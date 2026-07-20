import { describe, expect, it } from "vitest"

import {
  buildClientsRecencySummary,
  CLIENT_SILENCE_DAYS,
  EMPTY_RECENCY_SUMMARY,
} from "./recency"

const NOW = new Date(2026, 2, 15, 12, 0, 0)
const DAY_MS = 86_400_000

function daysAgo(days: number): Date {
  return new Date(NOW.getTime() - days * DAY_MS)
}

describe("buildClientsRecencySummary", () => {
  it("reports zero silent days for a contact today", () => {
    const { byClient } = buildClientsRecencySummary(
      [{ clientId: "c1", lastContactAt: NOW }],
      NOW,
    )

    expect(byClient["c1"]?.silentDays).toBe(0)
    expect(byClient["c1"]?.isSilent).toBe(false)
  })

  it("keeps a client contacted 29 days ago out of the silent set", () => {
    const { byClient } = buildClientsRecencySummary(
      [{ clientId: "c1", lastContactAt: daysAgo(29) }],
      NOW,
    )

    expect(byClient["c1"]?.silentDays).toBe(29)
    expect(byClient["c1"]?.isSilent).toBe(false)
  })

  it("flags the threshold day itself as silent", () => {
    const { byClient } = buildClientsRecencySummary(
      [{ clientId: "c1", lastContactAt: daysAgo(CLIENT_SILENCE_DAYS) }],
      NOW,
    )

    expect(byClient["c1"]?.silentDays).toBe(CLIENT_SILENCE_DAYS)
    expect(byClient["c1"]?.isSilent).toBe(true)
  })

  it("keeps counting beyond the threshold", () => {
    const { byClient } = buildClientsRecencySummary(
      [{ clientId: "c1", lastContactAt: daysAgo(100) }],
      NOW,
    )

    expect(byClient["c1"]?.silentDays).toBe(100)
    expect(byClient["c1"]?.isSilent).toBe(true)
  })

  it("returns a null duration when the client has no dated contact", () => {
    const { byClient } = buildClientsRecencySummary(
      [{ clientId: "c1", lastContactAt: null }],
      NOW,
    )

    expect(byClient["c1"]).toEqual({
      lastContactAt: null,
      silentDays: null,
      isSilent: false,
    })
  })

  it("clamps a future contact date to zero rather than a negative duration", () => {
    const { byClient } = buildClientsRecencySummary(
      [
        {
          clientId: "c1",
          lastContactAt: new Date(NOW.getTime() + 5 * DAY_MS),
        },
      ],
      NOW,
    )

    expect(byClient["c1"]?.silentDays).toBe(0)
    expect(byClient["c1"]?.isSilent).toBe(false)
  })

  it("serializes the last contact as ISO for both Date and string inputs", () => {
    const date = daysAgo(10)
    const { byClient } = buildClientsRecencySummary(
      [
        { clientId: "c1", lastContactAt: date },
        { clientId: "c2", lastContactAt: date.toISOString() },
      ],
      NOW,
    )

    expect(byClient["c1"]?.lastContactAt).toBe(date.toISOString())
    expect(byClient["c2"]?.lastContactAt).toBe(date.toISOString())
    expect(byClient["c2"]?.silentDays).toBe(10)
  })

  it("returns no entries for empty input", () => {
    expect(buildClientsRecencySummary([], NOW)).toEqual(EMPTY_RECENCY_SUMMARY)
  })
})
