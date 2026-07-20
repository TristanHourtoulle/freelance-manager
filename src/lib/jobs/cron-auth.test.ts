import { afterEach, beforeEach, describe, expect, it } from "vitest"
import { authorizeCronRequest } from "./cron-auth"

const SECRET = "test-cron-secret-value"

function request(key?: string) {
  return new Request("http://localhost/api/cron/daily", {
    method: "POST",
    headers: key === undefined ? {} : { "X-Cron-Key": key },
  })
}

describe("authorizeCronRequest", () => {
  let previous: string | undefined

  beforeEach(() => {
    previous = process.env.CRON_SECRET
    process.env.CRON_SECRET = SECRET
  })

  afterEach(() => {
    if (previous === undefined) delete process.env.CRON_SECRET
    else process.env.CRON_SECRET = previous
  })

  it("authorizes the correct key", () => {
    expect(authorizeCronRequest(request(SECRET))).toEqual({ ok: true })
  })

  it("rejects a wrong key of the same length", () => {
    const wrong = "test-cron-secret-valuX"
    expect(wrong).toHaveLength(SECRET.length)
    expect(authorizeCronRequest(request(wrong))).toEqual({
      ok: false,
      status: 401,
      code: "CRON_BAD_KEY",
    })
  })

  it("rejects a wrong key of a different length without throwing", () => {
    expect(() => authorizeCronRequest(request("short"))).not.toThrow()
    expect(authorizeCronRequest(request("short"))).toEqual({
      ok: false,
      status: 401,
      code: "CRON_BAD_KEY",
    })
  })

  it("rejects an empty key", () => {
    expect(authorizeCronRequest(request(""))).toEqual({
      ok: false,
      status: 401,
      code: "CRON_BAD_KEY",
    })
  })

  it("rejects a missing header", () => {
    expect(authorizeCronRequest(request())).toEqual({
      ok: false,
      status: 401,
      code: "CRON_BAD_KEY",
    })
  })

  it("fails closed with 503 when CRON_SECRET is unset, even with a header", () => {
    delete process.env.CRON_SECRET
    expect(authorizeCronRequest(request(SECRET))).toEqual({
      ok: false,
      status: 503,
      code: "CRON_NOT_CONFIGURED",
    })
  })
})
