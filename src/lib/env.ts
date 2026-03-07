import { z } from "zod/v4"

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(1),
  LINEAR_API_TOKEN: z.string().min(1),
  LINEAR_WEBHOOK_SECRET: z.string().min(1).optional(),
  LINEAR_CACHE_TTL_SECONDS: z.coerce.number().positive().optional(),
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),
})

export const env = envSchema.parse(process.env)
