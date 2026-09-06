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
import {
  makeAction,
  makeClient,
  makeMeeting,
  makeUser,
} from "@/test/integration/factories"
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

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "meeting_id")
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
  return new Request("http://localhost/api/meetings/x", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(): Request {
  return new Request("http://localhost/api/meetings/x", { method: "DELETE" })
}

describe("PATCH /api/meetings/[id] (integration)", () => {
  it("updates the caller's own meeting", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const meeting = await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ title: "Nouveau titre" }), {
      params: Promise.resolve({ id: meeting.id }),
    })
    const body = (await res.json()) as { title: string }

    expect(res.status).toBe(200)
    expect(body.title).toBe("Nouveau titre")
  })

  it("returns 404 (never 200) when patching another user's meeting", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const meeting = await makeMeeting(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ title: "Hijack" }), {
      params: Promise.resolve({ id: meeting.id }),
    })

    expect(res.status).toBe(404)
    const untouched = await ctx.prisma.meeting.findUniqueOrThrow({
      where: { id: meeting.id },
    })
    expect(untouched.title).not.toBe("Hijack")
  })
})

describe("DELETE /api/meetings/[id] (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: "any" }),
    })

    expect(res.status).toBe(401)
  })

  it("returns 404 (never 200) when deleting another user's meeting", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const meeting = await makeMeeting(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: meeting.id }),
    })

    expect(res.status).toBe(404)
    const stillThere = await ctx.prisma.meeting.findUnique({
      where: { id: meeting.id },
    })
    expect(stillThere).not.toBeNull()
  })

  it("deletes the meeting AND unlinks (never deletes) its follow-up actions", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const meeting = await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    const actionOne = await makeAction(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      meetingId: meeting.id,
      title: "Envoyer le compte-rendu",
    })
    const actionTwo = await makeAction(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      meetingId: meeting.id,
      title: "Relancer sur le devis",
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: meeting.id }),
    })

    expect(res.status).toBe(200)

    const deletedMeeting = await ctx.prisma.meeting.findUnique({
      where: { id: meeting.id },
    })
    expect(deletedMeeting).toBeNull()

    const survivingOne = await ctx.prisma.clientAction.findUniqueOrThrow({
      where: { id: actionOne.id },
    })
    const survivingTwo = await ctx.prisma.clientAction.findUniqueOrThrow({
      where: { id: actionTwo.id },
    })
    expect(survivingOne.meetingId).toBeNull()
    expect(survivingTwo.meetingId).toBeNull()
    expect(survivingOne.title).toBe("Envoyer le compte-rendu")
    expect(survivingTwo.title).toBe("Relancer sur le devis")
  })
})
