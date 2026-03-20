/** Centralized, type-safe analytics event identifiers. */
export const ANALYTICS_EVENTS = {
  PAGE_VIEW: "page_view",
  EXPENSE_CREATED: "expense_created",
  EXPENSE_DELETED: "expense_deleted",
  TASK_MOVED: "task_moved",
  TASK_OVERRIDE_UPDATED: "task_override_updated",
  INVOICE_EXPORTED: "invoice_exported",
  INVOICE_STATUS_CHANGED: "invoice_status_changed",
  CLIENT_CREATED: "client_created",
  CLIENT_ARCHIVED: "client_archived",
  LINEAR_SYNCED: "linear_synced",
  BANK_IMPORT: "bank_import",
  TAX_REPORT_EXPORTED: "tax_report_exported",
} as const

export type AnalyticsEvent =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS]
