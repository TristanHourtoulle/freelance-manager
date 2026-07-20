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

type Step = 1 | 2 | 3

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
  const initialClientId = search.get("clientId") ?? ""

  const b = useInvoiceBuilder({
    mode: "create",
    preselectedTaskIds,
    initialClientId,
  })
  const [step, setStep] = useState<Step>(initialClientId ? 2 : 1)
  const { client, kind, lines, effectiveTotal } = b

  const picked = useMemo(() => selectedTaskIds(lines), [lines])
  const pickable = useMemo(
    () => mergePickableTasks(b.tasks, b.eligibleTasks, lines),
    [b.tasks, b.eligibleTasks, lines],
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
                    {pickable.length} disponibles · {picked.size} sélectionnée
                    {picked.size > 1 ? "s" : ""}
                  </div>
                </div>

                {pickable.length === 0 ? (
                  <div className="empty">
                    <div className="empty-title">Aucune task à facturer</div>
                    <div>
                      Marque des tasks comme &quot;Pending Invoice&quot; sur
                      Linear
                    </div>
                  </div>
                ) : (
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
