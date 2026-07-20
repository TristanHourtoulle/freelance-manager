import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { AppBootSkeleton } from "./app-boot-skeleton"
import { NAV_SECTIONS } from "@/lib/navigation"

const NAV_ITEMS = NAV_SECTIONS.flatMap((s) => s.items)

describe("AppBootSkeleton", () => {
  it("mirrors the AppShell containers", () => {
    const { container } = render(<AppBootSkeleton />)
    expect(container.querySelector(".app")).not.toBeNull()
    expect(container.querySelector(".sidebar")).not.toBeNull()
    expect(container.querySelector(".main")).not.toBeNull()
    expect(container.querySelector(".topbar")).not.toBeNull()
    expect(container.querySelectorAll(".desktop-only")).toHaveLength(2)
  })

  it("paints the real brand identity", () => {
    render(<AppBootSkeleton />)
    expect(screen.getByText("FreelanceManager")).toBeInTheDocument()
    expect(screen.getByText("v0.4 · perso")).toBeInTheDocument()
  })

  it("paints every real nav label instead of skeletonising it", () => {
    render(<AppBootSkeleton />)
    for (const item of NAV_ITEMS) {
      expect(screen.getByText(item.label)).toBeInTheDocument()
    }
  })

  it("paints every real section title", () => {
    render(<AppBootSkeleton />)
    for (const section of NAV_SECTIONS) {
      if (section.title) {
        expect(screen.getByText(section.title)).toBeInTheDocument()
      }
    }
  })

  it("renders one nav item per navigation entry", () => {
    const { container } = render(<AppBootSkeleton />)
    expect(container.querySelectorAll(".nav-item")).toHaveLength(
      NAV_ITEMS.length,
    )
  })

  it("skeletonises only the badge counts", () => {
    const { container } = render(<AppBootSkeleton />)
    const badged = NAV_ITEMS.filter((i) => i.badgeKey).length
    expect(container.querySelectorAll(".nav-item .badge")).toHaveLength(badged)
  })

  it("paints the real search placeholder and shortcut", () => {
    render(<AppBootSkeleton />)
    expect(
      screen.getByText("Rechercher tasks, clients, factures…"),
    ).toBeInTheDocument()
    expect(screen.getByText("⌘K")).toBeInTheDocument()
  })

  it("exposes a single polite live region with the boot message", () => {
    const { container } = render(<AppBootSkeleton />)
    expect(container.querySelectorAll('[role="status"]')).toHaveLength(1)
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status).toHaveTextContent("Chargement de l'espace de travail…")
  })

  it("does not render the mobile bottom nav", () => {
    const { container } = render(<AppBootSkeleton />)
    expect(container.querySelector(".bottom-nav")).toBeNull()
    expect(container.querySelector(".mobile-only")).toBeNull()
  })

  it("contains no focusable elements", () => {
    const { container } = render(<AppBootSkeleton />)
    expect(
      container.querySelectorAll(
        "a, button, input, select, textarea, [tabindex]",
      ),
    ).toHaveLength(0)
  })
})
