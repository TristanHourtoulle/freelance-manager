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
import { makeClient, makeUser } from "@/test/integration/factories"
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
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "client_archive")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function postRequest(): Request {
  return new Request("http://localhost/api/clients/x/archive", {
    method: "POST",
  })
}

describe("POST /api/clients/[id]/archive (integration)", () => {
  it("archives the client, removing it from the default list but keeping it reachable with archived=true", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), {
      params: Promise.resolve({ id: client.id }),
    })

    expect(res.status).toBe(200)
    const updated = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: client.id },
    })
    expect(updated.archivedAt).not.toBeNull()

    const { GET } = await import("../../route")
    const defaultList = (await (
      await GET(new Request("http://localhost/api/clients"))
    ).json()) as { data: { id: string }[] }
    expect(defaultList.data.map((c) => c.id)).not.toContain(client.id)

    const archivedList = (await (
      await GET(new Request("http://localhost/api/clients?archived=true"))
    ).json()) as { data: { id: string }[] }
    expect(archivedList.data.map((c) => c.id)).toContain(client.id)
  })

  it("returns 404 (never 200) when archiving another user's client", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), {
      params: Promise.resolve({ id: ownerClient.id }),
    })

    expect(res.status).toBe(404)
    const untouched = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: ownerClient.id },
    })
    expect(untouched.archivedAt).toBeNull()
  })
})
