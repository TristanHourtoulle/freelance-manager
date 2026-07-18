import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  Skeleton,
  SkeletonCard,
  SkeletonKpi,
  SkeletonRow,
  SkeletonText,
} from "./skeleton"

describe("Skeleton", () => {
  it("applies the base skeleton class", () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.classList.contains("skeleton")).toBe(true)
  })

  it("composes extra classes without dropping the base class", () => {
    const { container } = render(<Skeleton className="flex-1" />)
    const el = container.firstChild as HTMLElement
    expect(el.classList.contains("skeleton")).toBe(true)
    expect(el.classList.contains("flex-1")).toBe(true)
  })

  it("forwards width, height and radius as inline styles", () => {
    const { container } = render(
      <Skeleton width={120} height={12} radius={4} />,
    )
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe("120px")
    expect(el.style.height).toBe("12px")
    expect(el.style.borderRadius).toBe("4px")
  })

  it("accepts string dimensions", () => {
    const { container } = render(<Skeleton width="60%" />)
    const el = container.firstChild as HTMLElement
    expect(el.style.width).toBe("60%")
  })

  it("is hidden from assistive technology", () => {
    const { container } = render(<Skeleton />)
    const el = container.firstChild as HTMLElement
    expect(el.getAttribute("aria-hidden")).toBe("true")
  })
})

describe("SkeletonText", () => {
  it("renders three lines by default", () => {
    const { container } = render(<SkeletonText />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(3)
  })

  it("renders the requested number of lines", () => {
    const { container } = render(<SkeletonText lines={5} />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(5)
  })
})

describe("SkeletonRow", () => {
  it("renders three skeleton blocks", () => {
    const { container } = render(<SkeletonRow />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(3)
  })
})

describe("SkeletonCard", () => {
  it("renders a title bar plus a text block", () => {
    const { container } = render(<SkeletonCard />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(3)
  })
})

describe("SkeletonKpi", () => {
  it("renders a label bar and a value bar", () => {
    const { container } = render(<SkeletonKpi />)
    expect(container.querySelectorAll(".skeleton")).toHaveLength(2)
  })
})
