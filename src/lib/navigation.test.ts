import { describe, expect, it } from "vitest"
import { NAV_SECTIONS } from "./navigation"

describe("NAV_SECTIONS", () => {
  it("exposes a Suivi entry that points at /suivi with no badge", () => {
    const items = NAV_SECTIONS.flatMap((s) => s.items)
    const suivi = items.find((i) => i.href === "/suivi")

    expect(suivi).toBeDefined()
    expect(suivi?.id).toBe("suivi")
    expect(suivi?.label).toBe("Suivi")
    expect(suivi?.badgeKey).toBeUndefined()
  })
})
