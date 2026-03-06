import { describe, it, expect } from "vitest"
import { createLinearMappingSchema } from "./linear-mapping"

describe("createLinearMappingSchema", () => {
  it("accepts input with linearTeamId only", () => {
    const result = createLinearMappingSchema.safeParse({
      clientId: "client-123",
      linearTeamId: "team-001",
    })
    expect(result.success).toBe(true)
  })

  it("accepts input with linearProjectId only", () => {
    const result = createLinearMappingSchema.safeParse({
      clientId: "client-123",
      linearProjectId: "proj-001",
    })
    expect(result.success).toBe(true)
  })

  it("accepts input with both team and project", () => {
    const result = createLinearMappingSchema.safeParse({
      clientId: "client-123",
      linearTeamId: "team-001",
      linearProjectId: "proj-001",
    })
    expect(result.success).toBe(true)
  })

  it("rejects input with neither team nor project", () => {
    const result = createLinearMappingSchema.safeParse({
      clientId: "client-123",
    })
    expect(result.success).toBe(false)
  })

  it("rejects missing clientId", () => {
    const result = createLinearMappingSchema.safeParse({
      linearTeamId: "team-001",
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty clientId", () => {
    const result = createLinearMappingSchema.safeParse({
      clientId: "",
      linearTeamId: "team-001",
    })
    expect(result.success).toBe(false)
  })
})
