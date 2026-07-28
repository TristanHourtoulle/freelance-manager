import { NextResponse } from "next/server"
import { prisma } from "@/lib/db"
import {
  apiServerError,
  apiUnauthorized,
  getAuthUser,
  requireSameOrigin,
} from "@/lib/api"
import { taskBulkBillabilitySchema } from "@/lib/schemas/task"
import { buildBillabilityUpdate } from "@/domain/tasks/billability"

/**
 * Bulk-set the billability of up to 500 tasks in one call.
 *
 * The update is scoped to the authenticated user's rows, only touches the
 * billability columns (never `status` nor `invoiceId`), and applies one shared
 * patch built by `buildBillabilityUpdate` to the whole batch.
 *
 * @param req - The incoming request; must be same-origin.
 * @returns `{ updated }` with the number of rows changed, 400/401/403 otherwise.
 */
export async function POST(req: Request) {
  const csrf = requireSameOrigin(req)
  if (csrf) return csrf
  const user = await getAuthUser()
  if (!user) return apiUnauthorized()

  try {
    const { taskIds, ...billability } = taskBulkBillabilitySchema.parse(
      await req.json(),
    )
    const patch = buildBillabilityUpdate(billability)
    const result = await prisma.task.updateMany({
      where: { id: { in: taskIds }, userId: user.id },
      data: patch,
    })
    return NextResponse.json({ updated: result.count })
  } catch (error) {
    return apiServerError(error)
  }
}
