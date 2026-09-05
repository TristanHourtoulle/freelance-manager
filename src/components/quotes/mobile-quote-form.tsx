"use client"

import { Icon } from "@/components/ui/icon"
import { fmtEUR } from "@/lib/format"
import type { QuoteStatus } from "@/hooks/use-quotes"
import type { QuoteForm as QuoteFormApi } from "@/features/quotes/use-quote-form"
import { QUOTE_STATUS_OPTIONS, quoteClientLabel } from "@/components/quotes/quote-form"

/**
 * Mobile twin of `QuoteForm`: the same fields and lines editor as the desktop
 * form (client/project/number/dates/status/Abby link/notes, then the lines
 * editor with the "import billable tasks" shortcut and a live total), stacked
 * into a single scrolling `.m-stack` column instead of the desktop `.card`
 * grid. Shares `useQuoteForm` with the desktop form, so pricing, task import
 * and submit semantics are identical.
 *
 * @param form - The form API from `useQuoteForm`, shared with the desktop form.
 */
export function MobileQuoteForm({ form }: { form: QuoteFormApi }) {
  return (
    <div className="m-stack">
      <div className="field">
        <label className="field-label" htmlFor="m-quote-client">
          Client
        </label>
        {form.isEdit ? (
          <input
            id="m-quote-client"
            className="input"
            value={form.client ? quoteClientLabel(form.client) : "—"}
            disabled
          />
        ) : (
          <select
            id="m-quote-client"
            className="select"
            value={form.clientId}
            onChange={(e) => form.selectClient(e.target.value)}
          >
            <option value="">Choisir un client…</option>
            {form.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {quoteClientLabel(c)}
              </option>
            ))}
          </select>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="m-quote-status">
          Statut
        </label>
        <select
          id="m-quote-status"
          className="select"
          value={form.status}
          onChange={(e) => form.setStatus(e.target.value as QuoteStatus)}
        >
          {QUOTE_STATUS_OPTIONS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="m-quote-project">
          Projet (optionnel)
        </label>
        <select
          id="m-quote-project"
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

      <div className="row gap-8">
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="m-quote-number">
            Numéro
          </label>
          <input
            id="m-quote-number"
            className="input mono"
            placeholder="Auto"
            value={form.number}
            onChange={(e) => form.setNumber(e.target.value)}
          />
        </div>
        <div className="field" style={{ flex: 1 }}>
          <label className="field-label" htmlFor="m-quote-issue">
            Émis le
          </label>
          <input
            id="m-quote-issue"
            className="input"
            type="date"
            value={form.issueDate}
            onChange={(e) => form.setIssueDate(e.target.value)}
          />
        </div>
      </div>

      <div className="field">
        <label className="field-label" htmlFor="m-quote-valid">
          Valable jusqu&apos;au
        </label>
        <input
          id="m-quote-valid"
          className="input"
          type="date"
          value={form.validUntil}
          onChange={(e) => form.setValidUntil(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="m-quote-abby">
          Lien Abby (facultatif)
        </label>
        <input
          id="m-quote-abby"
          className="input"
          type="url"
          placeholder="https://…"
          value={form.externalUrl}
          onChange={(e) => form.setExternalUrl(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="field-label" htmlFor="m-quote-notes">
          Notes (optionnel)
        </label>
        <textarea
          id="m-quote-notes"
          className="textarea"
          rows={2}
          value={form.notes}
          onChange={(e) => form.setNotes(e.target.value)}
        />
      </div>

      <div
        className="row gap-8"
        style={{ justifyContent: "space-between", alignItems: "center" }}
      >
        <div className="field-label" style={{ margin: 0 }}>
          Lignes du devis
        </div>
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={form.importEligibleTasks}
          disabled={!form.clientId}
        >
          <Icon name="check" size={13} />
          Importer
        </button>
      </div>

      <div className="builder-summary">
        {form.lines.length === 0 ? (
          <div className="empty" style={{ padding: "20px 8px" }}>
            <div className="empty-title">Aucune ligne</div>
            <div>Ajoute une ligne ou importe les tâches à facturer.</div>
          </div>
        ) : (
          <div className="col gap-6" style={{ marginBottom: 14 }}>
            {form.lines.map((l) => (
              <div key={l.key} className="builder-line">
                <div style={{ minWidth: 0 }}>
                  <input
                    className="input"
                    style={{ padding: "4px 7px", fontSize: 12 }}
                    placeholder="Description de la ligne"
                    value={l.label}
                    aria-label="Description de la ligne"
                    onChange={(e) =>
                      form.updateLine(l.key, { label: e.target.value })
                    }
                  />
                  <div className="row gap-4" style={{ marginTop: 4 }}>
                    <input
                      className="input num"
                      type="number"
                      step="0.25"
                      min={0}
                      value={l.qty}
                      aria-label="Quantité"
                      style={{ width: 68, padding: "3px 6px", fontSize: 12 }}
                      onChange={(e) =>
                        form.updateLine(l.key, { qty: Number(e.target.value) })
                      }
                    />
                    <span className="muted xs">×</span>
                    <input
                      className="input num"
                      type="number"
                      step="0.01"
                      min={0}
                      value={l.rate}
                      aria-label="Prix unitaire"
                      style={{ width: 82, padding: "3px 6px", fontSize: 12 }}
                      onChange={(e) =>
                        form.updateLine(l.key, {
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
                  onClick={() => form.removeLine(l.key)}
                >
                  <Icon name="x" size={12} />
                </button>
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          className="btn btn-secondary"
          style={{ width: "100%", justifyContent: "center" }}
          onClick={form.addLine}
        >
          <Icon name="plus" size={14} />
          Ajouter une ligne
        </button>

        <div className="divider" />
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="strong">Total</span>
          <span
            className="num strong"
            style={{ fontSize: 22, color: "var(--accent)" }}
          >
            {fmtEUR(form.total)}
          </span>
        </div>
      </div>
    </div>
  )
}
