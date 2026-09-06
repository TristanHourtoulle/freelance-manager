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
vi.mock("next/cache", () => ({
  revalidateTag: vi.fn(),
  cacheLife: vi.fn(),
  cacheTag: vi.fn(),
}))

beforeAll(() => {
  ctx = createIsolatedSchema(
    inject("integrationPostgresUrl"),
    "client_linear_mapping_id",
  )
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

function deleteRequest(): Request {
  return new Request("http://localhost/api/clients/x/linear-mappings/y", {
    method: "DELETE",
  })
}

describe("DELETE /api/clients/[id]/linear-mappings/[mappingId] (integration)", () => {
  it("deletes the caller's own mapping", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const mapping = await makeLinearMapping(ctx.prisma, {
      clientId: client.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: client.id, mappingId: mapping.id }),
    })

    expect(res.status).toBe(200)
    const remaining = await ctx.prisma.linearMapping.findUnique({
      where: { id: mapping.id },
    })
    expect(remaining).toBeNull()
  })

  it("leaves another user's mapping untouched (never a real effect)", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const mapping = await makeLinearMapping(ctx.prisma, {
      clientId: ownerClient.id,
    })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(), {
      params: Promise.resolve({ id: ownerClient.id, mappingId: mapping.id }),
    })

    expect(res.status).toBe(200)
    const untouched = await ctx.prisma.linearMapping.findUnique({
      where: { id: mapping.id },
    })
    expect(untouched).not.toBeNull()
  })
})
