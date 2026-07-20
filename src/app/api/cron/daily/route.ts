import { NextResponse } from "next/server"
import { authorizeCronRequest } from "@/lib/jobs/cron-auth"
import { runDailyJobs } from "@/lib/jobs/daily"

/**
 * POST /api/cron/daily
 *
 * Public endpoint reached by the external scheduler, which carries no session
 * cookie and no Origin header. It is guarded solely by the X-Cron-Key header
 * compared in constant time against CRON_SECRET, and fails closed with 503
 * when that secret is unset.
 *
 * An authorized call ALWAYS returns 200, even when individual jobs failed: a
 * 5xx makes the scheduler retry, and a retry storm on DB-backed jobs is worse
 * than a missed day. Failures surface as `ok: false` rows in the body and in
 * the server logs. The response never echoes the key.
 *
 * @param request - The scheduler request.
 * @returns 200 with the run result, 401 on a bad key, 503 when unconfigured.
 */
export async function POST(request: Request) {
  const auth = authorizeCronRequest(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.code }, { status: auth.status })
  }

  const result = await runDailyJobs(new Date())
  return NextResponse.json(result)
}
