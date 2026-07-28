import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useTaskCounts, useTasks } from "./use-tasks"

const { toastMock, apiGetMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  apiGetMock: vi.fn(),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock("@/lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client")
  return {
    ...actual,
    api: { get: apiGetMock, post: vi.fn(), patch: vi.fn() },
  }
})

const COUNTS = {
  all: 3,
  pending: 1,
  done: 1,
  in_progress: 1,
  invoiced: 0,
  non_billable: 0,
  unestimatedCount: 0,
}

const EMPTY_PAGE = { data: [], nextCursor: null, hasMore: false }

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    )
  }
  return { queryClient, Wrapper }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe("useTaskCounts", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue(COUNTS)
  })

  it("sends the selection as comma-separated params", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTaskCounts({ clientIds: ["c2", "c1"], projectIds: ["p1"] }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/tasks?summary=status&clientIds=c1%2Cc2&projectIds=p1",
    )
  })

  it("shares one cache entry between reordered and duplicated selections", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const first = renderHook(
      () => useTaskCounts({ clientIds: ["b", "a", "a"] }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = renderHook(() => useTaskCounts({ clientIds: ["a", "b"] }), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(apiGetMock).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
  })

  it("treats empty arrays as no filter, sharing the unfiltered entry", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const filtered = renderHook(
      () => useTaskCounts({ clientIds: [], projectIds: [] }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(filtered.result.current.isSuccess).toBe(true))

    const bare = renderHook(() => useTaskCounts(), { wrapper: Wrapper })
    await waitFor(() => expect(bare.result.current.isSuccess).toBe(true))

    expect(apiGetMock).toHaveBeenCalledTimes(1)
    expect(apiGetMock).toHaveBeenCalledWith("/api/tasks?summary=status")
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
  })

  it("keeps the counts key under the tasks prefix for shared invalidation", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const { result } = renderHook(() => useTaskCounts({ clientIds: ["c1"] }), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    const keys = queryClient
      .getQueryCache()
      .getAll()
      .map((q) => q.queryKey)
    expect(keys).toEqual([["tasks", "counts", { clientIds: ["c1"] }]])
  })
})

describe("useTasks", () => {
  beforeEach(() => {
    apiGetMock.mockResolvedValue(EMPTY_PAGE)
  })

  it("sends the selection as comma-separated params", async () => {
    const { Wrapper } = createWrapper()
    const { result } = renderHook(
      () => useTasks({ clientIds: ["c2", "c1"], projectIds: ["p2", "p1"] }),
      { wrapper: Wrapper },
    )

    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiGetMock).toHaveBeenCalledWith(
      "/api/tasks?clientIds=c1%2Cc2&projectIds=p1%2Cp2&limit=50",
    )
  })

  it("shares one cache entry between reordered selections", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const first = renderHook(() => useTasks({ clientIds: ["b", "a"] }), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(first.result.current.isSuccess).toBe(true))

    const second = renderHook(() => useTasks({ clientIds: ["a", "b", "b"] }), {
      wrapper: Wrapper,
    })
    await waitFor(() => expect(second.result.current.isSuccess).toBe(true))

    expect(apiGetMock).toHaveBeenCalledTimes(1)
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
  })

  it("treats empty arrays as no filter, sharing the unfiltered entry", async () => {
    const { queryClient, Wrapper } = createWrapper()
    const filtered = renderHook(
      () => useTasks({ clientIds: [], projectIds: [] }),
      { wrapper: Wrapper },
    )
    await waitFor(() => expect(filtered.result.current.isSuccess).toBe(true))

    const bare = renderHook(() => useTasks(), { wrapper: Wrapper })
    await waitFor(() => expect(bare.result.current.isSuccess).toBe(true))

    expect(apiGetMock).toHaveBeenCalledTimes(1)
    expect(apiGetMock).toHaveBeenCalledWith("/api/tasks?limit=50")
    expect(queryClient.getQueryCache().getAll()).toHaveLength(1)
  })
})
