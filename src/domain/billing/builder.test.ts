import { describe, expect, it } from "vitest"
import {
  buildLinesPayload,
  buildTaskIds,
  buildTaskLine,
  computeEffectiveTotal,
  computeSubtotal,
  filterEligibleTasks,
  type BuilderLine,
} from "./builder"

const task = {
  id: "t1",
  linearIdentifier: "TRI-1",
  title: "Ship it",
  estimate: 3,
}

describe("buildTaskLine", () => {
  it("seeds a DAILY line: qty = estimate days, rate = client rate", () => {
    const line = buildTaskLine("L1", { billingMode: "DAILY", rate: 500 }, task)
    expect(line).toEqual({
      id: "L1",
      taskId: "t1",
      label: "[TRI-1] Ship it",
      qty: 3,
      rate: 500,
    })
  })

  it("seeds an HOURLY line: qty = estimate * 8 hours, rate = client rate", () => {
    const line = buildTaskLine("L2", { billingMode: "HOURLY", rate: 80 }, task)
    expect(line).toMatchObject({ qty: 24, rate: 80 })
  })

  it("seeds a FIXED line: qty = 1, rate = 0 (filled manually)", () => {
    const line = buildTaskLine("L3", { billingMode: "FIXED", rate: 999 }, task)
    expect(line).toMatchObject({ qty: 1, rate: 0 })
  })

  it("defaults a null estimate to 1 day", () => {
    const line = buildTaskLine(
      "L4",
      { billingMode: "DAILY", rate: 400 },
      { ...task, estimate: null },
    )
    expect(line.qty).toBe(1)
  })
})

const eligibleTaskBase = {
  clientId: "c1",
  status: "PENDING_INVOICE",
  invoiceId: null as string | null,
  projectId: "p1",
  linearIdentifier: "TRI-10",
  title: "Feature",
}

function makeTasks() {
  return [
    { ...eligibleTaskBase, id: "a" },
    { ...eligibleTaskBase, id: "b", status: "DONE" },
    { ...eligibleTaskBase, id: "c", clientId: "other" },
    { ...eligibleTaskBase, id: "d", invoiceId: "inv-x" },
    { ...eligibleTaskBase, id: "e", invoiceId: "inv-self" },
    { ...eligibleTaskBase, id: "f", projectId: "p2" },
  ]
}

describe("filterEligibleTasks", () => {
  it("returns empty when no client is selected", () => {
    expect(
      filterEligibleTasks(makeTasks(), {
        clientId: "",
        lines: [],
        projectId: "all",
        search: "",
      }),
    ).toEqual([])
  })

  it("keeps only PENDING_INVOICE, same-client, unattached, unlisted tasks (create mode)", () => {
    const result = filterEligibleTasks(makeTasks(), {
      clientId: "c1",
      lines: [],
      projectId: "all",
      search: "",
    })
    expect(result.map((t) => t.id)).toEqual(["a", "f"])
  })

  it("excludes tasks already present in the builder lines", () => {
    const result = filterEligibleTasks(makeTasks(), {
      clientId: "c1",
      lines: [{ taskId: "a" }],
      projectId: "all",
      search: "",
    })
    expect(result.map((t) => t.id)).toEqual(["f"])
  })

  it("treats the edited invoice's own tasks as available via excludeInvoiceId", () => {
    const result = filterEligibleTasks(makeTasks(), {
      clientId: "c1",
      lines: [],
      projectId: "all",
      search: "",
      excludeInvoiceId: "inv-self",
    })
    expect(result.map((t) => t.id)).toEqual(["a", "e", "f"])
  })

  it("narrows by project", () => {
    const result = filterEligibleTasks(makeTasks(), {
      clientId: "c1",
      lines: [],
      projectId: "p2",
      search: "",
    })
    expect(result.map((t) => t.id)).toEqual(["f"])
  })

  it("narrows by case-insensitive search over identifier + title", () => {
    const tasks = [
      { ...eligibleTaskBase, id: "a", linearIdentifier: "TRI-10" },
      {
        ...eligibleTaskBase,
        id: "b",
        linearIdentifier: "TRI-99",
        title: "xyz",
      },
    ]
    const result = filterEligibleTasks(tasks, {
      clientId: "c1",
      lines: [],
      projectId: "all",
      search: "tri-99",
    })
    expect(result.map((t) => t.id)).toEqual(["b"])
  })
})

describe("totals", () => {
  const lines: BuilderLine[] = [
    { id: "1", taskId: null, label: "A", qty: 2, rate: 100 },
    { id: "2", taskId: null, label: "B", qty: 1, rate: 50 },
  ]

  it("sums standard lines", () => {
    expect(computeSubtotal({ kind: "STANDARD", lines, depositAmount: 0 })).toBe(
      250,
    )
  })

  it("uses the deposit amount for DEPOSIT invoices", () => {
    expect(
      computeSubtotal({ kind: "DEPOSIT", lines, depositAmount: 1200 }),
    ).toBe(1200)
  })

  it("prefers the manual override when enabled", () => {
    expect(
      computeEffectiveTotal({
        kind: "STANDARD",
        lines,
        depositAmount: 0,
        useTotalOverride: true,
        totalOverride: 999,
      }),
    ).toBe(999)
  })

  it("falls back to the subtotal when the override is disabled", () => {
    expect(
      computeEffectiveTotal({
        kind: "STANDARD",
        lines,
        depositAmount: 0,
        useTotalOverride: false,
        totalOverride: 999,
      }),
    ).toBe(250)
  })
})

describe("buildLinesPayload / buildTaskIds", () => {
  const lines: BuilderLine[] = [
    { id: "1", taskId: "t1", label: "A", qty: 2, rate: 100 },
    { id: "2", taskId: null, label: "B", qty: 1, rate: 50 },
  ]

  it("emits a single deposit line for DEPOSIT invoices", () => {
    expect(
      buildLinesPayload({
        kind: "DEPOSIT",
        lines,
        depositLabel: "Acompte",
        depositAmount: 800,
      }),
    ).toEqual([{ taskId: null, label: "Acompte", qty: 1, rate: 800 }])
  })

  it("maps builder lines for STANDARD invoices", () => {
    expect(
      buildLinesPayload({
        kind: "STANDARD",
        lines,
        depositLabel: "",
        depositAmount: 0,
      }),
    ).toEqual([
      { taskId: "t1", label: "A", qty: 2, rate: 100 },
      { taskId: null, label: "B", qty: 1, rate: 50 },
    ])
  })

  it("collects only real task ids for STANDARD, none for DEPOSIT", () => {
    expect(buildTaskIds("STANDARD", lines)).toEqual(["t1"])
    expect(buildTaskIds("DEPOSIT", lines)).toEqual([])
  })
})
