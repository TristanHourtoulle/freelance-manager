import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  inject,
  it,
} from "vitest"
import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "@/generated/prisma/client"
import { truncateAll } from "@/test/integration/db"
import {
  makeAuthenticatedUser,
  makeClient,
  makeInvoice,
} from "@/test/integration/factories"

let prisma: PrismaClient
let serverUrl: string

beforeAll(() => {
  const databaseUrl = inject("invoicesDatabaseUrl")
  serverUrl = inject("invoicesServerUrl")
  process.env.DATABASE_URL = databaseUrl
  prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  })
})

afterAll(async () => {
  await prisma.$disconnect()
})

beforeEach(async () => {
  await truncateAll(prisma, "public")
})

/**
 * Sign in through the real `auth.api.signInEmail` (against the same schema
 * the spawned `next dev` server reads from) and turn the resulting
 * `Set-Cookie` headers into a `Cookie` header string usable against that
 * separate server process.
 *
 * @param email - The fixture user's email.
 * @param password - The fixture user's plaintext password.
 */
async function signInCookie(email: string, password: string): Promise<string> {
  const { auth } = await import("@/lib/auth")
  const { convertSetCookieToCookie } = await import("better-auth/test")
  const response = (await auth.api.signInEmail({
    body: { email, password },
    asResponse: true,
  })) as Response
  const cookieHeaders = convertSetCookieToCookie(response.headers)
  const cookie = cookieHeaders.get("cookie")
  if (!cookie) throw new Error("sign-in did not return a session cookie")
  return cookie
}

interface InvoiceListResponse {
  data: Array<Record<string, unknown>>
  nextCursor: string | null
  hasMore: boolean
}

describe("GET /api/invoices (integration)", () => {
  it("returns invoices with usable numeric amounts through the real 'use cache' data layer", async () => {
    const user = await makeAuthenticatedUser(prisma)
    const client = await makeClient(prisma, { userId: user.id })
    await makeInvoice(prisma, {
      userId: user.id,
      clientId: client.id,
      total: 1234.56,
    })

    const cookie = await signInCookie(user.email, user.password)

    const res = await fetch(`${serverUrl}/api/invoices`, {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as InvoiceListResponse
    expect(body.data).toHaveLength(1)
    const [invoice] = body.data
    expect(typeof invoice?.total).toBe("number")
    expect(invoice?.total).toBeCloseTo(1234.56)
    expect(typeof invoice?.subtotal).toBe("number")
    expect(typeof invoice?.balanceDue).toBe("number")
  })
})
