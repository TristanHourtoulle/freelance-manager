import { renderHook, waitFor } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { useClaimLateFee, useWaiveLateFee } from "./use-invoices"

const { apiPostMock, apiDeleteMock, routerRefreshMock } = vi.hoisted(() => ({
  apiPostMock: vi.fn(),
  apiDeleteMock: vi.fn(),
  routerRefreshMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: routerRefreshMock }),
}))

vi.mock("@/lib/api-client", () => ({
  api: {
    get: vi.fn(),
    post: apiPostMock,
    patch: vi.fn(),
    put: vi.fn(),
    delete: apiDeleteMock,
  },
}))

const LATE_FEE_RESULT = {
  lateFeeFixed: 40,
  lateFeeInterest: 4.94,
  lateFeeDue: 44.94,
  lateFeeClaimedAt: "2026-09-04T00:00:00.000Z",
  lateFeeWaived: false,
  paymentStatus: "PARTIALLY_PAID" as const,
  balanceDue: 44.94,
  isOverdue: true,
}

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

describe("useClaimLateFee", () => {
  it("posts the override to the late-fee endpoint", async () => {
    apiPostMock.mockResolvedValue(LATE_FEE_RESULT)
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useClaimLateFee("inv-1"), {
      wrapper: Wrapper,
    })

    result.current.mutate({ fixed: 40, interest: 4.94 })
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiPostMock).toHaveBeenCalledWith("/api/invoices/inv-1/late-fee", {
      fixed: 40,
      interest: 4.94,
    })
  })

  it("invalidates exactly the invoices, this invoice, and dashboard query keys, and refreshes the router — matching useCreatePayment", async () => {
    apiPostMock.mockResolvedValue(LATE_FEE_RESULT)
    const { queryClient, Wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useClaimLateFee("inv-1"), {
      wrapper: Wrapper,
    })

    result.current.mutate(undefined)
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledTimes(3)
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ["invoices"] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
      queryKey: ["invoice", "inv-1"],
    })
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, { queryKey: ["dashboard"] })
    expect(routerRefreshMock).toHaveBeenCalledTimes(1)
  })
})

describe("useWaiveLateFee", () => {
  it("deletes the late-fee endpoint", async () => {
    apiDeleteMock.mockResolvedValue({ ...LATE_FEE_RESULT, lateFeeWaived: true })
    const { Wrapper } = createWrapper()
    const { result } = renderHook(() => useWaiveLateFee("inv-1"), {
      wrapper: Wrapper,
    })

    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(apiDeleteMock).toHaveBeenCalledWith("/api/invoices/inv-1/late-fee")
  })

  it("invalidates exactly the invoices, this invoice, and dashboard query keys, and refreshes the router — matching useCreatePayment", async () => {
    apiDeleteMock.mockResolvedValue({ ...LATE_FEE_RESULT, lateFeeWaived: true })
    const { queryClient, Wrapper } = createWrapper()
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries")
    const { result } = renderHook(() => useWaiveLateFee("inv-1"), {
      wrapper: Wrapper,
    })

    result.current.mutate()
    await waitFor(() => expect(result.current.isSuccess).toBe(true))

    expect(invalidateSpy).toHaveBeenCalledTimes(3)
    expect(invalidateSpy).toHaveBeenNthCalledWith(1, { queryKey: ["invoices"] })
    expect(invalidateSpy).toHaveBeenNthCalledWith(2, {
      queryKey: ["invoice", "inv-1"],
    })
    expect(invalidateSpy).toHaveBeenNthCalledWith(3, { queryKey: ["dashboard"] })
    expect(routerRefreshMock).toHaveBeenCalledTimes(1)
  })
})
