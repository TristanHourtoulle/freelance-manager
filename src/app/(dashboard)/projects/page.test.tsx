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

vi.mock("@/hooks/use-linear-sync", () => ({
  useLinearSyncProgress: () => ({
    isRunning: false,
    currentLabel: null,
    countLabel: null,
    buttonLabel: "Synchronisation…",
    doneMappings: 0,
    totalMappings: 0,
  }),
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

function buildProject(overrides: Record<string, unknown> = {}) {
  return {
    id: "p1",
    clientId: "c1",
    client: {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Acme",
      color: null,
    },
    linearProjectId: "lp-1",
    linearTeamId: null,
    name: "Alpha",
    key: "ALP",
    description: null,
    status: "ACTIVE" as const,
    tasksTotal: 0,
    targetDate: "2026-07-27T00:00:00.000Z",
    remainingDays: 10,
    atRisk: false,
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

  it("flags a project whose remaining work exceeds its target date", () => {
    useProjectsMock.mockReturnValue(
      buildQueryResult({
        data: [buildProject({ atRisk: true })],
        isPending: false,
      }),
    )

    render(<ProjectsPage />)

    expect(screen.getByText("À risque")).toBeInTheDocument()
  })

  it("does not flag a project that is on track", () => {
    useProjectsMock.mockReturnValue(
      buildQueryResult({
        data: [buildProject({ atRisk: false })],
        isPending: false,
      }),
    )

    render(<ProjectsPage />)

    expect(screen.queryByText("À risque")).not.toBeInTheDocument()
  })
})
