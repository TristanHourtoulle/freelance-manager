import { describe, expect, it } from "vitest"
import {
  getTaskProvider,
  isTaskProviderId,
  listTaskProviders,
  UnknownTaskProviderError,
} from "@/lib/task-sync/registry"

describe("task provider registry", () => {
  it("exposes Linear through the generic provider contract", () => {
    const provider = getTaskProvider("linear")

    expect(provider.id).toBe("linear")
    expect(provider.displayName).toBe("Linear")
    expect(provider.countMappings).toBeTypeOf("function")
    expect(provider.sync).toBeTypeOf("function")
  })

  it("lists registered providers without leaking the mutable registry", () => {
    expect(listTaskProviders().map(({ id }) => id)).toEqual(["linear"])
  })

  it("rejects unknown provider ids at the boundary", () => {
    expect(isTaskProviderId("linear")).toBe(true)
    expect(isTaskProviderId("github")).toBe(false)
    expect(() => getTaskProvider("github")).toThrow(UnknownTaskProviderError)
  })
})
