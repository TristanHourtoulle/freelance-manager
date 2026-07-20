"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { fmtEUR, initials, avatarColor } from "@/lib/format"
import { lineFromTask } from "@/lib/billing-math"
import { useInvoiceBuilder } from "@/features/billing/use-invoice-builder"
import {
  mergePickableTasks,
  selectedTaskIds,
} from "@/features/billing/mobile-task-picker"
import type { EditStatus } from "@/features/billing/invoice-builder-types"
import type { InvoiceKind } from "@/domain/billing/types"
import type { ClientDTO } from "@/hooks/use-clients"
import type { InvoiceDetail } from "@/hooks/use-invoices"

const STATUS_OPTIONS: { id: EditStatus; label: string }[] = [
  { id: "DRAFT", label: "Brouillon" },
  { id: "SENT", label: "Envoyée" },
  { id: "CANCELLED", label: "Annulée" },
]

function clientAvatar(client: ClientDTO): string {
  return client.color ?? avatarColor(`${client.firstName}${client.lastName}`)
}

function clientRateLabel(client: ClientDTO): string {
  if (client.billingMode === "DAILY") return `${client.rate} €/j`
  if (client.billingMode === "HOURLY") return `${client.rate} €/h`
  return "Forfait"
}

/**
 * Mobile twin of the invoice edit page: a single scrolling screen (the client
 * is already fixed, so no wizard) with tap-to-add / tap-to-remove task rows
 * instead of the desktop drag & drop.
 *
 * @param invoice - The invoice being edited.
 * @param id - The invoice id, used for the back navigation target.
 */
export function MobileEditInvoicePage({
  invoice,
  id,
}: {
  invoice: InvoiceDetail
  id: string
}) {
  const router = useRouter()
  const b = useInvoiceBuilder({ mode: "edit", invoice })
  const { client, kind, lines } = b
  const [showOptions, setShowOptions] = useState(false)

  const picked = useMemo(() => selectedTaskIds(lines), [lines])
  const pickable = useMemo(
    () => mergePickableTasks(b.tasks, b.eligibleTasks, lines),
    [b.tasks, b.eligibleTasks, lines],
  )

  const isDeposit = kind === "DEPOSIT"
  const saveDisabled = isDeposit
    ? !b.subtotal || b.isPending
    : lines.length === 0 || b.isPending

  return (
    <div className="m-screen">
      <MobileTopbar
        title={`Modifier ${invoice.number}`}
        back={() => router.push(`/billing?invoiceId=${id}`)}
      />

      <div className="m-content">
        <div className="m-stack">
          {client && (
            <div className="row gap-10">
              <div
                className="av av-sm"
                style={{ background: clientAvatar(client) }}
              >
                {initials(`${client.firstName} ${client.lastName}`)}
              </div>
              <div className="grow" style={{ minWidth: 0 }}>
                <div className="strong small truncate">
                  {client.company ?? `${client.firstName} ${client.lastName}`}
                </div>
                <div className="xs muted">{clientRateLabel(client)}</div>
              </div>
            </div>
          )}

          {b.hasPayments && (
            <div
              className="row gap-8"
              style={{
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
                enregistrés. Modifier le total recalculera son statut (partiel,
                payé ou trop-perçu).
              </span>
            </div>
          )}

          <div className="seg">
            {(["STANDARD", "DEPOSIT"] as InvoiceKind[]).map((k) => (
              <button
                key={k}
                type="button"
                className={kind === k ? "active" : ""}
                aria-pressed={kind === k}
                onClick={() => b.setKind(k)}
              >
                {k === "STANDARD" ? "Facture" : "Acompte"}
              </button>
            ))}
          </div>

          <div className="seg">
            {STATUS_OPTIONS.map((s) => (
              <button
                key={s.id}
                type="button"
                className={b.status === s.id ? "active" : ""}
                aria-pressed={b.status === s.id}
                onClick={() => b.setStatus(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>

          {isDeposit ? (
            <div className="card">
              <div className="card-title">Montant de l&apos;acompte</div>
              <div className="col gap-12" style={{ marginTop: 12 }}>
                <div className="field">
                  <label className="field-label" htmlFor="m-edit-deposit-label">
                    Description
                  </label>
                  <input
                    id="m-edit-deposit-label"
                    className="input"
                    value={b.depositLabel}
                    onChange={(e) => b.setDepositLabel(e.target.value)}
                  />
                </div>
                <div className="field">
                  <label
                    className="field-label"
                    htmlFor="m-edit-deposit-amount"
                  >
                    Montant (€)
                  </label>
                  <input
                    id="m-edit-deposit-amount"
                    className="input num"
                    type="number"
                    value={b.depositAmount}
                    onChange={(e) => b.setDepositAmount(Number(e.target.value))}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {client && pickable.length > 0 && (
                <div className="col gap-8">
                  {pickable.map((t) => {
                    const isSel = picked.has(t.id)
                    const { qty, rate } = lineFromTask({
                      billingMode: client.billingMode,
                      rate: client.rate,
                      estimateDays: t.estimate,
                    })
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={"task-item" + (isSel ? " selected" : "")}
                        style={{ textAlign: "left" }}
                        aria-pressed={isSel}
                        onClick={() => {
                          const line = lines.find((l) => l.taskId === t.id)
                          if (line) b.removeLine(line.id)
                          else b.addTask(t)
                        }}
                      >
                        <div className="row gap-8">
                          <div
                            className={
                              "checkbox-circle" + (isSel ? " checked" : "")
                            }
                          >
                            {isSel && <Icon name="check" size={13} />}
                          </div>
                          <TaskIdLink
                            identifier={t.linearIdentifier}
                            url={t.linearUrl}
                            className="task-id"
                            stopPropagation
                          />
                          <span
                            className="pill pill-no-dot xs pill-pending"
                            style={{ marginLeft: "auto" }}
                          >
                            À facturer
                          </span>
                        </div>
                        <div className="task-title">{t.title}</div>
                        <div className="task-meta">
                          <span>{t.estimate ?? "—"}j</span>
                          <span>·</span>
                          <span className="num">{fmtEUR(qty * rate)}</span>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}

              <div className="builder-summary">
                <div className="col gap-6" style={{ marginBottom: 14 }}>
                  {lines.map((l) => (
                    <div key={l.id} className="builder-line">
                      <div style={{ minWidth: 0 }}>
                        <input
                          className="input"
                          style={{ padding: "4px 7px", fontSize: 12 }}
                          value={l.label}
                          aria-label="Libellé de la ligne"
                          onChange={(e) =>
                            b.updateLine(l.id, { label: e.target.value })
                          }
                        />
                        <div className="row gap-4" style={{ marginTop: 4 }}>
                          <input
                            className="input num"
                            type="number"
                            step="0.25"
                            value={l.qty}
                            aria-label="Quantité"
                            style={{
                              width: 68,
                              padding: "3px 6px",
                              fontSize: 12,
                            }}
                            onChange={(e) =>
                              b.updateLine(l.id, {
                                qty: Number(e.target.value),
                              })
                            }
                          />
                          <span className="muted xs">×</span>
                          <input
                            className="input num"
                            type="number"
                            value={l.rate}
                            aria-label="Taux"
                            style={{
                              width: 82,
                              padding: "3px 6px",
                              fontSize: 12,
                            }}
                            onChange={(e) =>
                              b.updateLine(l.id, {
                                rate: Number(e.target.value),
                              })
                            }
                          />
                        </div>
                      </div>
                      <div className="num strong">{fmtEUR(l.qty * l.rate)}</div>
                      <button
                        type="button"
                        className="line-remove"
                        aria-label="Supprimer la ligne"
                        onClick={() => b.removeLine(l.id)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={b.addBlank}
                >
                  <Icon name="plus" size={14} />
                  Ajouter une ligne manuelle
                </button>

                <div className="divider" />
                <div
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <span className="strong">Total</span>
                  <span
                    className="num strong"
                    style={{ fontSize: 22, color: "var(--accent)" }}
                  >
                    {fmtEUR(b.effectiveTotal)}
                  </span>
                </div>
              </div>
            </>
          )}

          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
            aria-expanded={showOptions}
            onClick={() => setShowOptions((v) => !v)}
          >
            <Icon
              name={showOptions ? "chevron-down" : "chevron-right"}
              size={14}
            />
            Options
          </button>

          {showOptions && (
            <div className="card col gap-12">
              <div className="field">
                <label className="field-label" htmlFor="m-edit-project">
                  Projet (optionnel)
                </label>
                <select
                  id="m-edit-project"
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
              <div className="field">
                <label className="field-label" htmlFor="m-edit-issue-date">
                  Émise le
                </label>
                <input
                  id="m-edit-issue-date"
                  className="input"
                  type="date"
                  value={b.issueDate}
                  onChange={(e) => b.setIssueDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="m-edit-due-date">
                  Échéance
                </label>
                <input
                  id="m-edit-due-date"
                  className="input"
                  type="date"
                  value={b.dueDate}
                  onChange={(e) => b.setDueDate(e.target.value)}
                />
              </div>
              <div className="field">
                <label className="field-label" htmlFor="m-edit-number">
                  Numéro
                </label>
                <input
                  id="m-edit-number"
                  className="input mono"
                  value={b.customNumber}
                  onChange={(e) => b.setCustomNumber(e.target.value)}
                />
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="sticky-cta">
        <button
          type="button"
          className="btn btn-primary grow"
          style={{ justifyContent: "center" }}
          disabled={saveDisabled}
          onClick={() => b.save(b.status)}
        >
          <Icon name="check" size={14} />
          Sauver les modifications
        </button>
      </div>
    </div>
  )
}
