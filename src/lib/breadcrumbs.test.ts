import { describe, it, expect } from "vitest"
import { deriveCrumbs } from "@/lib/breadcrumbs"

describe("deriveCrumbs", () => {
  it("returns only the root for an empty path", () => {
    expect(deriveCrumbs("/")).toEqual(["FreelanceManager"])
  })

  it("maps a top-level route to its nav label", () => {
    expect(deriveCrumbs("/dashboard")).toEqual([
      "FreelanceManager",
      "Dashboard",
    ])
    expect(deriveCrumbs("/projects")).toEqual(["FreelanceManager", "Projets"])
    expect(deriveCrumbs("/settings")).toEqual(["FreelanceManager", "Réglages"])
  })

  it("appends a generic entity label for client detail", () => {
    expect(deriveCrumbs("/clients/abc123")).toEqual([
      "FreelanceManager",
      "Clients",
      "Fiche client",
    ])
  })

  it("uses the design wording for the new invoice route", () => {
    expect(deriveCrumbs("/billing/new")).toEqual([
      "FreelanceManager",
      "Factures",
      "Nouvelle facture",
    ])
  })

  it("falls back to a generic label for a nested invoice route", () => {
    expect(deriveCrumbs("/billing/inv_1/edit")).toEqual([
      "FreelanceManager",
      "Factures",
      "Facture",
    ])
  })

  it("stops at the root for an unknown segment", () => {
    expect(deriveCrumbs("/unknown/whatever")).toEqual(["FreelanceManager"])
  })

  it("ignores trailing slashes", () => {
    expect(deriveCrumbs("/tasks/")).toEqual(["FreelanceManager", "Tasks"])
  })
})
