import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { NewClientModal } from "./new-client-modal"

const { push, mutate } = vi.hoisted(() => ({
  push: vi.fn(),
  mutate: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

vi.mock("@/hooks/use-clients", () => ({
  useCreateClient: () => ({ mutate, isPending: false }),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe("NewClientModal", () => {
  it("navigates to the new client's detail page after creation", () => {
    mutate.mockImplementation(
      (
        _input: unknown,
        opts: {
          onSuccess: (c: {
            id: string
            firstName: string
            lastName: string
          }) => void
        },
      ) => {
        opts.onSuccess({
          id: "client-42",
          firstName: "Henri",
          lastName: "Mistral",
        })
      },
    )
    const onClose = vi.fn()
    render(<NewClientModal onClose={onClose} />)

    fireEvent.change(screen.getByPlaceholderText("Henri"), {
      target: { value: "Henri" },
    })
    fireEvent.change(screen.getByPlaceholderText("Mistral"), {
      target: { value: "Mistral" },
    })
    fireEvent.click(screen.getByText("Créer le client"))

    expect(onClose).toHaveBeenCalledTimes(1)
    expect(push).toHaveBeenCalledWith("/clients/client-42")
  })

  it("exposes every field by its visible label", () => {
    render(<NewClientModal onClose={vi.fn()} />)

    expect(screen.getByLabelText("Prénom")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("Nom")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("Entreprise")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("Email")).toBeInstanceOf(HTMLInputElement)
    expect(screen.getByLabelText("Taux (€/jour)")).toBeInstanceOf(
      HTMLInputElement,
    )
  })

  it("keeps the accessible name once the field has a value", () => {
    render(<NewClientModal onClose={vi.fn()} />)

    const firstName = screen.getByLabelText("Prénom")
    fireEvent.change(firstName, { target: { value: "Henri" } })

    expect(screen.getByLabelText("Prénom")).toBe(firstName)
  })

  it("labels the billing mode button group", () => {
    render(<NewClientModal onClose={vi.fn()} />)

    expect(
      screen.getByRole("group", { name: "Type de facturation" }),
    ).toBeInTheDocument()
  })
})
