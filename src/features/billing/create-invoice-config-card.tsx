"use client"

import type { InvoiceKind } from "@/domain/billing/types"
import type { CreateInvoiceBuilder } from "@/features/billing/invoice-builder-types"
import { ClientSummaryBar } from "@/features/billing/invoice-builder-parts"

/**
 * The create-mode configuration card: client and project pickers, invoice
 * number, dates, kind and initial-status toggles, and the optional
 * mark-as-paid control.
 */
export function CreateInvoiceConfigCard({
  builder,
}: {
  builder: CreateInvoiceBuilder
}) {
  const b = builder
  const { client, clientId, kind } = b
  return (
    <div className="card" style={{ marginBottom: 18 }}>
      <div className="row gap-16" style={{ flexWrap: "wrap" }}>
        <div className="field" style={{ flex: 1, minWidth: 260 }}>
          <label className="field-label">Client</label>
          <select
            className="select"
            value={clientId}
            onChange={(e) => b.selectClient(e.target.value)}
          >
            <option value="">— choisir un client —</option>
            {b.clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company ?? `${c.firstName} ${c.lastName}`} · {c.firstName}{" "}
                {c.lastName}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: 1, minWidth: 220 }}>
          <label className="field-label">Projet (optionnel)</label>
          <select
            className="select"
            value={b.projectId}
            onChange={(e) => b.setProjectId(e.target.value)}
            disabled={!clientId}
          >
            <option value="all">Tous les projets</option>
            {b.projects
              .filter((p) => p.clientId === clientId)
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
        <div className="field" style={{ width: 200 }}>
          <label className="field-label">
            Numéro <span className="muted xs">— auto si vide</span>
          </label>
          <input
            className="input mono"
            placeholder="2026-1042"
            value={b.customNumber}
            onChange={(e) => b.setCustomNumber(e.target.value)}
          />
        </div>
        <div className="field" style={{ width: 180 }}>
          <label className="field-label">Émise le</label>
          <input
            className="input"
            type="date"
            value={b.issueDate}
            onChange={(e) => b.setIssueDate(e.target.value)}
          />
        </div>
        <div className="field" style={{ width: 180 }}>
          <label className="field-label">Échéance</label>
          <input
            className="input"
            type="date"
            value={b.dueDate}
            onChange={(e) => b.setDueDate(e.target.value)}
          />
        </div>
        <div className="field" style={{ width: 220 }}>
          <label className="field-label">Type</label>
          <div
            className="row gap-4"
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
        <div className="field" style={{ width: 280 }}>
          <label className="field-label">Statut initial</label>
          <div
            className="row gap-4"
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
                { id: "SENT", label: "Émise" },
              ] as { id: "DRAFT" | "SENT"; label: string }[]
            ).map((s) => (
              <button
                key={s.id}
                className="chip"
                style={{
                  flex: 1,
                  justifyContent: "center",
                  background:
                    b.initialStatus === s.id ? "var(--accent)" : "transparent",
                  color:
                    b.initialStatus === s.id
                      ? "var(--accent-text)"
                      : "var(--text-1)",
                  border: "none",
                }}
                onClick={() => b.setInitialStatus(s.id)}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
        {b.initialStatus === "SENT" && (
          <div className="field" style={{ width: 320 }}>
            <label className="field-label">Marquer comme payée</label>
            <div
              className="row gap-8"
              style={{
                background: "var(--bg-2)",
                border: "1px solid var(--border)",
                borderRadius: 7,
                padding: "8px 10px",
                height: 40,
              }}
            >
              <input
                type="checkbox"
                id="markPaid"
                checked={b.markPaid}
                onChange={(e) => b.setMarkPaid(e.target.checked)}
              />
              <label
                htmlFor="markPaid"
                className="small"
                style={{ flex: 1, cursor: "pointer" }}
              >
                Paiement total reçu
              </label>
              {b.markPaid && (
                <input
                  className="input"
                  type="date"
                  value={b.paidAt}
                  onChange={(e) => b.setPaidAt(e.target.value)}
                  style={{ width: 140 }}
                />
              )}
            </div>
          </div>
        )}
      </div>
      {client && <ClientSummaryBar client={client} />}
    </div>
  )
}
