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
  makeInvoiceWithClaimedLateFee,
  makeProject,
  makeTask,
  makeUserSettings,
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

  it("reflects a claimed, unpaid penalty as a non-zero balanceDue/lateFeeDue through the cached read", async () => {
    const user = await makeAuthenticatedUser(prisma)
    const client = await makeClient(prisma, { userId: user.id })
    await makeInvoiceWithClaimedLateFee(prisma, {
      userId: user.id,
      clientId: client.id,
    })

    const cookie = await signInCookie(user.email, user.password)
    const res = await fetch(`${serverUrl}/api/invoices`, {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as InvoiceListResponse
    expect(body.data).toHaveLength(1)
    const [invoice] = body.data
    expect(invoice?.lateFeeDue).toBe(45)
    expect(invoice?.balanceDue).toBe(45)
    expect(invoice?.isOverdue).toBe(true)
  })

  it("honours a configured non-default late-fee annual rate rather than the 10% default", async () => {
    const defaultUser = await makeAuthenticatedUser(prisma)
    const defaultClient = await makeClient(prisma, { userId: defaultUser.id })
    const customUser = await makeAuthenticatedUser(prisma)
    const customClient = await makeClient(prisma, { userId: customUser.id })
    await makeUserSettings(prisma, {
      userId: customUser.id,
      lateFeeAnnualRate: 0.12,
      lateFeeFixedAmount: 40,
    })

    const overdueDueDate = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000)
    await makeInvoice(prisma, {
      userId: defaultUser.id,
      clientId: defaultClient.id,
      status: "SENT",
      total: 10_000,
      issueDate: new Date(overdueDueDate.getTime() - 10 * 24 * 60 * 60 * 1000),
      dueDate: overdueDueDate,
    })
    await makeInvoice(prisma, {
      userId: customUser.id,
      clientId: customClient.id,
      status: "SENT",
      total: 10_000,
      issueDate: new Date(overdueDueDate.getTime() - 10 * 24 * 60 * 60 * 1000),
      dueDate: overdueDueDate,
    })

    const [defaultCookie, customCookie] = await Promise.all([
      signInCookie(defaultUser.email, defaultUser.password),
      signInCookie(customUser.email, customUser.password),
    ])
    const [defaultRes, customRes] = await Promise.all([
      fetch(`${serverUrl}/api/invoices`, {
        headers: { Cookie: defaultCookie },
      }),
      fetch(`${serverUrl}/api/invoices`, { headers: { Cookie: customCookie } }),
    ])

    const defaultBody = (await defaultRes.json()) as InvoiceListResponse
    const customBody = (await customRes.json()) as InvoiceListResponse
    const defaultAccrued = defaultBody.data[0]?.lateFeeAccrued as number
    const customAccrued = customBody.data[0]?.lateFeeAccrued as number

    expect(defaultAccrued).toBeGreaterThan(0)
    expect(customAccrued).toBeGreaterThan(defaultAccrued)
  })

  it("never returns another user's invoices", async () => {
    const owner = await makeAuthenticatedUser(prisma)
    const ownerClient = await makeClient(prisma, { userId: owner.id })
    await makeInvoice(prisma, { userId: owner.id, clientId: ownerClient.id })

    const outsider = await makeAuthenticatedUser(prisma)
    const cookie = await signInCookie(outsider.email, outsider.password)

    const res = await fetch(`${serverUrl}/api/invoices`, {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as InvoiceListResponse
    expect(body.data).toHaveLength(0)
  })
})

describe("POST /api/invoices (integration)", () => {
  it("rejects an invalid payload with 400 instead of a 500", async () => {
    const user = await makeAuthenticatedUser(prisma)
    const cookie = await signInCookie(user.email, user.password)

    const res = await fetch(`${serverUrl}/api/invoices`, {
      method: "POST",
      headers: {
        Cookie: cookie,
        Origin: serverUrl,
        "content-type": "application/json",
      },
      body: JSON.stringify({ clientId: "", lines: [] }),
    })

    expect(res.status).toBe(400)
  })
})

/**
 * These two describe blocks deliberately share the invoices spec's own
 * spawned `next dev` server and database rather than getting their own test
 * files: `getClientsFirstPage` and `getProjectsFirstPage` are cached
 * (`"use cache"`) exactly like the invoices list, and only a genuine cache
 * round trip through the real Next.js runtime can prove a `Decimal` survives
 * it — a bare `vitest` process never applies the compiler transform the
 * cache wrapper needs, so calling the data-layer function in-process would
 * prove nothing about this specific risk. Reusing this file's single
 * server/database avoids racing this spec's own `beforeEach` truncation
 * against a second file's, which a second consumer of the same shared
 * resource could otherwise hit.
 */
describe("GET /api/clients (integration, real 'use cache' boundary)", () => {
  it("returns a usable numeric rate/fixedPrice through the real 'use cache' data layer", async () => {
    const user = await makeAuthenticatedUser(prisma)
    const client = await makeClient(prisma, {
      userId: user.id,
      billingMode: "FIXED",
      rate: 120.5,
    })
    await prisma.client.update({
      where: { id: client.id },
      data: { fixedPrice: 3000 },
    })

    const cookie = await signInCookie(user.email, user.password)
    const res = await fetch(`${serverUrl}/api/clients`, {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: Array<{ rate: number; fixedPrice: number | null }>
    }
    expect(body.data).toHaveLength(1)
    const [clientRow] = body.data
    expect(typeof clientRow?.rate).toBe("number")
    expect(clientRow?.rate).toBeCloseTo(120.5)
    expect(typeof clientRow?.fixedPrice).toBe("number")
    expect(
      (clientRow?.fixedPrice ?? 0) + (clientRow?.rate ?? 0),
    ).toBeCloseTo(3120.5)
  })
})

describe("GET /api/projects (integration, real 'use cache' boundary)", () => {
  it("returns a usable numeric remainingDays through the real 'use cache' data layer", async () => {
    const user = await makeAuthenticatedUser(prisma)
    const client = await makeClient(prisma, { userId: user.id })
    const project = await makeProject(prisma, {
      userId: user.id,
      clientId: client.id,
    })
    await makeTask(prisma, {
      userId: user.id,
      clientId: client.id,
      projectId: project.id,
      status: "BACKLOG",
      estimate: 3,
    })

    const cookie = await signInCookie(user.email, user.password)
    const res = await fetch(`${serverUrl}/api/projects`, {
      headers: { Cookie: cookie },
    })

    expect(res.status).toBe(200)
    const body = (await res.json()) as {
      data: Array<{ remainingDays: number }>
    }
    expect(body.data).toHaveLength(1)
    const [project0] = body.data
    expect(typeof project0?.remainingDays).toBe("number")
    expect((project0?.remainingDays ?? 0) * 2).toBeCloseTo(6)
  })
})
