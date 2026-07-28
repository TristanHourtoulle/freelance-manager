import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  buildBillabilityUpdate,
  isPipelineEligible,
  NON_BILLABLE_REASON_LABELS,
  PIPELINE_TASK_WHERE,
  validateBillability,
} from "./billability"

describe("validateBillability", () => {
  it("accepts a billable task with no reason and no note", () => {
    expect(
      validateBillability({
        billable: true,
        nonBillableReason: null,
        nonBillableNote: null,
      }),
    ).toEqual({ ok: true })
  })

  it("rejects a billable task carrying a reason", () => {
    expect(
      validateBillability({
        billable: true,
        nonBillableReason: "COMMERCIAL_GESTURE",
        nonBillableNote: null,
      }),
    ).toEqual({
      ok: false,
      error: "A billable task cannot carry a non-billable reason",
    })
  })

  it("rejects a billable task carrying a note", () => {
    expect(
      validateBillability({
        billable: true,
        nonBillableReason: null,
        nonBillableNote: "left over",
      }),
    ).toEqual({
      ok: false,
      error: "A billable task cannot carry a non-billable note",
    })
  })

  it("rejects a non-billable task without a reason", () => {
    expect(
      validateBillability({
        billable: false,
        nonBillableReason: null,
        nonBillableNote: null,
      }),
    ).toEqual({ ok: false, error: "A non-billable task requires a reason" })
  })

  it("accepts a non-billable task with a structured reason and no note", () => {
    expect(
      validateBillability({
        billable: false,
        nonBillableReason: "BUG_FIX_ALREADY_INVOICED",
        nonBillableNote: null,
      }),
    ).toEqual({ ok: true })
  })

  it("accepts a non-billable task with a structured reason and a note", () => {
    expect(
      validateBillability({
        billable: false,
        nonBillableReason: "NON_BILLED_WORK",
        nonBillableNote: "internal tooling",
      }),
    ).toEqual({ ok: true })
  })

  it("rejects the OTHER reason without a note", () => {
    expect(
      validateBillability({
        billable: false,
        nonBillableReason: "OTHER",
        nonBillableNote: null,
      }),
    ).toEqual({
      ok: false,
      error: "The OTHER reason requires a non-empty note",
    })
  })

  it("rejects the OTHER reason with a whitespace-only note", () => {
    expect(
      validateBillability({
        billable: false,
        nonBillableReason: "OTHER",
        nonBillableNote: "   ",
      }),
    ).toEqual({
      ok: false,
      error: "The OTHER reason requires a non-empty note",
    })
  })

  it("accepts the OTHER reason with a real note", () => {
    expect(
      validateBillability({
        billable: false,
        nonBillableReason: "OTHER",
        nonBillableNote: "goodwill after outage",
      }),
    ).toEqual({ ok: true })
  })
})

describe("buildBillabilityUpdate", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-07-28T10:00:00.000Z"))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("stamps nonBillableAt and stores the trimmed note when flipping to non-billable", () => {
    expect(
      buildBillabilityUpdate({
        billable: false,
        nonBillableReason: "OTHER",
        nonBillableNote: "  goodwill after outage  ",
      }),
    ).toEqual({
      billable: false,
      nonBillableReason: "OTHER",
      nonBillableNote: "goodwill after outage",
      nonBillableAt: new Date("2026-07-28T10:00:00.000Z"),
    })
  })

  it("stores a null note when flipping to non-billable without one", () => {
    expect(
      buildBillabilityUpdate({
        billable: false,
        nonBillableReason: "COMMERCIAL_GESTURE",
        nonBillableNote: null,
      }),
    ).toEqual({
      billable: false,
      nonBillableReason: "COMMERCIAL_GESTURE",
      nonBillableNote: null,
      nonBillableAt: new Date("2026-07-28T10:00:00.000Z"),
    })
  })

  it("clears reason, note and timestamp when flipping back to billable", () => {
    expect(
      buildBillabilityUpdate({
        billable: true,
        nonBillableReason: null,
        nonBillableNote: null,
      }),
    ).toEqual({
      billable: true,
      nonBillableReason: null,
      nonBillableNote: null,
      nonBillableAt: null,
    })
  })
})

describe("PIPELINE_TASK_WHERE", () => {
  it("builds the canonical pipeline gate for a user", () => {
    expect(PIPELINE_TASK_WHERE("user_1")).toEqual({
      userId: "user_1",
      status: "PENDING_INVOICE",
      invoiceId: null,
      billable: true,
      client: { archivedAt: null, category: "FREELANCE" },
    })
  })
})

describe("isPipelineEligible", () => {
  const eligibleTask = {
    status: "PENDING_INVOICE",
    invoiceId: null,
    billable: true,
  } as const
  const eligibleClient = { archivedAt: null, category: "FREELANCE" } as const

  it("accepts a billable pending task of an active freelance client", () => {
    expect(isPipelineEligible(eligibleTask, eligibleClient)).toBe(true)
  })

  it("rejects a task that is not pending invoice", () => {
    expect(
      isPipelineEligible({ ...eligibleTask, status: "DONE" }, eligibleClient),
    ).toBe(false)
  })

  it("rejects a task already attached to an invoice", () => {
    expect(
      isPipelineEligible(
        { ...eligibleTask, invoiceId: "inv_1" },
        eligibleClient,
      ),
    ).toBe(false)
  })

  it("rejects a non-billable task", () => {
    expect(
      isPipelineEligible({ ...eligibleTask, billable: false }, eligibleClient),
    ).toBe(false)
  })

  it("rejects a task of an archived client", () => {
    expect(
      isPipelineEligible(eligibleTask, {
        ...eligibleClient,
        archivedAt: new Date("2026-01-01"),
      }),
    ).toBe(false)
  })

  it("rejects a task of a non-freelance client", () => {
    expect(
      isPipelineEligible(eligibleTask, {
        ...eligibleClient,
        category: "PERSONAL",
      }),
    ).toBe(false)
  })
})

describe("NON_BILLABLE_REASON_LABELS", () => {
  it("maps every reason to its French label", () => {
    expect(NON_BILLABLE_REASON_LABELS).toEqual({
      BUG_FIX_ALREADY_INVOICED: "Bug déjà facturé",
      NON_BILLED_WORK: "Travail non facturé",
      COMMERCIAL_GESTURE: "Geste commercial",
      OTHER: "Autre",
    })
  })
})
