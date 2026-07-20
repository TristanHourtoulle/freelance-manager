"use client"

import { Icon } from "@/components/ui/icon"
import {
  StatusPill,
  invoicePillStatus,
  taskStatusToPill,
} from "@/components/ui/pill"
import { fmtDate, fmtEUR } from "@/lib/format"
import { TaskIdLink } from "@/components/ui/task-id-link"
import type {
  ProjectDetailInvoiceDTO,
  ProjectDetailTaskDTO,
} from "@/hooks/use-project-detail"

/**
 * Desktop tasks table for the project detail page.
 *
 * @param tasks - The project's unpaginated task rows from the detail payload.
 */
export function ProjectTasksTable({
  tasks,
}: {
  tasks: ProjectDetailTaskDTO[]
}) {
  return (
    <div className="card" style={{ padding: 0 }}>
      <table className="table">
        <thead>
          <tr>
            <th style={{ paddingLeft: 20 }}>ID</th>
            <th>Title</th>
            <th>Statut</th>
            <th className="right">Estimate</th>
            <th className="right" style={{ paddingRight: 20 }}>
              Facturé
            </th>
          </tr>
        </thead>
        <tbody>
          {tasks.length === 0 && (
            <tr>
              <td colSpan={5}>
                <div className="empty">
                  <div className="empty-title">Aucune task</div>
                </div>
              </td>
            </tr>
          )}
          {tasks.map((t) => (
            <tr key={t.id}>
              <td style={{ paddingLeft: 20 }}>
                <TaskIdLink
                  identifier={t.linearIdentifier}
                  url={t.linearUrl}
                  className="task-id"
                />
              </td>
              <td className="strong">{t.title}</td>
              <td>
                <StatusPill status={taskStatusToPill(t.status)} />
              </td>
              <td className="right num">
                {t.estimate ? `${t.estimate}j` : "—"}
              </td>
              <td className="right small" style={{ paddingRight: 20 }}>
                {t.invoiceId ? (
                  <span className="pill pill-paid pill-no-dot xs">
                    Facturée
                  </span>
                ) : (
                  <span className="muted">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

interface ProjectInvoicesPanelProps {
  invoices: ProjectDetailInvoiceDTO[]
  onOpen: (invoiceId: string) => void
}

/**
 * Desktop invoices panel for the project detail page.
 *
 * @param invoices - The project's unpaginated invoice rows.
 * @param onOpen - Called with the invoice id when a row is activated.
 */
export function ProjectInvoicesPanel({
  invoices,
  onOpen,
}: ProjectInvoicesPanelProps) {
  return (
    <div className="detail-card">
      <div className="detail-card-header">
        <div className="detail-card-title">Toutes les factures</div>
      </div>
      {invoices.length === 0 ? (
        <div className="empty">
          <div className="empty-title">Aucune facture</div>
        </div>
      ) : (
        invoices.map((inv, i) => (
          <div key={inv.id}>
            {i > 0 && <div className="inv-divider" />}
            <button
              type="button"
              className="inv-row"
              onClick={() => onOpen(inv.id)}
            >
              <span className="inv-num">{inv.number}</span>
              <span className="inv-date">{fmtDate(inv.issueDate)}</span>
              <StatusPill status={invoicePillStatus(inv)} />
              <span className="inv-total">{fmtEUR(inv.total)}</span>
              <Icon
                name="chevron-right"
                size={13}
                style={{ color: "var(--text-3)" }}
              />
            </button>
          </div>
        ))
      )}
    </div>
  )
}
