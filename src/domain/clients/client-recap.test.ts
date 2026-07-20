import { describe, expect, it } from "vitest"
import {
  buildClientFacingRecap,
  type BuildClientFacingRecapInput,
} from "./client-recap"

const PERIOD_START = new Date("2026-04-01T00:00:00.000Z")
const PERIOD_END = new Date("2026-06-30T23:59:59.000Z")

const FORBIDDEN_KEYS = [
  "notes",
  "rate",
  "fixedPrice",
  "deposit",
  "paymentTerms",
  "avgPaymentDelay",
  "revenue",
  "outstanding",
  "balanceDue",
  "paidAmount",
  "invoice",
  "payment",
]

function baseInput(
  overrides: Partial<BuildClientFacingRecapInput> = {},
): BuildClientFacingRecapInput {
  return {
    clientName: "Mistral SAS",
    periodStart: PERIOD_START,
    periodEnd: PERIOD_END,
    issuedAt: new Date("2026-07-01T09:00:00.000Z"),
    completedTasks: [
      {
        identifier: "TRI-2",
        title: "Écran de connexion",
        completedAt: new Date("2026-05-10T10:00:00.000Z"),
        projectName: "Portail",
      },
      {
        identifier: "TRI-1",
        title: "Schéma de données",
        completedAt: new Date("2026-04-05T10:00:00.000Z"),
        projectName: "Portail",
      },
      {
        identifier: "TRI-9",
        title: "Hors période",
        completedAt: new Date("2026-01-05T10:00:00.000Z"),
        projectName: "Ancien projet",
      },
    ],
    heldMeetings: [
      {
        title: "Point hebdo",
        heldAt: new Date("2026-05-12T09:00:00.000Z"),
        durationMinutes: 45,
      },
    ],
    openActions: [
      { title: "Valider la maquette", dueDate: null, status: "WAITING" },
      {
        title: "Envoyer les accès",
        dueDate: new Date("2026-07-05T00:00:00.000Z"),
        status: "TODO",
      },
    ],
    ...overrides,
  }
}

describe("buildClientFacingRecap", () => {
  it("groups completed tasks by project name, oldest first", () => {
    const recap = buildClientFacingRecap(baseInput())

    expect(recap.projects).toHaveLength(1)
    expect(recap.projects[0]!.name).toBe("Portail")
    expect(recap.projects[0]!.tasks.map((t) => t.identifier)).toEqual([
      "TRI-1",
      "TRI-2",
    ])
  })

  it("drops projects whose tasks all fall outside the period", () => {
    const recap = buildClientFacingRecap(baseInput())
    expect(recap.projects.map((p) => p.name)).not.toContain("Ancien projet")
  })

  it("excludes meetings held outside the period", () => {
    const recap = buildClientFacingRecap(
      baseInput({
        heldMeetings: [
          {
            title: "Kickoff",
            heldAt: new Date("2026-01-02T09:00:00.000Z"),
            durationMinutes: 60,
          },
        ],
      }),
    )
    expect(recap.meetings).toHaveLength(0)
  })

  it("marks waiting exactly for WAITING actions", () => {
    const recap = buildClientFacingRecap(baseInput())
    expect(recap.nextSteps).toEqual([
      { title: "Valider la maquette", dueDate: null, waiting: true },
      {
        title: "Envoyer les accès",
        dueDate: "2026-07-05T00:00:00.000Z",
        waiting: false,
      },
    ])
  })

  it("never carries a private field into the payload", () => {
    const serialized = JSON.stringify(
      buildClientFacingRecap(baseInput()),
    ).toLowerCase()
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(serialized).not.toContain(forbidden.toLowerCase())
    }
  })

  it("composes rather than filters: private fields on the source rows never appear", () => {
    const polluted = baseInput()
    const input: BuildClientFacingRecapInput = {
      ...polluted,
      completedTasks: polluted.completedTasks.map((t) => ({
        ...t,
        notes: "note privée",
        rate: 750,
        invoiceId: "inv-1",
      })) as BuildClientFacingRecapInput["completedTasks"],
      heldMeetings: polluted.heldMeetings.map((m) => ({
        ...m,
        notes: "compte rendu interne",
        avgPaymentDelay: 43,
      })) as BuildClientFacingRecapInput["heldMeetings"],
      openActions: polluted.openActions.map((a) => ({
        ...a,
        notes: "relancer, ce client paye en retard",
        balanceDue: 4200,
      })) as BuildClientFacingRecapInput["openActions"],
    }

    const serialized = JSON.stringify(
      buildClientFacingRecap(input),
    ).toLowerCase()
    for (const forbidden of FORBIDDEN_KEYS) {
      expect(serialized).not.toContain(forbidden.toLowerCase())
    }
  })
})
