import type {
  BillingMode,
  InvoiceStatus,
  TaskStatus,
} from "@/generated/prisma/client"

type PillStatus =
  | "pending_invoice"
  | "done"
  | "in_progress"
  | "backlog"
  | "draft"
  | "sent"
  | "paid"
  | "overdue"

interface StatusPillProps {
  status: PillStatus
}

const STATUS_LABELS: Record<PillStatus, { label: string; cls: string }> = {
  pending_invoice: { label: "À facturer", cls: "pill-pending" },
  done: { label: "Facturée", cls: "pill-done" },
  in_progress: { label: "En cours", cls: "pill-draft" },
  backlog: { label: "Backlog", cls: "pill-draft" },
  draft: { label: "Brouillon", cls: "pill-draft" },
  sent: { label: "Émise", cls: "pill-sent" },
  paid: { label: "Payée", cls: "pill-paid" },
  overdue: { label: "En retard", cls: "pill-overdue" },
}

export function StatusPill({ status }: StatusPillProps) {
  const m = STATUS_LABELS[status]
  return <span className={`pill ${m.cls}`}>{m.label}</span>
}

/**
 * Map a Prisma TaskStatus enum value to the design's display key. CANCELED
 * tasks render the same way as backlog (filtered out of most views anyway).
 */
export function taskStatusToPill(status: TaskStatus): PillStatus {
  switch (status) {
    case "PENDING_INVOICE":
      return "pending_invoice"
    case "DONE":
      return "done"
    case "IN_PROGRESS":
      return "in_progress"
    case "BACKLOG":
    case "CANCELED":
      return "backlog"
  }
}

/**
 * Map a Prisma InvoiceStatus enum value to the design's display key.
 */
export function invoiceStatusToPill(status: InvoiceStatus): PillStatus {
  switch (status) {
    case "DRAFT":
      return "draft"
    case "SENT":
      return "sent"
    case "PAID":
      return "paid"
    case "OVERDUE":
      return "overdue"
  }
}

interface BillingTypePillProps {
  type: BillingMode | "DAILY" | "FIXED" | "HOURLY"
}

const BILLING_LABELS: Record<BillingMode, { label: string; cls: string }> = {
  DAILY: { label: "TJM", cls: "pill-daily" },
  FIXED: { label: "Forfait", cls: "pill-fixed" },
  HOURLY: { label: "Horaire", cls: "pill-hourly" },
}

export function BillingTypePill({ type }: BillingTypePillProps) {
  const m = BILLING_LABELS[type as BillingMode]
  if (!m) return null
  return <span className={`pill pill-no-dot ${m.cls}`}>{m.label}</span>
}
