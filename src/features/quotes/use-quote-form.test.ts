import { act, renderHook, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { QuoteDetail } from "@/hooks/use-quotes"
import type { TaskDTO } from "@/hooks/use-tasks"

const h = vi.hoisted(() => ({
  push: vi.fn(),
  createMutate: vi.fn(),
  updateMutate: vi.fn(),
  clients: [] as Record<string, unknown>[],
  projects: [] as Record<string, unknown>[],
  tasks: [] as import("@/hooks/use-tasks").TaskDTO[],
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push }),
}))
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: h.clients }),
}))
vi.mock("@/hooks/use-projects", () => ({
  useProjects: () => ({ data: h.projects }),
}))
vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({ data: h.tasks }),
}))
vi.mock("@/hooks/use-quotes", () => ({
  useCreateQuote: () => ({ mutate: h.createMutate, isPending: false }),
  useUpdateQuote: () => ({ mutate: h.updateMutate, isPending: false }),
}))

import { useQuoteForm } from "./use-quote-form"

const CLIENT_DAILY = {
  id: "c1",
  firstName: "Ada",
  lastName: "Lovelace",
  company: "Analytical",
  email: null,
  billingMode: "DAILY",
  rate: 500,
  fixedPrice: null,
  deposit: null,
  color: null,
}

function task(overrides: Partial<TaskDTO> = {}): TaskDTO {
  return {
    id: "t1",
    linearIssueId: "issue-1",
    linearIdentifier: "TRI-1",
    linearUrl: null,
    title: "Audit sécurité",
    status: "PENDING_INVOICE",
    priority: "NONE",
    estimate: 2,
    actualDays: null,
    completedAt: null,
    invoiceId: null,
    taskGroupId: null,
    clientId: "c1",
    projectId: "p1",
    billable: true,
    nonBillableReason: null,
    nonBillableNote: null,
    ...overrides,
  }
}

function makeQuote(overrides: Partial<QuoteDetail> = {}): QuoteDetail {
  return {
    id: "q1",
    number: "D-2026-001",
    clientId: "c1",
    projectId: null,
    status: "DRAFT",
    issueDate: "2026-07-01T00:00:00.000Z",
    validUntil: null,
    sentAt: null,
    decidedAt: null,
    subtotal: 1000,
    total: 1000,
    notes: null,
    externalUrl: null,
    linesCount: 1,
    createdAt: "2026-07-01T00:00:00.000Z",
    client: {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical",
      billingMode: "DAILY",
      color: null,
    },
    lines: [{ id: "l1", taskId: null, label: "Audit", qty: 2, rate: 500 }],
    ...overrides,
  }
}

beforeEach(() => {
  h.push.mockReset()
  h.createMutate.mockReset()
  h.updateMutate.mockReset()
  h.clients = [CLIENT_DAILY]
  h.projects = []
  h.tasks = []
})

describe("useQuoteForm — create mode", () => {
  it("seeds the client from initialClientId and starts with no lines", () => {
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "create", initialClientId: "c1" }),
    )

    expect(result.current.clientId).toBe("c1")
    expect(result.current.status).toBe("DRAFT")
    expect(result.current.lines).toEqual([])
    expect(result.current.canSubmit).toBe(false)
  })

  it("resets project and lines when the client changes", () => {
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "create", initialClientId: "c1" }),
    )

    act(() => result.current.addLine())
    act(() => result.current.setProjectId("p1"))
    expect(result.current.lines).toHaveLength(1)

    act(() => result.current.selectClient("c2"))

    expect(result.current.clientId).toBe("c2")
    expect(result.current.projectId).toBeNull()
    expect(result.current.lines).toEqual([])
  })

  it("adds, updates and removes manual lines, keeping the total in sync", () => {
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "create", initialClientId: "c1" }),
    )

    act(() => result.current.addLine())
    const key = result.current.lines[0]?.key as string
    act(() =>
      result.current.updateLine(key, { label: "Conseil", qty: 3, rate: 200 }),
    )

    expect(result.current.total).toBe(600)
    expect(result.current.canSubmit).toBe(true)

    act(() => result.current.removeLine(key))
    expect(result.current.lines).toEqual([])
    expect(result.current.canSubmit).toBe(false)
  })

  it("maps a task to a line using the client's DAILY billing mode", () => {
    h.tasks = [task()]
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "create", initialClientId: "c1" }),
    )

    act(() => result.current.addLineFromTask(task()))

    expect(result.current.lines).toHaveLength(1)
    expect(result.current.lines[0]).toMatchObject({
      taskId: "t1",
      label: "[TRI-1] Audit sécurité",
      qty: 2,
      rate: 500,
    })
    expect(result.current.total).toBe(1000)
  })

  it("importEligibleTasks pulls every PENDING_INVOICE, unbound task of the client", () => {
    h.tasks = [
      task({ id: "t1" }),
      task({ id: "t2", linearIdentifier: "TRI-2", title: "Refonte" }),
      task({ id: "t3", clientId: "other-client" }),
      task({ id: "t4", invoiceId: "inv-1" }),
    ]
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "create", initialClientId: "c1" }),
    )

    act(() => result.current.importEligibleTasks())

    expect(result.current.lines).toHaveLength(2)
    expect(result.current.lines.map((l) => l.taskId).sort()).toEqual([
      "t1",
      "t2",
    ])
  })

  it("seeds lines from preselectedTaskIds once the client and tasks resolve", async () => {
    h.tasks = [task({ id: "t1" }), task({ id: "t2" })]
    const { result } = renderHook(() =>
      useQuoteForm({
        mode: "create",
        initialClientId: "c1",
        preselectedTaskIds: ["t2"],
      }),
    )

    await waitFor(() => expect(result.current.lines).toHaveLength(1))
    expect(result.current.lines[0]?.taskId).toBe("t2")
  })

  it("submits the create payload and navigates to the new quote's drawer", async () => {
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "create", initialClientId: "c1" }),
    )
    act(() => result.current.addLine())
    const key = result.current.lines[0]?.key as string
    act(() => result.current.updateLine(key, { label: "Audit" }))

    act(() => result.current.submit())

    expect(h.createMutate).toHaveBeenCalledTimes(1)
    const [payload, opts] = h.createMutate.mock.calls[0] ?? []
    expect(payload).toMatchObject({ clientId: "c1", status: "DRAFT" })

    act(() => opts.onSuccess({ id: "new-quote" }))
    expect(h.push).toHaveBeenCalledWith("/quotes?openId=new-quote")
  })

  it("does not submit when the form cannot be submitted", () => {
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "create", initialClientId: "c1" }),
    )

    act(() => result.current.submit())

    expect(h.createMutate).not.toHaveBeenCalled()
  })
})

describe("useQuoteForm — edit mode", () => {
  it("seeds every field from the existing quote", () => {
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "edit", quote: makeQuote() }),
    )

    expect(result.current.isEdit).toBe(true)
    expect(result.current.clientId).toBe("c1")
    expect(result.current.lines).toHaveLength(1)
    expect(result.current.total).toBe(1000)
  })

  it("saves the update payload and navigates back to the quote's drawer", () => {
    const { result } = renderHook(() =>
      useQuoteForm({ mode: "edit", quote: makeQuote() }),
    )

    act(() => result.current.save())

    expect(h.updateMutate).toHaveBeenCalledTimes(1)
    const [payload, opts] = h.updateMutate.mock.calls[0] ?? []
    expect(payload).toMatchObject({ status: "DRAFT" })
    expect(payload).not.toHaveProperty("clientId")

    act(() => opts.onSuccess())
    expect(h.push).toHaveBeenCalledWith("/quotes?openId=q1")
  })
})

describe("useQuoteForm — edit mode resyncs from the loaded quote", () => {
  it("adopts a status change on the quote prop even though the component was not remounted", () => {
    const { result, rerender } = renderHook(
      (quote: QuoteDetail) => useQuoteForm({ mode: "edit", quote }),
      { initialProps: makeQuote({ status: "DRAFT" }) },
    )

    expect(result.current.status).toBe("DRAFT")

    rerender(makeQuote({ status: "REFUSED" }))

    expect(result.current.status).toBe("REFUSED")
  })

  it("does not clobber a locally-edited field when only the quote's status changes underneath", () => {
    const { result, rerender } = renderHook(
      (quote: QuoteDetail) => useQuoteForm({ mode: "edit", quote }),
      { initialProps: makeQuote({ status: "DRAFT" }) },
    )

    act(() => result.current.setNotes("brouillon perso"))
    expect(result.current.notes).toBe("brouillon perso")

    rerender(makeQuote({ status: "REFUSED" }))

    expect(result.current.status).toBe("REFUSED")
    expect(result.current.notes).toBe("brouillon perso")
  })

  it("keeps a locally-picked status that has not been saved yet, even when the quote's status changes underneath", () => {
    const { result, rerender } = renderHook(
      (quote: QuoteDetail) => useQuoteForm({ mode: "edit", quote }),
      { initialProps: makeQuote({ status: "DRAFT" }) },
    )

    act(() => result.current.setStatus("SENT"))
    expect(result.current.status).toBe("SENT")

    rerender(makeQuote({ status: "REFUSED" }))

    expect(result.current.status).toBe("SENT")
  })

  it("fully resyncs every field when a different quote loads into the same mounted form", () => {
    const { result, rerender } = renderHook(
      (quote: QuoteDetail) => useQuoteForm({ mode: "edit", quote }),
      { initialProps: makeQuote({ id: "q1", number: "D-2026-001" }) },
    )

    rerender(
      makeQuote({
        id: "q2",
        number: "D-2026-002",
        status: "ACCEPTED",
        notes: "autre devis",
      }),
    )

    expect(result.current.number).toBe("D-2026-002")
    expect(result.current.status).toBe("ACCEPTED")
    expect(result.current.notes).toBe("autre devis")
  })
})
