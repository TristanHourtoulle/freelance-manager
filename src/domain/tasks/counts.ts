import { z } from "zod/v4"

/**
 * Maximum number of ids accepted per multi-select filter param.
 */
export const TASK_ID_FILTER_MAX = 200

/**
 * Wire codec for a multi-select id filter param.
 *
 * Decodes one comma-separated query param (`clientIds=c1,c2`) into a string
 * array, dropping blank segments, so an empty or absent param decodes to "no
 * narrowing". Rejects lists longer than {@link TASK_ID_FILTER_MAX} entries.
 */
export const taskIdListParamSchema = z
  .string()
  .transform((value) =>
    value
      .split(",")
      .map((id) => id.trim())
      .filter((id) => id.length > 0),
  )
  .pipe(z.array(z.string().min(1)).max(TASK_ID_FILTER_MAX))

/**
 * Query contract of the `GET /api/tasks?summary=status` aggregate mode.
 *
 * `summary` is the mode discriminator; `clientIds` / `projectIds` are
 * comma-separated id lists narrowing the counts to the clients or projects
 * currently selected on the Tasks page, so the chips stay truthful under a
 * multi-select. An empty or absent list means "no narrowing".
 */
export const taskCountsQuerySchema = z.object({
  summary: z.literal("status"),
  clientIds: taskIdListParamSchema.optional(),
  projectIds: taskIdListParamSchema.optional(),
})

/**
 * Optional client / project multi-select narrowing accepted by the counts
 * aggregate. Empty or absent arrays mean "no narrowing", never "match
 * nothing".
 */
export type TaskCountsQuery = {
  clientIds?: string[]
  projectIds?: string[]
}

/**
 * One grouped row as returned by the SQL aggregate, before normalization.
 *
 * Counts may surface as `bigint` or numeric strings depending on the driver,
 * so every field is widened and coerced by {@link buildTaskCountsSummary}.
 */
export interface TaskCountsAggregateRow {
  all: number | bigint
  pending: number | bigint
  done: number | bigint
  inProgress: number | bigint
  invoiced: number | bigint
  nonBillable: number | bigint
  unestimated: number | bigint
}

/**
 * Wire shape of the uncapped Tasks-page chip counts.
 *
 * Keys mirror the exact filter ids used by the desktop (`all | pending | done
 * | in_progress | non_billable`) and mobile (`all | pending | done | invoiced
 * | non_billable`) Tasks pages, so either twin can index the object directly.
 * Every figure is computed over the page's visible status universe
 * (`PENDING_INVOICE`, `DONE`, `IN_PROGRESS`, `BACKLOG`), never over a
 * paginated slice.
 *
 * `pending` counts every `PENDING_INVOICE` row, matching the historical chip
 * semantics — it is deliberately broader than the "À facturer" pipeline total
 * (`getClientsBillableSummary.totalCount`), which additionally requires
 * uninvoiced + billable + active FREELANCE client. The two figures answer
 * different questions and must not be conflated.
 *
 * `unestimatedCount` is the "N à estimer" figure: billable, uninvoiced
 * `PENDING_INVOICE` rows whose estimate is still null.
 */
export interface TaskCountsSummary {
  all: number
  pending: number
  done: number
  in_progress: number
  invoiced: number
  non_billable: number
  unestimatedCount: number
}

function toCount(value: number | bigint): number {
  return Number(value)
}

/**
 * Fold the raw SQL aggregate row into the wire summary.
 *
 * @param row - The single grouped row, or `undefined` when the driver returned
 *   no row at all.
 * @returns The normalized summary; all-zero when `row` is absent.
 */
export function buildTaskCountsSummary(
  row: TaskCountsAggregateRow | undefined,
): TaskCountsSummary {
  if (!row) {
    return {
      all: 0,
      pending: 0,
      done: 0,
      in_progress: 0,
      invoiced: 0,
      non_billable: 0,
      unestimatedCount: 0,
    }
  }
  return {
    all: toCount(row.all),
    pending: toCount(row.pending),
    done: toCount(row.done),
    in_progress: toCount(row.inProgress),
    invoiced: toCount(row.invoiced),
    non_billable: toCount(row.nonBillable),
    unestimatedCount: toCount(row.unestimated),
  }
}
