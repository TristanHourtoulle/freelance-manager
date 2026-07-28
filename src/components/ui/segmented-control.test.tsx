import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { describe, expect, it, vi } from "vitest"
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control"

type Sample = "one" | "two" | "three"

const OPTIONS: readonly SegmentedControlOption<Sample>[] = [
  { id: "one", label: "Un" },
  { id: "two", label: "Deux", count: 4 },
  { id: "three", label: "Trois" },
]

describe("SegmentedControl", () => {
  it("renders every option as a typed button", () => {
    render(
      <SegmentedControl options={OPTIONS} value="one" onChange={vi.fn()} />,
    )
    const buttons = screen.getAllByRole("button")
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button).toHaveAttribute("type", "button")
    }
    expect(screen.getByRole("button", { name: /Un/ })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /Trois/ })).toBeInTheDocument()
  })

  it("marks only the selected option with aria-pressed", () => {
    render(
      <SegmentedControl options={OPTIONS} value="two" onChange={vi.fn()} />,
    )
    expect(screen.getByRole("button", { name: /Deux/ })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: /Un/ })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
    expect(screen.getByRole("button", { name: /Deux/ })).toHaveClass("active")
  })

  it("fires onChange with the clicked option id", async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(
      <SegmentedControl options={OPTIONS} value="one" onChange={onChange} />,
    )
    await user.click(screen.getByRole("button", { name: /Trois/ }))
    expect(onChange).toHaveBeenCalledTimes(1)
    expect(onChange).toHaveBeenCalledWith("three")
  })

  it("renders the count badge when provided", () => {
    render(
      <SegmentedControl options={OPTIONS} value="one" onChange={vi.fn()} />,
    )
    const badge = screen.getByText("4")
    expect(badge).toHaveClass("count")
    expect(screen.getByRole("button", { name: /Deux/ })).toContainElement(badge)
  })

  it("renders an icon-only button exposing its label as accessible name", () => {
    const iconOptions: readonly SegmentedControlOption<"grid" | "list">[] = [
      { id: "grid", label: "Vue grille", icon: "grid" },
      { id: "list", label: "Vue liste", icon: "list" },
    ]
    render(
      <SegmentedControl
        options={iconOptions}
        value="grid"
        onChange={vi.fn()}
      />,
    )
    const gridButton = screen.getByRole("button", { name: "Vue grille" })
    expect(gridButton.querySelector("svg")).not.toBeNull()
    expect(gridButton).not.toHaveTextContent("Vue grille")
  })

  it("applies the accent variant class on the group", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="one"
        onChange={vi.fn()}
        variant="accent"
        label="Type"
      />,
    )
    const group = screen.getByRole("group", { name: "Type" })
    expect(group).toHaveClass("seg")
    expect(group).toHaveClass("seg-accent")
  })

  it("applies the scrollable modifier class only when requested", () => {
    const { rerender } = render(
      <SegmentedControl
        options={OPTIONS}
        value="one"
        onChange={vi.fn()}
        scrollable
      />,
    )
    expect(screen.getByRole("group")).toHaveClass("seg")
    expect(screen.getByRole("group")).toHaveClass("seg-scroll")
    rerender(
      <SegmentedControl options={OPTIONS} value="one" onChange={vi.fn()} />,
    )
    expect(screen.getByRole("group")).not.toHaveClass("seg-scroll")
  })

  it("keeps the neutral base class by default and merges className", () => {
    render(
      <SegmentedControl
        options={OPTIONS}
        value="one"
        onChange={vi.fn()}
        className="seg-raised"
      />,
    )
    const group = screen.getByRole("group")
    expect(group).toHaveClass("seg")
    expect(group).toHaveClass("seg-raised")
    expect(group).not.toHaveClass("seg-accent")
  })
})
