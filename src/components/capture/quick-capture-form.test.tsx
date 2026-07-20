import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const mutate = vi.fn()

vi.mock("@/hooks/use-actions", () => ({
  useCreateAction: () => ({ mutate, isPending: false }),
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({
    data: [
      {
        id: "c1",
        firstName: "Ada",
        lastName: "Lovelace",
        company: "Acme SAS",
      },
    ],
  }),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

import { QuickCaptureForm } from "./quick-capture-form"

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true })
  vi.setSystemTime(new Date(2026, 6, 15, 10, 0))
  mutate.mockReset()
})

afterEach(() => {
  vi.useRealTimers()
})

function payload() {
  return mutate.mock.calls[0]![0] as Record<string, unknown>
}

describe("QuickCaptureForm", () => {
  it("enables submit on a title alone, with no client selected", async () => {
    const user = userEvent.setup()
    render(<QuickCaptureForm onDone={vi.fn()} />)

    const submit = screen.getByRole("button", { name: "Créer" })
    expect(submit).toBeDisabled()

    await user.type(screen.getByLabelText("Intitulé"), "Appel client")
    expect(submit).toBeEnabled()
  })

  it("creates an unclassified OTHER action without a due date", async () => {
    const user = userEvent.setup()
    render(<QuickCaptureForm onDone={vi.fn()} />)

    await user.type(screen.getByLabelText("Intitulé"), "Appel client")
    await user.click(screen.getByRole("button", { name: "Créer" }))

    expect(payload()).toEqual({
      type: "OTHER",
      title: "Appel client",
      dueDate: null,
      clientId: null,
    })
  })

  it("sends tomorrow's local date when the Demain chip is picked", async () => {
    const user = userEvent.setup()
    render(<QuickCaptureForm onDone={vi.fn()} />)

    await user.type(screen.getByLabelText("Intitulé"), "Relire le devis")
    await user.click(screen.getByRole("button", { name: "Demain" }))
    await user.click(screen.getByRole("button", { name: "Créer" }))

    expect(payload().dueDate).toBe("2026-07-16")
  })

  it("sends the selected client id", async () => {
    const user = userEvent.setup()
    render(<QuickCaptureForm onDone={vi.fn()} />)

    await user.type(screen.getByLabelText("Intitulé"), "Relancer Acme")
    await user.selectOptions(screen.getByLabelText("Client"), "c1")
    await user.click(screen.getByRole("button", { name: "Créer" }))

    expect(payload().clientId).toBe("c1")
  })
})
