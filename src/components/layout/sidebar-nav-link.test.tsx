import { render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

const pathname = vi.fn<() => string>()

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}))

vi.mock("@/components/ui/icon", () => ({
  Icon: () => <svg data-testid="icon" />,
}))

import { SidebarNavLink } from "./sidebar-nav-link"

afterEach(() => {
  pathname.mockReset()
})

describe("SidebarNavLink", () => {
  it("marks the active link with aria-current=page", () => {
    pathname.mockReturnValue("/clients")
    render(<SidebarNavLink href="/clients" label="Clients" icon="users" />)
    expect(screen.getByRole("link")).toHaveAttribute("aria-current", "page")
  })

  it("omits aria-current on inactive links", () => {
    pathname.mockReturnValue("/tasks")
    render(<SidebarNavLink href="/clients" label="Clients" icon="users" />)
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current")
  })

  it("treats /dashboard as active only on exact match", () => {
    pathname.mockReturnValue("/dashboard/anything")
    render(<SidebarNavLink href="/dashboard" label="Accueil" icon="home" />)
    expect(screen.getByRole("link")).not.toHaveAttribute("aria-current")
  })
})
