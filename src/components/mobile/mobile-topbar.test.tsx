import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

const cmdk = vi.fn<() => { open: () => void; close: () => void } | null>()

vi.mock("@/components/cmdk/cmdk-provider", () => ({
  useOptionalCmdK: () => cmdk(),
}))

import { MobileTopbar } from "./mobile-topbar"

const open = vi.fn()

afterEach(() => {
  cmdk.mockReset()
  open.mockReset()
})

describe("MobileTopbar", () => {
  it("renders a search button that opens the palette", async () => {
    cmdk.mockReturnValue({ open, close: vi.fn() })
    render(<MobileTopbar title="Clients" />)
    await userEvent.click(screen.getByRole("button", { name: "Rechercher" }))
    expect(open).toHaveBeenCalledTimes(1)
  })

  it("hides the search button when search is disabled", () => {
    cmdk.mockReturnValue({ open, close: vi.fn() })
    render(<MobileTopbar title="Clients" search={false} />)
    expect(
      screen.queryByRole("button", { name: "Rechercher" }),
    ).not.toBeInTheDocument()
  })

  it("renders without a palette provider and shows no search button", () => {
    cmdk.mockReturnValue(null)
    expect(() => render(<MobileTopbar title="Clients" />)).not.toThrow()
    expect(
      screen.queryByRole("button", { name: "Rechercher" }),
    ).not.toBeInTheDocument()
  })
})
