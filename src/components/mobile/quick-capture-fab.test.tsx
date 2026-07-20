import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

const pathname = vi.fn<() => string>()

vi.mock("next/navigation", () => ({
  usePathname: () => pathname(),
}))

const capture = vi.fn<() => { open: () => void; close: () => void } | null>()

vi.mock("@/components/capture/quick-capture-provider", () => ({
  useOptionalQuickCapture: () => capture(),
}))

import { QuickCaptureFab } from "./quick-capture-fab"

afterEach(() => {
  pathname.mockReset()
  capture.mockReset()
})

const open = vi.fn()

function mountedCapture() {
  return { open, close: vi.fn() }
}

describe("QuickCaptureFab", () => {
  it("renders the capture button on the dashboard", () => {
    pathname.mockReturnValue("/dashboard")
    capture.mockReturnValue(mountedCapture())
    render(<QuickCaptureFab />)
    expect(
      screen.getByRole("button", { name: "Nouvelle action" }),
    ).toBeInTheDocument()
  })

  it.each(["/tasks", "/billing/new", "/billing/new/anything"])(
    "renders nothing on %s",
    (route) => {
      pathname.mockReturnValue(route)
      capture.mockReturnValue(mountedCapture())
      const { container } = render(<QuickCaptureFab />)
      expect(container).toBeEmptyDOMElement()
    },
  )

  it("renders nothing without a quick-capture provider", () => {
    pathname.mockReturnValue("/dashboard")
    capture.mockReturnValue(null)
    const { container } = render(<QuickCaptureFab />)
    expect(container).toBeEmptyDOMElement()
  })

  it("opens quick capture exactly once per click", async () => {
    open.mockReset()
    pathname.mockReturnValue("/clients")
    capture.mockReturnValue(mountedCapture())
    render(<QuickCaptureFab />)
    await userEvent.click(
      screen.getByRole("button", { name: "Nouvelle action" }),
    )
    expect(open).toHaveBeenCalledTimes(1)
  })
})
