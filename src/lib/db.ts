import "server-only"
import { PrismaClient } from "@/generated/prisma/client"
import { PrismaPg } from "@prisma/adapter-pg"

/**
 * Recommended DATABASE_URL query params in production:
 *
 *   ?sslmode=require                — TLS to Postgres
 *   &connection_limit=1             — one Prisma pool per lambda
 *   &pool_timeout=20                — fail fast under saturation
 *   &pgbouncer=true                 — disables prepared statements when
 *                                     fronting a transaction-mode pooler
 *   &application_name=freelance-... — visible in pg_stat_activity
 *
 * .env.example documents the full string.
 */
const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL,
})

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

/** Singleton Prisma client with PostgreSQL adapter. Reused across hot reloads in development. */
export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({ adapter, log: ["warn", "error"] })

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma
