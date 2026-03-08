import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod/v4"

/**
 * Verifies a Linear webhook signature using HMAC-SHA256 with timing-safe comparison.
 *
 * @param rawBody - The raw request body string
 * @param signature - The signature from the `Linear-Signature` header
 * @param secret - The webhook signing secret
 * @returns `true` if the signature is valid
 */
export function verifyLinearWebhookSignature(
  rawBody: string,
  signature: string,
  secret: string,
): boolean {
  const computed = createHmac("sha256", secret).update(rawBody).digest("hex")

  const sigBuffer = Buffer.from(signature, "utf8")
  const computedBuffer = Buffer.from(computed, "utf8")

  if (sigBuffer.length !== computedBuffer.length) {
    return false
  }

  return timingSafeEqual(sigBuffer, computedBuffer)
}

/** Validation schema for incoming Linear webhook payloads. */
export const linearWebhookPayloadSchema = z
  .object({
    action: z.enum(["create", "update", "remove"]),
    type: z.string(),
    data: z
      .object({
        id: z.string(),
      })
      .passthrough(),
  })
  .passthrough()

export type LinearWebhookPayload = z.infer<typeof linearWebhookPayloadSchema>
