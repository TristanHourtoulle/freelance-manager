"use client"

import { useId, useMemo, useState } from "react"
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
  useCreatePayment,
  useInvoice,
  useInvoices,
  useUpdateInvoiceStatus,
} from "@/hooks/use-invoices"
import { useClients } from "@/hooks/use-clients"
import { useToast } from "@/components/providers/toast-provider"
import {
  matchesInvoiceFilter,
  summarizeInvoices,
  type InvoiceFilterId,
} from "@/domain/billing/filters"

const todayISO = () => new Date().toISOString().slice(0, 10)

export function MobileBillingPage() {
  const router = useRouter()
  const search = useSearchParams()
  const initialId = search.get("invoiceId")
  const initialFilter = (search.get("filter") as InvoiceFilterId) ?? "all"

  const { data: invoices = [] } = useInvoices()
  const { data: clients = [] } = useClients()
  const [filter, setFilter] = useState<InvoiceFilterId>(initialFilter)
  const [openId, setOpenId] = useState<string | null>(initialId)

  const filtered = useMemo(
    () =>
      invoices
        .filter((i) => matchesInvoiceFilter(i, filter))
        .sort(
          (a, b) =>
            new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
        ),
    [invoices, filter],
  )

  const { counts } = useMemo(() => summarizeInvoices(invoices), [invoices])

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
                {
                  id: "all" as InvoiceFilterId,
                  label: "Toutes",
                  count: counts.all,
                },
                {
                  id: "DRAFT" as InvoiceFilterId,
                  label: "Brouillon",
                  count: counts.draft,
                },
                {
                  id: "SENT" as InvoiceFilterId,
                  label: "Émise",
                  count: counts.sent,
                },
                {
                  id: "PARTIAL" as InvoiceFilterId,
                  label: "Partielle",
                  count: counts.partial,
                },
                {
                  id: "PAID" as InvoiceFilterId,
                  label: "Payée",
                  count: counts.paid,
                },
                {
                  id: "OVERDUE" as InvoiceFilterId,
                  label: "En retard",
                  count: counts.overdue,
                },
              ] as { id: InvoiceFilterId; label: string; count: number }[]
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

export function MobileInvoiceSheet({
  invoiceId,
  onClose,
}: {
  invoiceId: string
  onClose: () => void
}) {
  const { data: invoice } = useInvoice(invoiceId)
  const updateStatus = useUpdateInvoiceStatus()
  const createPayment = useCreatePayment(invoiceId)
  const { toast } = useToast()
  const router = useRouter()
  const [partialOpen, setPartialOpen] = useState(false)

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

  function markPaid() {
    if (!invoice) return
    createPayment.mutate(
      {
        amount: invoice.balanceDue,
        paidAt: todayISO(),
        method: null,
        note: null,
      },
      {
        onSuccess: () => {
          toast({ variant: "success", title: "Facture payée" })
          onClose()
        },
        onError: (e) =>
          toast({
            variant: "error",
            title: "Erreur",
            description: e instanceof Error ? e.message : String(e),
          }),
      },
    )
  }

  const c = invoice.client
  const hasOverride = invoice.totalOverride != null
  const isFullyPaid =
    invoice.paymentStatus === "PAID" || invoice.paymentStatus === "OVERPAID"
  const canRecordPayment =
    invoice.status === "SENT" && !isFullyPaid && invoice.balanceDue > 0

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
        <div
          className="card-title"
          style={{
            marginBottom: 8,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 8,
          }}
        >
          <span>Lignes ({invoice.lines.length})</span>
          {hasOverride && (
            <span className="muted xs" style={{ fontStyle: "italic" }}>
              forfait — prix non détaillés
            </span>
          )}
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
                {!hasOverride && (
                  <div className="xs muted mono">
                    {l.qty} × {fmtEUR(l.rate)}
                  </div>
                )}
              </div>
              {!hasOverride && (
                <div className="num strong small">{fmtEUR(l.qty * l.rate)}</div>
              )}
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
        {canRecordPayment && (
          <button
            type="button"
            className="btn btn-primary grow"
            onClick={markPaid}
            disabled={createPayment.isPending}
          >
            <Icon name="check" size={13} />
            Marquer payée
          </button>
        )}
        {canRecordPayment && (
          <button
            type="button"
            className="btn btn-secondary grow"
            onClick={() => setPartialOpen(true)}
            disabled={createPayment.isPending}
          >
            <Icon name="euro" size={13} />
            Paiement partiel
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

      {partialOpen && (
        <MobilePartialPaymentSheet
          invoiceId={invoice.id}
          balanceDue={invoice.balanceDue}
          onClose={() => setPartialOpen(false)}
        />
      )}
    </MobileSheet>
  )
}

function MobilePartialPaymentSheet({
  invoiceId,
  balanceDue,
  onClose,
}: {
  invoiceId: string
  balanceDue: number
  onClose: () => void
}) {
  const fieldId = useId()
  const createPayment = useCreatePayment(invoiceId)
  const { toast } = useToast()
  const [amount, setAmount] = useState<number>(0)
  const [paidAt, setPaidAt] = useState<string>(() => todayISO())

  function submit() {
    if (amount <= 0) {
      toast({
        variant: "error",
        title: "Montant requis",
        description: "Le montant doit être supérieur à 0.",
      })
      return
    }
    createPayment.mutate(
      { amount, paidAt, method: null, note: null },
      {
        onSuccess: () => {
          toast({ variant: "success", title: "Paiement enregistré" })
          onClose()
        },
        onError: (e) =>
          toast({
            variant: "error",
            title: "Erreur",
            description: e instanceof Error ? e.message : String(e),
          }),
      },
    )
  }

  return (
    <MobileSheet
      onClose={onClose}
      title="Paiement partiel"
      description={`Reste dû ${fmtEUR(balanceDue)}`}
    >
      <div className="col gap-12">
        <div className="field">
          <label className="field-label" htmlFor={`${fieldId}-montant`}>
            Montant
          </label>
          <input
            id={`${fieldId}-montant`}
            className="input num"
            type="number"
            step="0.01"
            min="0"
            inputMode="decimal"
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
          />
        </div>
        <div className="field">
          <label className="field-label" htmlFor={`${fieldId}-date`}>
            Date
          </label>
          <input
            id={`${fieldId}-date`}
            className="input"
            type="date"
            value={paidAt}
            onChange={(e) => setPaidAt(e.target.value)}
          />
        </div>

        {amount > 0 && amount < balanceDue && (
          <div className="muted xs">
            Restera{" "}
            <span className="num strong">{fmtEUR(balanceDue - amount)}</span> à
            recevoir.
          </div>
        )}
        {amount > balanceDue && (
          <div className="xs" style={{ color: "var(--purple)" }}>
            {fmtEUR(amount - balanceDue)} en trop-perçu.
          </div>
        )}

        <div className="row gap-8" style={{ marginTop: 4 }}>
          <button
            type="button"
            className="btn btn-primary grow"
            onClick={submit}
            disabled={createPayment.isPending || amount <= 0}
          >
            <Icon name="check" size={13} />
            Enregistrer
          </button>
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Annuler
          </button>
        </div>
      </div>
    </MobileSheet>
  )
}
