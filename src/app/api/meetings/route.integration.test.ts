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
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "meetings")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(qs = ""): Request {
  return new Request(`http://localhost/api/meetings${qs}`)
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/meetings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface MeetingListResponse {
  data: { id: string; clientId: string; title: string }[]
  nextCursor: string | null
  hasMore: boolean
}

describe("GET /api/meetings (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { GET } = await import("./route")
    const res = await GET(getRequest())

    expect(res.status).toBe(401)
  })

  it("never returns another user's meetings", async () => {
    const other = await makeUser(ctx.prisma)
    const otherClient = await makeClient(ctx.prisma, { userId: other.id })
    await makeMeeting(ctx.prisma, {
      userId: other.id,
      clientId: otherClient.id,
    })

    const mine = await makeClient(ctx.prisma, { userId: currentUser.id })
    const myMeeting = await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: mine.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as MeetingListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.id).toBe(myMeeting.id)
  })

  it("filters by clientId when provided", async () => {
    const clientA = await makeClient(ctx.prisma, { userId: currentUser.id })
    const clientB = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeMeeting(ctx.prisma, { userId: currentUser.id, clientId: clientA.id })
    const meetingB = await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: clientB.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(`?clientId=${clientB.id}`))
    const body = (await res.json()) as MeetingListResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.id).toBe(meetingB.id)
  })
})

describe("POST /api/meetings (integration)", () => {
  it("creates a meeting owned by the session user", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        clientId: client.id,
        title: "Point hebdo",
        heldAt: new Date().toISOString(),
        durationMinutes: 45,
      }),
    )
    const body = (await res.json()) as { id: string; title: string }

    expect(res.status).toBe(201)
    expect(body.title).toBe("Point hebdo")

    const created = await ctx.prisma.meeting.findUniqueOrThrow({
      where: { id: body.id },
    })
    expect(created.userId).toBe(currentUser.id)
  })

  it("returns 404 (never 201) when the client belongs to another user", async () => {
    const other = await makeUser(ctx.prisma)
    const otherClient = await makeClient(ctx.prisma, { userId: other.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({
        clientId: otherClient.id,
        title: "Point hebdo",
        heldAt: new Date().toISOString(),
      }),
    )

    expect(res.status).toBe(404)
    const count = await ctx.prisma.meeting.count()
    expect(count).toBe(0)
  })

  it("rejects a missing title with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ clientId: client.id, heldAt: new Date().toISOString() }),
    )

    expect(res.status).toBe(400)
  })
})
