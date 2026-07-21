"use client"

import { useId } from "react"
import { Icon } from "@/components/ui/icon"
import { fmtEUR } from "@/lib/format"
import type { QuoteStatus } from "@/hooks/use-quotes"
import type { QuoteForm as QuoteFormApi } from "@/features/quotes/use-quote-form"

const STATUS_OPTIONS: { id: QuoteStatus; label: string }[] = [
  { id: "DRAFT", label: "Brouillon" },
  { id: "SENT", label: "Envoyé" },
  { id: "ACCEPTED", label: "Accepté" },
  { id: "REFUSED", label: "Refusé" },
  { id: "EXPIRED", label: "Expiré" },
]

function clientLabel(c: {
  firstName: string
  lastName: string
  company: string | null
}): string {
  return c.company ?? `${c.firstName} ${c.lastName}`
}

/**
 * The devis create/edit form: a configuration card (client, project, number,
 * dates, status, Abby link, notes) and a lines panel with an optional
 * "import billable tasks" shortcut and a live total.
 *
 * @param form - The form API from `useQuoteForm`.
 */
export function QuoteForm({ form }: { form: QuoteFormApi }) {
  const fieldId = useId()

  return (
    <>
      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row gap-16" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 240 }}>
            <label className="field-label" htmlFor={`${fieldId}-client`}>
              Client
            </label>
            {form.isEdit ? (
              <input
                id={`${fieldId}-client`}
                className="input"
                value={form.client ? clientLabel(form.client) : "—"}
                disabled
              />
            ) : (
              <select
                id={`${fieldId}-client`}
                className="select"
                value={form.clientId}
                onChange={(e) => form.selectClient(e.target.value)}
              >
                <option value="">Choisir un client…</option>
                {form.clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {clientLabel(c)}
                  </option>
                ))}
              </select>
            )}
          </div>

          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label className="field-label" htmlFor={`${fieldId}-project`}>
              Projet (optionnel)
            </label>
            <select
              id={`${fieldId}-project`}
              className="select"
              value={form.projectId ?? ""}
              onChange={(e) => form.setProjectId(e.target.value || null)}
              disabled={!form.clientId}
            >
              <option value="">Aucun projet</option>
              {form.clientProjects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ width: 200 }}>
            <label className="field-label" htmlFor={`${fieldId}-number`}>
              Numéro
            </label>
            <input
              id={`${fieldId}-number`}
              className="input mono"
              placeholder="Auto (D-AAAA-NNNN)"
              value={form.number}
              onChange={(e) => form.setNumber(e.target.value)}
            />
          </div>

          <div className="field" style={{ width: 180 }}>
            <label className="field-label" htmlFor={`${fieldId}-issue`}>
              Émis le
            </label>
            <input
              id={`${fieldId}-issue`}
              className="input"
              type="date"
              value={form.issueDate}
              onChange={(e) => form.setIssueDate(e.target.value)}
            />
          </div>

          <div className="field" style={{ width: 180 }}>
            <label className="field-label" htmlFor={`${fieldId}-valid`}>
              Valable jusqu&apos;au
            </label>
            <input
              id={`${fieldId}-valid`}
              className="input"
              type="date"
              value={form.validUntil}
              onChange={(e) => form.setValidUntil(e.target.value)}
            />
          </div>

          <div className="field" style={{ width: 200 }}>
            <label className="field-label" htmlFor={`${fieldId}-status`}>
              Statut
            </label>
            <select
              id={`${fieldId}-status`}
              className="select"
              value={form.status}
              onChange={(e) => form.setStatus(e.target.value as QuoteStatus)}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>

          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label className="field-label" htmlFor={`${fieldId}-abby`}>
              Lien Abby (facultatif)
            </label>
            <input
              id={`${fieldId}-abby`}
              className="input"
              type="url"
              placeholder="https://…"
              value={form.externalUrl}
              onChange={(e) => form.setExternalUrl(e.target.value)}
            />
          </div>

          <div className="field" style={{ width: "100%" }}>
            <label className="field-label" htmlFor={`${fieldId}-notes`}>
              Notes (optionnel)
            </label>
            <textarea
              id={`${fieldId}-notes`}
              className="textarea"
              rows={2}
              value={form.notes}
              onChange={(e) => form.setNotes(e.target.value)}
            />
          </div>
        </div>
      </div>

      <div className="card">
        <div
          className="row gap-12"
          style={{ justifyContent: "space-between", marginBottom: 14 }}
        >
          <div className="card-h2">Lignes du devis</div>
          <button
            className="btn btn-secondary btn-sm"
            onClick={form.importEligibleTasks}
            disabled={!form.clientId}
          >
            <Icon name="check" size={13} />
            Importer les tâches à facturer
          </button>
        </div>

        {form.lines.length === 0 ? (
          <div className="empty" style={{ padding: "32px 20px" }}>
            <div className="empty-title">Aucune ligne</div>
            <div>
              Ajoute une ligne manuelle ou importe les tâches à facturer du
              client.
            </div>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table" style={{ minWidth: 520 }}>
              <thead>
                <tr>
                  <th>Description</th>
                  <th className="right" style={{ width: 90 }}>
                    Qté
                  </th>
                  <th className="right" style={{ width: 120 }}>
                    Prix unit.
                  </th>
                  <th className="right" style={{ width: 110 }}>
                    Total
                  </th>
                  <th style={{ width: 44 }} />
                </tr>
              </thead>
              <tbody>
                {form.lines.map((l) => (
                  <tr key={l.key}>
                    <td>
                      <input
                        className="input"
                        style={{ fontSize: 12 }}
                        placeholder="Description de la ligne"
                        value={l.label}
                        onChange={(e) =>
                          form.updateLine(l.key, { label: e.target.value })
                        }
                      />
                    </td>
                    <td>
                      <input
                        className="input num"
                        type="number"
                        step="0.25"
                        min={0}
                        style={{ textAlign: "right" }}
                        value={l.qty}
                        onChange={(e) =>
                          form.updateLine(l.key, {
                            qty: Number(e.target.value),
                          })
                        }
                        aria-label="Quantité"
                      />
                    </td>
                    <td>
                      <input
                        className="input num"
                        type="number"
                        step="0.01"
                        min={0}
                        style={{ textAlign: "right" }}
                        value={l.rate}
                        onChange={(e) =>
                          form.updateLine(l.key, {
                            rate: Number(e.target.value),
                          })
                        }
                        aria-label="Prix unitaire"
                      />
                    </td>
                    <td className="right num">{fmtEUR(l.qty * l.rate)}</td>
                    <td className="right">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => form.removeLine(l.key)}
                        aria-label="Supprimer la ligne"
                      >
                        <Icon name="trash" size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <button
          className="btn btn-secondary btn-sm"
          style={{ marginTop: 12 }}
          onClick={form.addLine}
        >
          <Icon name="plus" size={13} />
          Ajouter une ligne
        </button>

        <div className="divider" style={{ margin: "16px 0" }} />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="strong">Total</span>
          <span className="num strong" style={{ fontSize: 22 }}>
            {fmtEUR(form.total)}
          </span>
        </div>
      </div>
    </>
  )
}
