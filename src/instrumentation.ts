/**
 * Next.js instrumentation hook, invoked once per server instance at boot.
 * Loads the environment schema on the Node.js runtime so a missing or
 * malformed variable fails fast at startup instead of surfacing as a
 * runtime error. The import is dynamic so the module stays out of the
 * build graph and the schema is never parsed at build time.
 */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    await import("@/lib/env")
  }
}
