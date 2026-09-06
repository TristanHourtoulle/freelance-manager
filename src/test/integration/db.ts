import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import path from "node:path"
import { Client as PgClient } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "@/generated/prisma/client"

export interface IsolatedSchema {
  schema: string
  url: string
  prisma: PrismaClient
}

/**
 * Name of the database migrated exactly once, in the integration project's
 * `globalSetup`, and never connected to afterwards. Every call to
 * {@link createIsolatedSchema} clones this database with `CREATE DATABASE
 * ... TEMPLATE ...` instead of replaying migrations, which is what removes
 * `prisma migrate deploy`'s global, non-configurable 10s advisory-lock wait
 * from the per-test-file path entirely — the lock is now taken at most once
 * for the whole run instead of once per file.
 */
export const ISOLATION_TEMPLATE_DATABASE = "e2e_isolation_template"

const CLONE_DATABASE_CLI = path.resolve(
  process.cwd(),
  "src/test/integration/clone-database-cli.ts",
)

const isolatedDatabases = new WeakMap<
  PrismaClient,
  { database: string; adminUrl: string }
>()

/**
 * Point a base Postgres connection string at a different database on the
 * same server, by replacing the URL's path segment. Both `pg` and Prisma's
 * migration engine already read the database name straight off the
 * connection string, which is what lets the spawned `next dev` integration
 * server — and every {@link createIsolatedSchema} clone — run against a
 * private database with zero test-only code in `src/lib/db.ts`.
 *
 * @param baseUrl - The container's root connection string.
 * @param database - The database name to target.
 * @returns A connection string pointed at that database.
 */
export function withDatabase(baseUrl: string, database: string): string {
  const url = new URL(baseUrl)
  url.pathname = `/${database}`
  return url.toString()
}

/**
 * Create a new, empty database on the same Postgres server as `baseUrl`.
 * Unlike a schema, `prisma migrate deploy` cannot create a database on its
 * own, so this issues the `CREATE DATABASE` itself over a plain `pg`
 * connection before migrations run.
 *
 * @param baseUrl - A connection string to any existing database on the
 *   target server, used only to open the administrative connection.
 * @param database - The name of the database to create.
 */
export async function createDatabase(
  baseUrl: string,
  database: string,
): Promise<void> {
  const client = new PgClient({ connectionString: baseUrl })
  await client.connect()
  try {
    await client.query(`CREATE DATABASE "${database}"`)
  } finally {
    await client.end()
  }
}

/**
 * Provision a throwaway database and replay every migration into it. Used
 * once per integration run for the single spawned `next dev` server, which
 * cannot be mocked and so needs its own private database, and once more for
 * {@link ISOLATION_TEMPLATE_DATABASE} — the only two `prisma migrate deploy`
 * invocations in the whole suite, both from `globalSetup`, so they never
 * contend with each other or with any test file.
 *
 * @param baseUrl - The container's root connection string.
 * @param database - The database to create and migrate.
 * @returns The database-scoped connection string, ready to hand to the
 *   spawned server as its `DATABASE_URL`.
 */
export async function migrateDatabase(
  baseUrl: string,
  database: string,
): Promise<string> {
  await createDatabase(baseUrl, database)
  const url = withDatabase(baseUrl, database)
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  })
  return url
}

/**
 * Clone a database from a template with `CREATE DATABASE ... TEMPLATE ...`
 * — a physical, block-level copy performed entirely by Postgres itself, so
 * it reproduces the source exactly (enums, constraints, indexes, defaults,
 * sequences) with no risk of the clone drifting from a hand-rolled
 * structure-copy missing one of them. Requires no other session connected
 * to `template` at the moment of the call, which holds here because nothing
 * ever reconnects to {@link ISOLATION_TEMPLATE_DATABASE} after it is
 * migrated once in `globalSetup`.
 *
 * @param baseUrl - A connection string to any existing database on the
 *   target server, used only to open the administrative connection.
 * @param database - The name of the database to create.
 * @param template - The name of the already-migrated database to clone.
 */
export async function cloneDatabase(
  baseUrl: string,
  database: string,
  template: string,
): Promise<void> {
  const client = new PgClient({ connectionString: baseUrl })
  await client.connect()
  try {
    await client.query(`CREATE DATABASE "${database}" TEMPLATE "${template}"`)
  } finally {
    await client.end()
  }
}

/**
 * Generate a short, collision-resistant name for one test file's private
 * database.
 *
 * @param prefix - A short label identifying the caller, kept in the name
 *   for easier debugging inside `psql -l`.
 */
export function randomDatabaseName(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`
}

/**
 * Run {@link cloneDatabase} synchronously, by shelling out to
 * {@link CLONE_DATABASE_CLI} — needed because {@link createIsolatedSchema}
 * itself must stay synchronous (every call site assigns its return value
 * without `await`, matching a plain, non-async `beforeAll`), the same
 * constraint that made the old implementation call `prisma migrate deploy`
 * through `execFileSync` rather than the Prisma Migrate API directly.
 *
 * @param baseUrl - The container's root connection string.
 * @param database - The name of the database to create.
 * @param template - The name of the already-migrated database to clone.
 */
function cloneDatabaseSync(
  baseUrl: string,
  database: string,
  template: string,
): void {
  execFileSync(
    "pnpm",
    ["exec", "tsx", CLONE_DATABASE_CLI, baseUrl, database, template],
    { stdio: "pipe" },
  )
}

/**
 * Provision a private, fully-migrated database and a `PrismaClient` bound
 * to it, by cloning {@link ISOLATION_TEMPLATE_DATABASE} instead of replaying
 * migrations. Used by integration test files that own their data
 * end-to-end (as opposed to the shared `next dev` server database), so
 * running several such files concurrently never shares a namespace and
 * truncating between tests in one file can never affect another.
 *
 * The returned `schema` is always `"public"`: every clone is its own
 * database rather than a namespace inside a shared one, so its tables live
 * in that database's default schema — which is what {@link truncateAll} and
 * any test file building schema-qualified raw SQL from `ctx.schema` expect.
 * The private database name (still useful for `psql -l` debugging) is kept
 * internally instead, to hand back to {@link dropIsolatedSchema}.
 *
 * @param baseUrl - The container's root connection string (from
 *   `inject("integrationPostgresUrl")`).
 * @param prefix - A short label for the database name, for debuggability.
 */
export function createIsolatedSchema(
  baseUrl: string,
  prefix: string,
): IsolatedSchema {
  const database = randomDatabaseName(prefix)
  cloneDatabaseSync(baseUrl, database, ISOLATION_TEMPLATE_DATABASE)
  const url = withDatabase(baseUrl, database)
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }),
  })
  isolatedDatabases.set(prisma, { database, adminUrl: baseUrl })
  return { schema: "public", url, prisma }
}

/**
 * Empty every table in a schema between tests, so each `it()` starts from a
 * known, empty state without re-running migrations. Scoped to one schema by
 * construction (`pg_tables` is filtered to it), so this is safe to run from
 * several test files in parallel as long as each owns a distinct schema.
 *
 * @param prisma - A client connected to `schema`.
 * @param schema - The schema whose tables should be emptied.
 */
export async function truncateAll(
  prisma: PrismaClient,
  schema: string,
): Promise<void> {
  const tables = await prisma.$queryRaw<
    { tablename: string }[]
  >`select tablename from pg_tables where schemaname = ${schema}`
  const names = tables
    .map((t) => t.tablename)
    .filter((name) => name !== "_prisma_migrations")
  if (names.length === 0) return
  const quoted = names.map((name) => `"${schema}"."${name}"`).join(", ")
  await prisma.$executeRaw`TRUNCATE TABLE ${Prisma.raw(quoted)} RESTART IDENTITY CASCADE`
}

/**
 * Disconnect an isolated context's client and drop its private database at
 * the end of a test file. Not required for the container to be reclaimed
 * (the whole container is destroyed in the integration project's global
 * teardown), but keeps a long-lived run tidy and bounds how many private
 * databases accumulate as more integration files land.
 *
 * @param prisma - The client returned by {@link createIsolatedSchema}.
 * @param schema - The value returned alongside it (always `"public"`),
 *   kept as a parameter so call sites do not need to change; only used here
 *   to produce a clear error if `prisma` was not one of that function's own
 *   clients.
 * @throws {Error} If `prisma` is not a client created by
 *   {@link createIsolatedSchema}, since there would then be no private
 *   database registered to drop.
 */
export async function dropIsolatedSchema(
  prisma: PrismaClient,
  schema: string,
): Promise<void> {
  const record = isolatedDatabases.get(prisma)
  await prisma.$disconnect()
  if (!record) {
    throw new Error(
      `dropIsolatedSchema: no isolated database registered for schema "${schema}" — pass the client returned by createIsolatedSchema`,
    )
  }
  const admin = new PgClient({ connectionString: record.adminUrl })
  await admin.connect()
  try {
    await admin.query(
      `DROP DATABASE IF EXISTS "${record.database}" WITH (FORCE)`,
    )
  } finally {
    await admin.end()
  }
  isolatedDatabases.delete(prisma)
}
