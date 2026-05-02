"use client"

import { Suspense, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { StatusPill, invoicePillStatus } from "@/components/ui/pill"
import { InvoiceDrawer } from "@/components/billing/invoice-drawer"
import { fmtDate, fmtEUR, initials, avatarColor } from "@/lib/format"
import { useInvoices } from "@/hooks/use-invoices"
import { useClients } from "@/hooks/use-clients"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { MobileBillingPage } from "./mobile"

type FilterId =
  | "all"
  | "DRAFT"
  | "SENT"
  | "PARTIAL"
  | "PAID"
  | "OVERPAID"
  | "OVERDUE"

function matchesFilter(
  i: {
    status: string
    paymentStatus: string
    isOverdue: boolean
  },
  f: FilterId,
): boolean {
  if (f === "all") return true
  if (f === "DRAFT") return i.status === "DRAFT"
  if (f === "SENT")
    return i.status === "SENT" && i.paymentStatus === "UNPAID" && !i.isOverdue
  if (f === "PARTIAL") return i.paymentStatus === "PARTIALLY_PAID"
  if (f === "PAID") return i.paymentStatus === "PAID"
  if (f === "OVERPAID") return i.paymentStatus === "OVERPAID"
  if (f === "OVERDUE") return i.isOverdue
  return true
}

export default function BillingPage() {
  const isMobile = useIsMobile()
  return (
    <Suspense fallback={<div className="empty">Chargement…</div>}>
      {isMobile ? <MobileBillingPage /> : <DesktopBillingPage />}
    </Suspense>
  )
}

function DesktopBillingPage() {
  const router = useRouter()
  const search = useSearchParams()
  const initialId = search.get("invoiceId")
  const [openId, setOpenId] = useState<string | null>(initialId)
  const [filter, setFilter] = useState<FilterId>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const { data: invoices = [] } = useInvoices()
  const { data: clients = [] } = useClients()

  const filtered = useMemo(() => {
    return invoices.filter((i) => {
      if (!matchesFilter(i, filter)) return false
      if (searchTerm) {
        const c = clients.find((cc) => cc.id === i.clientId)
        const text =
          `${i.number} ${c?.company ?? ""} ${c?.firstName ?? ""} ${c?.lastName ?? ""}`.toLowerCase()
        if (!text.includes(searchTerm.toLowerCase())) return false
      }
      return true
    })
  }, [invoices, clients, filter, searchTerm])

  const counts = {
    all: invoices.length,
    draft: invoices.filter((i) => matchesFilter(i, "DRAFT")).length,
    sent: invoices.filter((i) => matchesFilter(i, "SENT")).length,
    partial: invoices.filter((i) => matchesFilter(i, "PARTIAL")).length,
    paid: invoices.filter((i) => matchesFilter(i, "PAID")).length,
    overpaid: invoices.filter((i) => matchesFilter(i, "OVERPAID")).length,
    overdue: invoices.filter((i) => matchesFilter(i, "OVERDUE")).length,
  }
  const totals = {
    paid: invoices
      .filter(
        (i) => i.paymentStatus === "PAID" || i.paymentStatus === "OVERPAID",
      )
      .reduce((s, i) => s + i.paidAmount, 0),
    outstanding: invoices
      .filter(
        (i) =>
          i.status === "SENT" &&
          (i.paymentStatus === "UNPAID" ||
            i.paymentStatus === "PARTIALLY_PAID"),
      )
      .reduce((s, i) => s + i.balanceDue, 0),
    overdue: invoices
      .filter((i) => i.isOverdue)
      .reduce((s, i) => s + i.balanceDue, 0),
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Factures</h1>
          <div className="page-sub">
            {invoices.length} factures · {fmtEUR(totals.paid)} encaissées ·{" "}
            {fmtEUR(totals.outstanding)} en attente
          </div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-primary"
            onClick={() => router.push("/billing/new")}
          >
            <Icon name="plus" size={14} />
            Nouvelle facture
          </button>
        </div>
      </div>

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <div className="kpi kpi-accent">
          <div className="kpi-label">
            <Icon name="check" size={11} />
            Payées
          </div>
          <div className="kpi-value">{fmtEUR(totals.paid)}</div>
          <div className="kpi-sub">
            <span>{counts.paid} factures</span>
          </div>
        </div>
        <div className="kpi kpi-info">
          <div className="kpi-label">
            <Icon name="send" size={11} />
            En attente
          </div>
          <div className="kpi-value">{fmtEUR(totals.outstanding)}</div>
          <div className="kpi-sub">
            <span>
              {counts.sent + counts.partial} facture
              {counts.sent + counts.partial > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div
          className="kpi kpi-warn"
          style={{ borderLeftColor: "var(--danger)" }}
        >
          <div className="kpi-label">
            <Icon name="alert" size={11} />
            En retard
          </div>
          <div
            className="kpi-value"
            style={{ color: counts.overdue > 0 ? "var(--danger)" : undefined }}
          >
            {fmtEUR(totals.overdue)}
          </div>
          <div className="kpi-sub">
            <span>
              {counts.overdue} facture{counts.overdue > 1 ? "s" : ""}
            </span>
          </div>
        </div>
      </div>

      <div
        className="row gap-12"
        style={{ marginBottom: 18, justifyContent: "space-between" }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Icon
            name="search"
            size={14}
            className="muted"
            style={{ position: "absolute", left: 12, top: 10 }}
          />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Rechercher facture, client…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="chip-row">
          {(
            [
              { id: "all", label: "Toutes", count: counts.all },
              { id: "DRAFT", label: "Brouillon", count: counts.draft },
              { id: "SENT", label: "Émise", count: counts.sent },
              { id: "PARTIAL", label: "Partielle", count: counts.partial },
              { id: "PAID", label: "Payée", count: counts.paid },
              { id: "OVERPAID", label: "Trop-perçu", count: counts.overpaid },
              { id: "OVERDUE", label: "En retard", count: counts.overdue },
            ] as { id: FilterId; label: string; count: number }[]
          ).map((f) => (
            <button
              key={f.id}
              className={"chip" + (filter === f.id ? " active" : "")}
              onClick={() => setFilter(f.id)}
            >
              {f.label} <span className="count">{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Numéro</th>
              <th>Client</th>
              <th>Date</th>
              <th>Échéance</th>
              <th>Type</th>
              <th>Statut</th>
              <th className="right">Montant</th>
              <th style={{ paddingRight: 20, width: 80 }}></th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={8}>
                  <div className="empty">
                    <div className="empty-title">Aucune facture</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((inv) => {
              const client = clients.find((c) => c.id === inv.clientId)
              return (
                <tr
                  key={inv.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => setOpenId(inv.id)}
                >
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row gap-8">
                      <span className="mono small strong">{inv.number}</span>
                      {inv.kind === "DEPOSIT" && (
                        <span className="pill pill-deposit pill-no-dot xs">
                          acompte
                        </span>
                      )}
                    </div>
                    <div className="xs muted" style={{ marginTop: 2 }}>
                      {inv.linesCount} ligne{inv.linesCount > 1 ? "s" : ""}
                    </div>
                  </td>
                  <td>
                    {client && (
                      <div className="row gap-8">
                        <div
                          className="av av-sm"
                          style={{
                            background:
                              client.color ??
                              avatarColor(
                                `${client.firstName}${client.lastName}`,
                              ),
                          }}
                        >
                          {initials(`${client.firstName} ${client.lastName}`)}
                        </div>
                        <span className="small">
                          {client.company ??
                            `${client.firstName} ${client.lastName}`}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="muted small">{fmtDate(inv.issueDate)}</td>
                  <td className="muted small">{fmtDate(inv.dueDate)}</td>
                  <td className="small">
                    {inv.kind === "DEPOSIT" ? "Acompte" : "Standard"}
                  </td>
                  <td>
                    <StatusPill status={invoicePillStatus(inv)} />
                  </td>
                  <td className="right num strong">
                    {fmtEUR(inv.total)}
                    {inv.paymentStatus === "PARTIALLY_PAID" && (
                      <div className="xs muted num" style={{ marginTop: 2 }}>
                        reste {fmtEUR(inv.balanceDue)}
                      </div>
                    )}
                    {inv.paymentStatus === "OVERPAID" && (
                      <div
                        className="xs num"
                        style={{ marginTop: 2, color: "var(--purple)" }}
                      >
                        +{fmtEUR(-inv.balanceDue)}
                      </div>
                    )}
                  </td>
                  <td style={{ paddingRight: 20 }}>
                    <Icon name="chevron-right" size={14} className="muted" />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {openId && (
        <InvoiceDrawer invoiceId={openId} onClose={() => setOpenId(null)} />
      )}
    </div>
  )
}
