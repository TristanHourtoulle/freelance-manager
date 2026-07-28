import { render, screen } from "@testing-library/react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { qk } from "@/hooks/query-keys"
import type { ClientDetailDTO } from "@/hooks/use-client-detail"

const pathname = vi.fn<() => string>()

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}))

vi.mock("@/components/ui/icon", () => ({
  Icon: () => <svg data-testid="icon" />,
}))

vi.mock("@/components/cmdk/cmdk-provider", () => ({
  useCmdK: () => ({ open: vi.fn(), close: vi.fn() }),
}))

import { Topbar } from "./topbar"

function renderTopbar(queryClient: QueryClient) {
  return render(
    <QueryClientProvider client={queryClient}>
      <Topbar />
    </QueryClientProvider>,
  )
}

const CLIENT: ClientDetailDTO = {
  id: "client-1",
  firstName: "Ada",
  lastName: "Lovelace",
  company: null,
  email: null,
  phone: null,
  website: null,
  address: null,
  notes: null,
  billingMode: "DAILY",
  rate: 500,
  fixedPrice: null,
  deposit: null,
  paymentTerms: null,
  category: "FREELANCE",
  color: null,
  starred: false,
  archived: false,
  archivedAt: null,
  createdAt: new Date().toISOString(),
  workload: {
    days: 0,
    taskCount: 0,
    estimatedTaskCount: 0,
    missingEstimateCount: 0,
  },
  lastContactAt: null,
  meetings: [],
  openActions: [],
  monthlyRevenue: [],
  projects: [],
  linearMappings: [],
  tasks: [],
  invoices: [],
}

describe("Topbar", () => {
  let queryClient: QueryClient
  let errorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    })
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {})
  })

  afterEach(() => {
    errorSpy.mockRestore()
    pathname.mockReset()
    queryClient.clear()
  })

  it("never logs the missing queryFn error, on a client detail route or elsewhere", () => {
    pathname.mockReturnValue("/clients/client-1")
    renderTopbar(queryClient)

    expect(errorSpy).not.toHaveBeenCalled()
  })

  it("does not trigger a network fetch for the client breadcrumb query", () => {
    pathname.mockReturnValue("/clients/client-1")
    renderTopbar(queryClient)

    const state = queryClient.getQueryState(qk.client.detail("client-1"))
    expect(state?.fetchStatus).toBe("idle")
    expect(state?.status).toBe("pending")
  })

  it("renders the placeholder when no client is cached yet", () => {
    pathname.mockReturnValue("/clients/client-1")
    renderTopbar(queryClient)

    expect(screen.getByText("—")).toBeInTheDocument()
  })

  it("shows the client's name reactively once useClientDetail populates the cache", () => {
    pathname.mockReturnValue("/clients/client-1")
    queryClient.setQueryData(qk.client.detail("client-1"), CLIENT)

    renderTopbar(queryClient)

    expect(screen.getByText("Ada Lovelace")).toBeInTheDocument()
  })
})
