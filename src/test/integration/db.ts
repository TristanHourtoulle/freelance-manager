import { randomUUID } from "node:crypto"
import { execFileSync } from "node:child_process"
import { Client as PgClient } from "pg"
import { PrismaPg } from "@prisma/adapter-pg"
import { Prisma, PrismaClient } from "@/generated/prisma/client"

export interface IsolatedSchema {
  schema: string
  url: string
  prisma: PrismaClient
}

/**
 * Point a base Postgres connection string at one namespace, both for the
 * `pg` driver (`options=-c search_path=…`, honoured by every `pg.Pool`
 * connection at the wire level) and for Prisma's own migration engine
 * (`schema=…`, which it also uses to auto-create the schema on deploy).
 * Passing both in the same URL is safe: each consumer only reads the
 * parameter it recognizes and ignores the other.
 *
 * @param baseUrl - The container's root connection string.
 * @param schema - The Postgres schema/namespace to target.
 * @returns A connection string scoped to that schema.
 */
export function withSchema(baseUrl: string, schema: string): string {
  const url = new URL(baseUrl)
  url.searchParams.set("schema", schema)
  url.searchParams.set("options", `-c search_path=${schema}`)
  return url.toString()
}

/**
 * Point a base Postgres connection string at a different database on the
 * same server, by replacing the URL's path segment. Unlike
 * {@link withSchema}, this needs no query-param parsing on the application
 * side: both `pg` and Prisma's migration engine already read the database
 * name straight off the connection string, which is what lets the spawned
 * `next dev` integration server run against a private database with zero
 * test-only code in `src/lib/db.ts`.
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
 * Provision a throwaway database and replay every migration into it — the
 * database-level equivalent of {@link migrateSchema}. Used once per
 * integration run for the single spawned `next dev` server, which cannot be
 * mocked and so needs its own private database (never spawned per test
 * file, so the extra `CREATE DATABASE` never contends with per-file schema
 * provisioning).
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
 * Generate a short, collision-resistant schema name for one test file's
 * private namespace.
 *
 * @param prefix - A short label identifying the caller, kept in the name
 *   for easier debugging inside `psql`.
 */
export function randomSchemaName(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, "").slice(0, 20)}`
}

/**
 * Replay every migration into a schema, creating it first if needed —
 * `prisma migrate deploy` auto-creates the Postgres schema named by the
 * connection string's `schema` parameter.
 *
 * @param baseUrl - The container's root connection string.
 * @param schema - The schema to migrate into.
 * @returns The schema-scoped connection string, ready for a Prisma client.
 */
export function migrateSchema(baseUrl: string, schema: string): string {
  const url = withSchema(baseUrl, schema)
  execFileSync("pnpm", ["exec", "prisma", "migrate", "deploy"], {
    env: { ...process.env, DATABASE_URL: url },
    stdio: "pipe",
  })
  return url
}

/**
 * Provision a private, fully-migrated Postgres schema and a `PrismaClient`
 * bound to it. Used by integration test files that own their data
 * end-to-end (as opposed to the shared `next dev` server schema), so
 * running several such files concurrently never shares a namespace and
 * truncating between tests in one file can never affect another.
 *
 * @param baseUrl - The container's root connection string (from
 *   `inject("integrationPostgresUrl")`).
 * @param prefix - A short label for the schema name, for debuggability.
 */
export function createIsolatedSchema(
  baseUrl: string,
  prefix: string,
): IsolatedSchema {
  const schema = randomSchemaName(prefix)
  const url = migrateSchema(baseUrl, schema)
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: url }, { schema }),
  })
  return { schema, url, prisma }
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
 * Drop a private schema and disconnect its client at the end of a test
 * file. Not required for the container to be reclaimed (the whole
 * container is destroyed in the integration project's global teardown),
 * but keeps a long-lived run tidy.
 *
 * @param prisma - The client connected to `schema`.
 * @param schema - The schema to drop.
 */
export async function dropIsolatedSchema(
  prisma: PrismaClient,
  schema: string,
): Promise<void> {
  await prisma.$executeRaw`DROP SCHEMA IF EXISTS ${Prisma.raw(`"${schema}"`)} CASCADE`
  await prisma.$disconnect()
}
