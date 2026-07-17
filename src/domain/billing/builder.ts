import type { BillingMode } from "@/generated/prisma/client"
import { lineFromTask, sumLines } from "@/lib/billing-math"
import type { InvoiceKind } from "@/domain/billing/types"
import type { InvoiceLineInput } from "@/lib/schemas/invoice"

/**
 * A single editable line in the invoice builder. `taskId` is `null` for manual
 * lines; `id` is a client-local identifier, not the persisted line id.
 */
export interface BuilderLine {
  id: string
  taskId: string | null
  label: string
  qty: number
  rate: number
}

interface SeedClient {
  billingMode: BillingMode
  rate: number
}

interface SeedTask {
  id: string
  linearIdentifier: string
  title: string
  estimate: number | null
}

/**
 * Seeds a builder line from a Linear task using the client's billing mode.
 *
 * The `(qty, rate)` pair follows `lineFromTask` (DAILY/HOURLY/FIXED) and the
 * label is `[<linearIdentifier>] <title>`.
 *
 * @param id - Client-local line id to assign.
 * @param client - Billing mode + rate driving the seeded amounts.
 * @param task - The task to derive the line from.
 * @returns The seeded builder line.
 */
export function buildTaskLine(
  id: string,
  client: SeedClient,
  task: SeedTask,
): BuilderLine {
  const { qty, rate } = lineFromTask({
    billingMode: client.billingMode,
    rate: client.rate,
    estimateDays: task.estimate,
  })
  return {
    id,
    taskId: task.id,
    label: `[${task.linearIdentifier}] ${task.title}`,
    qty,
    rate,
  }
}

interface EligibleTaskRow {
  id: string
  clientId: string
  status: string
  invoiceId: string | null
  projectId: string
  linearIdentifier: string
  title: string
}

/**
 * Filters the tasks eligible to be added to an invoice.
 *
 * Parameterized superset covering both the create and edit builders:
 * - only `PENDING_INVOICE` tasks of the target client,
 * - tasks already attached to another invoice are excluded (a task attached to
 *   `excludeInvoiceId` is treated as unattached — used in edit mode),
 * - tasks already present in the builder lines are excluded,
 * - optional project and free-text (`<identifier> <title>`) narrowing.
 *
 * @param tasks - Candidate tasks.
 * @param opts - Target client id, current lines, project filter, search text
 *   and the invoice id to treat as "own" (edit mode).
 * @returns The subset of tasks that can still be added.
 */
export function filterEligibleTasks<T extends EligibleTaskRow>(
  tasks: readonly T[],
  opts: {
    clientId: string | null | undefined
    lines: readonly { taskId: string | null }[]
    projectId: string
    search: string
    excludeInvoiceId?: string
  },
): T[] {
  const { clientId, lines, projectId, search, excludeInvoiceId } = opts
  if (!clientId) return []
  const q = search.trim().toLowerCase()
  const ownIds = new Set(
    lines.map((l) => l.taskId).filter((x): x is string => Boolean(x)),
  )
  return tasks.filter((t) => {
    if (t.clientId !== clientId) return false
    if (t.status !== "PENDING_INVOICE") return false
    if (t.invoiceId && t.invoiceId !== excludeInvoiceId) return false
    if (ownIds.has(t.id)) return false
    if (projectId !== "all" && t.projectId !== projectId) return false
    if (q && !`${t.linearIdentifier} ${t.title}`.toLowerCase().includes(q))
      return false
    return true
  })
}

interface TotalOpts {
  kind: InvoiceKind
  lines: readonly { qty: number; rate: number }[]
  depositAmount: number
}

/**
 * The pre-override subtotal: the deposit amount for `DEPOSIT`, otherwise the
 * sum of the line `qty * rate`.
 */
export function computeSubtotal(opts: TotalOpts): number {
  return opts.kind === "DEPOSIT"
    ? Number(opts.depositAmount) || 0
    : sumLines(opts.lines)
}

/**
 * The effective invoice total: the manual override when enabled, otherwise the
 * computed subtotal.
 */
export function computeEffectiveTotal(
  opts: TotalOpts & { useTotalOverride: boolean; totalOverride: number },
): number {
  if (opts.useTotalOverride) return Number(opts.totalOverride) || 0
  return computeSubtotal(opts)
}

interface LinesPayloadOpts {
  kind: InvoiceKind
  lines: readonly BuilderLine[]
  depositLabel: string
  depositAmount: number
}

/**
 * Builds the persisted `lines` payload: a single deposit line for `DEPOSIT`,
 * otherwise the coerced builder lines.
 */
export function buildLinesPayload(opts: LinesPayloadOpts): InvoiceLineInput[] {
  if (opts.kind === "DEPOSIT") {
    return [
      {
        taskId: null,
        label: opts.depositLabel,
        qty: 1,
        rate: Number(opts.depositAmount) || 0,
      },
    ]
  }
  return opts.lines.map((l) => ({
    taskId: l.taskId ?? null,
    label: l.label,
    qty: Number(l.qty),
    rate: Number(l.rate),
  }))
}

/**
 * Extracts the task ids bound to a `STANDARD` invoice (empty for `DEPOSIT`).
 */
export function buildTaskIds(
  kind: InvoiceKind,
  lines: readonly BuilderLine[],
): string[] {
  return kind === "STANDARD"
    ? lines.map((l) => l.taskId).filter((x): x is string => Boolean(x))
    : []
}
