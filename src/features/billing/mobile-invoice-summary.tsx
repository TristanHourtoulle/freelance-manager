"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icon"
import { fmtEUR } from "@/lib/format"
import { initials, avatarColor } from "@/lib/format"
import type { CreateInvoiceBuilder } from "@/features/billing/invoice-builder-types"
import type { ClientDTO } from "@/hooks/use-clients"

function clientAvatar(client: ClientDTO): string {
  return client.color ?? avatarColor(`${client.firstName}${client.lastName}`)
}

/**
 * Step 3 of the mobile invoice builder: the recap card (`.builder-summary`)
 * with one editable `.builder-line` per invoice line, the running total, and a
 * collapsible options block (dates, number, mark-as-paid, split).
 *
 * @param builder - The shared create-mode invoice builder.
 * @param client - The resolved client of the invoice.
 */
export function MobileInvoiceSummary({
  builder,
  client,
}: {
  builder: CreateInvoiceBuilder
  client: ClientDTO
}) {
  const b = builder
  const [showOptions, setShowOptions] = useState(false)
  const isDeposit = b.kind === "DEPOSIT"

  return (
    <div className="m-stack">
      <div>
        <div className="big-title" style={{ fontSize: 22 }}>
          Récapitulatif
        </div>
        <div className="big-sub">Vérifie avant de créer</div>
      </div>

      <div className="builder-summary">
        <div className="row gap-10" style={{ marginBottom: 14 }}>
          <div className="av" style={{ background: clientAvatar(client) }}>
            {initials(`${client.firstName} ${client.lastName}`)}
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong truncate">
              {client.company ?? `${client.firstName} ${client.lastName}`}
            </div>
            <div className="xs muted">
              {client.firstName} {client.lastName}
            </div>
          </div>
          {isDeposit && (
            <span className="pill pill-no-dot pill-deposit">Acompte</span>
          )}
        </div>

        <div className="col gap-6" style={{ marginBottom: 14 }}>
          {isDeposit ? (
            <div className="builder-line">
              <div style={{ minWidth: 0 }}>
                <div className="small truncate">{b.depositLabel}</div>
                <div className="xs muted mono">
                  1 × {fmtEUR(b.depositAmount)}
                </div>
              </div>
              <div className="num strong">{fmtEUR(b.depositAmount)}</div>
              <span />
            </div>
          ) : (
            b.lines.map((l) => (
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
                      style={{ width: 68, padding: "3px 6px", fontSize: 12 }}
                      onChange={(e) =>
                        b.updateLine(l.id, { qty: Number(e.target.value) })
                      }
                    />
                    <span className="muted xs">×</span>
                    <input
                      className="input num"
                      type="number"
                      value={l.rate}
                      aria-label="Taux"
                      style={{ width: 82, padding: "3px 6px", fontSize: 12 }}
                      onChange={(e) =>
                        b.updateLine(l.id, { rate: Number(e.target.value) })
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
            ))
          )}
        </div>

        {!isDeposit && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
            onClick={b.addBlank}
          >
            <Icon name="plus" size={14} />
            Ajouter une ligne manuelle
          </button>
        )}

        <div className="divider" />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="strong">Total</span>
          <span
            className="num strong"
            style={{ fontSize: 22, color: "var(--accent)" }}
          >
            {fmtEUR(b.effectiveTotal)}
          </span>
        </div>
      </div>

      <button
        type="button"
        className="btn btn-secondary"
        style={{ width: "100%", justifyContent: "center" }}
        aria-expanded={showOptions}
        onClick={() => setShowOptions((v) => !v)}
      >
        <Icon name={showOptions ? "chevron-down" : "chevron-right"} size={14} />
        Options
      </button>

      {showOptions && (
        <div className="card col gap-12">
          <div className="field">
            <label className="field-label" htmlFor="m-issue-date">
              Émise le
            </label>
            <input
              id="m-issue-date"
              className="input"
              type="date"
              value={b.issueDate}
              onChange={(e) => b.setIssueDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="m-due-date">
              Échéance
            </label>
            <input
              id="m-due-date"
              className="input"
              type="date"
              value={b.dueDate}
              onChange={(e) => b.setDueDate(e.target.value)}
            />
          </div>
          <div className="field">
            <label className="field-label" htmlFor="m-number">
              Numéro <span className="muted xs">— auto si vide</span>
            </label>
            <input
              id="m-number"
              className="input mono"
              placeholder="2026-1042"
              value={b.customNumber}
              onChange={(e) => b.setCustomNumber(e.target.value)}
            />
          </div>
          <div className="row gap-8">
            <input
              type="checkbox"
              id="m-mark-paid"
              checked={b.markPaid}
              onChange={(e) => b.setMarkPaid(e.target.checked)}
            />
            <label
              htmlFor="m-mark-paid"
              className="small"
              style={{ flex: 1, cursor: "pointer" }}
            >
              Paiement total reçu
            </label>
          </div>
          {b.markPaid && (
            <div className="field">
              <label className="field-label" htmlFor="m-paid-at">
                Payée le
              </label>
              <input
                id="m-paid-at"
                className="input"
                type="date"
                value={b.paidAt}
                onChange={(e) => b.setPaidAt(e.target.value)}
              />
            </div>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ width: "100%", justifyContent: "center" }}
            disabled={!b.effectiveTotal || b.isPending}
            onClick={() => b.setShowSplit(true)}
          >
            <Icon name="grid" size={14} />
            Diviser en plusieurs
          </button>
        </div>
      )}
    </div>
  )
}
