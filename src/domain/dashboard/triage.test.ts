import { describe, expect, it } from "vitest"
import { fmtEUR } from "@/lib/format"
import {
  buildTriageItems,
  countEstimatedPipelineTasks,
  TRIAGE_TOP_N,
  type TriageInput,
} from "./triage"

const NOW = new Date(2026, 6, 28, 10, 0, 0)

function baseInput(overrides: Partial<TriageInput> = {}): TriageInput {
  return {
    now: NOW,
    overdue: [],
    pipelineAging: { oldestDays: null, staleCount: 0, staleValue: 0 },
    unestimatedCount: 0,
    actions: [],
    meetings: [],
    ...overrides,
  }
}

function daysAgo(n: number): string {
  return new Date(NOW.getTime() - n * 86_400_000).toISOString()
}

function todayAt(hours: number, minutes = 0): string {
  return new Date(2026, 6, 28, hours, minutes).toISOString()
}

describe("buildTriageItems", () => {
  it("returns an empty queue when nothing is actionable", () => {
    expect(buildTriageItems(baseInput())).toEqual([])
  })

  it("orders items danger, warn, info, then plain", () => {
    const items = buildTriageItems(
      baseInput({
        overdue: [
          {
            id: "i1",
            number: "2026-1001",
            clientId: "c1",
            total: 1200,
            dueDate: daysAgo(4),
          },
        ],
        pipelineAging: { oldestDays: 41, staleCount: 2, staleValue: 3000 },
        unestimatedCount: 1,
        actions: [
          {
            id: "a1",
            title: "Relancer devis",
            status: "TODO",
            dueDate: daysAgo(1),
          },
        ],
        meetings: [
          { id: "m1", title: "Point client", heldAt: todayAt(14, 30) },
        ],
      }),
    )
    expect(items.map((i) => i.kind)).toEqual([
      "overdue",
      "stalePipeline",
      "unestimated",
      "action",
      "meeting",
    ])
    expect(items.map((i) => i.severity)).toEqual([
      "danger",
      "warn",
      "info",
      "plain",
      "plain",
    ])
  })

  it("builds one danger row per overdue invoice with days late and balance", () => {
    const items = buildTriageItems(
      baseInput({
        overdue: [
          {
            id: "i1",
            number: "2026-1001",
            clientId: "c1",
            total: 1200,
            dueDate: daysAgo(4),
          },
          {
            id: "i2",
            number: "2026-1002",
            clientId: "c2",
            total: 800,
            dueDate: daysAgo(10),
          },
        ],
      }),
    )
    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({
      kind: "overdue",
      title: "2026-1001",
      detail: `Échue il y a 4 j · ${fmtEUR(1200)}`,
      invoiceId: "i1",
      clientId: "c1",
    })
    expect(items[1]?.detail).toBe(`Échue il y a 10 j · ${fmtEUR(800)}`)
  })

  it("clamps a not-yet-elapsed due date to zero days late", () => {
    const items = buildTriageItems(
      baseInput({
        overdue: [
          {
            id: "i1",
            number: "2026-1001",
            clientId: "c1",
            total: 100,
            dueDate: new Date(NOW.getTime() + 3_600_000).toISOString(),
          },
        ],
      }),
    )
    expect(items[0]?.detail).toBe(`Échue il y a 0 j · ${fmtEUR(100)}`)
  })

  it("describes the stale pipeline with singular wording for one task", () => {
    const items = buildTriageItems(
      baseInput({
        pipelineAging: { oldestDays: 35, staleCount: 1, staleValue: 900 },
      }),
    )
    expect(items[0]).toMatchObject({
      kind: "stalePipeline",
      title: "Pipeline vieillissante",
      detail: `La plus ancienne attend 35 j · 1 task > 30 j · ${fmtEUR(900)}`,
    })
  })

  it("pluralizes the unestimated row and keeps the singular form", () => {
    const many = buildTriageItems(baseInput({ unestimatedCount: 3 }))
    expect(many[0]?.title).toBe("3 tâches à estimer")
    const one = buildTriageItems(baseInput({ unestimatedCount: 1 }))
    expect(one[0]?.title).toBe("1 tâche à estimer")
    expect(one[0]?.detail).toBe(
      "Valeur pipeline inconnue tant qu'elles ne sont pas estimées",
    )
  })

  it("keeps only TODO actions due by end of today, sorted, capped at three", () => {
    const items = buildTriageItems(
      baseInput({
        actions: [
          { id: "a1", title: "Demain", status: "TODO", dueDate: daysAgo(-1) },
          { id: "a2", title: "Sans date", status: "TODO", dueDate: null },
          { id: "a3", title: "Faite", status: "DONE", dueDate: daysAgo(2) },
          { id: "a4", title: "Hier", status: "TODO", dueDate: daysAgo(1) },
          {
            id: "a5",
            title: "Avant-hier",
            status: "TODO",
            dueDate: daysAgo(2),
          },
          { id: "a6", title: "Ce matin", status: "TODO", dueDate: todayAt(9) },
          {
            id: "a7",
            title: "Il y a 3 j",
            status: "TODO",
            dueDate: daysAgo(3),
          },
        ],
      }),
    )
    expect(items).toHaveLength(TRIAGE_TOP_N)
    expect(items.map((i) => i.title)).toEqual([
      "Il y a 3 j",
      "Avant-hier",
      "Hier",
    ])
    expect(items.every((i) => i.detail === "Action due aujourd'hui")).toBe(true)
  })

  it("keeps only today's meetings with their time, capped at three", () => {
    const items = buildTriageItems(
      baseInput({
        meetings: [
          { id: "m0", title: "Hier", heldAt: daysAgo(1) },
          { id: "m1", title: "Après-midi", heldAt: todayAt(15, 45) },
          { id: "m2", title: "Matin", heldAt: todayAt(9, 0) },
          { id: "m3", title: "Midi", heldAt: todayAt(12, 15) },
          { id: "m4", title: "Soir", heldAt: todayAt(18, 0) },
        ],
      }),
    )
    expect(items).toHaveLength(TRIAGE_TOP_N)
    expect(items[0]?.title).toBe("Matin")
    expect(items[0]?.detail).toBe("Réunion aujourd'hui · 09:00")
    expect(items[2]?.detail).toBe("Réunion aujourd'hui · 15:45")
  })
})

describe("countEstimatedPipelineTasks", () => {
  it("subtracts the unestimated tasks from the pipeline count", () => {
    expect(countEstimatedPipelineTasks(7, 2)).toBe(5)
  })

  it("never returns a negative count", () => {
    expect(countEstimatedPipelineTasks(1, 3)).toBe(0)
    expect(countEstimatedPipelineTasks(0, 0)).toBe(0)
  })
})
