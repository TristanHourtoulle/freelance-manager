import { readFileSync } from "node:fs"
import { join } from "node:path"
import { beforeEach, describe, expect, it, vi } from "vitest"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    activityLog: { create: vi.fn() },
    client: { findFirst: vi.fn() },
    invoice: { findFirst: vi.fn() },
    meeting: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      deleteMany: vi.fn(),
      count: vi.fn(),
    },
    clientAction: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
  },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))
vi.mock("@/lib/auth", () => ({ auth: { api: { getSession: vi.fn() } } }))

const deferActivityLog = vi.fn()
vi.mock("@/lib/activity", () => ({
  deferActivityLog: (args: unknown) => deferActivityLog(args),
}))

import {
  completeAction,
  createAction,
  deleteMeeting,
  listActions,
  listMeetings,
  logMeeting,
  updateMeeting,
} from "./suivi"

const USER_ID = "user-1"

beforeEach(() => {
  vi.clearAllMocks()
  prismaMock.activityLog.create.mockResolvedValue({})
})

describe("listMeetings", () => {
  it("truncates agenda and summary free text", async () => {
    prismaMock.meeting.count.mockResolvedValue(1)
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
    const result = await listMeetings(USER_ID, { limit: 25, fetchAll: false })
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

  it("reports total from count(), independent of page size", async () => {
    prismaMock.meeting.count.mockResolvedValue(137)
    prismaMock.meeting.findMany.mockResolvedValue([
      {
        id: "meet-1",
        clientId: "client-1",
        title: "Kickoff",
        heldAt: new Date("2026-07-01T10:00:00Z"),
        durationMinutes: 10,
        participants: [],
        agendaMd: null,
        summaryMd: null,
        _count: { actions: 0 },
      },
      {
        id: "meet-2",
        clientId: "client-1",
        title: "Suivi",
        heldAt: new Date("2026-07-02T10:00:00Z"),
        durationMinutes: 10,
        participants: [],
        agendaMd: null,
        summaryMd: null,
        _count: { actions: 0 },
      },
    ])
    const result = await listMeetings(USER_ID, { limit: 1, fetchAll: false })
    const structured = result.structuredContent as {
      data: unknown[]
      total: number
      hasMore: boolean
      truncated: boolean
    }
    expect(structured.total).toBe(137)
    expect(structured.data).toHaveLength(1)
    expect(structured.hasMore).toBe(true)
    expect(structured.truncated).toBe(false)
    expect(prismaMock.meeting.count).toHaveBeenCalledTimes(1)
  })
})

describe("listActions", () => {
  it("reports total from count(), independent of page size", async () => {
    prismaMock.clientAction.count.mockResolvedValue(42)
    prismaMock.clientAction.findMany.mockResolvedValue([
      {
        id: "act-1",
        clientId: "client-1",
        type: "OTHER",
        title: "Envoyer le récap",
        link: null,
        notes: null,
        status: "TODO",
        dueDate: null,
        doneAt: null,
        invoiceId: null,
        meetingId: null,
        createdAt: new Date("2026-07-01T00:00:00Z"),
      },
    ])
    const result = await listActions(USER_ID, { limit: 25, fetchAll: false })
    const structured = result.structuredContent as {
      data: unknown[]
      total: number
    }
    expect(structured.total).toBe(42)
    expect(structured.data).toHaveLength(1)
    expect(prismaMock.clientAction.count).toHaveBeenCalledTimes(1)
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

describe("updateMeeting", () => {
  it("returns not-found for a meeting owned by another user", async () => {
    prismaMock.meeting.findFirst.mockResolvedValue(null)
    const result = await updateMeeting(USER_ID, {
      id: "foreign-meeting",
      title: "Nouveau titre",
    })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Meeting not found" })
    expect(prismaMock.meeting.update).not.toHaveBeenCalled()
  })

  it("writes only the fields provided in the call", async () => {
    prismaMock.meeting.findFirst.mockResolvedValue({ id: "meet-1" })
    prismaMock.meeting.update.mockResolvedValue({
      id: "meet-1",
      clientId: "client-1",
      title: "Nouveau titre",
      heldAt: new Date("2026-07-01T10:00:00Z"),
      durationMinutes: 30,
      participants: ["Marie"],
      agendaMd: null,
      summaryMd: null,
      _count: { actions: 0 },
    })
    const result = await updateMeeting(USER_ID, {
      id: "meet-1",
      title: "Nouveau titre",
    })
    expect(result.isError).toBeUndefined()
    const call = prismaMock.meeting.update.mock.calls[0]![0] as {
      where: { id: string }
      data: Record<string, unknown>
    }
    expect(call.where.id).toBe("meet-1")
    expect(call.data).toEqual({ title: "Nouveau titre" })
  })
})

describe("deleteMeeting", () => {
  it("deletes nothing for a foreign id", async () => {
    prismaMock.meeting.findFirst.mockResolvedValue(null)
    const result = await deleteMeeting(USER_ID, { id: "foreign-meeting" })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Meeting not found" })
    expect(prismaMock.meeting.deleteMany).not.toHaveBeenCalled()
  })

  it("deletes the meeting scoped to {id, userId} and returns the deleted payload", async () => {
    prismaMock.meeting.findFirst.mockResolvedValue({
      id: "meet-1",
      clientId: "client-1",
      title: "Kickoff",
      teamsUrl: "https://teams.microsoft.com/l/meetup/abc",
      heldAt: new Date("2026-07-01T10:00:00Z"),
      durationMinutes: 45,
      participants: ["Marie", "Tristan"],
      agendaMd: "Ordre du jour",
      summaryMd: "Compte-rendu",
      _count: { actions: 2 },
    })
    prismaMock.meeting.deleteMany.mockResolvedValue({ count: 1 })

    const result = await deleteMeeting(USER_ID, { id: "meet-1" })

    expect(result.isError).toBeUndefined()
    expect(prismaMock.meeting.deleteMany).toHaveBeenCalledWith({
      where: { id: "meet-1", userId: USER_ID },
    })
    expect(result.structuredContent).toMatchObject({
      id: "meet-1",
      clientId: "client-1",
      title: "Kickoff",
      teamsUrl: "https://teams.microsoft.com/l/meetup/abc",
      durationMinutes: 45,
      participants: ["Marie", "Tristan"],
      agenda: "Ordre du jour",
      summary: "Compte-rendu",
      actionsCount: 2,
    })
  })

  it("never cascade-deletes linked ClientAction rows — the schema relation is SetNull, not Cascade", () => {
    const schema = readFileSync(
      join(process.cwd(), "prisma/schema.prisma"),
      "utf8",
    )
    const meetingRelation = schema.match(
      /meeting\s+Meeting\?\s*@relation\([^)]*\)/,
    )
    expect(meetingRelation?.[0]).toBeDefined()
    expect(meetingRelation![0]).toContain("onDelete: SetNull")
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

describe("completeAction", () => {
  it("returns not-found for an action owned by another user", async () => {
    prismaMock.clientAction.findFirst.mockResolvedValue(null)
    const result = await completeAction(USER_ID, { id: "foreign-action" })
    expect(result.isError).toBe(true)
    expect(result.content[0]).toMatchObject({ text: "Action not found" })
    expect(prismaMock.clientAction.update).not.toHaveBeenCalled()
  })

  it("stamps doneAt and writes the ACTION_DONE activity log, scoped by userId", async () => {
    prismaMock.clientAction.findFirst.mockResolvedValue({
      id: "act-1",
      clientId: "client-1",
      type: "RELANCE",
      title: "Relancer la facture",
      link: null,
      notes: null,
      status: "TODO",
      dueDate: null,
      doneAt: null,
      invoiceId: null,
      meetingId: null,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    })
    prismaMock.clientAction.update.mockResolvedValue({
      id: "act-1",
      clientId: "client-1",
      type: "RELANCE",
      title: "Relancer la facture",
      link: null,
      notes: null,
      status: "DONE",
      dueDate: null,
      doneAt: new Date("2026-07-28T00:00:00Z"),
      invoiceId: null,
      meetingId: null,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    })

    const result = await completeAction(USER_ID, { id: "act-1" })

    expect(result.isError).toBeUndefined()
    expect(prismaMock.clientAction.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "act-1", userId: USER_ID },
      }),
    )
    expect(prismaMock.clientAction.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "act-1" },
        data: { status: "DONE", doneAt: expect.any(Date) },
      }),
    )
    expect(deferActivityLog).toHaveBeenCalledWith(
      expect.objectContaining({
        kind: "ACTION_DONE",
        clientId: "client-1",
      }),
    )
    const structured = result.structuredContent as {
      status: string
      doneAt: string | null
    }
    expect(structured.status).toBe("DONE")
    expect(structured.doneAt).not.toBeNull()
  })

  it("is a no-op when the action is already DONE — no update, no activity log", async () => {
    const doneAt = new Date("2026-07-20T00:00:00Z")
    prismaMock.clientAction.findFirst.mockResolvedValue({
      id: "act-1",
      clientId: "client-1",
      type: "RELANCE",
      title: "Relancer la facture",
      link: null,
      notes: null,
      status: "DONE",
      dueDate: null,
      doneAt,
      invoiceId: null,
      meetingId: null,
      createdAt: new Date("2026-07-01T00:00:00Z"),
    })

    const result = await completeAction(USER_ID, { id: "act-1" })

    expect(result.isError).toBeUndefined()
    expect(prismaMock.clientAction.update).not.toHaveBeenCalled()
    expect(deferActivityLog).not.toHaveBeenCalled()
    const structured = result.structuredContent as { doneAt: string | null }
    expect(structured.doneAt).toBe(doneAt.toISOString())
  })
})
