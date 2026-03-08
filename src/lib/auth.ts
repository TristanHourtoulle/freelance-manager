import { betterAuth } from "better-auth"
import { prismaAdapter } from "better-auth/adapters/prisma"
import { prisma } from "@/lib/db"

const trustedOrigins = process.env.NEXT_PUBLIC_APP_URL
  ? [process.env.NEXT_PUBLIC_APP_URL]
  : []

/** Server-side Better Auth instance configured with Prisma adapter and email/password. */
export const auth = betterAuth({
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  secret: process.env.BETTER_AUTH_SECRET,
  trustedOrigins,
})
