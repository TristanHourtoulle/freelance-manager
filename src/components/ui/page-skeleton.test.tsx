import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { PageSkeleton } from "./page-skeleton"

describe("PageSkeleton", () => {
  it("reuses the real page container classes", () => {
    const { container } = render(<PageSkeleton />)
    expect(container.querySelector(".page")).not.toBeNull()
    expect(container.querySelector(".page-header")).not.toBeNull()
    expect(container.querySelector(".page-actions")).not.toBeNull()
  })

  it("exposes a polite live region with the French message", () => {
    render(<PageSkeleton />)
    const status = screen.getByRole("status")
    expect(status.getAttribute("aria-live")).toBe("polite")
    expect(status).toHaveTextContent("Chargement en cours…")
  })

  it("renders no visible loading text", () => {
    const { container } = render(<PageSkeleton />)
    const srOnly = container.querySelector(".sr-only")
    expect(srOnly).not.toBeNull()
    expect(container.textContent).toBe("Chargement en cours…")
  })

  it("honours a custom label", () => {
    render(<PageSkeleton label="Chargement de l'espace de travail…" />)
    expect(screen.getByRole("status")).toHaveTextContent(
      "Chargement de l'espace de travail…",
    )
  })

  it("renders four KPI tiles by default", () => {
    const { container } = render(<PageSkeleton />)
    expect(container.querySelectorAll(".kpi")).toHaveLength(4)
  })

  it("renders the requested number of KPI tiles", () => {
    const { container } = render(<PageSkeleton kpis={3} />)
    expect(container.querySelectorAll(".kpi")).toHaveLength(3)
  })

  it("omits the KPI grid entirely when kpis is zero", () => {
    const { container } = render(<PageSkeleton kpis={0} />)
    expect(container.querySelector(".kpi-grid")).toBeNull()
    expect(container.querySelectorAll(".kpi")).toHaveLength(0)
  })

  it("omits the chart card by default", () => {
    const { container } = render(<PageSkeleton />)
    expect(container.querySelectorAll(".card")).toHaveLength(1)
  })

  it("adds a chart card when showChart is set", () => {
    const { container } = render(<PageSkeleton showChart />)
    expect(container.querySelectorAll(".card")).toHaveLength(2)
  })

  it("renders eight table rows by default", () => {
    const { container } = render(<PageSkeleton kpis={0} />)
    expect(container.querySelectorAll(".card > div > div")).toHaveLength(8)
  })

  it("renders the requested number of table rows", () => {
    const { container } = render(<PageSkeleton kpis={0} rows={3} />)
    expect(container.querySelectorAll(".card > div > div")).toHaveLength(3)
  })

  it("contains no focusable elements", () => {
    const { container } = render(<PageSkeleton showChart />)
    expect(
      container.querySelectorAll(
        "a, button, input, select, textarea, [tabindex]",
      ),
    ).toHaveLength(0)
  })
})
