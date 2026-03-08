import { LinearClient } from "@linear/sdk"
import { env } from "@/lib/env"

const globalForLinear = globalThis as unknown as {
  linearClient: LinearClient | undefined
}

/** Singleton Linear SDK client. Reused across hot reloads in development. */
export const linearClient =
  globalForLinear.linearClient ??
  new LinearClient({ apiKey: env.LINEAR_API_TOKEN })

if (process.env.NODE_ENV !== "production")
  globalForLinear.linearClient = linearClient
