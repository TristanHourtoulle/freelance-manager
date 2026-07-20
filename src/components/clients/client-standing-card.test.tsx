import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import {
  ClientStandingCard,
  daysSinceLastContact,
} from "./client-standing-card"

describe("daysSinceLastContact", () => {
  it("returns null when there has never been a contact", () => {
    expect(daysSinceLastContact(null, new Date("2026-07-20T10:00:00Z"))).toBe(
      null,
    )
  })

  it("counts whole elapsed days", () => {
    expect(
      daysSinceLastContact(
        "2026-07-08T10:00:00Z",
        new Date("2026-07-20T10:00:00Z"),
      ),
    ).toBe(12)
  })
})

describe("ClientStandingCard", () => {
  it("states the absence of follow-up rather than hiding the card", () => {
    const { container } = render(
      <ClientStandingCard
        lastContactAt={null}
        meetings={[]}
        openActions={[]}
      />,
    )

    expect(container.textContent).toContain("Où on en est")
    expect(container.textContent).toContain("Aucun contact enregistré")
    expect(container.textContent).toContain(
      "Aucun suivi enregistré pour ce client.",
    )
  })

  it("pills a WAITING action and never marks it overdue", () => {
    const { container } = render(
      <ClientStandingCard
        lastContactAt="2026-07-01T10:00:00.000Z"
        meetings={[]}
        openActions={[
          {
            id: "a1",
            title: "Valider la maquette",
            type: "OTHER",
            status: "WAITING",
            dueDate: "2020-01-01T00:00:00.000Z",
            meetingId: null,
          },
        ]}
      />,
    )

    expect(container.querySelector(".pill-waiting")?.textContent).toBe(
      "En attente",
    )
    expect(container.querySelector(".suivi-due.overdue")).toBeNull()
  })

  it("marks a past-due TODO action as overdue", () => {
    const { container } = render(
      <ClientStandingCard
        lastContactAt="2026-07-01T10:00:00.000Z"
        meetings={[]}
        openActions={[
          {
            id: "a2",
            title: "Envoyer les accès",
            type: "OTHER",
            status: "TODO",
            dueDate: "2020-01-01T00:00:00.000Z",
            meetingId: null,
          },
        ]}
      />,
    )

    expect(container.querySelector(".suivi-due.overdue")).not.toBeNull()
  })

  it("shows the last meeting with a plain-text summary excerpt", () => {
    const { container } = render(
      <ClientStandingCard
        lastContactAt="2026-07-01T10:00:00.000Z"
        meetings={[
          {
            id: "m1",
            title: "Point hebdo",
            heldAt: "2026-07-01T10:00:00.000Z",
            durationMinutes: 45,
            participants: ["Alice", "Bob"],
            summaryMd: "## Décisions\n- On part sur la v2",
          },
        ]}
        openActions={[]}
      />,
    )

    expect(container.textContent).toContain("Point hebdo")
    expect(container.textContent).toContain("2 participants")
    expect(container.textContent).toContain("On part sur la v2")
    expect(container.textContent).not.toContain("##")
  })
})
