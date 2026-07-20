import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCommandSearch } from "@/components/cmdk/use-command-search"

const mockClients = vi.fn()
const mockInvoices = vi.fn()
const mockTasks = vi.fn()

vi.mock("@/hooks/use-clients", () => ({
  useClients: (...args: unknown[]) => mockClients(...args),
}))
vi.mock("@/hooks/use-invoices", () => ({
  useInvoices: (...args: unknown[]) => mockInvoices(...args),
}))
vi.mock("@/hooks/use-tasks", () => ({
  useTasks: (...args: unknown[]) => mockTasks(...args),
}))

function makeRouter() {
  return { push: vi.fn() } as unknown as ReturnType<
    typeof import("next/navigation").useRouter
  >
}

const CLIENTS = [
  {
    id: "c1",
    firstName: "Acme",
    lastName: "Corp",
    company: "Acme SAS",
    email: "hello@acme.io",
  },
  {
    id: "c2",
    firstName: "Bob",
    lastName: "Martin",
    company: null,
    email: null,
  },
]

const INVOICES = [
  { id: "i1", number: "FAC-2026-001", total: 1200 },
  { id: "i2", number: "FAC-2026-042", total: 800 },
]

const TASKS = [
  {
    id: "t1",
    linearIdentifier: "TRI-1074",
    title: "Command palette",
    clientId: "c1",
  },
  { id: "t2", linearIdentifier: "TRI-9", title: "Other", clientId: "c2" },
]

describe("useCommandSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockClients.mockReturnValue({ data: CLIENTS })
    mockInvoices.mockReturnValue({ data: INVOICES })
    mockTasks.mockReturnValue({ data: TASKS })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  function run(query: string) {
    const router = makeRouter()
    const { result } = renderHook(() => useCommandSearch(query, router))
    act(() => {
      vi.advanceTimersByTime(200)
    })
    return { result, router }
  }

  it("returns no results for an empty query", () => {
    const { result } = run("")
    expect(result.current).toEqual([])
  })

  it("matches a client by name and navigates to its detail", () => {
    const { result, router } = run("acme")
    const client = result.current.find((c) => c.group === "Clients")
    expect(client).toBeDefined()
    expect(client?.label).toBe("Acme Corp")
    client?.run()
    expect(router.push).toHaveBeenCalledWith("/clients/c1")
  })

  it("matches an invoice by number and navigates with invoiceId", () => {
    const { result, router } = run("042")
    const invoice = result.current.find((c) => c.group === "Factures")
    expect(invoice?.label).toBe("Facture FAC-2026-042")
    invoice?.run()
    expect(router.push).toHaveBeenCalledWith("/billing?invoiceId=i2")
  })

  it("matches a task by identifier and navigates to its client tasks", () => {
    const { result, router } = run("tri-1074")
    const task = result.current.find((c) => c.group === "Tasks")
    expect(task?.label).toBe("[TRI-1074] Command palette")
    task?.run()
    expect(router.push).toHaveBeenCalledWith("/tasks?clientId=c1")
  })

  it("groups results by entity type", () => {
    const { result } = run("acme")
    const groups = new Set(result.current.map((c) => c.group))
    expect(groups.has("Clients")).toBe(true)
  })

  it("disables the three entity queries when the palette is closed", () => {
    const router = makeRouter()
    renderHook(() => useCommandSearch("acme", router, false))

    expect(mockClients).toHaveBeenCalledWith({ enabled: false })
    expect(mockInvoices).toHaveBeenCalledWith({ enabled: false })
    expect(mockTasks).toHaveBeenCalledWith(undefined, { enabled: false })
  })

  it("enables the three entity queries when the palette is open", () => {
    const router = makeRouter()
    renderHook(() => useCommandSearch("acme", router, true))

    expect(mockClients).toHaveBeenCalledWith({ enabled: true })
    expect(mockInvoices).toHaveBeenCalledWith({ enabled: true })
    expect(mockTasks).toHaveBeenCalledWith(undefined, { enabled: true })
  })

  it("debounces query changes before recomputing results", () => {
    const router = makeRouter()
    const { result, rerender } = renderHook(
      ({ q }: { q: string }) => useCommandSearch(q, router),
      { initialProps: { q: "" } },
    )
    expect(result.current).toEqual([])

    rerender({ q: "acme" })
    expect(result.current).toEqual([])

    act(() => {
      vi.advanceTimersByTime(200)
    })
    expect(result.current.some((c) => c.group === "Clients")).toBe(true)
  })
})
