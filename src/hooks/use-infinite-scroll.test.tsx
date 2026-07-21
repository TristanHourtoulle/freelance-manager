import { render } from "@testing-library/react"
import { useEffect } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { useInfiniteScroll } from "./use-infinite-scroll"

type IOCallback = (entries: Array<{ isIntersecting: boolean }>) => void

let lastCallback: IOCallback | null = null
const observe = vi.fn()
const disconnect = vi.fn()
const unobserve = vi.fn()

class FakeIntersectionObserver {
  constructor(cb: IOCallback) {
    lastCallback = cb
  }
  observe = observe
  disconnect = disconnect
  unobserve = unobserve
  takeRecords = vi.fn()
}

beforeEach(() => {
  lastCallback = null
  observe.mockClear()
  disconnect.mockClear()
  unobserve.mockClear()
  vi.stubGlobal("IntersectionObserver", FakeIntersectionObserver)
})

afterEach(() => {
  vi.unstubAllGlobals()
})

interface ProbeProps {
  hasNextPage: boolean
  isFetchingNextPage: boolean
  fetchNextPage: () => void
}

function Probe({
  hasNextPage,
  isFetchingNextPage,
  fetchNextPage,
}: ProbeProps) {
  const ref = useInfiniteScroll({
    hasNextPage,
    isFetchingNextPage,
    fetchNextPage,
  })
  useEffect(() => {
    if (ref.current) ref.current.setAttribute("data-mounted", "true")
  }, [ref])
  return <div ref={ref} data-testid="sentinel" />
}

describe("useInfiniteScroll", () => {
  it("observes when hasNextPage is true and not fetching", () => {
    render(
      <Probe
        hasNextPage
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />,
    )
    expect(observe).toHaveBeenCalledTimes(1)
  })

  it("does not observe when hasNextPage is false", () => {
    render(
      <Probe
        hasNextPage={false}
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />,
    )
    expect(observe).not.toHaveBeenCalled()
  })

  it("does not observe when already fetching the next page", () => {
    render(
      <Probe hasNextPage isFetchingNextPage fetchNextPage={vi.fn()} />,
    )
    expect(observe).not.toHaveBeenCalled()
  })

  it("calls fetchNextPage when the observer fires while active", () => {
    const fetchNextPage = vi.fn()
    render(
      <Probe
        hasNextPage
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
      />,
    )
    lastCallback?.([{ isIntersecting: true }])
    expect(fetchNextPage).toHaveBeenCalledTimes(1)
  })

  it("does not call fetchNextPage on a non-intersecting entry", () => {
    const fetchNextPage = vi.fn()
    render(
      <Probe
        hasNextPage
        isFetchingNextPage={false}
        fetchNextPage={fetchNextPage}
      />,
    )
    lastCallback?.([{ isIntersecting: false }])
    expect(fetchNextPage).not.toHaveBeenCalled()
  })

  it("disconnects the observer on unmount", () => {
    const { unmount } = render(
      <Probe
        hasNextPage
        isFetchingNextPage={false}
        fetchNextPage={vi.fn()}
      />,
    )
    unmount()
    expect(disconnect).toHaveBeenCalled()
  })
})
