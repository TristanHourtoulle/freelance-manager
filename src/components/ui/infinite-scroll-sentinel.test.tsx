import { render, screen } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { InfiniteScrollSentinel } from "./infinite-scroll-sentinel"

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void

let lastCallback: IOCallback | null = null
const observe = vi.fn()
const disconnect = vi.fn()

class FakeIntersectionObserver {
  constructor(cb: IOCallback) {
    lastCallback = cb
  }
  observe = observe
  disconnect = disconnect
  unobserve = vi.fn()
  takeRecords = vi.fn()
}

beforeEach(() => {
  lastCallback = null
  observe.mockClear()
  disconnect.mockClear()
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("InfiniteScrollSentinel", () => {
  it("renders nothing when there is no next page and no fetch in flight", () => {
    const { container } = render(
      <InfiniteScrollSentinel
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />,
    )
    expect(container).toBeEmptyDOMElement()
  })

  it("shows the loading affordance while fetching the next page", () => {
    render(
      <InfiniteScrollSentinel
        hasNextPage={false}
        isFetchingNextPage
        fetchNextPage={vi.fn()}
      />,
    )
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.getByText("Chargement…")).toBeInTheDocument()
  })

  it("calls fetchNextPage when the observer fires", () => {
    const fetchNextPage = vi.fn()
    render(
      <InfiniteScrollSentinel
        hasNextPage
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
      />,
    )
    lastCallback?.([{ isIntersecting: true }])
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })
})
