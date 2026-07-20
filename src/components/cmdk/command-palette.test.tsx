import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  CommandPalette,
  type CommandItem,
} from "@/components/cmdk/command-palette"

function makeCommands(): CommandItem[] {
  return [
    {
      id: "go-dashboard",
      group: "Navigation",
      label: "Aller au dashboard",
      run: vi.fn(),
    },
    {
      id: "go-clients",
      group: "Navigation",
      label: "Aller aux clients",
      run: vi.fn(),
    },
    {
      id: "new-invoice",
      group: "Actions",
      label: "Nouvelle facture",
      run: vi.fn(),
    },
  ]
}

describe("CommandPalette", () => {
  it("exposes combobox and listbox semantics", () => {
    render(<CommandPalette open onClose={vi.fn()} commands={makeCommands()} />)

    const input = screen.getByRole("combobox")
    const list = screen.getByRole("listbox")
    expect(input).toHaveAttribute("aria-expanded", "true")
    expect(input).toHaveAttribute("aria-controls", list.id)
    expect(screen.getAllByRole("option")).toHaveLength(3)
  })

  it("keeps an accessible name on the input while typing", () => {
    render(<CommandPalette open onClose={vi.fn()} commands={makeCommands()} />)

    const input = screen.getByRole("combobox", {
      name: "Rechercher une commande",
    })
    fireEvent.change(input, { target: { value: "fact" } })
    expect(
      screen.getByRole("combobox", { name: "Rechercher une commande" }),
    ).toBe(input)
  })

  it("moves aria-activedescendant with the arrow keys", () => {
    render(<CommandPalette open onClose={vi.fn()} commands={makeCommands()} />)

    const input = screen.getByRole("combobox")
    const options = screen.getAllByRole("option")
    expect(input).toHaveAttribute("aria-activedescendant", options[0]?.id)
    expect(options[0]).toHaveAttribute("aria-selected", "true")

    fireEvent.keyDown(window, { key: "ArrowDown" })
    expect(input).toHaveAttribute("aria-activedescendant", options[1]?.id)
    expect(screen.getAllByRole("option")[1]).toHaveAttribute(
      "aria-selected",
      "true",
    )

    fireEvent.keyDown(window, { key: "ArrowUp" })
    expect(input).toHaveAttribute("aria-activedescendant", options[0]?.id)
  })

  it("announces the result count in a polite live region", () => {
    render(<CommandPalette open onClose={vi.fn()} commands={makeCommands()} />)

    const status = screen.getByRole("status")
    expect(status).toHaveAttribute("aria-live", "polite")
    expect(status).toHaveTextContent("3 résultats disponibles")

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "zzzzzz" },
    })
    expect(screen.getByRole("status")).toHaveTextContent("Aucun résultat")
  })

  it("keeps focus inside the modal when tabbing", () => {
    const outside = document.createElement("button")
    document.body.appendChild(outside)

    render(<CommandPalette open onClose={vi.fn()} commands={makeCommands()} />)

    const input = screen.getByRole("combobox")
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(window, { key: "Tab" })
    expect(document.activeElement).toBe(input)

    fireEvent.keyDown(window, { key: "Tab", shiftKey: true })
    expect(document.activeElement).toBe(input)

    outside.remove()
  })

  it("restores focus to the trigger when it closes", () => {
    const trigger = document.createElement("button")
    document.body.appendChild(trigger)
    trigger.focus()
    expect(document.activeElement).toBe(trigger)

    const { rerender } = render(
      <CommandPalette open onClose={vi.fn()} commands={makeCommands()} />,
    )
    expect(document.activeElement).toBe(screen.getByRole("combobox"))

    rerender(
      <CommandPalette
        open={false}
        onClose={vi.fn()}
        commands={makeCommands()}
      />,
    )
    expect(document.activeElement).toBe(trigger)

    trigger.remove()
  })
})
