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

beforeAll(() => {
  ctx = createIsolatedSchema(
    inject("integrationPostgresUrl"),
    "client_unarchive",
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

function postRequest(): Request {
  return new Request("http://localhost/api/clients/x/unarchive", {
    method: "POST",
  })
}

describe("POST /api/clients/[id]/unarchive (integration)", () => {
  it("unarchives the caller's own client", async () => {
    const client = await makeClient(ctx.prisma, {
      userId: currentUser.id,
      archivedAt: new Date(),
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), {
      params: Promise.resolve({ id: client.id }),
    })

    expect(res.status).toBe(200)
    const updated = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: client.id },
    })
    expect(updated.archivedAt).toBeNull()
  })

  it("leaves another user's archived client untouched (never 200 with a real effect)", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, {
      userId: owner.id,
      archivedAt: new Date(),
    })

    const { POST } = await import("./route")
    const res = await POST(postRequest(), {
      params: Promise.resolve({ id: ownerClient.id }),
    })

    expect(res.status).toBe(200)
    const untouched = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: ownerClient.id },
    })
    expect(untouched.archivedAt).not.toBeNull()
  })
})
