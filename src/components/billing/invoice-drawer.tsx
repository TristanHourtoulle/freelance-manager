"use client"

import { Modal } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import {
  BillingTypePill,
  StatusPill,
  invoiceStatusToPill,
} from "@/components/ui/pill"
import {
  fmtDate,
  fmtEUR,
  fmtEURprecise,
  initials,
  avatarColor,
} from "@/lib/format"
import { useInvoice, useUpdateInvoiceStatus } from "@/hooks/use-invoices"
import { useToast } from "@/components/providers/toast-provider"

interface InvoiceDrawerProps {
  invoiceId: string
  onClose: () => void
}

export function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const updateStatus = useUpdateInvoiceStatus()
  const { toast } = useToast()

  if (isLoading || !invoice) {
    return (
      <Modal title="Facture" onClose={onClose} width={640}>
        <div className="empty">Chargement…</div>
      </Modal>
    )
  }

  const client = invoice.client

  function setStatus(
    status: "DRAFT" | "SENT" | "PAID" | "OVERDUE",
    paidAt?: string,
  ) {
    updateStatus.mutate(
      { id: invoice!.id, status, paidAt },
      {
        onSuccess: () =>
          toast({
            variant: "success",
            title:
              status === "PAID"
                ? "Facture marquée comme payée"
                : status === "SENT"
                  ? "Facture envoyée"
                  : "Statut mis à jour",
          }),
      },
    )
  }

  return (
    <Modal title={invoice.number} onClose={onClose} width={640}>
      <div className="row gap-8" style={{ marginTop: -12, marginBottom: 4 }}>
        <StatusPill status={invoiceStatusToPill(invoice.status)} />
        {invoice.kind === "DEPOSIT" && (
          <span className="pill pill-deposit pill-no-dot xs">acompte</span>
        )}
      </div>
      <div className="muted xs">
        Émise {fmtDate(invoice.issueDate)} · échéance {fmtDate(invoice.dueDate)}
      </div>

      <div
        className="row gap-12"
        style={{ padding: 14, background: "var(--bg-2)", borderRadius: 8 }}
      >
        <div
          className="av av-lg"
          style={{
            background:
              client.color ??
              avatarColor(`${client.firstName}${client.lastName}`),
          }}
        >
          {initials(`${client.firstName} ${client.lastName}`)}
        </div>
        <div>
          <div className="strong">
            {client.firstName} {client.lastName}
          </div>
          <div className="muted small">{client.company ?? "—"}</div>
          <div className="muted xs">{client.email ?? ""}</div>
        </div>
        <BillingTypePill type={client.billingMode} />
      </div>

      <div>
        <div className="card-title">Lignes</div>
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 14 }}>Description</th>
                <th className="right">Qté</th>
                <th className="right">Taux</th>
                <th className="right" style={{ paddingRight: 14 }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id}>
                  <td style={{ paddingLeft: 14 }} className="small">
                    {l.label}
                  </td>
                  <td className="right num small">{l.qty}</td>
                  <td className="right num small">{fmtEUR(l.rate)}</td>
                  <td className="right num strong" style={{ paddingRight: 14 }}>
                    {fmtEURprecise(l.qty * l.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        className="row"
        style={{ justifyContent: "flex-end", paddingTop: 6 }}
      >
        <div style={{ minWidth: 220 }}>
          <div
            className="row"
            style={{ justifyContent: "space-between", padding: "6px 0" }}
          >
            <span className="muted small">Sous-total</span>
            <span className="num">{fmtEURprecise(invoice.subtotal)}</span>
          </div>
          <div
            className="row"
            style={{ justifyContent: "space-between", padding: "6px 0" }}
          >
            <span className="muted small">TVA (0%)</span>
            <span className="num muted">—</span>
          </div>
          <div
            className="row"
            style={{
              justifyContent: "space-between",
              padding: "10px 0",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span className="strong">Total</span>
            <span className="num strong" style={{ fontSize: 18 }}>
              {fmtEURprecise(invoice.total)}
            </span>
          </div>
        </div>
      </div>

      <div
        className="row gap-8"
        style={{ justifyContent: "flex-end", paddingTop: 6 }}
      >
        <button className="btn btn-ghost">
          <Icon name="download" size={14} />
          PDF
        </button>
        {invoice.status === "DRAFT" && (
          <button
            className="btn btn-secondary"
            onClick={() => setStatus("SENT")}
          >
            <Icon name="send" size={14} />
            Marquer envoyée
          </button>
        )}
        {(invoice.status === "SENT" || invoice.status === "OVERDUE") && (
          <button
            className="btn btn-primary"
            onClick={() =>
              setStatus("PAID", new Date().toISOString().slice(0, 10))
            }
          >
            <Icon name="check" size={14} />
            Marquer payée
          </button>
        )}
        {invoice.status === "PAID" && (
          <button className="btn btn-secondary" disabled>
            <Icon name="check" size={14} />
            Payée le {fmtDate(invoice.paidAt)}
          </button>
        )}
      </div>
    </Modal>
  )
}
