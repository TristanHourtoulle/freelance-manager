"use client"

import { use, useId } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { fmtEUR } from "@/lib/format"
import { useInvoice, type InvoiceDetail } from "@/hooks/use-invoices"
import { useInvoiceBuilder } from "@/features/billing/use-invoice-builder"
import {
  ClientSummaryBar,
  DepositCard,
  EligibleTaskColumn,
  InvoiceLinesPanel,
} from "@/features/billing/invoice-builder-parts"
import type { InvoiceKind } from "@/domain/billing/types"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditInvoicePage({ params }: PageProps) {
  const { id } = use(params)
  const { data: invoice, isLoading } = useInvoice(id)

  if (isLoading || !invoice) {
    return (
      <div className="page">
        <div className="empty">Chargement…</div>
      </div>
    )
  }
  return <EditInvoiceForm invoice={invoice} id={id} />
}

interface EditInvoiceFormProps {
  invoice: InvoiceDetail
  id: string
}

function EditInvoiceForm({ invoice, id }: EditInvoiceFormProps) {
  const fieldId = useId()
  const router = useRouter()
  const b = useInvoiceBuilder({ mode: "edit", invoice })
  const { client, kind, lines } = b

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push(`/billing?invoiceId=${id}`)}
        >
          <Icon name="chevron-left" size={12} />
          Facture
        </button>
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Modifier {invoice.number}</h1>
          <div className="page-sub">
            Édite les dates, lignes ou tasks de la facture
          </div>
        </div>
      </div>

      {b.hasPayments && (
        <div
          className="row gap-8"
          style={{
            marginBottom: 14,
            padding: "10px 14px",
            background: "var(--warn-soft)",
            color: "var(--warn)",
            borderRadius: 8,
            fontSize: 13,
          }}
        >
          <Icon name="alert" size={14} />
          <span>
            Cette facture a déjà {fmtEUR(invoice.paidAmount)} de paiements
            enregistrés. Modifier le total recalculera son statut (partiel, payé
            ou trop-perçu).
          </span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row gap-16" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label className="field-label" htmlFor={`${fieldId}-client`}>
              Client
            </label>
            <input
              id={`${fieldId}-client`}
              className="input"
              value={
                client
                  ? `${client.company ?? `${client.firstName} ${client.lastName}`}`
                  : "—"
              }
              disabled
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label
              className="field-label"
              htmlFor={`${fieldId}-projet-optionnel`}
            >
              Projet (optionnel)
            </label>
            <select
              id={`${fieldId}-projet-optionnel`}
              className="select"
              value={b.projectId}
              onChange={(e) => b.setProjectId(e.target.value)}
            >
              <option value="all">Tous les projets</option>
              {b.projects
                .filter((p) => p.clientId === invoice.clientId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field" style={{ width: 200 }}>
            <label className="field-label" htmlFor={`${fieldId}-numero`}>
              Numéro
            </label>
            <input
              id={`${fieldId}-numero`}
              className="input mono"
              value={b.customNumber}
              onChange={(e) => b.setCustomNumber(e.target.value)}
            />
          </div>
          <div className="field" style={{ width: 180 }}>
            <label className="field-label" htmlFor={`${fieldId}-emise-le`}>
              Émise le
            </label>
            <input
              id={`${fieldId}-emise-le`}
              className="input"
              type="date"
              value={b.issueDate}
              onChange={(e) => b.setIssueDate(e.target.value)}
            />
          </div>
          <div className="field" style={{ width: 180 }}>
            <label className="field-label" htmlFor={`${fieldId}-echeance`}>
              Échéance
            </label>
            <input
              id={`${fieldId}-echeance`}
              className="input"
              type="date"
              value={b.dueDate}
              onChange={(e) => b.setDueDate(e.target.value)}
            />
          </div>
          <div className="field" style={{ width: 220 }}>
            <div className="field-label" id={`${fieldId}-kind`}>
              Type
            </div>
            <div
              className="row gap-4"
              role="group"
              aria-labelledby={`${fieldId}-kind`}
              style={{
                background: "var(--bg-2)",
                borderRadius: 7,
                padding: 3,
                border: "1px solid var(--border)",
              }}
            >
              {(["STANDARD", "DEPOSIT"] as InvoiceKind[]).map((k) => (
                <button
                  key={k}
                  className="chip"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    background: kind === k ? "var(--accent)" : "transparent",
                    color: kind === k ? "var(--accent-text)" : "var(--text-1)",
                    border: "none",
                  }}
                  onClick={() => b.setKind(k)}
                >
                  {k === "STANDARD" ? "Standard" : "Acompte"}
                </button>
              ))}
            </div>
          </div>
          <div className="field" style={{ width: 320 }}>
            <div className="field-label" id={`${fieldId}-status`}>
              Statut
            </div>
            <div
              className="row gap-4"
              role="group"
              aria-labelledby={`${fieldId}-status`}
              style={{
                background: "var(--bg-2)",
                borderRadius: 7,
                padding: 3,
                border: "1px solid var(--border)",
              }}
            >
              {(
                [
                  { id: "DRAFT", label: "Brouillon" },
                  { id: "SENT", label: "Envoyée" },
                  { id: "CANCELLED", label: "Annulée" },
                ] as {
                  id: "DRAFT" | "SENT" | "CANCELLED"
                  label: string
                }[]
              ).map((s) => (
                <button
                  key={s.id}
                  className="chip"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    background:
                      b.status === s.id ? "var(--accent)" : "transparent",
                    color:
                      b.status === s.id
                        ? "var(--accent-text)"
                        : "var(--text-1)",
                    border: "none",
                  }}
                  onClick={() => b.setStatus(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
        {client && <ClientSummaryBar client={client} />}
      </div>

      {kind === "DEPOSIT" ? (
        <DepositCard
          builder={b}
          actions={
            <div
              className="row gap-8"
              style={{ marginTop: 18, justifyContent: "flex-end" }}
            >
              <button
                className="btn btn-primary"
                onClick={() => b.save(b.status)}
                disabled={!b.subtotal || b.isPending}
              >
                <Icon name="check" size={14} />
                Sauver les modifications
              </button>
            </div>
          }
        />
      ) : (
        <div className="builder">
          <EligibleTaskColumn builder={b} />

          <InvoiceLinesPanel
            builder={b}
            dropzoneStyle={{ minHeight: lines.length === 0 ? 200 : "auto" }}
            emptyHint="ou clique sur une task à gauche"
            addLineButton={
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 8 }}
                onClick={b.addBlank}
              >
                <Icon name="plus" size={12} />
                Ligne personnalisée
              </button>
            }
            actions={
              <div className="col gap-8" style={{ marginTop: 18 }}>
                <button
                  className="btn btn-primary"
                  disabled={lines.length === 0 || b.isPending}
                  onClick={() => b.save(b.status)}
                >
                  <Icon name="check" size={14} />
                  Sauver les modifications
                </button>
              </div>
            }
          />
        </div>
      )}
    </div>
  )
}
