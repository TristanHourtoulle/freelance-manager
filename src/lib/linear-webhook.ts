import { createHmac, timingSafeEqual } from "node:crypto"
import { z } from "zod/v4"

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
