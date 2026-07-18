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
})
