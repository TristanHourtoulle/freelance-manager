import { describe, expect, it } from "vitest"
import { z } from "zod/v4"
import { apiError, handleApiError } from "@/lib/api-utils"

describe("apiError", () => {
  it("returns structured error response", async () => {
    const response = apiError("CLIENT_NOT_FOUND", "Client not found", 404)
    const body = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({
      error: { code: "CLIENT_NOT_FOUND", message: "Client not found" },
    })
  })

  it("includes details when provided", async () => {
    const details = [{ path: ["name"], message: "Required" }]
    const response = apiError(
      "VAL_INVALID_INPUT",
      "Validation failed",
      400,
      details,
    )
    const body = await response.json()

    expect(body.error.details).toEqual(details)
  })

  it("omits details when not provided", async () => {
    const response = apiError(
      "SYS_INTERNAL_ERROR",
      "Internal server error",
      500,
    )
    const body = await response.json()

    expect(body.error).not.toHaveProperty("details")
  })
})

describe("handleApiError", () => {
  it("returns VAL_INVALID_INPUT for ZodError", async () => {
    const schema = z.object({ name: z.string() })
    let zodError: z.ZodError | undefined
    try {
      schema.parse({ name: 123 })
    } catch (error) {
      zodError = error as z.ZodError
    }

    const response = handleApiError(zodError!)
    const body = await response.json()

    expect(response.status).toBe(400)
    expect(body.error.code).toBe("VAL_INVALID_INPUT")
    expect(body.error.details).toBeDefined()
    expect(Array.isArray(body.error.details)).toBe(true)
  })

  it("returns SYS_INTERNAL_ERROR for unknown errors", async () => {
    const response = handleApiError(new Error("something broke"))
    const body = await response.json()

    expect(response.status).toBe(500)
    expect(body.error.code).toBe("SYS_INTERNAL_ERROR")
  })
})
