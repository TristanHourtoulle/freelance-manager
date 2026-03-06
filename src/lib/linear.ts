import { LinearClient } from "@linear/sdk"
import { env } from "@/lib/env"

const globalForLinear = globalThis as unknown as {
  linearClient: LinearClient | undefined
}

export const linearClient =
  globalForLinear.linearClient ??
  new LinearClient({ apiKey: env.LINEAR_API_TOKEN })

if (process.env.NODE_ENV !== "production")
  globalForLinear.linearClient = linearClient
