import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import ProjectsPage from "./page"

const { useProjectsMock } = vi.hoisted(() => ({
  useProjectsMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/hooks/use-projects", () => ({
  useProjects: () => useProjectsMock(),
}))

vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({ data: [] }),
  useSyncLinear: () => ({ mutate: vi.fn(), isPending: false }),
}))

vi.mock("@/hooks/use-invoices", () => ({
  useInvoices: () => ({ data: [] }),
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: [] }),
}))

function buildQueryResult(overrides: Record<string, unknown>) {
  return {
    data: [],
    fetchNextPage: vi.fn(),
    hasNextPage: false,
    isFetchingNextPage: false,
    isPending: false,
    ...overrides,
  }
}

describe("ProjectsPage (desktop)", () => {
  it("shows skeleton rows and hides the empty state while loading", () => {
    useProjectsMock.mockReturnValue(
      buildQueryResult({ data: undefined, isPending: true }),
    )

    const { container } = render(<ProjectsPage />)

    expect(container.querySelectorAll(".skeleton").length).toBeGreaterThan(0)
    expect(screen.queryByText("Aucun projet")).not.toBeInTheDocument()
  })

  it("shows the empty state once loaded with no projects", () => {
    useProjectsMock.mockReturnValue(
      buildQueryResult({ data: [], isPending: false }),
    )

    const { container } = render(<ProjectsPage />)

    expect(screen.getByText("Aucun projet")).toBeInTheDocument()
    expect(container.querySelectorAll(".skeleton").length).toBe(0)
  })
})
