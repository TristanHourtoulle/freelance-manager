import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { LinearMappingsModal } from "./linear-mappings-modal"

const { push, hasLinearToken } = vi.hoisted(() => ({
  push: vi.fn(),
  hasLinearToken: { value: false },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push, refresh: vi.fn() }),
}))

vi.mock("@/hooks/use-settings", () => ({
  useSettings: () => ({ data: { hasLinearToken: hasLinearToken.value } }),
}))

vi.mock("@/hooks/use-linear", () => ({
  useAddLinearMapping: () => ({ mutate: vi.fn(), isPending: false }),
  useLinearProjects: () => ({ data: [], isLoading: false }),
}))

vi.mock("@/hooks/use-projects", () => ({
  useDeleteProject: () => ({ mutate: vi.fn(), isPending: false }),
  useProjects: () => ({ data: [] }),
}))

vi.mock("@/hooks/use-clients", () => ({
  useClients: () => ({ data: [] }),
}))

vi.mock("@/components/providers/toast-provider", () => ({
  useToast: () => ({ toast: vi.fn() }),
}))

describe("LinearMappingsModal", () => {
  it("shows token guidance and links to settings when no Linear token", () => {
    hasLinearToken.value = false
    render(<LinearMappingsModal onClose={vi.fn()} />)

    expect(
      screen.getByText("Connecte d'abord ton token Linear"),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByText("Configurer le token"))
    expect(push).toHaveBeenCalledWith("/settings")
  })

  it("does not show the token guidance when a token is present", () => {
    hasLinearToken.value = true
    render(<LinearMappingsModal onClose={vi.fn()} />)

    expect(
      screen.queryByText("Connecte d'abord ton token Linear"),
    ).not.toBeInTheDocument()
  })
})
