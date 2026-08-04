import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

const h = vi.hoisted(() => ({
  create: vi.fn(),
  update: vi.fn(),
  remove: vi.fn(),
  clients: [
    { id: "c1", firstName: "Ada", lastName: "Lovelace", company: "Acme" },
    { id: "c2", firstName: "Grace", lastName: "Hopper", company: "Navy" },
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
    },
  ],
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: h.clients }),
}))
vi.mock("@/hooks/use-tasks", () => ({
  useTasks: () => ({ data: h.tasks, isPending: false }),
}))
vi.mock("@/hooks/use-task-groups", () => ({
  useTaskGroups: () => ({ data: [], isPending: false }),
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
