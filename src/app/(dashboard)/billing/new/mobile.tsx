"use client"

import { useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { SplitDialog } from "@/components/billing/split-dialog"
import { fmtEUR, initials, avatarColor } from "@/lib/format"
import { lineFromTask } from "@/lib/billing-math"
import { useInvoiceBuilder } from "@/features/billing/use-invoice-builder"
import { MobileInvoiceSummary } from "@/features/billing/mobile-invoice-summary"
import {
  mergePickableTasks,
  selectedTaskIds,
} from "@/features/billing/mobile-task-picker"
import type { InvoiceKind } from "@/domain/billing/types"
import type { ClientDTO } from "@/hooks/use-clients"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { Skeleton } from "@/components/ui/skeleton"
import {
  SegmentedControl,
  type SegmentedControlOption,
} from "@/components/ui/segmented-control"

type Step = 1 | 2 | 3

const KIND_OPTIONS: readonly SegmentedControlOption<InvoiceKind>[] = [
  { id: "STANDARD", label: "Facture" },
  { id: "DEPOSIT", label: "Acompte" },
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
 * Mobile invoice builder: a 3-step flow (client + type, lines, recap) that
 * replaces the desktop drag & drop with tap-to-add / tap-to-remove rows.
 * Shares `useInvoiceBuilder` with the desktop page, so all pricing, deposit
 * and submit semantics are identical.
 */
export function MobileInvoiceNewPage() {
  const router = useRouter()
  const search = useSearchParams()
  const taskIdsParam = search.get("taskIds") ?? ""
  const preselectedTaskIds = useMemo(
    () => taskIdsParam.split(",").filter(Boolean),
    [taskIdsParam],
  )
  const groupIdsParam = search.get("groupIds") ?? ""
  const preselectedTaskGroupIds = useMemo(
    () => groupIdsParam.split(",").filter(Boolean),
    [groupIdsParam],
  )
  const initialClientId = search.get("clientId") ?? ""

  const b = useInvoiceBuilder({
    mode: "create",
    preselectedTaskIds,
    preselectedTaskGroupIds,
    initialClientId,
  })
  const [step, setStep] = useState<Step>(initialClientId ? 2 : 1)
  const { client, kind, lines, effectiveTotal } = b

  const standaloneLines = useMemo(
    () => lines.filter((line) => !line.taskGroupId),
    [lines],
  )
  const picked = useMemo(
    () => selectedTaskIds(standaloneLines),
    [standaloneLines],
  )
  const selectedCount = useMemo(() => selectedTaskIds(lines).size, [lines])
  const pickable = useMemo(
    () => mergePickableTasks(b.tasks, b.eligibleTasks, standaloneLines),
    [b.tasks, b.eligibleTasks, standaloneLines],
  )

  const canContinue =
    kind === "DEPOSIT" ? b.depositAmount > 0 : lines.length > 0

  const goBack = () => {
    if (step === 1) router.push("/billing")
    else setStep((step - 1) as Step)
  }

  return (
    <div className="m-screen">
      <MobileTopbar
        title="Nouvelle facture"
        back={goBack}
        action={<div className="xs muted">{step}/3</div>}
      />

      <div className="m-content">
        <div style={{ padding: "0 14px 14px" }}>
          <div className="pbar">
            <span style={{ width: `${(step / 3) * 100}%` }} />
          </div>
        </div>

        {step === 1 && (
          <div className="m-stack">
            <div>
              <div className="big-title" style={{ fontSize: 22 }}>
                Choisis un client
              </div>
              <div className="big-sub">Et le type de facture</div>
            </div>
            <SegmentedControl
              options={KIND_OPTIONS}
              value={kind}
              onChange={b.setKind}
            />
            <div className="col gap-8">
              {b.clients.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  className="card card-tight"
                  style={{ textAlign: "left", width: "100%" }}
                  onClick={() => {
                    b.selectClient(c.id)
                    setStep(2)
                  }}
                >
                  <div className="row gap-10">
                    <div
                      className="av av-sm"
                      style={{ background: clientAvatar(c) }}
                    >
                      {initials(`${c.firstName} ${c.lastName}`)}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong small truncate">
                        {c.company ?? `${c.firstName} ${c.lastName}`}
                      </div>
                      <div className="xs muted">{clientRateLabel(c)}</div>
                    </div>
                    <Icon name="chevron-right" size={14} className="muted" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {step === 2 && client && (
          <div className="m-stack">
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
                <div className="xs muted">
                  {kind === "DEPOSIT"
                    ? "Facture d'acompte"
                    : "Facture standard"}
                </div>
              </div>
            </div>

            {kind === "DEPOSIT" ? (
              <div className="card">
                <div className="card-title">Montant de l&apos;acompte</div>
                <div className="col gap-12" style={{ marginTop: 12 }}>
                  <div className="field">
                    <label className="field-label" htmlFor="m-deposit-label">
                      Description
                    </label>
                    <input
                      id="m-deposit-label"
                      className="input"
                      value={b.depositLabel}
                      onChange={(e) => b.setDepositLabel(e.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label className="field-label" htmlFor="m-deposit-amount">
                      Montant (€)
                    </label>
                    <input
                      id="m-deposit-amount"
                      className="input num"
                      type="number"
                      value={b.depositAmount}
                      onChange={(e) =>
                        b.setDepositAmount(Number(e.target.value))
                      }
                    />
                    {client.deposit != null && (
                      <div className="xs muted" style={{ marginTop: 4 }}>
                        Suggéré : {fmtEUR(client.deposit)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div>
                  <div className="big-title" style={{ fontSize: 18 }}>
                    Sélectionne les tasks
                  </div>
                  <div className="big-sub">
                    {pickable.length} disponibles · {selectedCount} sélectionnée
                    {selectedCount > 1 ? "s" : ""}
                  </div>
                </div>

                {(b.groups.length > 0 || b.eligibleGroups.length > 0) && (
                  <div className="col gap-8">
                    <div className="field-label">Groupes prêts à facturer</div>
                    {b.groups.map((group) => {
                      const groupLines = lines.filter(
                        (line) => line.taskGroupId === group.id,
                      )
                      return (
                        <button
                          key={group.id}
                          type="button"
                          className="task-item selected"
                          aria-pressed="true"
                          style={{ textAlign: "left" }}
                          onClick={() => b.removeTaskGroup(group.id)}
                        >
                          <div className="row gap-8">
                            <div className="checkbox-circle checked">
                              <Icon name="check" size={13} />
                            </div>
                            <Icon name="folder" size={14} className="muted" />
                            <span className="strong">{group.name}</span>
                          </div>
                          <div className="task-meta">
                            <span>
                              {groupLines.length} task
                              {groupLines.length > 1 ? "s" : ""}
                            </span>
                            <span>·</span>
                            <span className="num">
                              {fmtEUR(
                                groupLines.reduce(
                                  (sum, line) => sum + line.qty * line.rate,
                                  0,
                                ),
                              )}
                            </span>
                          </div>
                        </button>
                      )
                    })}
                    {b.eligibleGroups.map((group) => (
                      <button
                        key={group.id}
                        type="button"
                        className="task-item"
                        aria-pressed="false"
                        style={{ textAlign: "left" }}
                        onClick={() => b.addTaskGroup(group)}
                      >
                        <div className="row gap-8">
                          <div className="checkbox-circle" />
                          <Icon name="folder" size={14} className="muted" />
                          <span className="strong">{group.name}</span>
                        </div>
                        <div className="task-meta">
                          <span>{group.tasks.length} tasks</span>
                          <span>·</span>
                          <span>
                            {group.tasks
                              .map((task) => task.linearIdentifier)
                              .join(", ")}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}

                {b.taskGroupsPending ? (
                  <div className="card" role="status">
                    <span className="sr-only">Chargement des groupes…</span>
                    <div className="col gap-8">
                      <Skeleton width="42%" height={12} />
                      <Skeleton width="100%" height={56} radius={10} />
                    </div>
                  </div>
                ) : pickable.length === 0 &&
                  b.eligibleGroups.length === 0 &&
                  b.groups.length === 0 ? (
                  <div className="empty">
                    <div className="empty-title">Aucune task à facturer</div>
                    <div>
                      Marque des tasks comme &quot;Pending Invoice&quot; sur
                      Linear
                    </div>
                  </div>
                ) : pickable.length > 0 ? (
                  <div className="col gap-8">
                    <div className="field-label">Tasks hors groupe</div>
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
                ) : null}

                <button
                  type="button"
                  className="btn btn-secondary"
                  style={{ width: "100%", justifyContent: "center" }}
                  onClick={b.addBlank}
                >
                  <Icon name="plus" size={14} />
                  Ajouter une ligne manuelle
                </button>
              </>
            )}
          </div>
        )}

        {step === 3 && client && (
          <MobileInvoiceSummary builder={b} client={client} />
        )}
      </div>

      <div className="sticky-cta">
        {step === 1 && (
          <button
            type="button"
            className="btn btn-secondary grow"
            style={{ justifyContent: "center" }}
            onClick={() => router.push("/billing")}
          >
            Annuler
          </button>
        )}
        {step === 2 && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setStep(1)}
            >
              Retour
            </button>
            <button
              type="button"
              className="btn btn-primary grow"
              style={{ justifyContent: "center" }}
              disabled={!canContinue}
              onClick={() => setStep(3)}
            >
              Continuer · {fmtEUR(effectiveTotal)}
            </button>
          </>
        )}
        {step === 3 && (
          <>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={!canContinue || b.isPending}
              onClick={() => b.submit("DRAFT")}
            >
              Brouillon
            </button>
            <button
              type="button"
              className="btn btn-primary grow"
              style={{ justifyContent: "center" }}
              disabled={!canContinue || b.isPending}
              onClick={() => b.submit("SENT")}
            >
              <Icon name="send" size={13} />
              Créer &amp; envoyer
            </button>
          </>
        )}
      </div>

      {b.showSplit && (
        <SplitDialog
          total={effectiveTotal}
          initialIssueDate={b.issueDate}
          initialDueDate={b.dueDate}
          isPending={b.isSplitPending}
          onClose={() => b.setShowSplit(false)}
          onConfirm={(parts, schedule) => b.doSplit(parts, schedule)}
        />
      )}
    </div>
  )
}
