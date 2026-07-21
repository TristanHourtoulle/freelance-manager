import type { BillingMode } from "@/generated/prisma/client"
import { lineFromTask, sumLines } from "@/lib/billing-math"
import type { QuoteStatus } from "@/domain/quotes/types"
import type {
  QuoteCreateInput,
  QuoteLineInput,
  QuoteUpdateInput,
} from "@/lib/schemas/quote"

/**
 * A single editable line of the quote form. `key` is a client-local identifier
 * (never persisted); `taskId` is `null` for manual lines.
 */
export interface QuoteLineDraft {
  key: string
  taskId: string | null
  label: string
  qty: number
  rate: number
}

/**
 * The full editable state of the quote form, consumed by the pure payload
 * builders below so they can be unit-tested without React.
 */
export interface QuoteFormState {
  clientId: string
  projectId: string | null
  number: string
  status: QuoteStatus
  issueDate: string
  validUntil: string
  externalUrl: string
  notes: string
  lines: QuoteLineDraft[]
}

interface TaskLike {
  id: string
  linearIdentifier: string
  title: string
  estimate: number | null
}

interface ClientLike {
  billingMode: BillingMode
  rate: number
}

/**
 * Derive a quote line from a Linear task using the client's billing mode.
 *
 * The `(qty, rate)` pair follows `lineFromTask` (DAILY/HOURLY/FIXED) and the
 * label is `[<linearIdentifier>] <title>`.
 *
 * @param task - The task to derive the line from.
 * @param client - Billing mode + rate driving the seeded amounts.
 * @returns The line fields (without a client-local `key`).
 */
export function lineFromTaskForQuote(
  task: TaskLike,
  client: ClientLike,
): Omit<QuoteLineDraft, "key"> {
  const { qty, rate } = lineFromTask({
    billingMode: client.billingMode,
    rate: client.rate,
    estimateDays: task.estimate,
  })
  return {
    taskId: task.id,
    label: `[${task.linearIdentifier}] ${task.title}`,
    qty,
    rate,
  }
}

/**
 * The quote totals. Quotes carry no tax and no override, so the total equals
 * the sum of every line `qty * rate`.
 *
 * @param lines - The current quote lines.
 * @returns The identical `subtotal` and `total`.
 */
export function quoteFormTotals(
  lines: readonly { qty: number; rate: number }[],
): { subtotal: number; total: number } {
  const subtotal = sumLines(lines)
  return { subtotal, total: subtotal }
}

function isLineValid(line: QuoteLineDraft): boolean {
  return (
    line.label.trim().length > 0 &&
    Number.isFinite(line.qty) &&
    line.qty >= 0 &&
    Number.isFinite(line.rate) &&
    line.rate >= 0
  )
}

/**
 * Whether the form can be submitted: a client is set and every one of the (at
 * least one) lines has a non-empty label and valid amounts.
 *
 * @param state - The current form state.
 * @returns `true` when the form is submittable.
 */
export function canSubmitQuoteForm(state: QuoteFormState): boolean {
  return (
    state.clientId.trim().length > 0 &&
    state.lines.length >= 1 &&
    state.lines.every(isLineValid)
  )
}

function cleanLines(lines: readonly QuoteLineDraft[]): QuoteLineInput[] {
  return lines.map((l) => ({
    taskId: l.taskId ?? null,
    label: l.label.trim(),
    qty: Number(l.qty),
    rate: Number(l.rate),
  }))
}

function optionalText(value: string): string | undefined {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

function nullableText(value: string): string | null {
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : null
}

/**
 * Build the `POST /api/quotes` payload from the form state. Empty custom number
 * becomes `undefined`; empty valid-until, notes and external URL become `null`.
 *
 * @param state - The current form state.
 * @returns A payload validated by `quoteCreateSchema`.
 */
export function buildQuoteCreatePayload(
  state: QuoteFormState,
): QuoteCreateInput {
  return {
    clientId: state.clientId,
    projectId: state.projectId ?? null,
    number: optionalText(state.number),
    status: state.status,
    issueDate: state.issueDate,
    validUntil: nullableText(state.validUntil),
    notes: nullableText(state.notes),
    externalUrl: nullableText(state.externalUrl),
    lines: cleanLines(state.lines),
  }
}

/**
 * Build the `PATCH /api/quotes/:id` payload from the form state. Same shape as
 * the create payload minus `clientId` (a quote never changes client).
 *
 * @param state - The current form state.
 * @returns A payload validated by `quoteUpdateSchema`.
 */
export function buildQuoteUpdatePayload(
  state: QuoteFormState,
): QuoteUpdateInput {
  return {
    projectId: state.projectId ?? null,
    number: optionalText(state.number),
    status: state.status,
    issueDate: state.issueDate,
    validUntil: nullableText(state.validUntil),
    notes: nullableText(state.notes),
    externalUrl: nullableText(state.externalUrl),
    lines: cleanLines(state.lines),
  }
}
