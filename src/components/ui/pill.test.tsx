import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { StatusPill, taskStatusToPill } from "./pill"

describe("StatusPill", () => {
  it("labels a done task as Terminée", () => {
    const { container } = render(<StatusPill status="done" />)
    expect(container.textContent).toBe("Terminée")
  })

  it("labels a pending_invoice task as À facturer", () => {
    const { container } = render(<StatusPill status="pending_invoice" />)
    expect(container.textContent).toBe("À facturer")
  })
})

describe("taskStatusToPill", () => {
  it("maps DONE to done", () => {
    expect(taskStatusToPill("DONE")).toBe("done")
  })

  it("maps PENDING_INVOICE to pending_invoice", () => {
    expect(taskStatusToPill("PENDING_INVOICE")).toBe("pending_invoice")
  })

  it("maps CANCELED to backlog", () => {
    expect(taskStatusToPill("CANCELED")).toBe("backlog")
  })
})
