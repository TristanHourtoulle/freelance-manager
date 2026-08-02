import { startTaskSync } from "@/lib/task-sync/http"

interface RouteContext {
  params: Promise<{ provider: string }>
}

export async function POST(req: Request, { params }: RouteContext) {
  const { provider } = await params
  return startTaskSync(req, provider)
}
