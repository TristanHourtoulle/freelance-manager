import { spawn, type ChildProcess } from "node:child_process"
import { readFileSync, writeFileSync } from "node:fs"
import path from "node:path"
import type { TestProject } from "vitest/node"
import {
  PostgreSqlContainer,
  type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql"
import { getFreePort } from "@/test/integration/get-free-port"
import { migrateSchema, withSchema } from "@/test/integration/db"

declare module "vitest" {
  export interface ProvidedContext {
    integrationPostgresUrl: string
    invoicesServerUrl: string
    invoicesSchemaUrl: string
    invoicesSchemaName: string
  }
}

const INVOICES_SERVER_SCHEMA = "e2e_invoices_server"

const TSCONFIG_PATH = path.resolve(process.cwd(), "tsconfig.json")

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

/**
 * Global setup for the `integration` Vitest project.
 *
 * Starts one throwaway PostgreSQL container (via testcontainers) for the
 * entire integration run and a real `next dev` server bound to its own
 * private schema, so `GET /api/invoices` can be tested end-to-end through
 * a genuine `"use cache"` boundary — something a bare `vitest` process can
 * never exercise, since the cache wrapper Decimal values must survive is
 * injected by Next's own compiler, not present in the hand-written source.
 *
 * Other integration test files never need the server: they get their own
 * private schema straight off `integrationPostgresUrl` via
 * {@link import("./src/test/integration/db").createIsolatedSchema}.
 *
 * The server runs against its own `.next-integration` build directory
 * (`INTEGRATION_TEST_SERVER=1`, read by `next.config.ts`) so it never
 * touches the real `.next` dev cache. It still rewrites the tracked
 * `tsconfig.json` on boot (stock Next.js behaviour, unrelated to that
 * separate build directory), so this snapshots the file first and restores
 * it verbatim in {@link teardown}.
 *
 * @param project - The Vitest project, used to `provide()` connection
 *   details to every integration test file via `inject()`.
 */
export async function setup(project: TestProject): Promise<void> {
  try {
    container = await new PostgreSqlContainer("postgres:16-alpine")
      .withDatabase("integration")
      .withUsername("integration")
      .withPassword("integration")
      .start()

    const baseUrl = container.getConnectionUri()
    const schemaUrl = migrateSchema(baseUrl, INVOICES_SERVER_SCHEMA)
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
          DATABASE_URL: schemaUrl,
          NEXT_PUBLIC_APP_URL: serverUrl,
          PORT: String(port),
          INTEGRATION_TEST_SERVER: "1",
        },
        stdio: "pipe",
        detached: true,
      },
    )
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
    project.provide(
      "invoicesSchemaUrl",
      withSchema(baseUrl, INVOICES_SERVER_SCHEMA),
    )
    project.provide("invoicesSchemaName", INVOICES_SERVER_SCHEMA)
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
  if (tsconfigSnapshot !== undefined) {
    writeFileSync(TSCONFIG_PATH, tsconfigSnapshot)
  }
  await container?.stop()
}
