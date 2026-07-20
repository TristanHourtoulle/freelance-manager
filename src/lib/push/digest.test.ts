import { describe, expect, it } from "vitest"
import { buildDigestBody, DIGEST_TITLE } from "./digest"

describe("buildDigestBody", () => {
  it("returns null when every count is zero", () => {
    expect(
      buildDigestBody({ actions: 0, meetings: 0, overdueInvoices: 0 }),
    ).toBeNull()
  })

  it("renders the singular action segment", () => {
    expect(
      buildDigestBody({ actions: 1, meetings: 0, overdueInvoices: 0 }),
    ).toBe("1 action")
  })

  it("renders the plural action segment", () => {
    expect(
      buildDigestBody({ actions: 2, meetings: 0, overdueInvoices: 0 }),
    ).toBe("2 actions")
  })

  it("keeps RDV invariable in singular and plural", () => {
    expect(
      buildDigestBody({ actions: 0, meetings: 1, overdueInvoices: 0 }),
    ).toBe("1 RDV")
    expect(
      buildDigestBody({ actions: 0, meetings: 2, overdueInvoices: 0 }),
    ).toBe("2 RDV")
  })

  it("renders the overdue invoice segment in both numbers", () => {
    expect(
      buildDigestBody({ actions: 0, meetings: 0, overdueInvoices: 1 }),
    ).toBe("1 facture en retard")
    expect(
      buildDigestBody({ actions: 0, meetings: 0, overdueInvoices: 2 }),
    ).toBe("2 factures en retard")
  })

  it("joins the three segments in order", () => {
    expect(
      buildDigestBody({ actions: 3, meetings: 1, overdueInvoices: 2 }),
    ).toBe("3 actions, 1 RDV, 2 factures en retard")
  })

  it("omits zero segments instead of rendering them", () => {
    const body = buildDigestBody({
      actions: 0,
      meetings: 2,
      overdueInvoices: 1,
    })
    expect(body).toBe("2 RDV, 1 facture en retard")
    expect(body).not.toContain("0 ")
  })

  it("exposes the French digest title", () => {
    expect(DIGEST_TITLE).toBe("Aujourd'hui")
  })
})
