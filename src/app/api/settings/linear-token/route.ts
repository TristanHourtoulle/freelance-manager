import { LinearClient } from "@linear/sdk"
import { prisma } from "@/lib/db"
import { apiError, getAuthenticatedUser, handleApiError } from "@/lib/api-utils"
import { encrypt, decrypt, maskToken } from "@/lib/encryption"
import { clearLinearClientCache } from "@/lib/linear"
import { rateLimit } from "@/lib/rate-limit"
import { NextResponse } from "next/server"
import { z } from "zod/v4"

const saveTokenSchema = z.object({
  token: z.string().min(1).max(500),
})

/**
 * GET /api/settings/linear-token
 * Returns whether a Linear token is configured + masked preview.
 */
export async function GET(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const settings = await prisma.userSettings.findUnique({
      where: { userId: userOrError.id },
      select: { linearApiTokenEncrypted: true, linearApiTokenIv: true },
    })

    if (!settings?.linearApiTokenEncrypted || !settings.linearApiTokenIv) {
      return NextResponse.json({ configured: false, maskedToken: null })
    }

    try {
      const token = decrypt(
        Buffer.from(settings.linearApiTokenEncrypted),
        Buffer.from(settings.linearApiTokenIv),
      )
      return NextResponse.json({
        configured: true,
        maskedToken: maskToken(token),
      })
    } catch {
      return NextResponse.json({ configured: false, maskedToken: null })
    }
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * PUT /api/settings/linear-token
 * Validates the token against Linear API, encrypts, and stores it.
 */
export async function PUT(request: Request) {
  try {
    const rl = rateLimit(request, { limit: 5, windowMs: 60_000 })
    if (!rl.success) {
      return NextResponse.json(
        {
          error: { code: "RATE_LIMIT_EXCEEDED", message: "Too many requests" },
        },
        {
          status: 429,
          headers: { "Retry-After": String(Math.ceil(rl.reset / 1000)) },
        },
      )
    }

    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    const body: unknown = await request.json()
    const { token } = saveTokenSchema.parse(body)

    // Validate the token by making a test API call
    const testClient = new LinearClient({ apiKey: token })
    try {
      const viewer = await testClient.viewer
      if (!viewer?.id) {
        return apiError(
          "LINEAR_INVALID_TOKEN",
          "The token is invalid or does not have sufficient permissions.",
          400,
        )
      }
    } catch {
      return apiError(
        "LINEAR_INVALID_TOKEN",
        "Could not connect to Linear with this token. Please check it and try again.",
        400,
      )
    }

    // Encrypt and store
    const { ciphertext, iv } = encrypt(token)

    await prisma.userSettings.upsert({
      where: { userId: userOrError.id },
      create: {
        userId: userOrError.id,
        linearApiTokenEncrypted: new Uint8Array(ciphertext),
        linearApiTokenIv: new Uint8Array(iv),
      },
      update: {
        linearApiTokenEncrypted: new Uint8Array(ciphertext),
        linearApiTokenIv: new Uint8Array(iv),
      },
    })

    // Clear cached client so next request picks up new token
    clearLinearClientCache(userOrError.id)

    return NextResponse.json({
      configured: true,
      maskedToken: maskToken(token),
    })
  } catch (error) {
    return handleApiError(error)
  }
}

/**
 * DELETE /api/settings/linear-token
 * Removes the stored Linear token.
 */
export async function DELETE(request: Request) {
  try {
    const userOrError = await getAuthenticatedUser(request)
    if (userOrError instanceof NextResponse) return userOrError

    await prisma.userSettings.upsert({
      where: { userId: userOrError.id },
      create: { userId: userOrError.id },
      update: {
        linearApiTokenEncrypted: null,
        linearApiTokenIv: null,
      },
    })

    clearLinearClientCache(userOrError.id)

    return NextResponse.json({ configured: false, maskedToken: null })
  } catch (error) {
    return handleApiError(error)
  }
}
