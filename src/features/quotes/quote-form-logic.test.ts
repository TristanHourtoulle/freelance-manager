import { describe, it, expect } from "vitest"
import {
  buildQuoteCreatePayload,
  buildQuoteUpdatePayload,
  lineFromTaskForQuote,
  quoteFormTotals,
  type QuoteFormState,
  type QuoteLineDraft,
} from "@/features/quotes/quote-form-logic"
import { quoteCreateSchema, quoteUpdateSchema } from "@/lib/schemas/quote"

function line(patch: Partial<QuoteLineDraft> = {}): QuoteLineDraft {
  return { key: "k1", taskId: null, label: "Ligne", qty: 1, rate: 100, ...patch }
}

function state(patch: Partial<QuoteFormState> = {}): QuoteFormState {
  return {
    clientId: "client-1",
    projectId: null,
    number: "",
    status: "DRAFT",
    issueDate: "2026-07-21",
    validUntil: "",
    externalUrl: "",
    notes: "",
    lines: [line()],
    ...patch,
  }
}

const task = {
  id: "task-1",
  linearIdentifier: "TRI-42",
  title: "Build the thing",
  estimate: 3,
}

describe("quoteFormTotals", () => {
  it("returns 0 for no lines", () => {
    expect(quoteFormTotals([])).toEqual({ subtotal: 0, total: 0 })
  })

  it("sums qty * rate across lines", () => {
    const totals = quoteFormTotals([
      { qty: 2, rate: 500 },
      { qty: 1, rate: 250 },
    ])
    expect(totals).toEqual({ subtotal: 1250, total: 1250 })
  })

  it("handles decimal qty and rate", () => {
    const totals = quoteFormTotals([{ qty: 2.5, rate: 120.5 }])
    expect(totals.subtotal).toBeCloseTo(301.25)
    expect(totals.total).toBeCloseTo(301.25)
  })
})

describe("lineFromTaskForQuote", () => {
  it("maps DAILY: qty = estimate days, rate = client rate", () => {
    const l = lineFromTaskForQuote(task, { billingMode: "DAILY", rate: 600 })
    expect(l).toEqual({
      taskId: "task-1",
      label: "[TRI-42] Build the thing",
      qty: 3,
      rate: 600,
    })
  })

  it("maps HOURLY: qty = estimate * 8 hours, rate = client rate", () => {
    const l = lineFromTaskForQuote(task, { billingMode: "HOURLY", rate: 90 })
    expect(l.qty).toBe(24)
    expect(l.rate).toBe(90)
    expect(l.label).toBe("[TRI-42] Build the thing")
  })

  it("maps FIXED: qty = 1, rate = 0", () => {
    const l = lineFromTaskForQuote(task, { billingMode: "FIXED", rate: 600 })
    expect(l.qty).toBe(1)
    expect(l.rate).toBe(0)
    expect(l.label).toBe("[TRI-42] Build the thing")
  })
})

describe("buildQuoteCreatePayload", () => {
  it("produces a payload that passes quoteCreateSchema", () => {
    const payload = buildQuoteCreatePayload(
      state({
        number: "D-2026-0007",
        projectId: "project-9",
        validUntil: "2026-08-30",
        externalUrl: "https://abby.fr/devis/123",
        notes: "Merci",
      }),
    )
    expect(() => quoteCreateSchema.parse(payload)).not.toThrow()
    const parsed = quoteCreateSchema.parse(payload)
    expect(parsed.clientId).toBe("client-1")
    expect(parsed.lines).toHaveLength(1)
  })

  it("empty custom number becomes undefined", () => {
    const payload = buildQuoteCreatePayload(state({ number: "  " }))
    expect(payload.number).toBeUndefined()
  })

  it("empty valid-until, external URL and notes become null", () => {
    const payload = buildQuoteCreatePayload(
      state({ validUntil: "", externalUrl: "", notes: "" }),
    )
    expect(payload.validUntil).toBeNull()
    expect(payload.externalUrl).toBeNull()
    expect(payload.notes).toBeNull()
    expect(() => quoteCreateSchema.parse(payload)).not.toThrow()
  })

  it("trims line labels and coerces amounts", () => {
    const payload = buildQuoteCreatePayload(
      state({ lines: [line({ label: "  Design  ", qty: 2, rate: 400 })] }),
    )
    expect(payload.lines[0]).toMatchObject({
      taskId: null,
      label: "Design",
      qty: 2,
      rate: 400,
    })
  })
})

describe("buildQuoteUpdatePayload", () => {
  it("produces a payload that passes quoteUpdateSchema", () => {
    const payload = buildQuoteUpdatePayload(
      state({
        status: "SENT",
        number: "D-2026-0007",
        validUntil: "2026-09-01",
        externalUrl: "https://abby.fr/devis/456",
      }),
    )
    expect(() => quoteUpdateSchema.parse(payload)).not.toThrow()
    expect("clientId" in payload).toBe(false)
  })

  it("empty optionals become null / undefined and still parse", () => {
    const payload = buildQuoteUpdatePayload(
      state({ status: "ACCEPTED", number: "", validUntil: "", externalUrl: "" }),
    )
    expect(payload.number).toBeUndefined()
    expect(payload.validUntil).toBeNull()
    expect(payload.externalUrl).toBeNull()
    expect(() => quoteUpdateSchema.parse(payload)).not.toThrow()
  })
})
