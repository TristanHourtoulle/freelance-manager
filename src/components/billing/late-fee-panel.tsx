"use client"

import { useId, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { Modal } from "@/components/ui/modal"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { fmtDate, fmtDateShort, fmtEUR } from "@/lib/format"
import { useToast } from "@/components/providers/toast-provider"
import { useClaimLateFee, useWaiveLateFee } from "@/hooks/use-invoices"
import type { InvoiceLateFeeBreakdown } from "@/domain/billing/types"

const DAY_MS = 86_400_000
const CAP_EPSILON = 0.005

interface LateFeePanelProps {
  invoiceId: string
  dueDate: string
  lateFeeAccrued: number
  lateFeeDue: number
  lateFeeClaimedAt: string | null
  lateFeeWaived: boolean
  lateFeeBreakdown: InvoiceLateFeeBreakdown | null
}

type LateFeeState = "none" | "accruing" | "claimed" | "waived"

function round2(value: number): number {
  return Math.round(value * 100) / 100
}

function daysLateAsOf(dueDate: string, asOf: Date): number {
  return Math.max(
    0,
    Math.floor((asOf.getTime() - new Date(dueDate).getTime()) / DAY_MS),
  )
}

function resolveState(props: LateFeePanelProps): LateFeeState {
  if (props.lateFeeWaived) return "waived"
  if (props.lateFeeClaimedAt) return "claimed"
  if (props.lateFeeAccrued > 0) return "accruing"
  return "none"
}

/**
 * Late-payment penalty row for an invoice's totals block.
 *
 * Shows the live accrued amount when nothing has been claimed yet, the
 * frozen claimed amount once `lateFeeClaimedAt` is set, or an explicit
 * "Renoncée" state when waived — never hidden silently. A collapsible detail
 * shows the days late, the flat/interest split and, when the server sent one,
 * the per-period accrual segments — for a claimed penalty these come from
 * `lateFeeBreakdown`, whose `fixed`/`interest`/`total` are the frozen row
 * values (a claim may be for less than what accrued) while `segments` and
 * `daysLate` still describe how that accrual was reached. "Réclamer" opens an
 * editable amount pre-filled with the full accrued total; "Renoncer" asks for
 * confirmation before waiving a claimed penalty.
 *
 * @param invoiceId - The invoice this penalty belongs to.
 * @param dueDate - The invoice's due date (ISO), used only as a fallback for
 *   the days-late count when no breakdown is available.
 * @param lateFeeAccrued - The live, not-yet-claimed preview total.
 * @param lateFeeDue - The frozen amount owed once claimed.
 * @param lateFeeClaimedAt - ISO timestamp of the claim, or `null`.
 * @param lateFeeWaived - Whether a claimed penalty was given up.
 * @param lateFeeBreakdown - The server-computed days-late, flat/interest
 *   split and per-period segments, or `null` when nothing ever accrued.
 */
export function LateFeePanel(props: LateFeePanelProps) {
  const {
    invoiceId,
    dueDate,
    lateFeeAccrued,
    lateFeeDue,
    lateFeeClaimedAt,
    lateFeeBreakdown,
  } = props
  const fieldId = useId()
  const [expanded, setExpanded] = useState(false)
  const [claimOpen, setClaimOpen] = useState(false)
  const [confirmWaive, setConfirmWaive] = useState(false)
  const [claimAmount, setClaimAmount] = useState(lateFeeAccrued)
  const { toast } = useToast()
  const claim = useClaimLateFee(invoiceId)
  const waive = useWaiveLateFee(invoiceId)

  const state = resolveState(props)
  if (state === "none") return null

  const breakdownFixed = lateFeeBreakdown?.fixed ?? 0
  const breakdownInterest = lateFeeBreakdown?.interest ?? 0
  const daysLate =
    lateFeeBreakdown?.daysLate ??
    daysLateAsOf(
      dueDate,
      lateFeeClaimedAt ? new Date(lateFeeClaimedAt) : new Date(),
    )

  function openClaim() {
    setClaimAmount(lateFeeAccrued)
    setClaimOpen(true)
  }

  function submitClaim() {
    if (claimAmount <= 0 || claimAmount > lateFeeAccrued + CAP_EPSILON) {
      toast({
        variant: "error",
        title: "Montant invalide",
        description: `Le montant doit être compris entre 0 et ${fmtEUR(lateFeeAccrued)}.`,
      })
      return
    }
    const fixedToSend = round2(Math.min(breakdownFixed, claimAmount))
    const interestToSend = round2(Math.max(0, claimAmount - fixedToSend))
    claim.mutate(
      { fixed: fixedToSend, interest: interestToSend },
      {
        onSuccess: () => {
          toast({ variant: "success", title: "Pénalité réclamée" })
          setClaimOpen(false)
        },
        onError: (e) =>
          toast({
            variant: "error",
            title: "Erreur",
            description: e instanceof Error ? e.message : String(e),
          }),
      },
    )
  }

  function submitWaive() {
    waive.mutate(undefined, {
      onSuccess: () => {
        toast({ variant: "success", title: "Pénalité renoncée" })
        setConfirmWaive(false)
      },
      onError: (e) =>
        toast({
          variant: "error",
          title: "Erreur",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  const amountColor =
    state === "claimed"
      ? "var(--danger)"
      : state === "accruing"
        ? "var(--warn)"
        : "var(--text-2)"

  return (
    <div className="col gap-6">
      <div className="row" style={{ justifyContent: "space-between", padding: "4px 0" }}>
        <button
          type="button"
          className="row gap-4"
          onClick={() => setExpanded((v) => !v)}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            color: "inherit",
          }}
        >
          <Icon
            name={expanded ? "chevron-down" : "chevron-right"}
            size={12}
            className="muted"
          />
          <span className={state === "claimed" ? "strong small" : "small muted"}>
            Pénalité de retard
          </span>
        </button>
        <span className="num" style={{ color: amountColor }}>
          {state === "waived" ? "Renoncée" : fmtEUR(state === "claimed" ? lateFeeDue : lateFeeAccrued)}
          {state === "accruing" && (
            <span className="xs muted" style={{ marginLeft: 6 }}>
              non réclamée
            </span>
          )}
        </span>
      </div>

      {expanded && (
        <div
          className="col gap-4"
          style={{ padding: "8px 10px", background: "var(--bg-2)", borderRadius: 8 }}
        >
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="xs muted">Jours de retard</span>
            <span className="xs num">{daysLate} j</span>
          </div>
          {lateFeeBreakdown ? (
            <>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="xs muted">Indemnité forfaitaire</span>
                <span className="xs num">{fmtEUR(breakdownFixed)}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="xs muted">Intérêts de retard</span>
                <span className="xs num">{fmtEUR(breakdownInterest)}</span>
              </div>
              {state === "claimed" && lateFeeClaimedAt && (
                <div className="row" style={{ justifyContent: "space-between" }}>
                  <span className="xs muted">Réclamée le</span>
                  <span className="xs">{fmtDate(lateFeeClaimedAt)}</span>
                </div>
              )}
              {lateFeeBreakdown.segments.length > 0 && (
                <div
                  className="col gap-4"
                  style={{
                    marginTop: 2,
                    paddingTop: 6,
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span
                    className="xs muted"
                    style={{ textTransform: "uppercase", letterSpacing: "0.02em" }}
                  >
                    Détail par période
                  </span>
                  {lateFeeBreakdown.segments.map((segment, i) => (
                    <div
                      key={`${segment.from}-${segment.to}`}
                      className="row"
                      style={{ justifyContent: "space-between", gap: 8 }}
                    >
                      <span className="xs muted">
                        {i + 1}. {fmtDateShort(segment.from)} → {fmtDateShort(segment.to)}
                        {" · "}
                        {segment.days} j sur {fmtEUR(segment.outstanding)}
                      </span>
                      <span className="xs num" style={{ flexShrink: 0 }}>
                        {fmtEUR(segment.interest)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="xs muted" style={{ fontStyle: "italic", marginTop: 2 }}>
              Détail non disponible.
            </div>
          )}
        </div>
      )}

      <div className="row gap-8">
        {(state === "accruing" || state === "waived") && lateFeeAccrued > 0 && (
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={openClaim}
            disabled={claim.isPending}
          >
            <Icon name="euro" size={12} />
            Réclamer
          </button>
        )}
        {state === "claimed" && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setConfirmWaive(true)}
            disabled={waive.isPending}
          >
            Renoncer
          </button>
        )}
      </div>

      {claimOpen && (
        <Modal
          title="Réclamer la pénalité de retard"
          onClose={() => setClaimOpen(false)}
          width={420}
          footer={
            <>
              <button
                className="btn btn-ghost"
                onClick={() => setClaimOpen(false)}
                disabled={claim.isPending}
              >
                Annuler
              </button>
              <button
                className="btn btn-primary"
                onClick={submitClaim}
                disabled={claim.isPending || claimAmount <= 0}
              >
                <Icon name="check" size={14} />
                {claim.isPending ? "…" : "Réclamer"}
              </button>
            </>
          }
        >
          <div className="field">
            <label className="field-label" htmlFor={`${fieldId}-claim-amount`}>
              Montant à réclamer
            </label>
            <input
              id={`${fieldId}-claim-amount`}
              className="input num"
              type="number"
              step="0.01"
              min="0"
              max={lateFeeAccrued}
              value={claimAmount}
              onChange={(e) => setClaimAmount(Number(e.target.value))}
            />
          </div>
          <div className="muted xs" style={{ marginTop: 8 }}>
            Montant théorique accumulé : <span className="num">{fmtEUR(lateFeeAccrued)}</span>.
            Vous pouvez réclamer moins.
          </div>
        </Modal>
      )}

      {confirmWaive && (
        <ConfirmDialog
          title="Renoncer à la pénalité ?"
          description="La pénalité réclamée sera annulée et le montant dû recalculé."
          confirmLabel="Renoncer"
          cancelLabel="Annuler"
          isPending={waive.isPending}
          onCancel={() => setConfirmWaive(false)}
          onConfirm={submitWaive}
        />
      )}
    </div>
  )
}
