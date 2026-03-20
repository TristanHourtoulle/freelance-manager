"use client"

import { useState, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import {
  ArrowUpTrayIcon,
  DocumentIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import {
  useUploadInvoiceFile,
  useDeleteInvoiceFile,
} from "@/hooks/use-invoice-files"
import { useToast } from "@/components/providers/toast-provider"

import type {
  HistoryMonthGroup,
  HistoryClientGroup,
} from "@/components/billing/types"

interface HistoryMonthListProps {
  months: HistoryMonthGroup[]
  onMarkAsPaid?: (invoiceId: string) => void
  onUpdateStatus?: (
    invoiceId: string,
    status: "DRAFT" | "SENT" | "PAID",
  ) => void
}

const BILLING_MODE_KEYS: Record<string, string> = {
  HOURLY: "hourly",
  DAILY: "daily",
  FIXED: "fixed",
  FREE: "free",
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes}B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
}

function PaymentDeadlineBadge({
  paymentDueDate,
  status,
}: {
  paymentDueDate: string | null
  status: string
}) {
  const t = useTranslations("billingHistory")

  if (status === "PAID") return null
  if (!paymentDueDate) return null

  const dueDate = new Date(paymentDueDate)
  const now = new Date()
  const diffMs = dueDate.getTime() - now.getTime()
  const diffDays = Math.ceil(diffMs / (24 * 60 * 60 * 1000))

  if (diffDays > 0) {
    return (
      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-600 dark:bg-blue-500/10 dark:text-blue-400">
        {t("dueIn", { days: diffDays })}
      </span>
    )
  }

  const overdueDays = Math.abs(diffDays)
  return (
    <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600 dark:bg-red-500/10 dark:text-red-400">
      {t("overdue", { days: overdueDays })}
    </span>
  )
}

function InvoiceStatusBadge({
  group,
  onMarkAsPaid,
  onUpdateStatus,
}: {
  group: HistoryClientGroup
  onMarkAsPaid?: (invoiceId: string) => void
  onUpdateStatus?: (
    invoiceId: string,
    status: "DRAFT" | "SENT" | "PAID",
  ) => void
}) {
  const t = useTranslations("billingHistory")

  if (!group.invoice) return null

  const { status, id, paymentDueDate } = group.invoice

  if (status === "DRAFT") {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-500/10 dark:text-gray-400">
          {t("draft")}
        </span>
        {onUpdateStatus && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onUpdateStatus(id, "SENT")
            }}
            className="cursor-pointer rounded-md bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 transition-colors hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:hover:bg-amber-500/20"
          >
            {t("markAsSent")}
          </button>
        )}
      </div>
    )
  }

  if (status === "PAID") {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400">
          {t("paid")}
        </span>
        {onUpdateStatus && (
          <button
            onClick={(e) => {
              e.stopPropagation()
              onUpdateStatus(id, "SENT")
            }}
            className="cursor-pointer rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:hover:bg-gray-500/20"
          >
            {t("revertToSent")}
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-600 dark:bg-amber-500/10 dark:text-amber-400">
        {t("sent")}
      </span>
      <PaymentDeadlineBadge paymentDueDate={paymentDueDate} status={status} />
      {(onMarkAsPaid || onUpdateStatus) && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            if (onUpdateStatus) onUpdateStatus(id, "PAID")
            else if (onMarkAsPaid) onMarkAsPaid(id)
          }}
          className="cursor-pointer rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:hover:bg-emerald-500/20"
        >
          {t("markAsPaid")}
        </button>
      )}
      {onUpdateStatus && (
        <button
          onClick={(e) => {
            e.stopPropagation()
            onUpdateStatus(id, "DRAFT")
          }}
          className="cursor-pointer rounded-md bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-600 transition-colors hover:bg-gray-200 dark:bg-gray-500/10 dark:text-gray-400 dark:hover:bg-gray-500/20"
        >
          {t("revertToDraft")}
        </button>
      )}
    </div>
  )
}

function InvoiceFileSection({ group }: { group: HistoryClientGroup }) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const uploadMutation = useUploadInvoiceFile()
  const deleteMutation = useDeleteInvoiceFile()
  const { toast } = useToast()
  const t = useTranslations("billingHistory")

  const invoiceId = group.invoice?.id
  const files = group.invoice?.files ?? []

  const handleUpload = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file || !invoiceId) return

      uploadMutation.mutate(
        { invoiceId, file },
        {
          onSuccess: () => {
            toast({ variant: "success", title: t("pdfUploaded") })
          },
          onError: (error) => {
            toast({
              variant: "error",
              title: error.message || t("uploadFailed"),
            })
          },
        },
      )

      // Reset input so same file can be re-uploaded
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    },
    [invoiceId, uploadMutation, toast, t],
  )

  const handleDelete = useCallback(
    (fileId: string) => {
      if (!invoiceId) return
      deleteMutation.mutate(
        { invoiceId, fileId },
        {
          onError: () => {
            toast({ variant: "error", title: t("deleteFailed") })
          },
        },
      )
    },
    [invoiceId, deleteMutation, toast, t],
  )

  if (!group.invoice) return null

  return (
    <div className="flex items-center gap-2 border-t border-border-light px-4 py-2">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleUpload}
        className="hidden"
      />
      <button
        onClick={(e) => {
          e.stopPropagation()
          fileInputRef.current?.click()
        }}
        disabled={uploadMutation.isPending}
        className="inline-flex cursor-pointer items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-border disabled:opacity-50"
      >
        <ArrowUpTrayIcon className="h-3.5 w-3.5" />
        {uploadMutation.isPending ? t("uploading") : t("uploadPdf")}
      </button>

      {files.map((file) => (
        <div
          key={file.id}
          className="inline-flex items-center gap-1 rounded-md bg-surface-muted px-2 py-1 text-xs text-text-secondary"
        >
          <DocumentIcon className="h-3.5 w-3.5 text-red-500" />
          <a
            href={`/api/billing/invoices/${invoiceId}/files/${file.id}`}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="hover:text-primary hover:underline"
          >
            {file.fileName}
          </a>
          <span className="text-text-muted">
            ({formatFileSize(file.fileSize)})
          </span>
          <button
            onClick={(e) => {
              e.stopPropagation()
              handleDelete(file.id)
            }}
            disabled={deleteMutation.isPending}
            className="cursor-pointer text-text-muted transition-colors hover:text-red-500 disabled:opacity-50"
          >
            <TrashIcon className="h-3 w-3" />
          </button>
        </div>
      ))}
    </div>
  )
}

export function HistoryMonthList({
  months,
  onMarkAsPaid,
  onUpdateStatus,
}: HistoryMonthListProps) {
  const [collapsedMonths, setCollapsedMonths] = useState<Set<string>>(new Set())
  const [collapsedClients, setCollapsedClients] = useState<Set<string>>(
    new Set(),
  )
  const t = useTranslations("billingHistory")
  const tt = useTranslations("billingTable")
  const tc = useTranslations("common.billingModes")

  function toggleMonth(monthKey: string) {
    setCollapsedMonths((prev) => {
      const next = new Set(prev)
      if (next.has(monthKey)) next.delete(monthKey)
      else next.add(monthKey)
      return next
    })
  }

  function toggleClient(compositeKey: string) {
    setCollapsedClients((prev) => {
      const next = new Set(prev)
      if (next.has(compositeKey)) next.delete(compositeKey)
      else next.add(compositeKey)
      return next
    })
  }

  return (
    <div className="space-y-6">
      {months.map((month) => {
        const isMonthCollapsed = collapsedMonths.has(month.month)

        return (
          <div
            key={month.month}
            className="rounded-lg border border-border bg-surface"
          >
            <button
              onClick={() => toggleMonth(month.month)}
              aria-expanded={!isMonthCollapsed}
              className="flex w-full items-center justify-between px-5 py-4 text-left"
            >
              <div className="flex items-center gap-3">
                <svg
                  className={`h-4 w-4 text-text-muted transition-transform ${isMonthCollapsed ? "" : "rotate-90"}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M9 5l7 7-7 7"
                  />
                </svg>
                <h2 className="text-base font-semibold text-text-primary">
                  {month.label}
                </h2>
                <span className="text-sm text-text-secondary">
                  {t("taskCount", { count: month.taskCount })}
                </span>
              </div>
              <span className="text-base font-semibold tabular-nums text-text-primary">
                {formatAmount(month.monthTotal)}
              </span>
            </button>

            {!isMonthCollapsed && (
              <div className="space-y-3 border-t border-border-light px-4 py-3">
                {month.clients.map((group) => {
                  const clientKey = `${month.month}-${group.client.id}`
                  const isClientCollapsed = collapsedClients.has(clientKey)

                  return (
                    <div
                      key={group.client.id}
                      className="rounded-md border border-border-light"
                    >
                      <button
                        onClick={() => toggleClient(clientKey)}
                        aria-expanded={!isClientCollapsed}
                        className="flex w-full items-center justify-between px-4 py-3 text-left"
                      >
                        <div className="flex items-center gap-3">
                          <svg
                            className={`h-3.5 w-3.5 text-text-muted transition-transform ${isClientCollapsed ? "" : "rotate-90"}`}
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                            strokeWidth={2}
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                          <div>
                            <span className="text-sm font-semibold text-text-primary">
                              {group.client.name}
                            </span>
                            {group.client.company && (
                              <span className="ml-2 text-sm text-text-secondary">
                                {group.client.company}
                              </span>
                            )}
                          </div>
                          <span className="rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary">
                            {tc(
                              BILLING_MODE_KEYS[group.client.billingMode] ??
                                "hourly",
                            )}
                          </span>
                          <span className="text-xs text-text-secondary">
                            {t("taskCount", { count: group.taskCount })}
                          </span>
                          <InvoiceStatusBadge
                            group={group}
                            onMarkAsPaid={onMarkAsPaid}
                            onUpdateStatus={onUpdateStatus}
                          />
                        </div>
                        <span className="text-sm font-semibold tabular-nums text-text-primary">
                          {formatAmount(group.totalBilling)}
                        </span>
                      </button>

                      <InvoiceFileSection group={group} />

                      {!isClientCollapsed && (
                        <div className="border-t border-border-light">
                          <div className="overflow-x-auto">
                            <table className="w-full text-left">
                              <thead>
                                <tr className="border-b border-border">
                                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                                    {tt("id")}
                                  </th>
                                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                                    {tt("title")}
                                  </th>
                                  <th className="px-3 py-2 text-xs font-medium uppercase tracking-wider text-text-secondary">
                                    {tt("status")}
                                  </th>
                                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                                    {tt("estimate")}
                                  </th>
                                  <th className="px-3 py-2 text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                                    {tt("amount")}
                                  </th>
                                </tr>
                              </thead>
                              <tbody>
                                {group.tasks.map((task) => (
                                  <tr
                                    key={task.linearIssueId}
                                    className="border-b border-border-light last:border-0"
                                  >
                                    <td className="px-3 py-2.5">
                                      {task.url ? (
                                        <a
                                          href={task.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="text-sm font-medium text-text-secondary hover:text-primary"
                                        >
                                          {task.identifier}
                                        </a>
                                      ) : (
                                        <span className="text-sm text-text-muted">
                                          {task.identifier}
                                        </span>
                                      )}
                                    </td>
                                    <td className="max-w-xs truncate px-3 py-2.5 text-sm text-text-primary">
                                      {task.title}
                                    </td>
                                    <td className="px-3 py-2.5">
                                      {task.status ? (
                                        <span
                                          className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
                                          style={{
                                            backgroundColor: `${task.status.color}20`,
                                            color: task.status.color,
                                          }}
                                        >
                                          {task.status.name}
                                        </span>
                                      ) : (
                                        <span className="text-xs text-text-muted">
                                          -
                                        </span>
                                      )}
                                    </td>
                                    <td className="px-3 py-2.5 text-right text-sm tabular-nums text-text-secondary">
                                      {task.estimate !== undefined
                                        ? `${task.estimate}h`
                                        : "-"}
                                    </td>
                                    <td
                                      className="px-3 py-2.5 text-right text-sm font-medium tabular-nums text-text-primary"
                                      title={task.billingFormula}
                                    >
                                      {formatAmount(task.billingAmount)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
