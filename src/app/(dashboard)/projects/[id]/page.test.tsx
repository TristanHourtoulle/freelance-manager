import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { DesktopProjectDetailPage } from "./page"
import { fmtEUR } from "@/lib/format"
import type { ProjectDetailDTO } from "@/hooks/use-project-detail"

const { useProjectDetailMock } = vi.hoisted(() => ({
  useProjectDetailMock: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

vi.mock("@/hooks/use-is-mobile", () => ({
  useIsMobile: () => false,
}))

vi.mock("@/hooks/use-project-detail", () => ({
  useProjectDetail: () => useProjectDetailMock(),
  useUpdateProject: () => ({ mutate: vi.fn(), isPending: false }),
}))

function buildProject(overrides: Partial<ProjectDetailDTO> = {}) {
  return {
    id: "p1",
    name: "Refonte Acme",
    key: "ACM",
    description: "Le site vitrine",
    status: "ACTIVE",
    linearProjectId: "lp-1",
    linearTeamId: "team-1",
    lastSyncedAt: "2026-07-01T10:00:00.000Z",
    repoUrl: "https://github.com/acme/app",
    stagingUrl: null,
    prodUrl: null,
    runbook: "## Déploiement\n\nPousser sur main.",
    client: {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Acme",
      color: null,
      billingMode: "DAILY",
      rate: 500,
    },
    tasks: [
      {
        id: "t1",
        linearIdentifier: "ACM-1",
        linearUrl: null,
        title: "Poser les fondations",
        status: "PENDING_INVOICE",
        estimate: 2,
        invoiceId: null,
      },
    ],
    invoices: [],
    counts: {
      tasksTotal: 42,
      tasksPendingInvoice: 7,
      invoicesTotal: 3,
    },
    totals: { revenue: 12500, outstanding: 3000 },
    ...overrides,
  } as ProjectDetailDTO
}

describe("ProjectDetailPage (desktop)", () => {
  it("renders the project name, key and client label", () => {
    useProjectDetailMock.mockReturnValue({
      data: buildProject(),
      isLoading: false,
    })

    render(<DesktopProjectDetailPage id="p1" />)

    expect(screen.getByText("Refonte Acme")).toBeInTheDocument()
    expect(screen.getByText("ACM")).toBeInTheDocument()
    expect(screen.getByText("Acme")).toBeInTheDocument()
  })

  it("renders server-provided totals and counts, not values derived from the truncated task array", () => {
    const project = buildProject()
    useProjectDetailMock.mockReturnValue({ data: project, isLoading: false })

    render(<DesktopProjectDetailPage id="p1" />)

    const grid = screen.getByTestId("project-kpi-grid")
    const values = Array.from(grid.querySelectorAll(".kpi-value")).map(
      (n) => n.textContent,
    )
    expect(values).toEqual([fmtEUR(12500), fmtEUR(3000), "7"])
    expect(values).not.toContain(String(project.tasks.length))
  })

  it("shows the not-found state when the project does not resolve", () => {
    useProjectDetailMock.mockReturnValue({
      data: undefined,
      isLoading: false,
    })

    render(<DesktopProjectDetailPage id="p1" />)

    expect(screen.getByText("Projet introuvable")).toBeInTheDocument()
  })

  it("renders the runbook markdown", () => {
    useProjectDetailMock.mockReturnValue({
      data: buildProject(),
      isLoading: false,
    })

    render(<DesktopProjectDetailPage id="p1" />)

    expect(screen.getByText("Déploiement")).toBeInTheDocument()
  })

  it("shows the empty runbook state when the project has no runbook", () => {
    useProjectDetailMock.mockReturnValue({
      data: buildProject({ runbook: null }),
      isLoading: false,
    })

    render(<DesktopProjectDetailPage id="p1" />)

    expect(screen.getByText("Aucun runbook")).toBeInTheDocument()
  })
})
