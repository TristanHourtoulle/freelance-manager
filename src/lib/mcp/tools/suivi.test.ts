import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    client: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    meeting: { findMany: vi.fn(), findFirst: vi.fn(), create: vi.fn() },
    clientAction: { findMany: vi.fn(), create: vi.fn() },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

const deferActivityLog = vi.fn()
vi.mock("@/lib/activity", () => ({
  deferActivityLog: (args: unknown) => deferActivityLog(args),
}))

import { createAction, listMeetings, logMeeting } from "./suivi"

const USER_ID = "user-1"

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
})

describe("listMeetings", () => {
  it("truncates agenda and summary free text", async () => {
    prismaMock.meeting.findMany.mockResolvedValue([
      {
        id: "meet-1",
        clientId: "client-1",
        title: "Point mensuel",
        heldAt: new Date("2026-07-01T10:00:00Z"),
        durationMinutes: 30,
        participants: ["Marie"],
        agendaMd: "a".repeat(2000),
        summaryMd: "s".repeat(2000),
        _count: { actions: 1 },
      },
    ])
    const result = await listMeetings(USER_ID, { limit: 25 })
    const { data } = result.structuredContent as {
      data: { agenda: string; summary: string }[]
    }
    expect(data[0]!.agenda).toHaveLength(501)
    expect(data[0]!.summary).toHaveLength(501)
    const call = prismaMock.meeting.findMany.mock.calls[0]![0] as {
      where: { userId: string }
    }
    expect(call.where.userId).toBe(USER_ID)
  })
})

describe("logMeeting", () => {
  it("returns not-found for a client owned by another user", async () => {
    prismaMock.client.findFirst.mockResolvedValue(null)
    const result = await logMeeting(USER_ID, {
      clientId: "foreign-client",
      title: "Kickoff",
      heldAt: "2026-07-28",
      durationMinutes: 0,
      participants: [],
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Client not found" })
    expect(prismaMock.meeting.create).not.toHaveBeenCalled()
  })

  it("creates the meeting scoped to the principal and logs the activity", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
    prismaMock.meeting.create.mockResolvedValue({
      id: "meet-1",
      clientId: "client-1",
      title: "Kickoff",
      heldAt: new Date("2026-07-28T00:00:00Z"),
      durationMinutes: 45,
      createdAt: new Date("2026-07-28T01:00:00Z"),
    })
    const result = await logMeeting(USER_ID, {
      clientId: "client-1",
      title: "Kickoff",
      heldAt: "2026-07-28",
      durationMinutes: 45,
      participants: ["Marie"],
    })
    expect(result.isError).toBeUndefined()
    const create = prismaMock.meeting.create.mock.calls[0]![0] as {
      data: { userId: string }
    }
    expect(create.data.userId).toBe(USER_ID)
    expect(deferActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({ kind: "MEETING_LOGGED" }),
    )
  })
})

describe("createAction", () => {
  it("requires a clientId to link an invoice", async () => {
    const result = await createAction(USER_ID, {
      type: "RELANCE",
      title: "Relancer la facture",
      invoiceId: "inv-1",
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({
      text: "A clientId is required to link an invoice or a meeting",
    })
    expect(prismaMock.clientAction.create).not.toHaveBeenCalled()
  })

  it("verifies the linked invoice belongs to the principal and client", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
    prismaMock.invoice.findFirst.mockResolvedValue(null)
    const result = await createAction(USER_ID, {
      clientId: "client-1",
      type: "RELANCE",
      title: "Relancer",
      invoiceId: "foreign-invoice",
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Invoice not found" })
    expect(prismaMock.invoice.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "foreign-invoice", userId: USER_ID, clientId: "client-1" },
      }),
    )
  })

  it("creates the action scoped to the principal with an audit row", async () => {
    prismaMock.client.findFirst.mockResolvedValue({ id: "client-1" })
    prismaMock.clientAction.create.mockResolvedValue({
      id: "act-1",
      clientId: "client-1",
      type: "OTHER",
      title: "Envoyer le récap",
      status: "TODO",
      dueDate: null,
      invoiceId: null,
      meetingId: null,
      createdAt: new Date("2026-07-28T00:00:00Z"),
    })
    const result = await createAction(USER_ID, {
      clientId: "client-1",
      type: "OTHER",
      title: "Envoyer le récap",
    })
    expect(result.isError).toBeUndefined()
    const create = prismaMock.clientAction.create.mock.calls[0]![0] as {
      data: { userId: string }
    }
    expect(create.data.userId).toBe(USER_ID)
    const entry = prismaMock.activityLog.create.mock.calls[0]![0] as {
      data: { title: string }
    }
    expect(entry.data.title).toBe("Appel MCP create_action (succès)")
  })
})
