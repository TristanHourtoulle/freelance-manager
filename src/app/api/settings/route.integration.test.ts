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
import { makeUser } from "@/test/integration/factories"
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "settings")
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
  return new Request("http://localhost/api/settings", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
}

interface SettingsResponse {
  lateFeeFixedAmount: number
  lateFeeAnnualRate: number
}

describe("GET /api/settings (integration)", () => {
  it("upserts and returns the Prisma-column defaults (40 EUR / 10%) on first read", async () => {
    const { GET } = await import("./route")
    const res = await GET()
    const body = (await res.json()) as SettingsResponse

    expect(res.status).toBe(200)
    expect(body.lateFeeFixedAmount).toBe(40)
    expect(body.lateFeeAnnualRate).toBe(0.1)
  })
})

describe("PATCH /api/settings (integration)", () => {
  it("persists a configured non-default late-fee rate, reflected on the next GET", async () => {
    const { GET, PATCH } = await import("./route")
    const patchRes = await PATCH(
      patchRequest({ lateFeeAnnualRate: 0.12, lateFeeFixedAmount: 60 }),
    )
    expect(patchRes.status).toBe(200)

    const res = await GET()
    const body = (await res.json()) as SettingsResponse

    expect(body.lateFeeAnnualRate).toBe(0.12)
    expect(body.lateFeeFixedAmount).toBe(60)
  })

  it("rejects an out-of-range annual rate (>1, i.e. >100%) with 400", async () => {
    const { PATCH } = await import("./route")
    const res = await PATCH(patchRequest({ lateFeeAnnualRate: 1.5 }))

    expect(res.status).toBe(400)
  })

  it("never lets one user's settings change leak into another user's row", async () => {
    const other = await makeUser(ctx.prisma)

    const { GET, PATCH } = await import("./route")
    await PATCH(patchRequest({ lateFeeAnnualRate: 0.12 }))

    currentUser = other
    const res = await GET()
    const body = (await res.json()) as SettingsResponse

    expect(body.lateFeeAnnualRate).toBe(0.1)
  })
})
