import { fireEvent, render } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { TaskIdLink } from "./task-id-link"

const URL = "https://linear.app/acme/issue/TRI-543/some-slug"

describe("TaskIdLink", () => {
  it.each([[null], [undefined], [""]])(
    "renders plain text when url is %p",
    (url) => {
      const { container } = render(
        <TaskIdLink identifier="TRI-543" url={url} className="task-id" />,
      )
      expect(container.querySelector("a")).toBeNull()
      const span = container.querySelector("span")
      expect(span?.textContent).toBe("TRI-543")
      expect(span?.className).toBe("task-id")
    },
  )

  it("renders an anchor with href, target and rel when url is present", () => {
    const { container } = render(
      <TaskIdLink identifier="TRI-543" url={URL} className="task-id" />,
    )
    const anchor = container.querySelector("a")
    expect(anchor).not.toBeNull()
    expect(anchor?.getAttribute("href")).toBe(URL)
    expect(anchor?.getAttribute("target")).toBe("_blank")
    expect(anchor?.getAttribute("rel")).toBe("noopener noreferrer")
    expect(anchor?.textContent).toBe("TRI-543")
  })

  it("keeps the caller class and adds the hover affordance class", () => {
    const { container } = render(
      <TaskIdLink identifier="TRI-543" url={URL} className="task-id mono" />,
    )
    expect(container.querySelector("a")?.className).toBe(
      "task-id mono task-link",
    )
  })

  it("is not natively draggable so a draggable parent keeps its drag", () => {
    const { container } = render(<TaskIdLink identifier="TRI-543" url={URL} />)
    expect(container.querySelector("a")?.getAttribute("draggable")).toBe(
      "false",
    )
  })

  it("does not propagate the click when stopPropagation is set", () => {
    const onRowClick = vi.fn()
    const { container } = render(
      <button type="button" onClick={onRowClick}>
        <TaskIdLink identifier="TRI-543" url={URL} stopPropagation />
      </button>,
    )
    const anchor = container.querySelector("a")
    expect(anchor).not.toBeNull()
    fireEvent.click(anchor as HTMLAnchorElement)
    expect(onRowClick).not.toHaveBeenCalled()
  })

  it("propagates the click by default", () => {
    const onRowClick = vi.fn()
    const { container } = render(
      <button type="button" onClick={onRowClick}>
        <TaskIdLink identifier="TRI-543" url={URL} />
      </button>,
    )
    fireEvent.click(container.querySelector("a") as HTMLAnchorElement)
    expect(onRowClick).toHaveBeenCalledTimes(1)
  })
})
