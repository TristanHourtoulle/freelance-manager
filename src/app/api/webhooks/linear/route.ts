import { NextResponse } from "next/server"
import { z } from "zod/v4"

import { apiError } from "@/lib/api-utils"
import { prisma } from "@/lib/db"
import { env } from "@/lib/env"
import {
  clearLinearCaches,
  setLastWebhookReceivedAt,
} from "@/lib/linear-service"
import {
  linearWebhookPayloadSchema,
  verifyLinearWebhookSignature,
} from "@/lib/linear-webhook"

/**
 * POST /api/webhooks/linear
 * Handles incoming Linear webhook events. Verifies the signature, clears
 * caches on issue events, and deletes overrides when issues are removed.
 * @returns 200 - `{ success: true }`
 * @throws 401 - Missing or invalid webhook signature
 * @throws 400 - Malformed JSON or invalid payload
 */
export async function POST(request: Request): Promise<NextResponse> {
  try {
    const rawBody = await request.text()
    const signature = request.headers.get("linear-signature")

    if (!env.LINEAR_WEBHOOK_SECRET) {
      return apiError(
        "WEBHOOK_NOT_CONFIGURED",
        "Webhook secret is not configured",
        500,
      )
    }

    if (!signature) {
      return apiError(
        "WEBHOOK_MISSING_SIGNATURE",
        "Missing linear-signature header",
        401,
      )
    }

    const isValid = verifyLinearWebhookSignature(
      rawBody,
      signature,
      env.LINEAR_WEBHOOK_SECRET,
    )

    if (!isValid) {
      return apiError(
        "WEBHOOK_INVALID_SIGNATURE",
        "Invalid webhook signature",
        401,
      )
    }

    const body: unknown = JSON.parse(rawBody)
    const payload = linearWebhookPayloadSchema.parse(body)

    if (payload.type !== "Issue") {
      return NextResponse.json({ success: true })
    }

    clearLinearCaches()

    if (payload.action === "remove") {
      await prisma.taskOverride.deleteMany({
        where: { linearIssueId: payload.data.id },
      })
    }

    setLastWebhookReceivedAt(Date.now())

    return NextResponse.json({ success: true })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return apiError(
        "VAL_INVALID_INPUT",
        "Invalid webhook payload",
        400,
        error.issues,
      )
    }

    if (error instanceof SyntaxError) {
      return apiError("VAL_INVALID_INPUT", "Malformed JSON body", 400)
    }

    return apiError("SYS_INTERNAL_ERROR", "Internal server error", 500)
  }
}
