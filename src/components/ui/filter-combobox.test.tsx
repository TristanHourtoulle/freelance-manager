import { useState } from "react"
import { fireEvent, render, screen, within } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import {
  FilterCombobox,
  type FilterComboboxGroup,
  type FilterComboboxOption,
} from "./filter-combobox"

const GROUPS: FilterComboboxGroup[] = [
  { id: "clients", label: "Clients" },
  { id: "projects-c1", label: "Projets · Quintyss" },
]

const OPTIONS: FilterComboboxOption[] = [
  { id: "c1", label: "Quintyss", groupId: "clients" },
  { id: "c2", label: "Émilie Dupont", groupId: "clients" },
  { id: "p1", label: "Refonte", groupId: "projects-c1", hint: "REF" },
  { id: "p2", label: "App mobile", groupId: "projects-c1", hint: "APP" },
]

function Harness({
  initial = [],
  onChangeSpy,
}: {
  initial?: string[]
  onChangeSpy?: (ids: string[]) => void
}) {
  const [selected, setSelected] = useState<string[]>(initial)
  return (
    <FilterCombobox
      label="Filtres"
      options={OPTIONS}
      groups={GROUPS}
      selected={selected}
      onChange={(ids) => {
        onChangeSpy?.(ids)
        setSelected(ids)
      }}
      placeholder="Rechercher un client ou un projet…"
    />
  )
}

function openPopover() {
  fireEvent.click(screen.getByRole("button", { name: /^Filtres/ }))
  return screen.getByRole("combobox")
}

describe("FilterCombobox", () => {
  it("opens on trigger click with focus in the search field and closes on outside click", () => {
    render(<Harness />)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()

    const input = openPopover()

    expect(screen.getByRole("listbox")).toBeInTheDocument()
    expect(document.activeElement).toBe(input)

    fireEvent.mouseDown(document.body)
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("exposes the multi-select listbox pattern", () => {
    render(<Harness initial={["c1"]} />)
    openPopover()

    const list = screen.getByRole("listbox")
    expect(list).toHaveAttribute("aria-multiselectable", "true")
    const options = screen.getAllByRole("option")
    expect(options).toHaveLength(4)
    expect(screen.getByRole("option", { name: /Quintyss/ })).toHaveAttribute(
      "aria-selected",
      "true",
    )
    expect(screen.getByRole("option", { name: /Refonte/ })).toHaveAttribute(
      "aria-selected",
      "false",
    )
  })

  it("renders group headers with their options nested", () => {
    render(<Harness />)
    openPopover()

    const groups = screen.getAllByRole("group")
    expect(groups).toHaveLength(2)
    expect(groups[0]).toHaveTextContent("Clients")
    expect(within(groups[0]!).getAllByRole("option")).toHaveLength(2)
    expect(groups[1]).toHaveTextContent("Projets · Quintyss")
    expect(within(groups[1]!).getAllByRole("option")).toHaveLength(2)
  })

  it("filters as you type, accent- and case-insensitively", () => {
    render(<Harness />)
    const input = openPopover()

    fireEvent.change(input, { target: { value: "quintyss" } })
    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(screen.getByRole("option", { name: /Quintyss/ })).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "emilie" } })
    expect(screen.getAllByRole("option")).toHaveLength(1)
    expect(
      screen.getByRole("option", { name: /Émilie Dupont/ }),
    ).toBeInTheDocument()

    fireEvent.change(input, { target: { value: "zzz" } })
    expect(screen.queryAllByRole("option")).toHaveLength(0)
    expect(screen.getByText("Aucun résultat")).toBeInTheDocument()
  })

  it("toggles multiple options on click and keeps the popover open", () => {
    const spy = vi.fn()
    render(<Harness onChangeSpy={spy} />)
    openPopover()

    fireEvent.click(screen.getByRole("option", { name: /Quintyss/ }))
    expect(spy).toHaveBeenLastCalledWith(["c1"])
    fireEvent.click(screen.getByRole("option", { name: /Refonte/ }))
    expect(spy).toHaveBeenLastCalledWith(["c1", "p1"])
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.click(screen.getByRole("option", { name: /Quintyss/ }))
    expect(spy).toHaveBeenLastCalledWith(["p1"])
  })

  it("navigates with arrows and toggles with Enter via aria-activedescendant", () => {
    const spy = vi.fn()
    render(<Harness onChangeSpy={spy} />)
    const input = openPopover()

    const firstOption = screen.getByRole("option", { name: /Quintyss/ })
    expect(input).toHaveAttribute("aria-activedescendant", firstOption.id)

    fireEvent.keyDown(input, { key: "ArrowDown" })
    const secondOption = screen.getByRole("option", { name: /Émilie Dupont/ })
    expect(input).toHaveAttribute("aria-activedescendant", secondOption.id)

    fireEvent.keyDown(input, { key: "Enter" })
    expect(spy).toHaveBeenLastCalledWith(["c2"])
    expect(screen.getByRole("listbox")).toBeInTheDocument()

    fireEvent.keyDown(input, { key: "ArrowUp" })
    expect(input).toHaveAttribute("aria-activedescendant", firstOption.id)
  })

  it("closes on Escape and restores focus to the trigger", () => {
    render(<Harness />)
    openPopover()

    fireEvent.keyDown(document, { key: "Escape" })

    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
    expect(document.activeElement).toBe(
      screen.getByRole("button", { name: /^Filtres/ }),
    )
  })

  it("shows a count badge and clears everything via Tout effacer", () => {
    const spy = vi.fn()
    render(<Harness initial={["c1", "p1"]} onChangeSpy={spy} />)

    expect(screen.getByRole("button", { name: /^Filtres/ })).toHaveTextContent(
      "2",
    )

    openPopover()
    fireEvent.click(screen.getByRole("button", { name: "Tout effacer" }))
    expect(spy).toHaveBeenLastCalledWith([])
  })

  it("clears from the trigger-side affordance without opening", () => {
    const spy = vi.fn()
    render(<Harness initial={["c1"]} onChangeSpy={spy} />)

    fireEvent.click(
      screen.getByRole("button", { name: "Effacer les filtres Filtres" }),
    )

    expect(spy).toHaveBeenLastCalledWith([])
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument()
  })

  it("preserves selected ids that are missing from the options", () => {
    const spy = vi.fn()
    render(<Harness initial={["ghost"]} onChangeSpy={spy} />)
    openPopover()

    fireEvent.click(screen.getByRole("option", { name: /Quintyss/ }))

    expect(spy).toHaveBeenLastCalledWith(["ghost", "c1"])
  })

  it("marks the trigger chevron as open only while the popover is open", () => {
    render(<Harness />)
    const trigger = screen.getByRole("button", { name: /^Filtres/ })
    const chevron = () => trigger.querySelector(".filter-combobox-chevron")

    expect(chevron()).not.toBeNull()
    expect(chevron()).not.toHaveClass("is-open")
    expect(chevron()).toHaveAttribute("aria-hidden", "true")

    fireEvent.click(trigger)
    expect(chevron()).toHaveClass("is-open")

    fireEvent.mouseDown(document.body)
    expect(chevron()).not.toHaveClass("is-open")
    expect(trigger).toHaveAccessibleName("Filtres")
  })

  it("renders no native select", () => {
    const { container } = render(<Harness />)
    openPopover()
    expect(container.querySelector("select")).toBeNull()
  })
})
