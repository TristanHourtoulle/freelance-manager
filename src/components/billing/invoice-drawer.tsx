"use client"

import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import {
  BillingTypePill,
  StatusPill,
  invoicePillStatus,
} from "@/components/ui/pill"
import {
  fmtDate,
  fmtEUR,
  fmtEURprecise,
  initials,
  avatarColor,
} from "@/lib/format"
import {
  useInvoice,
  useUpdateInvoiceStatus,
  type InvoiceDocStatus,
} from "@/hooks/use-invoices"
import { useToast } from "@/components/providers/toast-provider"
import { PaymentsSection } from "@/components/billing/payments-section"

interface InvoiceDrawerProps {
  invoiceId: string
  onClose: () => void
}

export function InvoiceDrawer({ invoiceId, onClose }: InvoiceDrawerProps) {
  const router = useRouter()
  const { data: invoice, isLoading } = useInvoice(invoiceId)
  const updateStatus = useUpdateInvoiceStatus()
  const { toast } = useToast()

  if (isLoading || !invoice) {
    return (
      <Modal title="Facture" onClose={onClose} width={680}>
        <div className="empty">Chargement…</div>
      </Modal>
    )
  }

  const client = invoice.client
  const canEdit = invoice.status !== "CANCELLED"
  const hasOverride = invoice.totalOverride != null
  const isFullyPaid =
    invoice.paymentStatus === "PAID" || invoice.paymentStatus === "OVERPAID"

  function setStatus(status: InvoiceDocStatus) {
    updateStatus.mutate(
      { id: invoice!.id, status },
      {
        onSuccess: () =>
          toast({
            variant: "success",
            title:
              status === "SENT"
                ? "Facture émise"
                : status === "CANCELLED"
                  ? "Facture annulée"
                  : "Statut mis à jour",
          }),
      },
    )
  }

  const footer = (
    <>
      {canEdit && (
        <button
          className="btn btn-ghost"
          onClick={() => router.push(`/billing/${invoice.id}/edit`)}
        >
          <Icon name="edit" size={14} />
          Modifier
        </button>
      )}
      <button className="btn btn-ghost">
        <Icon name="download" size={14} />
        PDF
      </button>
      {invoice.status === "DRAFT" && (
        <button className="btn btn-secondary" onClick={() => setStatus("SENT")}>
          <Icon name="send" size={14} />
          Émettre
        </button>
      )}
      {isFullyPaid && (
        <button className="btn btn-secondary" disabled>
          <Icon name="check" size={14} />
          {invoice.paymentStatus === "OVERPAID"
            ? `Trop-perçu de ${fmtEUR(-invoice.balanceDue)}`
            : `Soldée le ${fmtDate(invoice.lastPaidAt ?? invoice.dueDate)}`}
        </button>
      )}
    </>
  )

  return (
    <Modal
      title={invoice.number}
      onClose={onClose}
      width={680}
      footer={footer}
      bodyStyle={{
        padding: 0,
        gap: 0,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "16px 24px 0",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="row gap-8">
          <StatusPill status={invoicePillStatus(invoice)} />
          {invoice.kind === "DEPOSIT" && (
            <span className="pill pill-deposit pill-no-dot xs">acompte</span>
          )}
          <span className="muted xs" style={{ marginLeft: "auto" }}>
            Émise {fmtDate(invoice.issueDate)} · échéance{" "}
            {fmtDate(invoice.dueDate)}
          </span>
        </div>
        <div
          className="row gap-12"
          style={{ padding: 12, background: "var(--bg-2)", borderRadius: 8 }}
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
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong">
              {client.firstName} {client.lastName}
            </div>
            <div className="muted small">{client.company ?? "—"}</div>
            <div className="muted xs truncate">{client.email ?? ""}</div>
          </div>
          <BillingTypePill type={client.billingMode} />
        </div>
        {invoice.notes && (
          <div className="muted xs" style={{ whiteSpace: "pre-wrap" }}>
            {invoice.notes}
          </div>
        )}
        <div
          className="card-title"
          style={{ marginBottom: 0, paddingBottom: 10 }}
        >
          <span>Lignes</span>
          {hasOverride && (
            <span className="muted xs" style={{ fontStyle: "italic" }}>
              forfait — prix non détaillés
            </span>
          )}
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "0 24px 14px",
        }}
      >
        <div
          className="card"
          style={{
            padding: 0,
            borderTop: "none",
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }}
        >
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 14 }}>Description</th>
                {!hasOverride && (
                  <>
                    <th className="right">Qté</th>
                    <th className="right">Taux</th>
                    <th className="right" style={{ paddingRight: 14 }}>
                      Total
                    </th>
                  </>
                )}
              </tr>
            </thead>
            <tbody>
              {invoice.lines.map((l) => (
                <tr key={l.id}>
                  <td style={{ paddingLeft: 14 }} className="small">
                    {l.label}
                  </td>
                  {!hasOverride && (
                    <>
                      <td className="right num small">{l.qty}</td>
                      <td className="right num small">{fmtEUR(l.rate)}</td>
                      <td
                        className="right num strong"
                        style={{ paddingRight: 14 }}
                      >
                        {fmtEURprecise(l.qty * l.rate)}
                      </td>
                    </>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div style={{ marginTop: 18 }}>
          <PaymentsSection
            invoiceId={invoice.id}
            total={invoice.total}
            balanceDue={invoice.balanceDue}
            paidAmount={invoice.paidAmount}
            payments={invoice.payments}
            paymentStatus={invoice.paymentStatus}
            documentStatus={invoice.status}
          />
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "12px 24px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-1)",
        }}
      >
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <div style={{ minWidth: 240 }}>
            {!hasOverride && (
              <>
                <div
                  className="row"
                  style={{ justifyContent: "space-between", padding: "4px 0" }}
                >
                  <span className="muted small">Sous-total</span>
                  <span className="num">{fmtEURprecise(invoice.subtotal)}</span>
                </div>
                <div
                  className="row"
                  style={{ justifyContent: "space-between", padding: "4px 0" }}
                >
                  <span className="muted small">TVA (0%)</span>
                  <span className="num muted">—</span>
                </div>
              </>
            )}
            <div
              className="row"
              style={{
                justifyContent: "space-between",
                padding: "8px 0 0",
                borderTop: hasOverride ? "none" : "1px solid var(--border)",
              }}
            >
              <span className="strong">Total</span>
              <span className="num strong" style={{ fontSize: 18 }}>
                {fmtEURprecise(invoice.total)}
              </span>
            </div>
            {invoice.paidAmount > 0 && (
              <div
                className="row"
                style={{ justifyContent: "space-between", padding: "4px 0" }}
              >
                <span className="muted small">Payé</span>
                <span className="num small" style={{ color: "var(--accent)" }}>
                  {fmtEURprecise(invoice.paidAmount)}
                </span>
              </div>
            )}
            {invoice.balanceDue !== 0 && (
              <div
                className="row"
                style={{ justifyContent: "space-between", padding: "4px 0" }}
              >
                <span className="strong small">
                  {invoice.balanceDue > 0 ? "Reste dû" : "Trop-perçu"}
                </span>
                <span
                  className="num strong"
                  style={{
                    color:
                      invoice.balanceDue > 0 ? "var(--warn)" : "var(--purple)",
                  }}
                >
                  {fmtEURprecise(Math.abs(invoice.balanceDue))}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
