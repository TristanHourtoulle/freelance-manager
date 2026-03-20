import { LinearClient } from "@linear/sdk"
import { prisma } from "@/lib/db"
import { decrypt } from "@/lib/encryption"
import { TTLCache } from "@/lib/cache"

const clientCache = new TTLCache<LinearClient>(5 * 60 * 1000) // 5 min

/**
 * Returns a LinearClient for the given user.
 * Priority: 1) encrypted token in DB  2) env var LINEAR_API_TOKEN
 * Cached per-user for 5 minutes.
 */
export async function getLinearClient(userId: string): Promise<LinearClient> {
  const cached = clientCache.get(userId)
  if (cached) return cached

  // Try user's stored token first
  const settings = await prisma.userSettings.findUnique({
    where: { userId },
    select: { linearApiTokenEncrypted: true, linearApiTokenIv: true },
  })

  let apiKey: string | undefined

  if (settings?.linearApiTokenEncrypted && settings.linearApiTokenIv) {
    apiKey = decrypt(
      Buffer.from(settings.linearApiTokenEncrypted),
      Buffer.from(settings.linearApiTokenIv),
    )
  }

  // Fallback to env var
  if (!apiKey) {
    apiKey = process.env.LINEAR_API_TOKEN
    if (apiKey) {
      console.warn(
        "[Linear] Using shared LINEAR_API_TOKEN env var. Consider configuring per-user tokens for tenant isolation.",
      )
    }
  }

  if (!apiKey) {
    throw new Error(
      "No Linear API token configured. Add one in Settings > Integrations.",
    )
  }

  const client = new LinearClient({ apiKey })
  clientCache.set(userId, client)
  return client
}

/** Clears the cached LinearClient for a user (e.g. after token update). */
export function clearLinearClientCache(userId: string): void {
  clientCache.delete(userId)
}

/**
 * @deprecated Use getLinearClient(userId) instead.
 * Kept temporarily for backward compatibility during migration.
 * Throws at call-time if no LINEAR_API_TOKEN env var is set.
 */
function createLegacyClient(): LinearClient {
  const token = process.env.LINEAR_API_TOKEN
  if (!token) {
    throw new Error(
      "LINEAR_API_TOKEN env var is not set and no per-user token configured. Add a token in Settings > Integrations.",
    )
  }
  return new LinearClient({ apiKey: token })
}

const globalForLinear = globalThis as unknown as {
  _legacyLinearClient: LinearClient | undefined
}

export const linearClient: LinearClient =
  globalForLinear._legacyLinearClient ?? createLegacyClient()

if (process.env.NODE_ENV !== "production") {
  globalForLinear._legacyLinearClient = linearClient
}
