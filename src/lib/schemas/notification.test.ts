import { describe, expect, it } from "vitest"
import { notificationFilterSchema } from "./notification"

describe("notificationFilterSchema", () => {
  it("returns defaults for empty object", () => {
    const result = notificationFilterSchema.parse({})
    expect(result).toEqual({ unreadOnly: true, limit: 20 })
  })

  it("parses valid filter with all fields", () => {
    const result = notificationFilterSchema.parse({
      unreadOnly: "false",
      type: "BILLING_REMINDER",
      limit: "10",
    })
    expect(result).toEqual({
      unreadOnly: false,
      type: "BILLING_REMINDER",
      limit: 10,
    })
  })

  it("coerces string values", () => {
    const result = notificationFilterSchema.parse({
      unreadOnly: "true",
      limit: "50",
    })
    expect(result.unreadOnly).toBe(true)
    expect(result.limit).toBe(50)
  })

  it("rejects invalid notification type", () => {
    expect(() =>
      notificationFilterSchema.parse({ type: "INVALID_TYPE" }),
    ).toThrow()
  })

  it("rejects limit over 50", () => {
    expect(() => notificationFilterSchema.parse({ limit: "51" })).toThrow()
  })

  it("rejects negative limit", () => {
    expect(() => notificationFilterSchema.parse({ limit: "-1" })).toThrow()
  })
})
