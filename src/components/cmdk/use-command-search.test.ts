import { act, renderHook } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useCommandSearch } from "@/components/cmdk/use-command-search"

const mockEntitySearch = vi.fn()

vi.mock("@/hooks/use-entity-search", () => ({
  SEARCH_LIMIT: 6,
  useEntitySearch: (...args: unknown[]) => mockEntitySearch(...args),
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
]

const PROJECTS = [
  {
    id: "p1",
    key: "ACM",
    name: "Refonte Acme",
    client: { firstName: "Acme", lastName: "Corp", company: "Acme SAS" },
  },
]

const INVOICES = [
  {
    id: "i2",
    number: "FAC-2026-042",
    total: 800,
    clientName: "Acme SAS",
  },
]

const TASKS = [
  {
    id: "t1",
    linearIdentifier: "TRI-1074",
    title: "Command palette",
    clientId: "c1",
  },
]

function results(overrides: Record<string, unknown> = {}) {
  return {
    clients: { rows: CLIENTS, hasMore: false },
    projects: { rows: PROJECTS, hasMore: false },
    invoices: { rows: INVOICES, hasMore: false },
    tasks: { rows: TASKS, hasMore: false },
    isPending: false,
    ...overrides,
  }
}

describe("useCommandSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockEntitySearch.mockReturnValue(results())
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

  it("exposes a Projets group and navigates to the project detail page", () => {
    const { result, router } = run("acme")
    const project = result.current.find((c) => c.group === "Projets")
    expect(project?.label).toBe("Refonte Acme")
    expect(project?.keywords).toContain("ACM")
    project?.run()
    expect(router.push).toHaveBeenCalledWith("/projects/p1")
  })

  it("matches an invoice by number and navigates with invoiceId", () => {
    const { result, router } = run("042")
    const invoice = result.current.find((c) => c.group === "Factures")
    expect(invoice?.label).toBe("Facture FAC-2026-042")
    invoice?.run()
    expect(router.push).toHaveBeenCalledWith("/billing?invoiceId=i2")
  })

  it("carries the client name of an invoice so relation hits stay visible", () => {
    const { result } = run("acme")
    const invoice = result.current.find((c) => c.group === "Factures")
    expect(invoice?.keywords).toContain("Acme SAS")
    expect(invoice?.hint).toContain("Acme SAS")
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
    expect(groups).toEqual(new Set(["Clients", "Projets", "Factures", "Tasks"]))
  })

  it("queries the server with the debounced term instead of a cached page", () => {
    const router = makeRouter()
    const { rerender } = renderHook(
      ({ q }: { q: string }) => useCommandSearch(q, router),
      { initialProps: { q: "" } },
    )
    rerender({ q: "  Acme  " })
    act(() => {
      vi.advanceTimersByTime(200)
    })

    expect(mockEntitySearch).toHaveBeenLastCalledWith("Acme", true)
  })

  it("disables the entity search when the palette is closed", () => {
    const router = makeRouter()
    renderHook(() => useCommandSearch("acme", router, false))

    expect(mockEntitySearch).toHaveBeenCalledWith("acme", false)
  })

  it("appends a sticky notice when the server truncated a group", () => {
    mockEntitySearch.mockReturnValue(
      results({ clients: { rows: CLIENTS, hasMore: true } }),
    )
    const { result, router } = run("acme")

    const notice = result.current.find((c) => c.id === "clients-truncated")
    expect(notice?.sticky).toBe(true)
    expect(notice?.group).toBe("Clients")
    expect(notice?.label).toContain("6 premiers résultats")
    notice?.run()
    expect(router.push).toHaveBeenCalledWith("/clients")
  })

  it("omits the truncation notice when every match fits", () => {
    const { result } = run("acme")
    expect(result.current.some((c) => c.sticky)).toBe(false)
  })
})
