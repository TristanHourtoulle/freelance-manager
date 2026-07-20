import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import {
  useLinearSyncStatus,
  useLinearSyncWatcher,
  type LinearSyncStatusDTO,
} from "./use-linear-sync"
import { useSyncLinear } from "./use-tasks"
import { ApiError } from "@/lib/api-client"
import { qk } from "@/hooks/query-keys"

const { toastMock, refreshMock, apiGetMock, apiPostMock } = vi.hoisted(() => ({
  toastMock: vi.fn(),
  refreshMock: vi.fn(),
  apiGetMock: vi.fn(),
  apiPostMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: refreshMock }),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: toastMock }),
}))

vi.mock("@/lib/api-client", async () => {
  const actual =
    await vi.importActual<typeof import("@/lib/api-client")>("@/lib/api-client")
  return {
    ...actual,
    api: { get: apiGetMock, post: apiPostMock },
  }
})

const RUNNING: LinearSyncStatusDTO = {
  runId: "run-1",
  status: "RUNNING",
  totalMappings: 3,
  doneMappings: 1,
  currentLabel: "Mistral SAS",
  projectsUpserted: 0,
  tasksUpserted: 0,
  errorMessage: null,
  startedAt: "2026-07-20T10:00:00.000Z",
  finishedAt: null,
}

const COMPLETED: LinearSyncStatusDTO = {
  ...RUNNING,
  status: "COMPLETED",
  doneMappings: 3,
  currentLabel: null,
  projectsUpserted: 2,
  tasksUpserted: 17,
  finishedAt: "2026-07-20T10:00:30.000Z",
}

const FAILED: LinearSyncStatusDTO = {
  ...RUNNING,
  status: "FAILED",
  currentLabel: null,
  errorMessage: "Linear API rate limit",
  finishedAt: "2026-07-20T10:00:12.000Z",
}

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
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

afterEach(() => {
  vi.useRealTimers()
})

describe("useLinearSyncStatus", () => {
  it("polls every second while the run is RUNNING", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiGetMock.mockResolvedValue(RUNNING)
    const { Wrapper } = createWrapper()

    renderHook(() => useLinearSyncStatus(), { wrapper: Wrapper })

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(1_000)
    expect(apiGetMock).toHaveBeenCalledTimes(2)

    await vi.advanceTimersByTimeAsync(1_000)
    expect(apiGetMock).toHaveBeenCalledTimes(3)
  })

  it("falls back to the slow cadence once the run is no longer RUNNING", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiGetMock.mockResolvedValue(COMPLETED)
    const { Wrapper } = createWrapper()

    renderHook(() => useLinearSyncStatus(), { wrapper: Wrapper })

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(1_000)
    expect(apiGetMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(14_000)
    expect(apiGetMock).toHaveBeenCalledTimes(2)
  })

  it("uses the slow cadence when the user has never synced", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiGetMock.mockResolvedValue({
      status: "idle",
    } satisfies LinearSyncStatusDTO)
    const { Wrapper } = createWrapper()

    renderHook(() => useLinearSyncStatus(), { wrapper: Wrapper })

    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1))

    await vi.advanceTimersByTimeAsync(1_000)
    expect(apiGetMock).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(14_000)
    expect(apiGetMock).toHaveBeenCalledTimes(2)
  })
})

describe("useLinearSyncWatcher", () => {
  it("invalidates and toasts exactly once on the RUNNING → COMPLETED edge", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiGetMock.mockResolvedValue(RUNNING)
    const { queryClient, Wrapper } = createWrapper()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    renderHook(() => useLinearSyncWatcher(), { wrapper: Wrapper })
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1))

    expect(toastMock).not.toHaveBeenCalled()

    apiGetMock.mockResolvedValue(COMPLETED)
    await vi.advanceTimersByTimeAsync(1_000)

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    expect(toastMock).toHaveBeenCalledWith({
      variant: "success",
      title: "Synchronisation Linear terminée",
      description: "17 tasks · 2 projets mis à jour.",
    })
    expect(refreshMock).toHaveBeenCalledTimes(1)

    const invalidatedKeys = invalidate.mock.calls.map(([arg]) => arg?.queryKey)
    expect(invalidatedKeys).toEqual([
      qk.tasks.all(),
      qk.projects(),
      qk.dashboard(),
      qk.settings(),
    ])

    await vi.advanceTimersByTimeAsync(15_000)
    await vi.advanceTimersByTimeAsync(15_000)
    expect(toastMock).toHaveBeenCalledTimes(1)
    expect(refreshMock).toHaveBeenCalledTimes(1)
  })

  it("surfaces the server error on the RUNNING → FAILED edge", async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true })
    apiGetMock.mockResolvedValue(RUNNING)
    const { Wrapper } = createWrapper()

    renderHook(() => useLinearSyncWatcher(), { wrapper: Wrapper })
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1))

    apiGetMock.mockResolvedValue(FAILED)
    await vi.advanceTimersByTimeAsync(1_000)

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    expect(toastMock).toHaveBeenCalledWith({
      variant: "error",
      title: "Synchronisation Linear échouée",
      description: "Linear API rate limit",
    })
  })

  it("stays silent when a terminal status is the first thing it ever sees", async () => {
    apiGetMock.mockResolvedValue(COMPLETED)
    const { Wrapper } = createWrapper()

    renderHook(() => useLinearSyncWatcher(), { wrapper: Wrapper })
    await waitFor(() => expect(apiGetMock).toHaveBeenCalledTimes(1))

    expect(toastMock).not.toHaveBeenCalled()
    expect(refreshMock).not.toHaveBeenCalled()
  })
})

describe("useSyncLinear", () => {
  it("toasts the friendly conflict message on a 409", async () => {
    apiPostMock.mockRejectedValue(new ApiError("Sync already in progress", 409))
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useSyncLinear(), { wrapper: Wrapper })
    result.current.mutate()

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    expect(toastMock).toHaveBeenCalledWith({
      variant: "info",
      title: "Synchronisation déjà en cours",
      description: "Patiente qu'elle se termine avant d'en relancer une.",
    })
  })

  it("toasts the generic error for any other failure", async () => {
    apiPostMock.mockRejectedValue(new ApiError("Boom", 500))
    const { Wrapper } = createWrapper()

    const { result } = renderHook(() => useSyncLinear(), { wrapper: Wrapper })
    result.current.mutate()

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    expect(toastMock).toHaveBeenCalledWith({
      variant: "error",
      title: "Sync échouée",
      description: "Boom",
    })
  })

  it("does not invalidate the data caches itself — the watcher owns that", async () => {
    apiPostMock.mockResolvedValue({ status: "started", runId: "run-1" })
    const { queryClient, Wrapper } = createWrapper()
    const invalidate = vi.spyOn(queryClient, "invalidateQueries")

    const { result } = renderHook(() => useSyncLinear(), { wrapper: Wrapper })
    result.current.mutate()

    await waitFor(() => expect(toastMock).toHaveBeenCalledTimes(1))
    expect(invalidate.mock.calls.map(([arg]) => arg?.queryKey)).toEqual([
      qk.linear.syncStatus(),
    ])
  })
})
