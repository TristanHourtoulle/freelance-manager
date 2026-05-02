import "server-only"
import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/db"

const trustedOrigins: string[] = []

if (process.env.NEXT_PUBLIC_APP_URL) {
  trustedOrigins.push(process.env.NEXT_PUBLIC_APP_URL)
}

if (process.env.NODE_ENV === "development") {
  trustedOrigins.push("http://localhost:*")
}

/**
 * Server-side Better Auth instance.
 *
 * - Email/password sign-in only.
 * - `disableSignUp: true` because this is a single-user perso app — public
 *   registration would let anyone fill the User table. To create a new
 *   account, run a one-shot script against the DB.
 * - Built-in `rateLimit` capped at 5 hits per 60s on /sign-in/email to
 *   defeat brute-force attacks. Other endpoints get the default rate limit.
 */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
    disableSignUp: true,
  },
  rateLimit: {
    enabled: true,
    window: 60,
    max: 30,
    customRules: {
      "/sign-in/email": { window: 60, max: 5 },
      "/sign-up/email": { window: 60, max: 3 },
    },
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
})
