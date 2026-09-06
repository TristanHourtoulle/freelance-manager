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
  makeActivityLog,
  makeClient,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "client_activity")
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(id: string): Request {
  return new Request(`http://localhost/api/clients/${id}/activity`)
}

interface ActivityResponse {
  items: { id: string; title: string; createdAt: string }[]
}

describe("GET /api/clients/[id]/activity (integration)", () => {
  it("returns the client's activity, newest first, capped at 30", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const now = Date.now()
    for (let i = 0; i < 32; i++) {
      await makeActivityLog(ctx.prisma, {
        userId: currentUser.id,
        clientId: client.id,
        title: `Activity ${i}`,
        createdAt: new Date(now - i * 1000),
      })
    }

    const { GET } = await import("./route")
    const res = await GET(new Request("http://localhost"), {
      params: Promise.resolve({ id: client.id }),
    })
    const body = (await res.json()) as ActivityResponse

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(30)
    expect(body.items[0]?.title).toBe("Activity 0")
    expect(body.items[29]?.title).toBe("Activity 29")
  })

  it("never returns another user's client activity", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    await makeActivityLog(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
      title: "Private activity",
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(ownerClient.id), {
      params: Promise.resolve({ id: ownerClient.id }),
    })
    const body = (await res.json()) as ActivityResponse

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(0)
  })
})
