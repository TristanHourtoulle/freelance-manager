import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { MobileSheet } from "@/components/mobile/mobile-sheet"
import { Modal } from "./modal"

describe("Modal", () => {
  it("moves initial focus inside the modal", () => {
    render(
      <Modal title="Nouveau client" onClose={vi.fn()}>
        <input aria-label="Prénom" />
      </Modal>,
    )
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Fermer" }),
    )
  })

  it("traps Tab focus within the modal", () => {
    render(
      <Modal title="Nouveau client" onClose={vi.fn()}>
        <button>Premier</button>
        <button>Dernier</button>
      </Modal>,
    )
    const last = screen.getByRole("button", { name: "Dernier" })
    last.focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Fermer" }),
    )
  })

  it("wraps backwards on Shift+Tab from the first focusable", () => {
    render(
      <Modal title="Nouveau client" onClose={vi.fn()}>
        <button>Premier</button>
        <button>Dernier</button>
      </Modal>,
    )
    screen.getByRole("button", { name: "Fermer" }).focus()
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Dernier" }),
    )
  })

  it("restores focus to the trigger on close", () => {
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()

    const { unmount } = render(
      <Modal title="Nouveau client" onClose={vi.fn()}>
        <button>Action</button>
      </Modal>,
    )
    expect(document.activeElement).not.toBe(trigger)

    unmount()
    expect(document.activeElement).toBe(trigger)
    trigger.remove()
  })

  it("locks body scroll while open and restores it on close", () => {
    const { unmount } = render(
      <Modal title="Nouveau client" onClose={vi.fn()}>
        <button>Action</button>
      </Modal>,
    )
    expect(document.body.style.overflow).toBe("hidden")
    unmount()
    expect(document.body.style.overflow).toBe("")
  })

  it("closes on Escape", () => {
    const onClose = vi.fn()
    render(
      <Modal title="Nouveau client" onClose={onClose}>
        <button>Action</button>
      </Modal>,
    )
    fireEvent.keyDown(document, { key: "Escape" })
    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it("closes only the topmost dialog on Escape when a sheet is stacked on top", () => {
    const closeModal = vi.fn()
    const closeSheet = vi.fn()

    function Stacked({ sheetOpen }: { sheetOpen: boolean }) {
      return (
        <Modal title="Nouveau client" onClose={closeModal}>
          <button>Extérieur</button>
          {sheetOpen && (
            <MobileSheet onClose={closeSheet} title="Paiement partiel">
              <button>Intérieur</button>
            </MobileSheet>
          )}
        </Modal>
      )
    }

    const { rerender } = render(<Stacked sheetOpen={false} />)
    rerender(<Stacked sheetOpen />)

    fireEvent.keyDown(document, { key: "Escape" })
    expect(closeSheet).toHaveBeenCalledTimes(1)
    expect(closeModal).not.toHaveBeenCalled()

    rerender(<Stacked sheetOpen={false} />)
    fireEvent.keyDown(document, { key: "Escape" })
    expect(closeModal).toHaveBeenCalledTimes(1)
    expect(closeSheet).toHaveBeenCalledTimes(1)
  })

  it("keeps the Tab trap inside the topmost stacked dialog", () => {
    render(
      <Modal title="Nouveau client" onClose={vi.fn()}>
        <button>Extérieur</button>
        <MobileSheet onClose={vi.fn()} title="Paiement partiel">
          <button>Premier</button>
          <button>Dernier</button>
        </MobileSheet>
      </Modal>,
    )
    screen.getByRole("button", { name: "Dernier" }).focus()
    fireEvent.keyDown(document, { key: "Tab" })
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: "Premier" }),
    )
  })

  it("keeps body scroll locked until every stacked dialog is closed", () => {
    function Stacked({ sheetOpen }: { sheetOpen: boolean }) {
      return (
        <Modal title="Nouveau client" onClose={vi.fn()}>
          <button>Extérieur</button>
          {sheetOpen && (
            <MobileSheet onClose={vi.fn()} title="Paiement partiel">
              <button>Intérieur</button>
            </MobileSheet>
          )}
        </Modal>
      )
    }

    const { rerender, unmount } = render(<Stacked sheetOpen />)
    expect(document.body.style.overflow).toBe("hidden")

    rerender(<Stacked sheetOpen={false} />)
    expect(document.body.style.overflow).toBe("hidden")

    unmount()
    expect(document.body.style.overflow).toBe("")
  })
})
