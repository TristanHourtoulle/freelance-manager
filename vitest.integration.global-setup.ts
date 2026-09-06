import { spawn, type ChildProcess } from "node:child_process"
import { existsSync, readFileSync, unlinkSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { TestProject } from "vitest/node"
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql"
import { getFreePort } from "@/test/integration/get-free-port"
import { migrateDatabase } from "@/test/integration/db"

declare module "vitest" {
  export interface ProvidedContext {
    integrationPostgresUrl: string
    invoicesServerUrl: string
    invoicesDatabaseUrl: string
  }
}

const INVOICES_SERVER_DB = "e2e_invoices_server"

const TSCONFIG_PATH = path.resolve(process.cwd(), "tsconfig.json")

const PID_FILE = path.resolve(process.cwd(), ".integration-next-server.pid")

let container: StartedPostgreSqlContainer | undefined
let nextServer: ChildProcess | undefined
let tsconfigSnapshot: string | undefined

async function waitForServer(url: string, timeoutMs: number): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    try {
      await fetch(url, { signal: AbortSignal.timeout(2000) })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 500))
    }
  }
  throw new Error(`Next.js dev server did not become ready at ${url}`)
}

function killProcessGroupSync(pid: number): void {
  try {
    process.kill(-pid, "SIGKILL")
  } catch {
    try {
      process.kill(pid, "SIGKILL")
    } catch {}
  }
}

function reapOrphanedServer(): void {
  if (!existsSync(PID_FILE)) return
  const pid = Number(readFileSync(PID_FILE, "utf8").trim())
  if (Number.isInteger(pid) && pid > 0) killProcessGroupSync(pid)
  unlinkSync(PID_FILE)
}

function killServerAndCleanupSync(): void {
  const pid = nextServer?.pid
  if (pid) killProcessGroupSync(pid)
  if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
}

process.once("exit", killServerAndCleanupSync)
process.once("SIGINT", () => {
  killServerAndCleanupSync()
  process.exit(130)
})
process.once("SIGTERM", () => {
  killServerAndCleanupSync()
  process.exit(143)
})

/**
 * Global setup for the `integration` Vitest project.
 *
 * Starts one throwaway PostgreSQL container (via testcontainers) for the
 * entire integration run and a real `next dev` server bound to its own
 * private, purpose-created database, so `GET /api/invoices` can be tested
 * end-to-end through a genuine `"use cache"` boundary — something a bare
 * `vitest` process can never exercise, since the cache wrapper Decimal
 * values must survive is injected by Next's own compiler, not present in
 * the hand-written source.
 *
 * A dedicated database (rather than a schema on the shared one) means the
 * spawned server needs no test-only connection-string parsing in
 * `src/lib/db.ts`: both `pg` and Prisma's migration engine already resolve
 * the database name straight off the URL, so pointing `DATABASE_URL` at it
 * is enough for the app's own, unmodified Prisma singleton to find the
 * right tables in that database's default `public` schema. This costs one
 * extra `CREATE DATABASE` at the start of the whole run — negligible next
 * to the per-test-file schemas every other integration file provisions via
 * {@link import("./src/test/integration/db").createIsolatedSchema}, which
 * this does not touch or contend with.
 *
 * The server runs against its own `.next-integration` build directory
 * (`INTEGRATION_TEST_SERVER=1`, read by `next.config.ts`) so it never
 * touches the real `.next` dev cache. It still rewrites the tracked
 * `tsconfig.json` on boot (stock Next.js behaviour, unrelated to that
 * separate build directory), so this snapshots the file first and restores
 * it verbatim in {@link teardown}.
 *
 * The spawned server's pid is written to {@link PID_FILE} and reaped by a
 * following run's `reapOrphanedServer` call below, and killed synchronously
 * on `exit`/`SIGINT`/`SIGTERM` by the handlers registered at module load —
 * together these keep a `next dev` process from surviving this run under
 * any exit path short of an uncatchable `SIGKILL` or OOM, which the next
 * run's pid-file reap then cleans up instead. Ryuk already reclaims the
 * Postgres container in that scenario; nothing but this reclaims the plain
 * Node child process.
 *
 * @param project - The Vitest project, used to `provide()` connection
 *   details to every integration test file via `inject()`.
 */
export async function setup(project: TestProject): Promise<void> {
  try {
    reapOrphanedServer()

    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("integration")
      .withUsername("integration")
      .withPassword("integration")
      .start()

    const baseUrl = container.getConnectionUri()
    const databaseUrl = await migrateDatabase(baseUrl, INVOICES_SERVER_DB)
    const port = await getFreePort()
    const serverUrl = `http://127.0.0.1:${port}`

    tsconfigSnapshot = readFileSync(TSCONFIG_PATH, "utf8")

    const nextBin = path.resolve(process.cwd(), "node_modules/.bin/next")
    nextServer = spawn(
      nextBin,
      ["dev", "-p", String(port), "--hostname", "127.0.0.1"],
      {
        env: {
          ...process.env,
          DATABASE_URL: databaseUrl,
          NEXT_PUBLIC_APP_URL: serverUrl,
          PORT: String(port),
          INTEGRATION_TEST_SERVER: "1",
        },
        stdio: "pipe",
        detached: true,
      },
    )
    if (nextServer.pid) writeFileSync(PID_FILE, String(nextServer.pid))
    let serverLog = ""
    nextServer.stdout?.on("data", (chunk: Buffer) => {
      serverLog += chunk.toString()
    })
    nextServer.stderr?.on("data", (chunk: Buffer) => {
      serverLog += chunk.toString()
    })

    try {
      await waitForServer(serverUrl, 60_000)
    } catch (error) {
      console.error(serverLog)
      throw error
    }

    project.provide("integrationPostgresUrl", baseUrl)
    project.provide("invoicesServerUrl", serverUrl)
    project.provide("invoicesDatabaseUrl", databaseUrl)
  } catch (error) {
    await teardown()
    throw error
  }
}

export async function teardown(): Promise<void> {
  const server = nextServer
  const pid = server?.pid
  if (server && pid) {
    await new Promise<void>((resolve) => {
      server.once("exit", () => resolve())
      try {
        process.kill(-pid, "SIGTERM")
      } catch {
        server.kill("SIGTERM")
      }
      setTimeout(resolve, 5000)
    })
  }
  if (existsSync(PID_FILE)) unlinkSync(PID_FILE)
  if (tsconfigSnapshot !== undefined) {
    writeFileSync(TSCONFIG_PATH, tsconfigSnapshot)
  }
  await container?.stop()
}
