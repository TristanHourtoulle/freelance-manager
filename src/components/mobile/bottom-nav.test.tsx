import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const pathname = vi.fn<() => string>()

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}))

import { BottomNav } from "./bottom-nav"

afterEach(() => {
  pathname.mockReset()
})

describe("BottomNav", () => {
  it("marks exactly one tab with aria-current=page", () => {
    pathname.mockReturnValue("/tasks")
    render(<BottomNav />)
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent("Tasks")
  })

  it("marks a tab active on nested routes", () => {
    pathname.mockReturnValue("/clients/123")
    render(<BottomNav />)
    const clients = screen.getByRole("link", { name: /Clients/ })
    expect(clients).toHaveAttribute("aria-current", "page")
  })

  it("omits aria-current when no tab matches", () => {
    pathname.mockReturnValue("/unknown")
    render(<BottomNav />)
    const current = screen
      .getAllByRole("link")
      .filter((link) => link.getAttribute("aria-current") === "page")
    expect(current).toHaveLength(0)
  })
})
