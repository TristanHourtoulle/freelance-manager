import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  updateEffort: vi.fn(),
  fetchNextPage: vi.fn(),
  hasNextPage: false,
  groups: [] as Array<Record<string, unknown>>,
  clients: [
    {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Acme",
      billingMode: "DAILY",
      rate: 300,
      fixedPrice: null,
    },
    {
      id: "c2",
      firstName: "Grace",
      lastName: "Hopper",
      company: "Navy",
      billingMode: "HOURLY",
      rate: 80,
      fixedPrice: null,
    },
  ],
  tasks: [
    {
      id: "t1",
      clientId: "c1",
      projectId: "p1",
      linearIdentifier: "ACME-1",
      title: "Optimiser les images",
      status: "PENDING_INVOICE",
      billable: true,
      invoiceId: null,
      taskGroupId: null,
      estimate: 1,
      actualDays: 1.5,
    },
    {
      id: "t2",
      clientId: "c1",
      projectId: "p1",
      linearIdentifier: "ACME-2",
      title: "Déjà groupée",
      status: "PENDING_INVOICE",
      billable: true,
      invoiceId: null,
      taskGroupId: "g-existing",
      estimate: 1,
      actualDays: null,
    },
    {
      id: "t3",
      clientId: "c2",
      projectId: "p2",
      linearIdentifier: "NAVY-1",
      title: "Autre client",
      status: "PENDING_INVOICE",
      billable: true,
      invoiceId: null,
      taskGroupId: null,
      estimate: 1,
      actualDays: null,
    },
    {
      id: "t4",
      clientId: "c1",
      projectId: "p1",
      linearIdentifier: "ACME-4",
      title: "Déployer le CDN",
      status: "PENDING_INVOICE",
      billable: true,
      invoiceId: null,
      taskGroupId: null,
      estimate: 2,
      actualDays: null,
    },
  ],
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: h.clients }),
}))
vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({
    data: h.tasks,
    isPending: false,
    hasNextPage: h.hasNextPage,
    isFetchingNextPage: false,
    fetchNextPage: h.fetchNextPage,
  }),
  useUpdateTaskEffort: () => ({ mutate: h.updateEffort, isPending: false }),
}))
vi.mock("@/hooks/use-task-groups", () => ({
  useTaskGroups: () => ({ data: h.groups, isPending: false }),
  useCreateTaskGroup: () => ({ mutate: h.create, isPending: false }),
  useUpdateTaskGroup: () => ({ mutate: h.update, isPending: false }),
  useDeleteTaskGroup: () => ({ mutate: h.remove, isPending: false }),
}))
vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import TaskGroupsPage from "./page"

describe("TaskGroupsPage", () => {
  beforeEach(() => {
    h.create.mockReset()
    h.updateEffort.mockReset()
    h.fetchNextPage.mockReset()
    h.hasNextPage = false
    h.groups.length = 0
  })

  it("uses the same full-width page layout as the other dashboard pages", () => {
    const { container } = render(<TaskGroupsPage />)

    expect(
      (container.querySelector(".task-groups-page") as HTMLElement).style
        .maxWidth,
    ).toBe("")
  })

  it("loads every task page before exposing the complete editor", async () => {
    h.hasNextPage = true
    render(<TaskGroupsPage />)

    await userEvent.setup().selectOptions(screen.getByLabelText("Client"), "c1")

    await waitFor(() => expect(h.fetchNextPage).toHaveBeenCalledTimes(1))
    expect(
      screen.getByRole("button", { name: "Nouveau groupe" }),
    ).toBeDisabled()
  })

  it("only offers ungrouped tasks of the selected client", async () => {
    const user = userEvent.setup()
    render(<TaskGroupsPage />)

    await user.selectOptions(screen.getByLabelText("Client"), "c1")
    await user.click(screen.getByRole("button", { name: "Nouveau groupe" }))

    expect(screen.getByText("ACME-1")).toBeInTheDocument()
    expect(screen.queryByText("ACME-2")).not.toBeInTheDocument()
    expect(screen.queryByText("NAVY-1")).not.toBeInTheDocument()
  })

  it("keeps task identifiers compact and searchable by identifier or title", async () => {
    const user = userEvent.setup()
    render(<TaskGroupsPage />)

    await user.selectOptions(screen.getByLabelText("Client"), "c1")
    await user.click(screen.getByRole("button", { name: "Nouveau groupe" }))

    const identifier = screen.getByText("ACME-1")
    expect(identifier).toHaveClass("task-id")
    expect(identifier.closest(".task-group-task-picker")).not.toBeNull()

    const search = screen.getByRole("searchbox", {
      name: "Rechercher une task",
    })
    await user.type(search, "cdn")
    expect(screen.getByText("ACME-4")).toBeInTheDocument()
    expect(screen.queryByText("ACME-1")).not.toBeInTheDocument()

    await user.clear(search)
    await user.type(search, "acme-1")
    expect(screen.getByText("Optimiser les images")).toBeInTheDocument()
    expect(screen.queryByText("Déployer le CDN")).not.toBeInTheDocument()
  })

  it("shows group pricing and lets the user capture effort per task", async () => {
    h.groups.push({
      id: "g1",
      name: "Bucket & CDN",
      clientId: "c1",
      invoiceId: null,
      invoiceNumber: null,
      createdAt: "2026-08-05T08:00:00.000Z",
      updatedAt: "2026-08-05T08:00:00.000Z",
      tasks: [
        {
          id: "t1",
          linearIdentifier: "ACME-1",
          linearUrl: null,
          title: "Optimiser les images",
          estimate: 1,
          actualDays: 1.5,
          clientId: "c1",
          projectId: "p1",
        },
        {
          id: "t4",
          linearIdentifier: "ACME-4",
          linearUrl: null,
          title: "Déployer le CDN",
          estimate: 2,
          actualDays: null,
          clientId: "c1",
          projectId: "p1",
        },
      ],
    })
    const user = userEvent.setup()
    render(<TaskGroupsPage />)

    await user.selectOptions(screen.getByLabelText("Client"), "c1")

    expect(screen.getAllByText("450 €").length).toBeGreaterThan(0)
    expect(screen.getByText("1 temps manquant")).toBeInTheDocument()

    await user.click(
      screen.getByRole("button", { name: "Temps et prix de Bucket & CDN" }),
    )
    const input = screen.getByLabelText("Temps passé pour ACME-4, en jours")
    await user.type(input, "0,5")
    await user.tab()

    expect(h.updateEffort).toHaveBeenCalledWith({
      id: "t4",
      actualDays: 0.5,
    })
  })

  it("creates an ad-hoc group with the selected tasks", async () => {
    const user = userEvent.setup()
    render(<TaskGroupsPage />)

    await user.selectOptions(screen.getByLabelText("Client"), "c1")
    await user.click(screen.getByRole("button", { name: "Nouveau groupe" }))
    await user.type(screen.getByLabelText("Nom du groupe"), "Bucket & CDN")
    await user.click(screen.getByLabelText(/ACME-1/))
    await user.click(screen.getByRole("button", { name: "Créer le groupe" }))

    expect(h.create).toHaveBeenCalledWith(
      { clientId: "c1", name: "Bucket & CDN", taskIds: ["t1"] },
      expect.any(Object),
    )
  })
})
