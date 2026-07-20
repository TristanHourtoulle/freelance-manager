import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { fmtEUR } from "@/lib/format"
import type { InvoiceDetail } from "@/hooks/use-invoices"

const h = vi.hoisted(() => {
  const client = {
    id: "c1",
    firstName: "Ada",
    lastName: "Lovelace",
    company: "Analytical",
    email: null,
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
    push: vi.fn(),
    updateMutate: vi.fn(),
  }
})

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: h.push, refresh: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
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
  useCreateInvoice: () => ({ mutate: vi.fn(), isPending: false }),
  useUpdateInvoice: () => ({ mutate: h.updateMutate, isPending: false }),
}))
vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: h.clients }),
}))
vi.mock("@/hooks/use-tasks", () => ({ useTasks: () => ({ data: h.tasks }) }))

import { MobileEditInvoicePage } from "./mobile"

function makeInvoice(overrides: Partial<InvoiceDetail> = {}): InvoiceDetail {
  return {
    id: "inv1",
    number: "F-2026-001",
    clientId: "c1",
    projectId: null,
    status: "DRAFT",
    paymentStatus: "UNPAID",
    isOverdue: false,
    kind: "STANDARD",
    issueDate: "2026-07-01T00:00:00.000Z",
    dueDate: "2026-07-31T00:00:00.000Z",
    paidAmount: 0,
    balanceDue: 500,
    lastPaidAt: null,
    subtotal: 500,
    tax: 0,
    total: 500,
    totalOverride: null,
    notes: null,
    linesCount: 1,
    client: {
      id: "c1",
      firstName: "Ada",
      lastName: "Lovelace",
      company: "Analytical",
      email: null,
      billingMode: "DAILY",
      color: null,
    },
    lines: [
      { id: "l1", taskId: null, label: "Ligne existante", qty: 1, rate: 500 },
    ],
    payments: [],
    ...overrides,
  }
}

function taskRow(identifier: string) {
  return screen.getByRole("button", { name: new RegExp(identifier) })
}

function normalized(value: string | null): string {
  return (value ?? "").replace(/\s/g, " ")
}

function totalText(): string {
  const row = screen.getByText("Total").parentElement as HTMLElement
  return normalized(within(row).getByText(/€/).textContent ?? "")
}

beforeEach(() => {
  h.clients = [h.client]
  h.push.mockReset()
  h.updateMutate.mockReset()
})

describe("MobileEditInvoicePage", () => {
  it("renders the invoice number in the topbar title", () => {
    render(<MobileEditInvoicePage invoice={makeInvoice()} id="inv1" />)
    expect(screen.getByText("Modifier F-2026-001")).toBeInTheDocument()
  })

  it("renders one editable line per invoice line and recomputes the total", async () => {
    const user = userEvent.setup()
    render(<MobileEditInvoicePage invoice={makeInvoice()} id="inv1" />)

    const label = screen.getByLabelText("Libellé de la ligne")
    expect(label).toHaveValue("Ligne existante")
    expect(totalText()).toBe(normalized(fmtEUR(500)))

    const qty = screen.getByLabelText("Quantité")
    await user.clear(qty)
    await user.type(qty, "3")

    expect(totalText()).toBe(normalized(fmtEUR(1500)))
  })

  it("adds a line on task tap and removes it on a second tap", async () => {
    const user = userEvent.setup()
    render(<MobileEditInvoicePage invoice={makeInvoice()} id="inv1" />)

    await user.click(taskRow("TRI-1"))
    expect(taskRow("TRI-1")).toHaveAttribute("aria-pressed", "true")
    expect(screen.getAllByLabelText("Libellé de la ligne")).toHaveLength(2)

    await user.click(taskRow("TRI-1"))
    expect(taskRow("TRI-1")).toHaveAttribute("aria-pressed", "false")
    expect(screen.getAllByLabelText("Libellé de la ligne")).toHaveLength(1)
  })

  it("calls the update mutation once when saving", async () => {
    const user = userEvent.setup()
    render(<MobileEditInvoicePage invoice={makeInvoice()} id="inv1" />)

    await user.click(
      screen.getByRole("button", { name: /Sauver les modifications/ }),
    )

    expect(h.updateMutate).toHaveBeenCalledTimes(1)
    const payload = h.updateMutate.mock.calls[0]?.[0] as { status: string }
    expect(payload.status).toBe("DRAFT")
  })

  it("shows the payments warning only when the invoice has payments", () => {
    const { unmount } = render(
      <MobileEditInvoicePage invoice={makeInvoice()} id="inv1" />,
    )
    expect(screen.queryByText(/de paiements/)).not.toBeInTheDocument()
    unmount()

    render(
      <MobileEditInvoicePage
        invoice={makeInvoice({ paidAmount: 200 })}
        id="inv1"
      />,
    )
    expect(screen.getByText(/de paiements/)).toBeInTheDocument()
  })
})
