import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    clientAction: { findFirst: vi.fn(), update: vi.fn(), delete: vi.fn() },
    invoice: { findFirst: vi.fn() },
    meeting: { findFirst: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

const getAuthUser = vi.fn()
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return {
    ...actual,
    getAuthUser: () => getAuthUser(),
    requireSameOrigin: () => null,
  }
})

const deferActivityLog = vi.fn()
vi.mock("@/lib/activity", () => ({
  deferActivityLog: (...args: unknown[]) => deferActivityLog(...args),
}))

vi.mock("@/lib/data/actions", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/data/actions")>()
  return { ...actual, serializeAction: (a: unknown) => a }
})

const params = { params: Promise.resolve({ id: "a1" }) }

function patch(body: Record<string, unknown>) {
  return new Request("http://localhost/api/actions/a1", {
    method: "PATCH",
    body: JSON.stringify(body),
  })
}

function updateData() {
  return prismaMock.clientAction.update.mock.calls[0]![0].data
}

describe("PATCH /api/actions/[id] status transitions", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    getAuthUser.mockResolvedValue({ id: "user-1" })
    prismaMock.clientAction.findFirst.mockResolvedValue({
      id: "a1",
      clientId: "c1",
      status: "TODO",
      title: "Relancer",
    })
    prismaMock.clientAction.update.mockResolvedValue({
      id: "a1",
      title: "Relancer",
    })
  })

  it("writes WAITING and clears doneAt", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patch({ status: "WAITING" }), params)

    expect(res.status).toBe(200)
    expect(updateData().status).toBe("WAITING")
    expect(updateData().doneAt).toBeNull()
  })

  it("does not log an activity for a WAITING transition", async () => {
    const { PATCH } = await import("./route")
    await PATCH(patch({ status: "WAITING" }), params)

    expect(deferActivityLog).not.toHaveBeenCalled()
  })

  it("stamps doneAt and logs once when moving from WAITING to DONE", async () => {
    prismaMock.clientAction.findFirst.mockResolvedValue({
      id: "a1",
      clientId: "c1",
      status: "WAITING",
      title: "Relancer",
    })
    const { PATCH } = await import("./route")
    await PATCH(patch({ status: "DONE" }), params)

    expect(updateData().doneAt).toBeInstanceOf(Date)
    expect(deferActivityLog).toHaveBeenCalledTimes(1)
  })

  it("clears doneAt when moving back from DONE to TODO", async () => {
    prismaMock.clientAction.findFirst.mockResolvedValue({
      id: "a1",
      clientId: "c1",
      status: "DONE",
      title: "Relancer",
    })
    const { PATCH } = await import("./route")
    await PATCH(patch({ status: "TODO" }), params)

    expect(updateData().status).toBe("TODO")
    expect(updateData().doneAt).toBeNull()
    expect(deferActivityLog).not.toHaveBeenCalled()
  })

  it("rejects an unknown status", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patch({ status: "BOGUS" }), params)

    expect(res.status).toBe(400)
    expect(prismaMock.clientAction.update).not.toHaveBeenCalled()
  })
})
