import { beforeEach, describe, expect, it, vi } from "vitest"
import { recordMcpToolCall, withMcpAudit } from "./audit"

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: { activityLog: { create: vi.fn() } },
}))
vi.mock("@/lib/db", () => ({ prisma: prismaMock }))

interface CreatedRow {
  userId: string
  kind: string
  title: string
  meta: string
}

function createdRow(callIndex = 0): CreatedRow {
  const call = prismaMock.activityLog.create.mock.calls[callIndex]?.[0] as
    | { data: CreatedRow }
    | undefined
  if (!call) throw new Error("no activityLog.create call recorded")
  return call.data
}

describe("recordMcpToolCall", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.activityLog.create.mockResolvedValue({})
  })

  it("writes one MCP_TOOL_CALL row with structured meta", async () => {
    await recordMcpToolCall({
      userId: "user-1",
      tool: "list_clients",
      args: { archived: false },
      outcome: "success",
      durationMs: 42,
    })
    const row = createdRow()
    expect(row.userId).toBe("user-1")
    expect(row.kind).toBe("MCP_TOOL_CALL")
    expect(row.title).toBe("Appel MCP list_clients (succès)")
    expect(JSON.parse(row.meta)).toEqual({
      tool: "list_clients",
      outcome: "success",
      durationMs: 42,
      args: JSON.stringify({ archived: false }),
    })
  })

  it("writes a row for a rejected (rate-limited) call", async () => {
    await recordMcpToolCall({
      userId: "user-1",
      tool: "tools/call:list_clients",
      args: null,
      outcome: "rate_limited",
      durationMs: 0,
    })
    const meta = JSON.parse(createdRow().meta) as { outcome: string }
    expect(meta.outcome).toBe("rate_limited")
  })

  it("caps serialized arguments and marks the truncation", async () => {
    await recordMcpToolCall({
      userId: "user-1",
      tool: "list_tasks",
      args: { blob: "x".repeat(5000) },
      outcome: "success",
      durationMs: 1,
    })
    const meta = JSON.parse(createdRow().meta) as { args: string }
    expect(meta.args.length).toBeLessThanOrEqual(2020)
    expect(meta.args.endsWith("…[truncated]")).toBe(true)
  })

  it("survives unserializable arguments", async () => {
    const circular: Record<string, unknown> = {}
    circular.self = circular
    await recordMcpToolCall({
      userId: "user-1",
      tool: "list_tasks",
      args: circular,
      outcome: "success",
      durationMs: 1,
    })
    const meta = JSON.parse(createdRow().meta) as { args: string }
    expect(meta.args).toBe("[unserializable]")
  })

  it("propagates an insert failure (fail closed)", async () => {
    prismaMock.activityLog.create.mockRejectedValue(new Error("db down"))
    await expect(
      recordMcpToolCall({
        userId: "user-1",
        tool: "list_clients",
        args: null,
        outcome: "success",
        durationMs: 1,
      }),
    ).rejects.toThrow("db down")
  })
})

describe("withMcpAudit", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    prismaMock.activityLog.create.mockResolvedValue({})
  })

  it("returns the handler result after persisting a success row", async () => {
    const result = await withMcpAudit(
      { userId: "user-1", tool: "get_client", args: { id: "c1" } },
      async () => "payload",
    )
    expect(result).toBe("payload")
    const meta = JSON.parse(createdRow().meta) as { outcome: string }
    expect(meta.outcome).toBe("success")
  })

  it("audits a failing handler and rethrows the original error", async () => {
    await expect(
      withMcpAudit({ userId: "user-1", tool: "get_client", args: {} }, () =>
        Promise.reject(new Error("boom")),
      ),
    ).rejects.toThrow("boom")
    const meta = JSON.parse(createdRow().meta) as { outcome: string }
    expect(meta.outcome).toBe("error")
  })

  it("fails the call when the success audit write fails", async () => {
    prismaMock.activityLog.create.mockRejectedValue(new Error("audit down"))
    await expect(
      withMcpAudit(
        { userId: "user-1", tool: "get_client", args: {} },
        async () => "payload",
      ),
    ).rejects.toThrow("audit down")
  })

  it("keeps the original error when the error-path audit write also fails", async () => {
    const consoleSpy = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined)
    prismaMock.activityLog.create.mockRejectedValue(new Error("audit down"))
    await expect(
      withMcpAudit({ userId: "user-1", tool: "get_client", args: {} }, () =>
        Promise.reject(new Error("boom")),
      ),
    ).rejects.toThrow("boom")
    expect(consoleSpy).toHaveBeenCalled()
    consoleSpy.mockRestore()
  })
})
