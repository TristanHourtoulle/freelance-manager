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
  makeInvoiceWithClaimedLateFee,
  makeUser,
  makeUserSettings,
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
vi.mock("next/cache", () => ({ revalidateTag: vi.fn() }))
vi.mock("@/lib/activity", () => ({ deferActivityLog: vi.fn() }))

beforeAll(() => {
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "client_id")
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
  return new Request(`http://localhost/api/clients/${id}`)
}

function patchRequest(id: string, body: Record<string, unknown>): Request {
  return new Request(`http://localhost/api/clients/${id}`, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

function deleteRequest(id: string): Request {
  return new Request(`http://localhost/api/clients/${id}`, {
    method: "DELETE",
  })
}

interface ClientDetailResponse {
  id: string
  invoices: { balanceDue: number; lateFeeDue: number; isOverdue: boolean }[]
}

describe("GET /api/clients/[id] (integration)", () => {
  it("returns a non-zero balanceDue/lateFeeDue for a claimed, unpaid penalty (select-completeness)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(client.id), {
      params: Promise.resolve({ id: client.id }),
    })
    const body = (await res.json()) as ClientDetailResponse

    expect(res.status).toBe(200)
    expect(body.invoices).toHaveLength(1)
    expect(body.invoices[0]?.balanceDue).toBe(45)
    expect(body.invoices[0]?.lateFeeDue).toBe(45)
    expect(body.invoices[0]?.isOverdue).toBe(true)
  })

  it("honours a configured non-default late-fee annual rate rather than the 10% default", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })

    const { GET } = await import("./route")
    const before = (await (
      await GET(getRequest(client.id), {
        params: Promise.resolve({ id: client.id }),
      })
    ).json()) as { invoices: { lateFeeAccrued: number }[] }

    await makeUserSettings(ctx.prisma, {
      userId: currentUser.id,
      lateFeeAnnualRate: 0.4,
      lateFeeFixedAmount: 40,
    })
    const after = (await (
      await GET(getRequest(client.id), {
        params: Promise.resolve({ id: client.id }),
      })
    ).json()) as { invoices: { lateFeeAccrued: number }[] }

    expect(after.invoices[0]?.lateFeeAccrued).toBeGreaterThan(
      before.invoices[0]?.lateFeeAccrued ?? 0,
    )
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

describe("PATCH /api/clients/[id] (integration)", () => {
  it("rejects an invalid payload (email not an email) with 400", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(client.id, { email: "not-an-email" }),
      { params: Promise.resolve({ id: client.id }) },
    )

    expect(res.status).toBe(400)
  })

  it("returns 404 (never 200) when patching another user's client", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, {
      userId: owner.id,
      firstName: "Original",
    })

    const { PATCH } = await import("./route")
    const res = await PATCH(
      patchRequest(ownerClient.id, { firstName: "Hijacked" }),
      { params: Promise.resolve({ id: ownerClient.id }) },
    )

    expect(res.status).toBe(404)

    const untouched = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: ownerClient.id },
      select: { firstName: true },
    })
    expect(untouched.firstName).toBe("Original")
  })
})

describe("DELETE /api/clients/[id] (integration)", () => {
  it("archives the caller's own client", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(client.id), {
      params: Promise.resolve({ id: client.id }),
    })

    expect(res.status).toBe(200)
    const updated = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: client.id },
    })
    expect(updated.archivedAt).not.toBeNull()
  })

  it("returns 404 (never 200) when archiving another user's client", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })

    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest(ownerClient.id), {
      params: Promise.resolve({ id: ownerClient.id }),
    })

    expect(res.status).toBe(404)
    const untouched = await ctx.prisma.client.findUniqueOrThrow({
      where: { id: ownerClient.id },
    })
    expect(untouched.archivedAt).toBeNull()
  })
})
