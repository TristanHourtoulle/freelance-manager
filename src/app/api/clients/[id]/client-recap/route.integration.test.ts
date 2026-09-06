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
  makeProject,
  makeTask,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "client_recap")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(id: string): Request {
  return new Request(`http://localhost/api/clients/${id}/client-recap`)
}

describe("GET /api/clients/[id]/client-recap (integration)", () => {
  it("renders 200 with a PDF content-type for a client with delivered work and a held meeting", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    await makeTask(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
      status: "DONE",
      completedAt: new Date(),
    })
    await makeMeeting(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(client.id), {
      params: Promise.resolve({ id: client.id }),
    })

    expect(res.status).toBe(200)
    expect(res.headers.get("content-type")).toBe("application/pdf")
    const buffer = await res.arrayBuffer()
    expect(buffer.byteLength).toBeGreaterThan(0)
  })

  it("returns 404 (never 200) for another user's client", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest(ownerClient.id), {
      params: Promise.resolve({ id: ownerClient.id }),
    })

    expect(res.status).toBe(404)
  })
})
