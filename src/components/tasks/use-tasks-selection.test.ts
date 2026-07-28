import { renderHook, act } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import {
  parseIdListParam,
  pruneProjectIds,
  useTasksSelection,
} from "./use-tasks-selection"

const { replaceMock, searchState } = vi.hoisted(() => ({
  replaceMock: vi.fn(),
  searchState: { value: "" },
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock }),
  usePathname: () => "/tasks",
  useSearchParams: () => new URLSearchParams(searchState.value),
}))

const PROJECTS = [
  { id: "p1", clientId: "c1" },
  { id: "p2", clientId: "c2" },
]

describe("parseIdListParam", () => {
  it("reads the comma-separated plural param", () => {
    const search = new URLSearchParams("clientIds=a,b")
    expect(parseIdListParam(search, "clientIds", "clientId")).toEqual([
      "a",
      "b",
    ])
  })

  it("merges the legacy singular param and dedupes", () => {
    const search = new URLSearchParams("clientIds=a,b&clientId=b")
    expect(parseIdListParam(search, "clientIds", "clientId")).toEqual([
      "a",
      "b",
    ])
  })

  it("ignores empty segments", () => {
    const search = new URLSearchParams("clientIds=a,,%20,b")
    expect(parseIdListParam(search, "clientIds", "clientId")).toEqual([
      "a",
      "b",
    ])
  })

  it("returns an empty array when neither param is set", () => {
    expect(
      parseIdListParam(new URLSearchParams(), "clientIds", "clientId"),
    ).toEqual([])
  })
})

describe("pruneProjectIds", () => {
  it("keeps everything when no client is selected", () => {
    expect(pruneProjectIds(["p1", "p2"], [], PROJECTS)).toEqual(["p1", "p2"])
  })

  it("drops projects owned by unselected clients", () => {
    expect(pruneProjectIds(["p1", "p2"], ["c1"], PROJECTS)).toEqual(["p1"])
  })

  it("keeps projects missing from the loaded list", () => {
    expect(pruneProjectIds(["p1", "ghost"], ["c1"], PROJECTS)).toEqual([
      "p1",
      "ghost",
    ])
  })
})

describe("useTasksSelection", () => {
  beforeEach(() => {
    replaceMock.mockReset()
    searchState.value = ""
  })

  it("reads plural params and legacy singular deep links", () => {
    searchState.value = "clientIds=c1,c2&projectId=p1"
    const { result } = renderHook(() => useTasksSelection(PROJECTS))

    expect(result.current.clientIds).toEqual(["c1", "c2"])
    expect(result.current.projectIds).toEqual(["p1"])
  })

  it("writes the selection as comma-separated params without history push", () => {
    const { result } = renderHook(() => useTasksSelection(PROJECTS))

    act(() => {
      result.current.setSelection({
        clientIds: ["c1", "c2"],
        projectIds: ["p1"],
      })
    })

    expect(replaceMock).toHaveBeenCalledWith(
      "/tasks?clientIds=c1%2Cc2&projectIds=p1",
      { scroll: false },
    )
  })

  it("rewrites legacy params and preserves unrelated ones", () => {
    searchState.value = "clientId=c1&foo=bar"
    const { result } = renderHook(() => useTasksSelection(PROJECTS))

    act(() => {
      result.current.setSelection({ clientIds: ["c2"], projectIds: [] })
    })

    expect(replaceMock).toHaveBeenCalledWith("/tasks?foo=bar&clientIds=c2", {
      scroll: false,
    })
  })

  it("clears every filter param when the selection empties", () => {
    searchState.value = "clientIds=c1&projectIds=p1"
    const { result } = renderHook(() => useTasksSelection(PROJECTS))

    act(() => {
      result.current.setSelection({ clientIds: [], projectIds: [] })
    })

    expect(replaceMock).toHaveBeenCalledWith("/tasks", { scroll: false })
  })

  it("prunes selected projects that leave the selected clients", () => {
    const { result } = renderHook(() => useTasksSelection(PROJECTS))

    act(() => {
      result.current.setSelection({
        clientIds: ["c1"],
        projectIds: ["p1", "p2"],
      })
    })

    expect(replaceMock).toHaveBeenCalledWith(
      "/tasks?clientIds=c1&projectIds=p1",
      { scroll: false },
    )
  })
})
