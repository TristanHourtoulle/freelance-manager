import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

const runDailyJobs = vi.fn()
vi.mock("@/lib/jobs/daily", () => ({ runDailyJobs: () => runDailyJobs() }))

const SECRET = "test-cron-secret-value"

function request(key?: string) {
  return new Request("http://localhost/api/cron/daily", {
    method: "POST",
    headers: key === undefined ? {} : { "X-Cron-Key": key },
  })
}

const OK_RESULT = {
  startedAt: "2026-07-20T07:00:00.000Z",
  finishedAt: "2026-07-20T07:00:01.000Z",
  jobs: [{ name: "overdue-relances", ok: true, count: 2 }],
}

describe("POST /api/cron/daily", () => {
  let previous: string | undefined

  beforeEach(() => {
    vi.clearAllMocks()
    previous = process.env.CRON_SECRET
    process.env.CRON_SECRET = SECRET
    runDailyJobs.mockResolvedValue(OK_RESULT)
  })

  afterEach(() => {
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  })

  it("rejects a wrong key without running any job", async () => {
    const { POST } = await import("./route")
    const res = await POST(request("wrong-key"))
    const body = await res.json()

    expect(res.status).toBe(401)
    expect(body.error).toBe("CRON_BAD_KEY")
    expect(JSON.stringify(body)).not.toContain(SECRET)
    expect(runDailyJobs).not.toHaveBeenCalled()
  })

  it("rejects a missing header without running any job", async () => {
    const { POST } = await import("./route")
    const res = await POST(request())

    expect(res.status).toBe(401)
    expect(runDailyJobs).not.toHaveBeenCalled()
  })

  it("returns 503 and runs nothing when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET

    const { POST } = await import("./route")
    const res = await POST(request(SECRET))
    const body = await res.json()

    expect(res.status).toBe(503)
    expect(body.error).toBe("CRON_NOT_CONFIGURED")
    expect(runDailyJobs).not.toHaveBeenCalled()
  })

  it("runs the jobs once and returns the result on a valid key", async () => {
    const { POST } = await import("./route")
    const res = await POST(request(SECRET))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(runDailyJobs).toHaveBeenCalledTimes(1)
    expect(body.jobs).toEqual(OK_RESULT.jobs)
  })

  it("still returns 200 when a job reported a failure", async () => {
    runDailyJobs.mockResolvedValue({
      ...OK_RESULT,
      jobs: [{ name: "overdue-relances", ok: false, count: 0 }],
    })

    const { POST } = await import("./route")
    const res = await POST(request(SECRET))
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.jobs[0].ok).toBe(false)
  })
})
