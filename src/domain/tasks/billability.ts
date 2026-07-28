import type {
  ClientCategory,
  NonBillableReason,
  Prisma,
  TaskStatus,
} from "@/generated/prisma/client"

/**
 * Billability payload of a task: the flag plus the structured justification
 * required whenever the task is excluded from invoicing.
 */
export type TaskBillabilityInput = {
  billable: boolean
  nonBillableReason: NonBillableReason | null
  nonBillableNote: string | null
}

/**
 * Result of validating a billability payload against the domain invariant.
 */
export type BillabilityValidation = { ok: true } | { ok: false; error: string }

/**
 * French display labels for each non-billable reason.
 */
export const NON_BILLABLE_REASON_LABELS: Record<NonBillableReason, string> = {
  BUG_FIX_ALREADY_INVOICED: "Bug déjà facturé",
  NON_BILLED_WORK: "Travail non facturé",
  COMMERCIAL_GESTURE: "Geste commercial",
  OTHER: "Autre",
}

/**
 * Validate the billability invariant.
 *
 * A billable task carries no reason and no note; a non-billable task requires
 * a reason, and the OTHER reason additionally requires a non-empty note.
 *
 * @param input - The billability payload to check.
 * @returns `{ ok: true }` when the invariant holds, otherwise `{ ok: false }`
 *   with an English error message.
 */
export function validateBillability(
  input: TaskBillabilityInput,
): BillabilityValidation {
  if (input.billable) {
    if (input.nonBillableReason !== null) {
      return {
        ok: false,
        error: "A billable task cannot carry a non-billable reason",
      }
    }
    if (input.nonBillableNote !== null) {
      return {
        ok: false,
        error: "A billable task cannot carry a non-billable note",
      }
    }
    return { ok: true }
  }
  if (input.nonBillableReason === null) {
    return { ok: false, error: "A non-billable task requires a reason" }
  }
  if (
    input.nonBillableReason === "OTHER" &&
    (input.nonBillableNote === null || input.nonBillableNote.trim() === "")
  ) {
    return { ok: false, error: "The OTHER reason requires a non-empty note" }
  }
  return { ok: true }
}

/**
 * Build the Prisma data patch applying a billability change.
 *
 * Flipping to non-billable stamps `nonBillableAt` with the current time and
 * stores the trimmed note; flipping back to billable clears the reason, the
 * note and the timestamp.
 *
 * @param input - A payload already accepted by {@link validateBillability}.
 * @returns The partial update to persist on the task row.
 */
export function buildBillabilityUpdate(
  input: TaskBillabilityInput,
): Pick<
  Prisma.TaskUncheckedUpdateInput,
  "billable" | "nonBillableReason" | "nonBillableNote" | "nonBillableAt"
> {
  if (input.billable) {
    return {
      billable: true,
      nonBillableReason: null,
      nonBillableNote: null,
      nonBillableAt: null,
    }
  }
  const trimmedNote = input.nonBillableNote?.trim()
  return {
    billable: false,
    nonBillableReason: input.nonBillableReason,
    nonBillableNote: trimmedNote ? trimmedNote : null,
    nonBillableAt: new Date(),
  }
}

/**
 * Canonical Prisma filter for pipeline-eligible tasks: pending invoice, not
 * yet invoiced, billable, and owned by an active FREELANCE client.
 *
 * @param userId - Owner of the tasks.
 * @returns The where clause every pipeline aggregate must use.
 */
export function PIPELINE_TASK_WHERE(userId: string): Prisma.TaskWhereInput {
  return {
    userId,
    status: "PENDING_INVOICE",
    invoiceId: null,
    billable: true,
    client: { archivedAt: null, category: "FREELANCE" },
  }
}

/**
 * Client-side twin of {@link PIPELINE_TASK_WHERE} for rows already in memory.
 *
 * @param task - Task fields relevant to the pipeline gate.
 * @param client - Client fields relevant to the pipeline gate; `archivedAt`
 *   accepts either the Prisma `Date` or its serialized ISO string.
 * @returns True when the task would match the canonical pipeline filter.
 */
export function isPipelineEligible(
  task: { status: TaskStatus; invoiceId: string | null; billable: boolean },
  client: { archivedAt: Date | string | null; category: ClientCategory },
): boolean {
  return (
    task.status === "PENDING_INVOICE" &&
    task.invoiceId === null &&
    task.billable &&
    client.archivedAt === null &&
    client.category === "FREELANCE"
  )
}
