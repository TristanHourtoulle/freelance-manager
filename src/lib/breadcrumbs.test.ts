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

  it("stops at the id-less parent for client detail without a resolved label", () => {
    expect(deriveCrumbs("/clients/abc123")).toEqual([
      "FreelanceManager",
      "Clients",
    ])
  })

  it("uses the resolved client name as the last crumb", () => {
    expect(deriveCrumbs("/clients/abc123", "Marie Dupont")).toEqual([
      "FreelanceManager",
      "Clients",
      "Marie Dupont",
    ])
  })

  it("ignores a resolved label on a top-level route", () => {
    expect(deriveCrumbs("/clients", "Marie Dupont")).toEqual([
      "FreelanceManager",
      "Clients",
    ])
  })

  it("uses the design wording for the new invoice route", () => {
    expect(deriveCrumbs("/billing/new")).toEqual([
      "FreelanceManager",
      "Factures",
      "Nouvelle",
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
