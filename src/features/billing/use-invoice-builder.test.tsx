import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TaskDTO } from "@/hooks/use-tasks"
import type { InvoiceDetail } from "@/hooks/use-invoices"

const h = vi.hoisted(() => {
  const client = {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical",
    billingMode: "DAILY",
    rate: 500,
    fixedPrice: null,
    deposit: null,
    color: null,
  }
  const tasks = [
    {
      id: "t1",
      linearIdentifier: "TRI-1",
      linearUrl: null,
      title: "One",
      status: "PENDING_INVOICE",
      estimate: 2,
      actualDays: null,
      invoiceId: null,
      taskGroupId: null,
      clientId: "c1",
      projectId: "p1",
    },
    {
      id: "t2",
      linearIdentifier: "TRI-2",
      linearUrl: null,
      title: "Two",
      status: "PENDING_INVOICE",
      estimate: 1,
      actualDays: null,
      invoiceId: null,
      taskGroupId: null,
      clientId: "c1",
      projectId: "p1",
    },
    {
      id: "t3",
      linearIdentifier: "TRI-3",
      linearUrl: null,
      title: "Done",
      status: "DONE",
      estimate: 5,
      actualDays: null,
      invoiceId: null,
      taskGroupId: null,
      clientId: "c1",
      projectId: "p1",
    },
  ]
  const taskGroup = {
    id: "g1",
    name: "Bucket & CDN",
    clientId: "c1",
    invoiceId: null,
    invoiceNumber: null,
    createdAt: "2026-08-04T00:00:00.000Z",
    updatedAt: "2026-08-04T00:00:00.000Z",
    tasks: [tasks[0]!, tasks[1]!],
  }
  return {
    client,
    tasks,
    taskGroup,
    taskGroups: [taskGroup],
    createMutate: vi.fn(),
    updateMutate: vi.fn(),
    splitMutate: vi.fn(),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}))
vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock("@/hooks/use-projects", () => ({
  useProjects: () => ({ data: [] }),
}))
vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({ data: undefined }),
}))
vi.mock("@/hooks/use-invoice-split", () => ({
  useSplitInvoice: () => ({ mutate: h.splitMutate, isPending: false }),
}))
vi.mock("@/hooks/use-invoices", () => ({
  useCreateInvoice: () => ({ mutate: h.createMutate, isPending: false }),
  useUpdateInvoice: () => ({ mutate: h.updateMutate, isPending: false }),
}))
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: [h.client] }),
}))
vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({ data: h.tasks }),
}))
vi.mock("@/hooks/use-task-groups", () => ({
  useTaskGroups: () => ({ data: h.taskGroups }),
}))

import { useInvoiceBuilder } from "./use-invoice-builder"

const tasks = h.tasks as unknown as TaskDTO[]
const NONE: string[] = []
const PRE_T1 = ["t1"]
const PRE_T2 = ["t2"]
const PRE_G1 = ["g1"]

describe("useInvoiceBuilder (create mode)", () => {
  beforeEach(() => {
    h.createMutate.mockReset()
    h.updateMutate.mockReset()
    h.splitMutate.mockReset()
  })

  it("exposes only PENDING_INVOICE tasks of the resolved client", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        initialClientId: "c1",
      }),
    )
    expect(result.current.eligibleTasks.map((t) => t.id)).toEqual(["t1", "t2"])
    expect(result.current.effectiveTotal).toBe(0)
  })

  it("seeds a DAILY line and drops the task from the eligible list", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.addTask(tasks[0]!)
    })

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({
      taskId: "t1",
      label: "[TRI-1] One",
      qty: 2,
      rate: 500,
    })
    expect(result.current.effectiveTotal).toBe(1000)
    expect(result.current.eligibleTasks.map((t) => t.id)).toEqual(["t2"])
  })

  it("seeds preselected task ids on mount", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: PRE_T2,
        initialClientId: "c1",
      }),
    )
    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({ taskId: "t2", qty: 1 })
  })

  it("does not re-seed when a new array with the same ids is passed on re-render", () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useInvoiceBuilder({
          mode: "create",
          preselectedTaskIds: ids,
          initialClientId: "c1",
        }),
      { initialProps: { ids: ["t1"] } },
    )

    expect(result.current.lines).toHaveLength(1)
    const seededLine = result.current.lines[0]

    act(() => {
      result.current.addTask(tasks[1]!)
    })
    expect(result.current.lines).toHaveLength(2)

    rerender({ ids: ["t1"] })
    rerender({ ids: ["t1"] })

    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines[0]).toBe(seededLine)
  })

  it("re-seeds when the preselected ids genuinely change", () => {
    const { result, rerender } = renderHook(
      ({ ids }: { ids: string[] }) =>
        useInvoiceBuilder({
          mode: "create",
          preselectedTaskIds: ids,
          initialClientId: "c1",
        }),
      { initialProps: { ids: ["t1"] } },
    )

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({ taskId: "t1" })

    rerender({ ids: ["t1", "t2"] })

    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines.map((l) => l.taskId)).toEqual(["t1", "t2"])
  })

  it("applies a manual total override and clears it", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.addTask(tasks[0]!)
    })
    act(() => {
      result.current.setTotalOverrideValue(4200)
    })
    expect(result.current.effectiveTotal).toBe(4200)

    act(() => {
      result.current.clearTotalOverride()
    })
    expect(result.current.effectiveTotal).toBe(1000)
  })

  it("defaults the initial status to SENT (send-first)", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        initialClientId: "c1",
      }),
    )
    expect(result.current.initialStatus).toBe("SENT")
  })

  it("attaches a payment when emitting with markPaid enabled", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: PRE_T1,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.setMarkPaid(true)
    })
    act(() => {
      result.current.submit("SENT")
    })

    const payload = h.createMutate.mock.calls[0]![0]
    expect(payload.status).toBe("SENT")
    expect(payload.initialPayment).toMatchObject({ amount: 1000 })
  })

  it("never attaches a payment when saving a draft, even with markPaid enabled", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: PRE_T1,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.setMarkPaid(true)
    })
    act(() => {
      result.current.submit("DRAFT")
    })

    const payload = h.createMutate.mock.calls[0]![0]
    expect(payload.status).toBe("DRAFT")
    expect(payload.initialPayment).toBeNull()
  })

  it("submits a create payload built from the current state", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: PRE_T1,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.submit("SENT")
    })

    expect(h.createMutate).toHaveBeenCalledTimes(1)
    const payload = h.createMutate.mock.calls[0]![0]
    expect(payload).toMatchObject({
      clientId: "c1",
      status: "SENT",
      kind: "STANDARD",
      taskIds: ["t1"],
    })
    expect(payload.lines).toEqual([
      {
        taskId: "t1",
        taskGroupId: null,
        label: "[TRI-1] One",
        qty: 2,
        rate: 500,
      },
    ])
  })

  it("adds every task from a pending client group in one action", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.addTaskGroup(h.taskGroup)
    })

    expect(result.current.groups).toHaveLength(1)
    expect(result.current.groups[0]?.name).toBe("Bucket & CDN")
    expect(result.current.lines.map((line) => line.taskId)).toEqual([
      "t1",
      "t2",
    ])
    expect(
      new Set(result.current.lines.map((line) => line.taskGroupId)),
    ).toEqual(new Set([result.current.groups[0]?.id]))
    expect(result.current.eligibleTasks).toHaveLength(0)
  })

  it("seeds a preselected group and all of its tasks", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        preselectedTaskGroupIds: PRE_G1,
        initialClientId: "c1",
      }),
    )

    expect(result.current.groups).toEqual([{ id: "g1", name: "Bucket & CDN" }])
    expect(result.current.lines.map((line) => line.taskId)).toEqual([
      "t1",
      "t2",
    ])
    expect(
      result.current.lines.every((line) => line.taskGroupId === "g1"),
    ).toBe(true)
  })

  it("submits a persisted group and keeps standalone tasks ungrouped", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.addTaskGroup({ ...h.taskGroup, tasks: [h.tasks[0]!] })
      result.current.addTask(tasks[1]!)
    })
    act(() => {
      result.current.submit("DRAFT")
    })

    const payload = h.createMutate.mock.calls[0]![0]
    expect(payload.taskGroupIds).toEqual(["g1"])
    expect(payload.lines).toEqual([
      expect.objectContaining({ taskId: "t1", taskGroupId: "g1" }),
      expect.objectContaining({ taskId: "t2", taskGroupId: null }),
    ])
  })

  it("removes a whole group and makes all of its tasks eligible again", () => {
    const { result } = renderHook(() =>
      useInvoiceBuilder({
        mode: "create",
        preselectedTaskIds: NONE,
        initialClientId: "c1",
      }),
    )

    act(() => {
      result.current.addTaskGroup(h.taskGroup)
    })
    const groupId = result.current.groups[0]!.id
    act(() => {
      result.current.removeTaskGroup(groupId)
    })

    expect(result.current.groups).toEqual([])
    expect(result.current.lines).toEqual([])
    expect(result.current.eligibleTasks.map((task) => task.id)).toEqual([
      "t1",
      "t2",
    ])
  })
})

function makeInvoice(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: "inv1",
    number: "F-2026-001",
    clientId: "c1",
    projectId: null,
    status: "DRAFT",
    paymentStatus: "UNPAID",
    isOverdue: false,
    kind: "STANDARD",
    issueDate: "2026-07-01T00:00:00.000Z",
    dueDate: "2026-07-31T00:00:00.000Z",
    paidAmount: 0,
    balanceDue: 500,
    lastPaidAt: null,
    lateFeeAccrued: 0,
    lateFeeDue: 0,
    lateFeeClaimedAt: null,
    lateFeeWaived: false,
    lateFeeBreakdown: null,
    penaltyPaid: 0,
    subtotal: 500,
    tax: 0,
    total: 500,
    totalOverride: null,
    notes: null,
    linesCount: 1,
    client: {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical",
      email: null,
      billingMode: "DAILY",
      color: null,
    },
    lines: [
      { id: "l1", taskId: null, label: "Ligne existante", qty: 1, rate: 500 },
    ],
    payments: [],
    ...overrides,
  }
}

describe("useInvoiceBuilder (edit mode) resyncs from the loaded invoice", () => {
  beforeEach(() => {
    h.createMutate.mockReset()
    h.updateMutate.mockReset()
    h.splitMutate.mockReset()
  })

  it("adopts a customNumber change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ number: "F-2026-001" }) },
    )

    expect(result.current.customNumber).toBe("F-2026-001")

    rerender(makeInvoice({ number: "F-2026-002" }))

    expect(result.current.customNumber).toBe("F-2026-002")
  })

  it("keeps a locally-edited customNumber that has not been saved yet, even when the invoice prop changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ number: "F-2026-001" }) },
    )

    act(() => {
      result.current.setCustomNumber("F-CUSTOM")
    })
    expect(result.current.customNumber).toBe("F-CUSTOM")

    rerender(makeInvoice({ number: "F-2026-002" }))

    expect(result.current.customNumber).toBe("F-CUSTOM")
  })

  it("adopts a status change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ status: "DRAFT" }) },
    )

    expect(result.current.status).toBe("DRAFT")

    rerender(makeInvoice({ status: "SENT" }))

    expect(result.current.status).toBe("SENT")
  })

  it("keeps a locally-picked status that has not been saved yet, even when the invoice's status changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ status: "DRAFT" }) },
    )

    act(() => {
      result.current.setStatus("SENT")
    })
    expect(result.current.status).toBe("SENT")

    rerender(makeInvoice({ status: "CANCELLED" }))

    expect(result.current.status).toBe("SENT")
  })

  it("adopts a lines change from the invoice prop when the user has not touched the lines", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          lines: [
            { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
          ],
        }),
      },
    )

    expect(result.current.lines).toEqual([
      {
        id: "l1",
        taskId: null,
        taskGroupId: null,
        label: "Ligne A",
        qty: 1,
        rate: 500,
      },
    ])

    rerender(
      makeInvoice({
        lines: [
          { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
          { id: "l2", taskId: null, label: "Ligne B", qty: 2, rate: 300 },
        ],
      }),
    )

    expect(result.current.lines.map((l) => l.id)).toEqual(["l1", "l2"])
  })

  it("keeps a locally-added line that has not been saved yet, even when the invoice's lines change underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          lines: [
            { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
          ],
        }),
      },
    )

    act(() => {
      result.current.addTask(tasks[0]!)
    })
    expect(result.current.lines.map((l) => l.taskId)).toEqual([null, "t1"])
    expect(result.current.lines).toHaveLength(2)

    rerender(
      makeInvoice({
        lines: [
          {
            id: "l1",
            taskId: null,
            label: "Ligne A modifiee ailleurs",
            qty: 9,
            rate: 999,
          },
        ],
      }),
    )

    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines[0]).toMatchObject({
      id: "l1",
      label: "Ligne A",
      qty: 1,
      rate: 500,
    })
    expect(result.current.lines[1]).toMatchObject({ taskId: "t1" })
  })

  it("does not loop forever and keeps resyncing an untouched field across many rapid refetches", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ number: "F-0" }) },
    )

    expect(() => {
      for (let i = 1; i <= 25; i++) {
        rerender(makeInvoice({ number: `F-${i}` }))
      }
    }).not.toThrow()

    expect(result.current.customNumber).toBe("F-25")
  })

  it("adopts a kind change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ kind: "STANDARD" }) },
    )

    expect(result.current.kind).toBe("STANDARD")

    rerender(makeInvoice({ kind: "DEPOSIT" }))

    expect(result.current.kind).toBe("DEPOSIT")
  })

  it("keeps a locally-picked kind that has not been saved yet, even when the invoice's kind changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ kind: "STANDARD" }) },
    )

    act(() => {
      result.current.setKind("DEPOSIT")
    })
    expect(result.current.kind).toBe("DEPOSIT")

    rerender(makeInvoice({ kind: "STANDARD" }))

    expect(result.current.kind).toBe("DEPOSIT")
  })

  it("adopts a projectId change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ projectId: null }) },
    )

    expect(result.current.projectId).toBe("all")

    rerender(makeInvoice({ projectId: "p1" }))

    expect(result.current.projectId).toBe("p1")
  })

  it("keeps a locally-picked projectId that has not been saved yet, even when the invoice's projectId changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ projectId: null }) },
    )

    act(() => {
      result.current.setProjectId("p2")
    })
    expect(result.current.projectId).toBe("p2")

    rerender(makeInvoice({ projectId: "p3" }))

    expect(result.current.projectId).toBe("p2")
  })

  it("adopts an issueDate change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          issueDate: "2026-07-01T00:00:00.000Z",
        }),
      },
    )

    expect(result.current.issueDate).toBe("2026-07-01")

    rerender(makeInvoice({ issueDate: "2026-08-15T00:00:00.000Z" }))

    expect(result.current.issueDate).toBe("2026-08-15")
  })

  it("keeps a locally-edited issueDate that has not been saved yet, even when the invoice's issueDate changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          issueDate: "2026-07-01T00:00:00.000Z",
        }),
      },
    )

    act(() => {
      result.current.setIssueDate("2026-07-10")
    })
    expect(result.current.issueDate).toBe("2026-07-10")

    rerender(makeInvoice({ issueDate: "2026-08-15T00:00:00.000Z" }))

    expect(result.current.issueDate).toBe("2026-07-10")
  })

  it("adopts a dueDate change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          dueDate: "2026-07-31T00:00:00.000Z",
        }),
      },
    )

    expect(result.current.dueDate).toBe("2026-07-31")

    rerender(makeInvoice({ dueDate: "2026-09-01T00:00:00.000Z" }))

    expect(result.current.dueDate).toBe("2026-09-01")
  })

  it("keeps a locally-edited dueDate that has not been saved yet, even when the invoice's dueDate changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          dueDate: "2026-07-31T00:00:00.000Z",
        }),
      },
    )

    act(() => {
      result.current.setDueDate("2026-08-05")
    })
    expect(result.current.dueDate).toBe("2026-08-05")

    rerender(makeInvoice({ dueDate: "2026-09-01T00:00:00.000Z" }))

    expect(result.current.dueDate).toBe("2026-08-05")
  })

  it("adopts a depositLabel change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          kind: "DEPOSIT",
          lines: [
            {
              id: "dl1",
              taskId: null,
              label: "Acompte 30%",
              qty: 1,
              rate: 1000,
            },
          ],
        }),
      },
    )

    expect(result.current.depositLabel).toBe("Acompte 30%")

    rerender(
      makeInvoice({
        kind: "DEPOSIT",
        lines: [
          { id: "dl1", taskId: null, label: "Acompte 50%", qty: 1, rate: 1000 },
        ],
      }),
    )

    expect(result.current.depositLabel).toBe("Acompte 50%")
  })

  it("keeps a locally-edited depositLabel that has not been saved yet, even when the invoice's deposit line changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          kind: "DEPOSIT",
          lines: [
            {
              id: "dl1",
              taskId: null,
              label: "Acompte 30%",
              qty: 1,
              rate: 1000,
            },
          ],
        }),
      },
    )

    act(() => {
      result.current.setDepositLabel("Mon acompte")
    })
    expect(result.current.depositLabel).toBe("Mon acompte")

    rerender(
      makeInvoice({
        kind: "DEPOSIT",
        lines: [
          { id: "dl1", taskId: null, label: "Acompte 50%", qty: 1, rate: 1000 },
        ],
      }),
    )

    expect(result.current.depositLabel).toBe("Mon acompte")
  })

  it("adopts a depositAmount change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          kind: "DEPOSIT",
          lines: [
            {
              id: "dl1",
              taskId: null,
              label: "Acompte 30%",
              qty: 1,
              rate: 1000,
            },
          ],
        }),
      },
    )

    expect(result.current.depositAmount).toBe(1000)

    rerender(
      makeInvoice({
        kind: "DEPOSIT",
        lines: [
          { id: "dl1", taskId: null, label: "Acompte 30%", qty: 1, rate: 2500 },
        ],
      }),
    )

    expect(result.current.depositAmount).toBe(2500)
  })

  it("keeps a locally-edited depositAmount that has not been saved yet, even when the invoice's deposit line changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          kind: "DEPOSIT",
          lines: [
            {
              id: "dl1",
              taskId: null,
              label: "Acompte 30%",
              qty: 1,
              rate: 1000,
            },
          ],
        }),
      },
    )

    act(() => {
      result.current.setDepositAmount(1500)
    })
    expect(result.current.depositAmount).toBe(1500)

    rerender(
      makeInvoice({
        kind: "DEPOSIT",
        lines: [
          { id: "dl1", taskId: null, label: "Acompte 30%", qty: 1, rate: 2500 },
        ],
      }),
    )

    expect(result.current.depositAmount).toBe(1500)
  })

  it("adopts a totalOverride change from the invoice prop when the user has not touched it", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ totalOverride: null }) },
    )

    expect(result.current.useTotalOverride).toBe(false)
    expect(result.current.totalOverride).toBe(0)

    rerender(makeInvoice({ totalOverride: 1500 }))

    expect(result.current.useTotalOverride).toBe(true)
    expect(result.current.totalOverride).toBe(1500)
  })

  it("keeps a locally-set totalOverride that has not been saved yet, even when the invoice's totalOverride changes underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      { initialProps: makeInvoice({ totalOverride: null }) },
    )

    act(() => {
      result.current.setTotalOverrideValue(999)
    })
    expect(result.current.useTotalOverride).toBe(true)
    expect(result.current.totalOverride).toBe(999)

    rerender(makeInvoice({ totalOverride: 5000 }))

    expect(result.current.useTotalOverride).toBe(true)
    expect(result.current.totalOverride).toBe(999)
  })

  it("adopts a groups change from the invoice prop when the user has not touched the lines", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          lines: [
            {
              id: "l1",
              taskId: "t1",
              taskGroupId: "g1",
              label: "[TRI-1] One",
              qty: 2,
              rate: 500,
            },
          ],
          taskGroups: [{ id: "g1", name: "Bucket & CDN" }],
        }),
      },
    )

    expect(result.current.groups).toEqual([{ id: "g1", name: "Bucket & CDN" }])

    rerender(
      makeInvoice({
        lines: [
          {
            id: "l1",
            taskId: "t1",
            taskGroupId: "g1",
            label: "[TRI-1] One",
            qty: 2,
            rate: 500,
          },
        ],
        taskGroups: [{ id: "g2", name: "Renamed group" }],
      }),
    )

    expect(result.current.groups).toEqual([{ id: "g2", name: "Renamed group" }])
  })

  it("keeps locally-added groups that have not been saved yet, even when the invoice's groups change underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          lines: [
            { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
          ],
          taskGroups: [],
        }),
      },
    )

    act(() => {
      result.current.addTaskGroup(h.taskGroup)
    })
    expect(result.current.groups).toEqual([{ id: "g1", name: "Bucket & CDN" }])

    rerender(
      makeInvoice({
        lines: [
          { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
        ],
        taskGroups: [{ id: "g9", name: "Server-side group" }],
      }),
    )

    expect(result.current.groups).toEqual([{ id: "g1", name: "Bucket & CDN" }])
  })

  it("keeps a line changed via updateLine that has not been saved yet, even when the invoice's lines change underneath", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          lines: [
            { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
          ],
        }),
      },
    )

    act(() => {
      result.current.updateLine("l1", { qty: 3, rate: 750 })
    })
    expect(result.current.lines[0]).toMatchObject({ qty: 3, rate: 750 })

    rerender(
      makeInvoice({
        lines: [
          {
            id: "l1",
            taskId: null,
            label: "Ligne A modifiee ailleurs",
            qty: 9,
            rate: 999,
          },
        ],
      }),
    )

    expect(result.current.lines[0]).toMatchObject({
      id: "l1",
      label: "Ligne A",
      qty: 3,
      rate: 750,
    })
  })

  it("adopts a line removed server-side when the user has not touched the lines", () => {
    const { result, rerender } = renderHook(
      (invoice: InvoiceDetail) => useInvoiceBuilder({ mode: "edit", invoice }),
      {
        initialProps: makeInvoice({
          lines: [
            { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
            { id: "l2", taskId: null, label: "Ligne B", qty: 2, rate: 300 },
          ],
        }),
      },
    )

    expect(result.current.lines.map((l) => l.id)).toEqual(["l1", "l2"])

    rerender(
      makeInvoice({
        lines: [
          { id: "l1", taskId: null, label: "Ligne A", qty: 1, rate: 500 },
        ],
      }),
    )

    expect(result.current.lines.map((l) => l.id)).toEqual(["l1"])
  })
})
