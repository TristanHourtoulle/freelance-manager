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
  makeProject,
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
  ctx = createIsolatedSchema(inject("integrationPostgresUrl"), "project_id")
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
  return new Request(`http://localhost/api/projects/${id}`)
}

interface ProjectDetailResponse {
  invoices: { balanceDue: number }[]
  totals: { revenue: number; outstanding: number }
}

describe("GET /api/projects/[id] (integration)", () => {
  it("folds a claimed, unpaid penalty into an invoice's balanceDue and the project's outstanding total (select-completeness)", async () => {
    const client = await makeClient(ctx.prisma, { userId: currentUser.id })
    const project = await makeProject(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
    })
    await makeInvoiceWithClaimedLateFee(ctx.prisma, {
      userId: currentUser.id,
      clientId: client.id,
      projectId: project.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(project.id), {
      params: Promise.resolve({ id: project.id }),
    })
    const body = (await res.json()) as ProjectDetailResponse

    expect(res.status).toBe(200)
    expect(body.invoices).toHaveLength(1)
    expect(body.invoices[0]?.balanceDue).toBe(45)
    expect(body.totals.outstanding).toBe(45)
  })

  it("returns 404 (never 200) for another user's project", async () => {
    const owner = await makeUser(ctx.prisma)
    const ownerClient = await makeClient(ctx.prisma, { userId: owner.id })
    const ownerProject = await makeProject(ctx.prisma, {
      userId: owner.id,
      clientId: ownerClient.id,
    })

    const { GET } = await import("./route")
    const res = await GET(getRequest(ownerProject.id), {
      params: Promise.resolve({ id: ownerProject.id }),
    })

    expect(res.status).toBe(404)
  })
})
