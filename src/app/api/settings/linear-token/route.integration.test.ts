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
import { decrypt } from "@/lib/encryption"

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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "linear_token")
  delete process.env.NEXT_PUBLIC_APP_URL
})

afterAll(async () => {
  await dropIsolatedSchema(ctx.prisma, ctx.schema)
})

beforeEach(async () => {
  await truncateAll(ctx.prisma, ctx.schema)
  currentUser = await makeUser(ctx.prisma)
})

const REAL_TOKEN = "fake-integration-test-linear-token-9f8e7d6c5b4a"

function putRequest(token: string): Request {
  return new Request("http://localhost/api/settings/linear-token", {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  })
}

function deleteRequest(): Request {
  return new Request("http://localhost/api/settings/linear-token", {
    method: "DELETE",
  })
}

interface RawUserSettingsRow {
  userId: string
  linearApiTokenEncrypted: Buffer | null
  linearApiTokenIv: Buffer | null
  linearApiTokenKeyVersion: number | null
}

async function readRawRow(userId: string): Promise<RawUserSettingsRow> {
  const rows = await ctx.prisma.$queryRaw<RawUserSettingsRow[]>`
    SELECT "userId", "linearApiTokenEncrypted", "linearApiTokenIv", "linearApiTokenKeyVersion"
    FROM "user_settings"
    WHERE "userId" = ${userId}
  `
  const row = rows[0]
  if (!row) throw new Error("no user_settings row found")
  return row
}

interface SettingsPreviewResponse {
  hasLinearToken: boolean
  linearTokenPreview: string | null
}

describe("PUT /api/settings/linear-token (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { PUT } = await import("./route")
    const res = await PUT(putRequest(REAL_TOKEN))

    expect(res.status).toBe(401)
  })

  it("stores the token AES-256-GCM encrypted: the plaintext never appears anywhere in the raw database row", async () => {
    const { PUT } = await import("./route")
    const res = await PUT(putRequest(REAL_TOKEN))
    expect(res.status).toBe(200)

    const row = await readRawRow(currentUser.id)
    expect(row.linearApiTokenEncrypted).not.toBeNull()
    expect(row.linearApiTokenIv).not.toBeNull()

    const encryptedBuf = row.linearApiTokenEncrypted as Buffer
    const ivBuf = row.linearApiTokenIv as Buffer

    expect(encryptedBuf.toString("utf8")).not.toContain(REAL_TOKEN)
    expect(encryptedBuf.toString("latin1")).not.toContain(REAL_TOKEN)
    expect(encryptedBuf.toString("base64")).not.toContain(REAL_TOKEN)
    expect(encryptedBuf.toString("hex")).not.toContain(
      Buffer.from(REAL_TOKEN, "utf8").toString("hex"),
    )

    const wholeRowSerialized = JSON.stringify({
      encrypted: encryptedBuf.toString("base64"),
      iv: ivBuf.toString("base64"),
      keyVersion: row.linearApiTokenKeyVersion,
    })
    expect(wholeRowSerialized).not.toContain(REAL_TOKEN)

    const decrypted = decrypt(
      encryptedBuf,
      ivBuf,
      row.linearApiTokenKeyVersion ?? 1,
    )
    expect(decrypted).toBe(REAL_TOKEN)
  })

  it("rejects a too-short token with 400 and never writes a row", async () => {
    const { PUT } = await import("./route")
    const res = await PUT(putRequest("short"))

    expect(res.status).toBe(400)
    const settings = await ctx.prisma.userSettings.findUnique({
      where: { userId: currentUser.id },
    })
    expect(settings?.linearApiTokenEncrypted ?? null).toBeNull()
  })

  it("scopes the write to the session user only", async () => {
    const other = await makeUser(ctx.prisma)

    const { PUT } = await import("./route")
    await PUT(putRequest(REAL_TOKEN))

    const otherSettings = await ctx.prisma.userSettings.findUnique({
      where: { userId: other.id },
    })
    expect(otherSettings).toBeNull()
  })
})

describe("GET /api/settings after PUT/DELETE linear-token (integration)", () => {
  it("exposes only a truncated preview, never the raw token", async () => {
    const { PUT } = await import("../linear-token/route")
    await PUT(putRequest(REAL_TOKEN))

    const { GET } = await import("../route")
    const res = await GET()
    const body = (await res.json()) as SettingsPreviewResponse

    expect(res.status).toBe(200)
    expect(body.hasLinearToken).toBe(true)
    expect(body.linearTokenPreview).not.toBeNull()
    expect(body.linearTokenPreview).not.toBe(REAL_TOKEN)
    expect(body.linearTokenPreview).not.toContain(REAL_TOKEN)
    expect(JSON.stringify(body)).not.toContain(REAL_TOKEN)
  })
})

describe("DELETE /api/settings/linear-token (integration)", () => {
  it("returns 401 for an unauthenticated caller", async () => {
    currentUser = null as unknown as ApiUser
    const { DELETE } = await import("./route")
    const res = await DELETE(deleteRequest())

    expect(res.status).toBe(401)
  })

  it("clears the token so GET /api/settings reports no token afterwards", async () => {
    const { PUT, DELETE } = await import("./route")
    await PUT(putRequest(REAL_TOKEN))

    const res = await DELETE(deleteRequest())
    expect(res.status).toBe(200)

    const row = await readRawRow(currentUser.id)
    expect(row.linearApiTokenEncrypted).toBeNull()
    expect(row.linearApiTokenIv).toBeNull()

    const { GET } = await import("../route")
    const settingsRes = await GET()
    const body = (await settingsRes.json()) as SettingsPreviewResponse
    expect(body.hasLinearToken).toBe(false)
    expect(body.linearTokenPreview).toBeNull()
  })
})
