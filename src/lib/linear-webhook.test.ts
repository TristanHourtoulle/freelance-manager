import { createHmac } from "node:crypto"
import { describe, expect, it } from "vitest"

import {
  linearWebhookPayloadSchema,
  verifyLinearWebhookSignature,
} from "./linear-webhook"

const TEST_SECRET = "whsec_test_secret_123"

function sign(body: string, secret: string = TEST_SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex")
}

describe("verifyLinearWebhookSignature", () => {
  const body = '{"action":"update","type":"Issue","data":{"id":"abc"}}'

  it("returns true for a valid signature", () => {
    const signature = sign(body)
    expect(verifyLinearWebhookSignature(body, signature, TEST_SECRET)).toBe(
      true,
    )
  })

  it("returns false for an invalid signature", () => {
    expect(
      verifyLinearWebhookSignature(body, "invalid_signature_hex", TEST_SECRET),
    ).toBe(false)
  })

  it("returns false when signature length differs from computed hash", () => {
    expect(verifyLinearWebhookSignature(body, "short", TEST_SECRET)).toBe(false)
  })

  it("returns false when body was tampered with", () => {
    const signature = sign(body)
    const tampered = '{"action":"remove","type":"Issue","data":{"id":"abc"}}'
    expect(verifyLinearWebhookSignature(tampered, signature, TEST_SECRET)).toBe(
      false,
    )
  })

  it("returns false when signed with a different secret", () => {
    const signature = sign(body, "wrong_secret")
    expect(verifyLinearWebhookSignature(body, signature, TEST_SECRET)).toBe(
      false,
    )
  })
})

describe("linearWebhookPayloadSchema", () => {
  it("parses a valid Issue create payload", () => {
    const result = linearWebhookPayloadSchema.parse({
      action: "create",
      type: "Issue",
      data: { id: "issue-1", title: "Test issue" },
    })

    expect(result.action).toBe("create")
    expect(result.type).toBe("Issue")
    expect(result.data.id).toBe("issue-1")
  })

  it("parses a valid Issue remove payload", () => {
    const result = linearWebhookPayloadSchema.parse({
      action: "remove",
      type: "Issue",
      data: { id: "issue-2" },
    })

    expect(result.action).toBe("remove")
    expect(result.data.id).toBe("issue-2")
  })

  it("allows extra fields via passthrough", () => {
    const result = linearWebhookPayloadSchema.parse({
      action: "update",
      type: "Issue",
      data: { id: "issue-3", extraField: true },
      organizationId: "org-1",
      webhookId: "wh-1",
    })

    expect(result.data.id).toBe("issue-3")
    expect((result as Record<string, unknown>).organizationId).toBe("org-1")
  })

  it("rejects invalid action", () => {
    expect(() =>
      linearWebhookPayloadSchema.parse({
        action: "invalid",
        type: "Issue",
        data: { id: "issue-1" },
      }),
    ).toThrow()
  })

  it("rejects missing data.id", () => {
    expect(() =>
      linearWebhookPayloadSchema.parse({
        action: "create",
        type: "Issue",
        data: {},
      }),
    ).toThrow()
  })

  it("rejects missing action", () => {
    expect(() =>
      linearWebhookPayloadSchema.parse({
        type: "Issue",
        data: { id: "issue-1" },
      }),
    ).toThrow()
  })
})
