import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { BillingTypePill, StatusPill, taskStatusToPill } from "./pill"

describe("StatusPill", () => {
  const cases = [
    ["pending_invoice", "À facturer"],
    ["done", "Done"],
    ["in_progress", "In Progress"],
    ["backlog", "Backlog"],
    ["draft", "Brouillon"],
    ["sent", "Envoyée"],
    ["paid", "Payée"],
    ["partial", "Partielle"],
    ["overpaid", "Trop-perçu"],
    ["overdue", "En retard"],
    ["cancelled", "Annulée"],
  ] as const

  it.each(cases)("labels %s as %s", (status, label) => {
    const { container } = render(<StatusPill status={status} />)
    expect(container.textContent).toBe(label)
  })
})

describe("BillingTypePill", () => {
  const cases = [
    ["DAILY", "TJM"],
    ["FIXED", "Forfait"],
    ["HOURLY", "Horaire"],
  ] as const

  it.each(cases)("labels %s as %s", (type, label) => {
    const { container } = render(<BillingTypePill type={type} />)
    expect(container.textContent).toBe(label)
  })
})

describe("taskStatusToPill", () => {
  it("maps DONE to done", () => {
    expect(taskStatusToPill("DONE")).toBe("done")
  })

  it("maps PENDING_INVOICE to pending_invoice", () => {
    expect(taskStatusToPill("PENDING_INVOICE")).toBe("pending_invoice")
  })

  it("maps IN_PROGRESS to in_progress", () => {
    expect(taskStatusToPill("IN_PROGRESS")).toBe("in_progress")
  })

  it("maps BACKLOG to backlog", () => {
    expect(taskStatusToPill("BACKLOG")).toBe("backlog")
  })

  it("maps CANCELED to backlog", () => {
    expect(taskStatusToPill("CANCELED")).toBe("backlog")
  })
})
