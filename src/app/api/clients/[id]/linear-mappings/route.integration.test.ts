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
    "client_linear_mappings",
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

function getRequest(): Request {
  return new Request("http://localhost/api/clients/x/linear-mappings")
}

function postRequest(body: Record<string, unknown>): Request {
  return new Request("http://localhost/api/clients/x/linear-mappings", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface MappingsListResponse {
  items: { id: string; linearProjectId: string | null }[]
}

describe("GET /api/clients/[id]/linear-mappings (integration)", () => {
  it("lists a client's Linear mappings, newest first", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeLinearMapping(ctx.prisma, {
      clientId: client.id,
      linearProjectId: "proj-old",
    })
    await new Promise((r) => setTimeout(r, 5))
    await makeLinearMapping(ctx.prisma, {
      clientId: client.id,
      linearProjectId: "proj-new",
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(), {
      params: Promise.resolve({ id: client.id }),
    })
    const body = (await res.json()) as MappingsListResponse

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(2)
    expect(body.items[0]?.linearProjectId).toBe("proj-new")
  })

  it("never returns another user's client mappings", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    await makeLinearMapping(ctx.prisma, { clientId: ownerClient.id })

    const { GET } = await import("./route")
    const res = await GET(getRequest(), {
      params: Promise.resolve({ id: ownerClient.id }),
    })
    const body = (await res.json()) as MappingsListResponse

    expect(res.status).toBe(200)
    expect(body.items).toHaveLength(0)
  })
})

describe("POST /api/clients/[id]/linear-mappings (integration)", () => {
  it("creates a mapping for the caller's own client, even when no Linear token is configured", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ linearProjectId: "linear-proj-1" }),
      { params: Promise.resolve({ id: client.id }) },
    )

    expect(res.status).toBe(201)
    const rows = await ctx.prisma.linearMapping.findMany({
      where: { clientId: client.id },
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]?.linearProjectId).toBe("linear-proj-1")
  })

  it("rejects a payload with neither linearTeamId nor linearProjectId with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(postRequest({}), {
      params: Promise.resolve({ id: client.id }),
    })

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) for a client under another user, and creates no mapping", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ linearProjectId: "linear-proj-hijack" }),
      { params: Promise.resolve({ id: ownerClient.id }) },
    )

    expect(res.status).toBe(404)
    const rows = await ctx.prisma.linearMapping.findMany({
      where: { clientId: ownerClient.id },
    })
    expect(rows).toHaveLength(0)
  })

  it("returns 409 when the Linear project is already mapped to a different client", async () => {
    const otherClient = await makeClient(ctx.prisma, {
      userId: currentUser.id,
    })
    await makeLinearMapping(ctx.prisma, {
      clientId: otherClient.id,
      linearProjectId: "shared-proj",
    })
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ linearProjectId: "shared-proj" }),
      { params: Promise.resolve({ id: client.id }) },
    )

    expect(res.status).toBe(409)
    const body = (await res.json()) as { conflictClientId: string }
    expect(body.conflictClientId).toBe(otherClient.id)
  })

  it("returns the existing mapping (200) instead of a duplicate when re-posting the same client+project pair", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const existing = await makeLinearMapping(ctx.prisma, {
      clientId: client.id,
      linearProjectId: "same-proj",
    })

    const { POST } = await import("./route")
    const res = await POST(
      postRequest({ linearProjectId: "same-proj" }),
      { params: Promise.resolve({ id: client.id }) },
    )

    expect(res.status).toBe(200)
    const body = (await res.json()) as { id: string }
    expect(body.id).toBe(existing.id)
    const rows = await ctx.prisma.linearMapping.findMany({
      where: { clientId: client.id },
    })
    expect(rows).toHaveLength(1)
  })
})
