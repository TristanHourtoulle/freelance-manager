import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobilePageSkeleton } from "./mobile-page-skeleton"

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
}))

describe("MobilePageSkeleton", () => {
  it("mirrors the mobile frame containers", () => {
    const { container } = render(<MobilePageSkeleton title="Clients" />)
    expect(container.querySelector(".m-screen")).not.toBeNull()
    expect(container.querySelector(".m-topbar")).not.toBeNull()
    expect(container.querySelector(".m-content")).not.toBeNull()
    expect(container.querySelector(".m-stack")).not.toBeNull()
  })

  it("paints the real topbar title", () => {
    render(<MobilePageSkeleton title="Factures" />)
    expect(screen.getByText("Factures")).toBeInTheDocument()
  })

  it("paints the real big header when heading and subtitle are given", () => {
    const { container } = render(
      <MobilePageSkeleton
        title="Pilotage"
        heading="Pilotage"
        subtitle="Vue d'ensemble du mois"
      />,
    )
    expect(container.querySelector(".big-header")).not.toBeNull()
    expect(container.querySelector(".big-title")).toHaveTextContent("Pilotage")
    expect(container.querySelector(".big-sub")).toHaveTextContent(
      "Vue d'ensemble du mois",
    )
  })

  it("omits the big header when the twin has none", () => {
    const { container } = render(<MobilePageSkeleton title="Clients" />)
    expect(container.querySelector(".big-header")).toBeNull()
  })

  it("renders four KPI tiles for the tiles variant", () => {
    const { container } = render(
      <MobilePageSkeleton title="Pilotage" variant="tiles" />,
    )
    expect(container.querySelectorAll(".kpi-tile")).toHaveLength(4)
  })

  it("renders no KPI tiles for the list variant", () => {
    const { container } = render(
      <MobilePageSkeleton title="Clients" variant="list" />,
    )
    expect(container.querySelectorAll(".kpi-tile")).toHaveLength(0)
  })

  it("renders the chip row for tiles and list but not for builder", () => {
    const list = render(
      <MobilePageSkeleton title="Clients" variant="list" />,
    ).container
    expect(list.querySelector(".chip-row")).not.toBeNull()

    const builder = render(
      <MobilePageSkeleton title="Nouvelle facture" variant="builder" />,
    ).container
    expect(builder.querySelector(".chip-row")).toBeNull()
  })

  it("renders six rows by default using the real card geometry", () => {
    const { container } = render(<MobilePageSkeleton title="Clients" />)
    expect(container.querySelectorAll(".card.card-tight")).toHaveLength(6)
  })

  it("renders the requested number of rows", () => {
    const { container } = render(<MobilePageSkeleton title="Tasks" rows={7} />)
    expect(container.querySelectorAll(".card.card-tight")).toHaveLength(7)
  })

  it("exposes a polite live region with the French message", () => {
    render(<MobilePageSkeleton title="Clients" />)
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status).toHaveTextContent("Chargement en cours…")
  })

  it("shows no visible loading text beyond the real page copy", () => {
    const { container } = render(<MobilePageSkeleton title="Clients" />)
    expect(container.textContent).toBe("Chargement en cours…Clients")
  })

  it("contains no focusable elements when no back target is given", () => {
    const { container } = render(
      <MobilePageSkeleton title="Clients" variant="tiles" />,
    )
    expect(
      container.querySelectorAll(
        "a, button, input, select, textarea, [tabindex]",
      ),
    ).toHaveLength(0)
  })

  it("renders the back button only when a back target is given", () => {
    render(<MobilePageSkeleton title="Analytics" back="/more" />)
    expect(screen.getByLabelText("Retour")).toBeInTheDocument()
  })
})
