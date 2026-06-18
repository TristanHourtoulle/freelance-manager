import { z } from "zod/v4"

const PLACEHOLDER_SECRETS = new Set([
  "your-secret-key-here",
  "changeme",
  "change-me",
])

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET must be at least 32 chars (256-bit minimum)")
    .refine(
      (v) => !PLACEHOLDER_SECRETS.has(v),
      "BETTER_AUTH_SECRET still has its placeholder value — generate a real secret with: openssl rand -hex 32",
    ),
  LINEAR_API_TOKEN: z.string().min(1).optional(),
  LINEAR_WEBHOOK_SECRET: z.string().min(1).optional(),
  LINEAR_CACHE_TTL_SECONDS: z.coerce.number().positive().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url(),
  ENCRYPTION_KEY: z
    .string()
    .length(
      64,
      "ENCRYPTION_KEY must be 64 hex chars (32 bytes). Generate with: openssl rand -hex 32",
    ),
  CRON_SECRET: z.string().min(1).optional(),
  TRUST_PROXY: z.coerce.boolean().default(false),
  HEALTH_KEY: z.string().min(16).optional(),
})

/** Validated environment variables. Throws at startup if any required variable is missing. */
export const env = envSchema.parse(process.env)
