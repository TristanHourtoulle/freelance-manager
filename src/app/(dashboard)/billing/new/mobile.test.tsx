import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fmtEUR } from "@/lib/format"
import { sumLines } from "@/lib/billing-math"

const h = vi.hoisted(() => {
  const client = {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical",
    billingMode: "DAILY",
    rate: 500,
    fixedPrice: null,
    deposit: null,
    color: null,
  }
  return {
    client,
    clients: [client] as Record<string, unknown>[],
    tasks: [
      {
        id: "t1",
        linearIdentifier: "TRI-1",
        title: "Premiere task",
        status: "PENDING_INVOICE",
        estimate: 2,
        invoiceId: null,
        clientId: "c1",
        projectId: "p1",
      },
      {
        id: "t2",
        linearIdentifier: "TRI-2",
        title: "Deuxieme task",
        status: "PENDING_INVOICE",
        estimate: 1,
        invoiceId: null,
        clientId: "c1",
        projectId: "p1",
      },
    ],
    params: new URLSearchParams(),
    push: vi.fn(),
    createMutate: vi.fn(),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, refresh: vi.fn() }),
  useSearchParams: () => h.params,
}))
vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))
vi.mock("@/hooks/use-projects", () => ({ useProjects: () => ({ data: [] }) }))
vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({ data: undefined }),
}))
vi.mock("@/hooks/use-invoice-split", () => ({
  useSplitInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock("@/hooks/use-invoices", () => ({
  useCreateInvoice: () => ({ mutate: h.createMutate, isPending: false }),
  useUpdateInvoice: () => ({ mutate: vi.fn(), isPending: false }),
}))
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: h.clients }),
}))
vi.mock("@/hooks/use-tasks", () => ({ useTasks: () => ({ data: h.tasks }) }))

import { MobileInvoiceNewPage } from "./mobile"

function setClient(patch: Record<string, unknown>) {
  h.clients = [{ ...h.client, ...patch }]
}

function taskRow(identifier: string) {
  return screen.getByRole("button", { name: new RegExp(identifier) })
}

function normalized(value: string | null): string {
  return (value ?? "").replace(/\s/g, " ")
}

beforeEach(() => {
  h.params = new URLSearchParams()
  h.clients = [h.client]
  h.push.mockReset()
  h.createMutate.mockReset()
})

describe("MobileInvoiceNewPage", () => {
  it("renders the mobile 3-step flow starting on the client picker", () => {
    render(<MobileInvoiceNewPage />)
    expect(screen.getByText("Nouvelle facture")).toBeInTheDocument()
    expect(screen.getByText("1/3")).toBeInTheDocument()
    expect(screen.getByText("Choisis un client")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Facture" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Acompte" })).toBeInTheDocument()
  })

  it("moves to the task step once a client is picked", async () => {
    const user = userEvent.setup()
    render(<MobileInvoiceNewPage />)
    await user.click(screen.getByRole("button", { name: /Analytical/ }))
    expect(screen.getByText("2/3")).toBeInTheDocument()
    expect(screen.getByText("Sélectionne les tasks")).toBeInTheDocument()
  })

  it("adds a DAILY line on tap with qty = estimate and rate = client rate", async () => {
    const user = userEvent.setup()
    h.params = new URLSearchParams({ clientId: "c1" })
    render(<MobileInvoiceNewPage />)

    await user.click(taskRow("TRI-1"))

    expect(taskRow("TRI-1")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getByText(/1 sélectionnée/)).toBeInTheDocument()

    await user.click(screen.getByRole("button", { name: /Continuer/ }))
    expect(screen.getByLabelText("Quantité")).toHaveValue(2)
    expect(screen.getByLabelText("Taux")).toHaveValue(500)
  })

  it("adds an HOURLY line with qty = estimate * 8", async () => {
    const user = userEvent.setup()
    setClient({ billingMode: "HOURLY", rate: 80 })
    h.params = new URLSearchParams({ clientId: "c1" })
    render(<MobileInvoiceNewPage />)

    await user.click(taskRow("TRI-1"))
    await user.click(screen.getByRole("button", { name: /Continuer/ }))

    expect(screen.getByLabelText("Quantité")).toHaveValue(16)
    expect(screen.getByLabelText("Taux")).toHaveValue(80)
  })

  it("adds a FIXED line with qty = 1 and rate = 0", async () => {
    const user = userEvent.setup()
    setClient({ billingMode: "FIXED", rate: 0, fixedPrice: 9000 })
    h.params = new URLSearchParams({ clientId: "c1" })
    render(<MobileInvoiceNewPage />)

    await user.click(taskRow("TRI-1"))
    await user.click(screen.getByRole("button", { name: /Continuer/ }))

    expect(screen.getByLabelText("Quantité")).toHaveValue(1)
    expect(screen.getByLabelText("Taux")).toHaveValue(0)
  })

  it("labels the line [linearIdentifier] title", async () => {
    const user = userEvent.setup()
    h.params = new URLSearchParams({ clientId: "c1" })
    render(<MobileInvoiceNewPage />)

    await user.click(taskRow("TRI-1"))
    await user.click(screen.getByRole("button", { name: /Continuer/ }))

    expect(screen.getByLabelText("Libellé de la ligne")).toHaveValue(
      "[TRI-1] Premiere task",
    )
  })

  it("removes the line when the same task is tapped again", async () => {
    const user = userEvent.setup()
    h.params = new URLSearchParams({ clientId: "c1" })
    render(<MobileInvoiceNewPage />)

    await user.click(taskRow("TRI-1"))
    expect(taskRow("TRI-1")).toHaveAttribute("aria-pressed", "true")

    await user.click(taskRow("TRI-1"))
    expect(taskRow("TRI-1")).toHaveAttribute("aria-pressed", "false")
    expect(screen.getByText(/0 sélectionnée/)).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Continuer/ })).toBeDisabled()
  })

  it("shows a running total equal to sumLines of the selected tasks", async () => {
    const user = userEvent.setup()
    h.params = new URLSearchParams({ clientId: "c1" })
    render(<MobileInvoiceNewPage />)

    await user.click(taskRow("TRI-1"))
    await user.click(taskRow("TRI-2"))

    const expected = sumLines([
      { qty: 2, rate: 500 },
      { qty: 1, rate: 500 },
    ])
    const cta = screen.getByRole("button", { name: /Continuer/ })
    expect(normalized(cta.textContent)).toContain(normalized(fmtEUR(expected)))

    await user.click(cta)
    const summary = screen.getByText("Total").closest(".builder-summary")
    expect(summary).not.toBeNull()
    const totals = within(summary as HTMLElement).getAllByText(
      (_, node) =>
        normalized(node?.textContent ?? "") === normalized(fmtEUR(expected)),
    )
    expect(totals.length).toBeGreaterThan(0)
  })

  it("submits the invoice from the recap step", async () => {
    const user = userEvent.setup()
    h.params = new URLSearchParams({ clientId: "c1" })
    render(<MobileInvoiceNewPage />)

    await user.click(taskRow("TRI-1"))
    await user.click(screen.getByRole("button", { name: /Continuer/ }))
    await user.click(screen.getByRole("button", { name: /Créer & envoyer/ }))

    expect(h.createMutate).toHaveBeenCalledTimes(1)
    const payload = h.createMutate.mock.calls[0]?.[0] as {
      status: string
      taskIds: string[]
      lines: { label: string; qty: number; rate: number }[]
    }
    expect(payload.status).toBe("SENT")
    expect(payload.taskIds).toEqual(["t1"])
    expect(payload.lines).toEqual([
      { taskId: "t1", label: "[TRI-1] Premiere task", qty: 2, rate: 500 },
    ])
  })

  it("switches to the deposit flow and gates the CTA on the amount", async () => {
    const user = userEvent.setup()
    render(<MobileInvoiceNewPage />)

    await user.click(screen.getByRole("button", { name: "Acompte" }))
    await user.click(screen.getByRole("button", { name: /Analytical/ }))

    expect(screen.getByText("Facture d'acompte")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Continuer/ })).toBeDisabled()

    await user.clear(screen.getByLabelText("Montant (€)"))
    await user.type(screen.getByLabelText("Montant (€)"), "1500")

    const cta = screen.getByRole("button", { name: /Continuer/ })
    expect(cta).toBeEnabled()
    expect(normalized(cta.textContent)).toContain(normalized(fmtEUR(1500)))
  })
})
