import { startTaskSync } from "@/lib/task-sync/http"

/** @deprecated Prefer POST /api/task-sync/linear/refresh. */
export function POST(req: Request) {
  return startTaskSync(req, "linear")
}
