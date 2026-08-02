import { getTaskSyncStatus } from "@/lib/task-sync/http"

interface RouteContext {
  params: Promise<{ provider: string }>
}

export async function GET(_req: Request, { params }: RouteContext) {
  const { provider } = await params
  return getTaskSyncStatus(provider)
}
