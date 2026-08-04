"use client"

import type { ReactNode } from "react"
import { Icon } from "@/components/ui/icon"
import { BillingTypePill } from "@/components/ui/pill"
import { EditableTotal } from "@/components/billing/editable-total"
import { fmtEUR, fmtEURprecise, initials, avatarColor } from "@/lib/format"
import { lineFromTask } from "@/lib/billing-math"
import type { ClientDTO } from "@/hooks/use-clients"
import type { InvoiceBuilder } from "@/features/billing/invoice-builder-types"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { buildInvoiceEntries, type BuilderLine } from "@/domain/billing/builder"

/**
 * The client identity strip (avatar, name, billing mode) shown under the
 * invoice form header. Identical across create and edit.
 */
export function ClientSummaryBar({ client }: { client: ClientDTO }) {
  return (
    <div
      className="row gap-12"
      style={{
        marginTop: 14,
        padding: 12,
        background: "var(--bg-2)",
        borderRadius: 8,
      }}
    >
      <div
        className="av av-sm"
        style={{
          background:
            client.color ??
            avatarColor(`${client.firstName}${client.lastName}`),
        }}
      >
        {initials(`${client.firstName} ${client.lastName}`)}
      </div>
      <div className="grow">
        <div className="strong small">
          {client.firstName} {client.lastName} · {client.company ?? "—"}
        </div>
        <div className="muted xs">
          Type {client.billingMode.toLowerCase()} ·{" "}
          {client.billingMode === "DAILY"
            ? `${client.rate}€/j`
            : client.billingMode === "HOURLY"
              ? `${client.rate}€/h`
              : fmtEUR(client.fixedPrice)}
        </div>
      </div>
      <BillingTypePill type={client.billingMode} />
    </div>
  )
}

/**
 * The deposit ("Acompte") editor card: description and amount fields plus the
 * computed total. `extraField` and `actions` are mode-specific slots.
 */
export function DepositCard({
  builder,
  extraField,
  actions,
}: {
  builder: InvoiceBuilder
  extraField?: ReactNode
  actions: ReactNode
}) {
  const b = builder
  return (
    <div className="card" style={{ maxWidth: 600 }}>
      <div className="card-h2" style={{ marginBottom: 16 }}>
        Détails de l&apos;acompte
      </div>
      <div className="col gap-12">
        <div className="field">
          <label className="field-label">Description</label>
          <input
            className="input"
            value={b.depositLabel}
            onChange={(e) => b.setDepositLabel(e.target.value)}
          />
        </div>
        <div className="field">
          <label className="field-label">Montant (€)</label>
          <input
            className="input num"
            type="number"
            value={b.depositAmount}
            onChange={(e) => b.setDepositAmount(Number(e.target.value))}
          />
        </div>
        {extraField}
      </div>
      <div className="divider" />
      <div className="row" style={{ justifyContent: "space-between" }}>
        <span className="strong">Total facture</span>
        <span className="num strong" style={{ fontSize: 22 }}>
          {fmtEUR(b.effectiveTotal)}
        </span>
      </div>
      {actions}
    </div>
  )
}

/**
 * The left column of the STANDARD builder: header, search box, an optional
 * empty-state slot, then the drag/click-to-add list of eligible tasks.
 */
export function EligibleTaskColumn({
  builder,
  beforeList,
}: {
  builder: InvoiceBuilder
  beforeList?: ReactNode
}) {
  const b = builder
  const { client } = b
  return (
    <div>
      <div className="card-title" style={{ marginBottom: 10 }}>
        <span>Tasks à facturer · {b.eligibleTasks.length}</span>
        <span className="xs muted">Glisse-déposer ou clique pour ajouter</span>
      </div>
      <div style={{ position: "relative", marginBottom: 12 }}>
        <Icon
          name="search"
          size={14}
          className="muted"
          style={{ position: "absolute", left: 12, top: 10 }}
        />
        <input
          className="input"
          style={{ paddingLeft: 34 }}
          placeholder="Rechercher par ID ou titre…"
          value={b.taskSearch}
          onChange={(e) => b.setTaskSearch(e.target.value)}
        />
      </div>
      {beforeList}
      {b.eligibleGroups.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div className="xs muted" style={{ marginBottom: 6 }}>
            Groupes prêts à facturer
          </div>
          <div className="col gap-6">
            {b.eligibleGroups.map((group) => {
              const total = client
                ? group.tasks.reduce((sum, task) => {
                    const value = lineFromTask({
                      billingMode: client.billingMode,
                      rate: client.rate,
                      estimateDays: task.estimate,
                    })
                    return sum + value.qty * value.rate
                  }, 0)
                : 0
              return (
                <button
                  key={group.id}
                  type="button"
                  className="task-pickable"
                  aria-label={`Ajouter le groupe ${group.name}`}
                  onClick={() => b.addTaskGroup(group)}
                >
                  <Icon name="folder" size={14} className="muted" />
                  <div style={{ minWidth: 0 }}>
                    <div className="strong small truncate">{group.name}</div>
                    <div className="xs muted">
                      {group.tasks.length} task
                      {group.tasks.length > 1 ? "s" : ""}
                    </div>
                  </div>
                  <span className="num small">
                    {b.useTotalOverride ? "" : fmtEUR(total)}
                  </span>
                  <Icon name="plus" size={14} className="muted" />
                </button>
              )
            })}
          </div>
          <div className="divider" style={{ margin: "12px 0" }} />
        </div>
      )}
      <div
        style={{
          maxHeight: "calc(100vh - 360px)",
          overflowY: "auto",
          paddingRight: 6,
        }}
      >
        {b.eligibleTasks.map((t) => {
          const project = b.projectById.get(t.projectId)
          const value = client
            ? lineFromTask({
                billingMode: client.billingMode,
                rate: client.rate,
                estimateDays: t.estimate,
              })
            : { qty: 0, rate: 0 }
          return (
            <button
              key={t.id}
              type="button"
              className="task-pickable"
              draggable
              onDragStart={(e) => {
                e.dataTransfer.setData("text/plain", t.id)
                e.currentTarget.classList.add("dragging")
              }}
              onDragEnd={(e) => e.currentTarget.classList.remove("dragging")}
              onClick={() => b.addTask(t)}
            >
              <Icon name="grip" size={14} className="muted" />
              <div>
                <div className="row gap-8">
                  <TaskIdLink
                    identifier={t.linearIdentifier}
                    url={t.linearUrl}
                    className="task-id"
                    stopPropagation
                  />
                  <span className="strong small truncate">{t.title}</span>
                </div>
                <div className="xs muted" style={{ marginTop: 2 }}>
                  {project?.name ?? ""} · {t.estimate ?? "—"}j
                </div>
              </div>
              <span className="num small">
                {b.useTotalOverride ? "" : fmtEUR(value.qty * value.rate)}
              </span>
              <Icon name="plus" size={14} className="muted" />
            </button>
          )
        })}
      </div>
    </div>
  )
}

/**
 * The right column of the STANDARD builder: the drop zone with editable line
 * items, the subtotal/total block, and mode-specific add-line and action
 * slots.
 */
export function InvoiceLinesPanel({
  builder,
  dropzoneStyle,
  emptyHint,
  addLineButton,
  actions,
}: {
  builder: InvoiceBuilder
  dropzoneStyle: React.CSSProperties
  emptyHint: string
  addLineButton: ReactNode
  actions: ReactNode
}) {
  const b = builder
  const { lines } = b
  const entries = buildInvoiceEntries(lines, b.groups)

  const renderLine = (line: BuilderLine, nested = false) => (
    <div
      key={line.id}
      className="line-item"
      style={{
        ...(b.useTotalOverride ? { gridTemplateColumns: "auto 1fr auto" } : {}),
        ...(nested
          ? {
              margin: "0 8px 8px",
              background: "var(--bg-2)",
              borderRadius: 7,
            }
          : {}),
      }}
    >
      <Icon name="grip" size={12} className="muted" />
      <div style={{ minWidth: 0 }}>
        <input
          className="input"
          style={{ padding: "4px 7px", fontSize: 12 }}
          value={line.label}
          onChange={(e) => b.updateLine(line.id, { label: e.target.value })}
        />
      </div>
      {!b.useTotalOverride && (
        <div className="row gap-4">
          <input
            type="number"
            step="0.25"
            value={line.qty}
            onChange={(e) =>
              b.updateLine(line.id, { qty: Number(e.target.value) })
            }
            title="Quantité"
          />
          <span className="muted xs">×</span>
          <input
            type="number"
            value={line.rate}
            onChange={(e) =>
              b.updateLine(line.id, { rate: Number(e.target.value) })
            }
            title="Taux"
          />
        </div>
      )}
      <button
        type="button"
        className="line-remove"
        aria-label={line.taskGroupId ? "Retirer le groupe" : "Retirer la ligne"}
        onClick={() => b.removeLine(line.id)}
      >
        <Icon name="x" size={12} />
      </button>
    </div>
  )

  return (
    <div className="invoice-side">
      <div className="card-h2" style={{ marginBottom: 14 }}>
        Aperçu facture
      </div>

      <div
        className={
          "dropzone" +
          (b.dragOver ? " over" : "") +
          (lines.length === 0 ? " empty" : "")
        }
        style={dropzoneStyle}
        onDragOver={(e) => {
          e.preventDefault()
          b.setDragOver(true)
        }}
        onDragLeave={() => b.setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          b.setDragOver(false)
          b.addTaskById(e.dataTransfer.getData("text/plain"))
        }}
      >
        {lines.length === 0 ? (
          <div>
            <Icon name="plus" size={20} className="muted" />
            <br />
            <div style={{ marginTop: 6 }}>
              Glisse une task ici
              <br />
              <span className="xs muted">{emptyHint}</span>
            </div>
          </div>
        ) : (
          <>
            {entries.map((entry) =>
              entry.type === "line" ? (
                renderLine(entry.line)
              ) : (
                <details
                  key={entry.group.id}
                  open
                  style={{
                    border: "1px solid var(--border)",
                    borderRadius: 9,
                    marginBottom: 8,
                    overflow: "hidden",
                  }}
                >
                  <summary
                    className="row gap-8"
                    style={{ padding: 10, cursor: "pointer" }}
                  >
                    <Icon name="folder" size={14} className="muted" />
                    <span className="strong small grow">
                      {entry.group.name}
                    </span>
                    <span className="xs muted">
                      {entry.lines.length} task
                      {entry.lines.length > 1 ? "s" : ""}
                    </span>
                    {!b.useTotalOverride && (
                      <span className="num small">{fmtEUR(entry.total)}</span>
                    )}
                    <button
                      type="button"
                      className="line-remove"
                      aria-label={`Retirer le groupe ${entry.group.name}`}
                      onClick={(event) => {
                        event.preventDefault()
                        event.stopPropagation()
                        b.removeTaskGroup(entry.group.id)
                      }}
                    >
                      <Icon name="x" size={12} />
                    </button>
                  </summary>
                  {entry.lines.map((line) => renderLine(line, true))}
                </details>
              ),
            )}
          </>
        )}
      </div>

      {addLineButton}

      <div className="divider" />
      <div className="col gap-4">
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted small">Sous-total</span>
          <EditableTotal
            value={b.effectiveTotal}
            hasOverride={b.useTotalOverride}
            onSet={b.setTotalOverrideValue}
            onClear={b.clearTotalOverride}
          />
        </div>
        <div className="row" style={{ justifyContent: "space-between" }}>
          <span className="muted small">TVA (0%)</span>
          <span className="num muted">—</span>
        </div>
        <div
          className="row"
          style={{
            justifyContent: "space-between",
            marginTop: 8,
            paddingTop: 10,
            borderTop: "1px solid var(--border)",
          }}
        >
          <span className="strong">Total</span>
          <span className="num strong" style={{ fontSize: 22 }}>
            {fmtEURprecise(b.effectiveTotal)}
          </span>
        </div>
        {b.useTotalOverride && (
          <div
            className="muted xs"
            style={{ marginTop: 4, fontStyle: "italic" }}
          >
            Forfait — les prix par ligne sont masqués.
          </div>
        )}
      </div>

      {actions}
    </div>
  )
}
