"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { MobileSheet } from "@/components/mobile/mobile-sheet"
import { StatusPill, invoicePillStatus } from "@/components/ui/pill"
import {
  fmtDate,
  fmtEUR,
  fmtRelative,
  initials,
  avatarColor,
} from "@/lib/format"
import {
  useInvoice,
  useInvoices,
  useUpdateInvoiceStatus,
} from "@/hooks/use-invoices"
import { useClients } from "@/hooks/use-clients"
import { useToast } from "@/components/providers/toast-provider"

type Filter = "all" | "DRAFT" | "SENT" | "PARTIAL" | "PAID" | "OVERDUE"

export function MobileBillingPage() {
  const router = useRouter()
  const search = useSearchParams()
  const initialId = search.get("invoiceId")
  const initialFilter = (search.get("filter") as Filter) ?? "all"

  const { data: invoices = [] } = useInvoices()
  const { data: clients = [] } = useClients()
  const [filter, setFilter] = useState<Filter>(initialFilter)
  const [openId, setOpenId] = useState<string | null>(initialId)

  function matchesFilter(i: (typeof invoices)[number], f: Filter) {
    if (f === "all") return true
    if (f === "DRAFT") return i.status === "DRAFT"
    if (f === "SENT")
      return i.status === "SENT" && i.paymentStatus === "UNPAID" && !i.isOverdue
    if (f === "PARTIAL") return i.paymentStatus === "PARTIALLY_PAID"
    if (f === "PAID") return i.paymentStatus === "PAID"
    if (f === "OVERDUE") return i.isOverdue
    return true
  }

  const filtered = useMemo(
    () =>
      invoices
        .filter((i) => matchesFilter(i, filter))
        .sort(
          (a, b) =>
            new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
        ),
    [invoices, filter],
  )

  const counts = {
    all: invoices.length,
    draft: invoices.filter((i) => matchesFilter(i, "DRAFT")).length,
    sent: invoices.filter((i) => matchesFilter(i, "SENT")).length,
    partial: invoices.filter((i) => matchesFilter(i, "PARTIAL")).length,
    paid: invoices.filter((i) => matchesFilter(i, "PAID")).length,
    overdue: invoices.filter((i) => matchesFilter(i, "OVERDUE")).length,
  }

  return (
    <div className="m-screen">
      <MobileTopbar
        title="Factures"
        action={
          <button
            type="button"
            className="m-topbar-action primary"
            onClick={() => router.push("/billing/new")}
            aria-label="Nouvelle facture"
          >
            <Icon name="plus" size={16} />
          </button>
        }
      />

      <div className="m-content">
        <div className="m-stack" style={{ paddingTop: 8 }}>
          <div className="chip-row">
            {(
              [
                { id: "all" as Filter, label: "Toutes", count: counts.all },
                {
                  id: "DRAFT" as Filter,
                  label: "Brouillon",
                  count: counts.draft,
                },
                { id: "SENT" as Filter, label: "Émise", count: counts.sent },
                {
                  id: "PARTIAL" as Filter,
                  label: "Partielle",
                  count: counts.partial,
                },
                { id: "PAID" as Filter, label: "Payée", count: counts.paid },
                {
                  id: "OVERDUE" as Filter,
                  label: "En retard",
                  count: counts.overdue,
                },
              ] as { id: Filter; label: string; count: number }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={"chip" + (filter === f.id ? " active" : "")}
                onClick={() => setFilter(f.id)}
              >
                {f.label} <span className="count">{f.count}</span>
              </button>
            ))}
          </div>

          <div className="col gap-8">
            {filtered.map((inv) => {
              const c = clients.find((cl) => cl.id === inv.clientId)
              return (
                <button
                  key={inv.id}
                  type="button"
                  className="card card-tight"
                  onClick={() => setOpenId(inv.id)}
                  style={{ textAlign: "left", width: "100%" }}
                >
                  <div className="row gap-10">
                    <div
                      className="av av-sm"
                      style={{
                        background:
                          c?.color ??
                          avatarColor(
                            `${c?.firstName ?? ""}${c?.lastName ?? ""}`,
                          ),
                      }}
                    >
                      {c ? initials(`${c.firstName} ${c.lastName}`) : "??"}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="row gap-6">
                        <span className="strong small truncate">
                          {c?.company ??
                            `${c?.firstName ?? ""} ${c?.lastName ?? ""}`}
                        </span>
                        {inv.kind === "DEPOSIT" && (
                          <span className="pill pill-deposit pill-no-dot xs">
                            Acompte
                          </span>
                        )}
                      </div>
                      <div className="xs muted">
                        {inv.number} · {fmtDate(inv.issueDate)}
                      </div>
                    </div>
                    <div
                      className="col"
                      style={{ alignItems: "flex-end", gap: 4 }}
                    >
                      <div className="num strong small">
                        {fmtEUR(inv.total)}
                      </div>
                      <StatusPill status={invoicePillStatus(inv)} />
                    </div>
                  </div>
                  {inv.isOverdue && (
                    <div
                      className="xs"
                      style={{ color: "var(--danger)", marginTop: 8 }}
                    >
                      Échue {fmtRelative(inv.dueDate)}
                    </div>
                  )}
                  {inv.paymentStatus === "PARTIALLY_PAID" && (
                    <div className="xs muted num" style={{ marginTop: 8 }}>
                      Reste {fmtEUR(inv.balanceDue)}
                    </div>
                  )}
                </button>
              )
            })}

            {filtered.length === 0 && (
              <div className="empty">
                <div className="empty-title">Aucune facture</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {openId && (
        <MobileInvoiceSheet
          invoiceId={openId}
          onClose={() => setOpenId(null)}
        />
      )}
    </div>
  )
}

function MobileInvoiceSheet({
  invoiceId,
  onClose,
}: {
  invoiceId: string
  onClose: () => void
}) {
  const { data: invoice } = useInvoice(invoiceId)
  const updateStatus = useUpdateInvoiceStatus()
  const { toast } = useToast()
  const router = useRouter()

  if (!invoice) {
    return (
      <MobileSheet onClose={onClose}>
        <div className="empty">Chargement…</div>
      </MobileSheet>
    )
  }

  function setStatus(status: "DRAFT" | "SENT" | "CANCELLED") {
    updateStatus.mutate(
      { id: invoice!.id, status },
      {
        onSuccess: () => {
          toast({
            variant: "success",
            title:
              status === "SENT"
                ? "Facture émise"
                : status === "CANCELLED"
                  ? "Facture annulée"
                  : "Statut mis à jour",
          })
          onClose()
        },
      },
    )
  }

  const c = invoice.client
  const isFullyPaid =
    invoice.paymentStatus === "PAID" || invoice.paymentStatus === "OVERPAID"

  return (
    <MobileSheet onClose={onClose}>
      <div className="row gap-10" style={{ marginBottom: 14 }}>
        <div
          className="av"
          style={{
            background: c.color ?? avatarColor(`${c.firstName}${c.lastName}`),
          }}
        >
          {initials(`${c.firstName} ${c.lastName}`)}
        </div>
        <div className="grow" style={{ minWidth: 0 }}>
          <div className="strong">{invoice.number}</div>
          <div className="xs muted truncate">{c.company ?? "—"}</div>
        </div>
        <StatusPill status={invoicePillStatus(invoice)} />
      </div>

      <div className="card card-tight" style={{ marginBottom: 12 }}>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="xs muted">Émise le</span>
          <span className="small">{fmtDate(invoice.issueDate)}</span>
        </div>
        <div className="divider" style={{ margin: "8px 0" }} />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="xs muted">Échéance</span>
          <span className="small">{fmtDate(invoice.dueDate)}</span>
        </div>
        {invoice.lastPaidAt && (
          <>
            <div className="divider" style={{ margin: "8px 0" }} />
            <div className="row" style={{ justifyContent: "space-between" }}>
              <span className="xs muted">Dernier paiement</span>
              <span className="small" style={{ color: "var(--accent)" }}>
                {fmtDate(invoice.lastPaidAt)}
              </span>
            </div>
          </>
        )}
      </div>

      <div style={{ marginBottom: 14 }}>
        <div className="card-title" style={{ marginBottom: 8 }}>
          Lignes ({invoice.lines.length})
        </div>
        <div
          className="col gap-6"
          style={{ maxHeight: 220, overflowY: "auto" }}
        >
          {invoice.lines.map((l) => (
            <div
              key={l.id}
              className="row gap-8"
              style={{
                padding: 10,
                background: "var(--bg-2)",
                borderRadius: 8,
              }}
            >
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="small truncate">{l.label}</div>
                <div className="xs muted mono">
                  {l.qty} × {fmtEUR(l.rate)}
                </div>
              </div>
              <div className="num strong small">{fmtEUR(l.qty * l.rate)}</div>
            </div>
          ))}
        </div>

        <div
          className="row"
          style={{
            justifyContent: "space-between",
            marginTop: 12,
            padding: "8px 0 0",
            borderTop: "1px solid var(--border)",
          }}
        >
          <span className="strong">Total</span>
          <span
            className="num strong"
            style={{ fontSize: 18, color: "var(--accent)" }}
          >
            {fmtEUR(invoice.total)}
          </span>
        </div>
        {invoice.paidAmount > 0 && (
          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 4 }}
          >
            <span className="xs muted">Payé</span>
            <span className="num small" style={{ color: "var(--accent)" }}>
              {fmtEUR(invoice.paidAmount)}
            </span>
          </div>
        )}
        {invoice.balanceDue !== 0 && (
          <div
            className="row"
            style={{ justifyContent: "space-between", marginTop: 4 }}
          >
            <span className="xs strong">
              {invoice.balanceDue > 0 ? "Reste dû" : "Trop-perçu"}
            </span>
            <span
              className="num strong"
              style={{
                color: invoice.balanceDue > 0 ? "var(--warn)" : "var(--purple)",
              }}
            >
              {fmtEUR(Math.abs(invoice.balanceDue))}
            </span>
          </div>
        )}
      </div>

      <div className="row gap-8" style={{ flexWrap: "wrap" }}>
        {invoice.status === "DRAFT" && (
          <button
            type="button"
            className="btn btn-primary grow"
            onClick={() => setStatus("SENT")}
          >
            <Icon name="send" size={13} />
            Émettre
          </button>
        )}
        {!isFullyPaid && (
          <button
            type="button"
            className="btn btn-secondary grow"
            onClick={() => router.push(`/billing/${invoice.id}/edit`)}
          >
            <Icon name="edit" size={13} />
            Modifier
          </button>
        )}
        <button type="button" className="btn btn-ghost" onClick={onClose}>
          Fermer
        </button>
      </div>
    </MobileSheet>
  )
}
