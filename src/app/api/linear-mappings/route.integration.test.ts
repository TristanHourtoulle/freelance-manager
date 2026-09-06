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
  makeLinearMapping,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "linear_mappings")
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function getRequest(qs = ""): Request {
  return new Request(`http://localhost/api/linear-mappings${qs}`)
}

interface MappingsResponse {
  data: { id: string; clientId: string; clientLabel: string }[]
  nextCursor: string | null
  hasMore: boolean
}

describe("GET /api/linear-mappings (integration)", () => {
  it("lists every mapping across the caller's clients, enriched with the client label", async () => {
    const client = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      company: "Acme Corp",
    })
    await makeLinearMapping(ctx.prisma, { clientId: client.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as MappingsResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0]?.clientLabel).toBe("Acme Corp")
  })

  it("never returns another user's mappings", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    await makeLinearMapping(ctx.prisma, { clientId: ownerClient.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest())
    const body = (await res.json()) as MappingsResponse

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(0)
  })
})
