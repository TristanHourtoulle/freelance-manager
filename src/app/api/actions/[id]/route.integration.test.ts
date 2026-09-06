import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
  vi,
} from "vitest"
import {
  createIsolatedSchema,
  dropIsolatedSchema,
  truncateAll,
  type IsolatedSchema,
} from "@/test/integration/db"
import { makeAction, makeClient, makeUser } from "@/test/integration/factories"
import type { ApiUser } from "@/lib/api"

let ctx: IsolatedSchema
let currentUser: ApiUser

vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))
vi.mock("@/lib/api", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/api")>()
  return { ...actual, getAuthUser: async () => currentUser }
})
vi.mock("@/lib/db", () => ({
  get prisma() {
    return ctx.prisma
  },
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "action_id")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function patchRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/actions/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(): Request {
  return new Request("http://localhost/api/actions/x", { method: "DELETE" })
}

describe("PATCH /api/actions/[id] (integration)", () => {
  it("marks the caller's own action DONE and stamps doneAt", async () => {
    const action = await makeAction(ctx.prisma, { userId: currentUser.id })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ status: "DONE" }), {
      params: Promise.resolve({ id: action.id }),
    })
    const body = (await res.json()) as { status: string; doneAt: string | null }

    expect(res.status).toBe(200)
    expect(body.status).toBe("DONE")
    expect(body.doneAt).not.toBeNull()
  })

  it("returns 404 (never 200) when patching another user's action", async () => {
    const owner = await makeUser(ctx.prisma)
    const action = await makeAction(ctx.prisma, { userId: owner.id })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ status: "DONE" }), {
      params: Promise.resolve({ id: action.id }),
    })

    expect(res.status).toBe(404)
    const untouched = await ctx.prisma.clientAction.findUniqueOrThrow({
      where: { id: action.id },
    })
    expect(untouched.status).toBe("TODO")
  })

  it("rejects re-pointing clientId at another user's client with 404", async () => {
    const action = await makeAction(ctx.prisma, { userId: currentUser.id })
    const other = await makeUser(ctx.prisma)
    const otherClient = await makeClient(ctx.prisma, { userId: other.id })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ clientId: otherClient.id }), {
      params: Promise.resolve({ id: action.id }),
    })

    expect(res.status).toBe(404)
  })
})

describe("DELETE /api/actions/[id] (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: "any" }),
    })

    expect(res.status).toBe(401)
  })

  it("deletes the caller's own action", async () => {
    const action = await makeAction(ctx.prisma, { userId: currentUser.id })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: action.id }),
    })

    expect(res.status).toBe(200)
    const gone = await ctx.prisma.clientAction.findUnique({
      where: { id: action.id },
    })
    expect(gone).toBeNull()
  })

  it("returns 404 (never 200) when deleting another user's action", async () => {
    const owner = await makeUser(ctx.prisma)
    const action = await makeAction(ctx.prisma, { userId: owner.id })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: action.id }),
    })

    expect(res.status).toBe(404)
    const stillThere = await ctx.prisma.clientAction.findUnique({
      where: { id: action.id },
    })
    expect(stillThere).not.toBeNull()
  })
})
