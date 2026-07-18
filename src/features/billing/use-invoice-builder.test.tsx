import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { TaskDTO } from "@/hooks/use-tasks"

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
      title: "One",
      status: "PENDING_INVOICE",
      estimate: 2,
      invoiceId: null,
      clientId: "c1",
      projectId: "p1",
    },
    {
      id: "t2",
      linearIdentifier: "TRI-2",
      title: "Two",
      status: "PENDING_INVOICE",
      estimate: 1,
      invoiceId: null,
      clientId: "c1",
      projectId: "p1",
    },
    {
      id: "t3",
      linearIdentifier: "TRI-3",
      title: "Done",
      status: "DONE",
      estimate: 5,
      invoiceId: null,
      clientId: "c1",
      projectId: "p1",
    },
  ]
  return {
    client,
    tasks,
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

import { useInvoiceBuilder } from "./use-invoice-builder"

const tasks = h.tasks as unknown as TaskDTO[]
const NONE: string[] = []
const PRE_T1 = ["t1"]
const PRE_T2 = ["t2"]

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
      { taskId: "t1", label: "[TRI-1] One", qty: 2, rate: 500 },
    ])
  })
})
