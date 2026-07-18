"use client"

import { Suspense, useMemo } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { fmtEUR } from "@/lib/format"
import { useInvoiceBuilder } from "@/features/billing/use-invoice-builder"
import {
  DepositCard,
  EligibleTaskColumn,
  InvoiceLinesPanel,
} from "@/features/billing/invoice-builder-parts"
import { CreateInvoiceConfigCard } from "@/features/billing/create-invoice-config-card"
import { SplitDialog } from "@/components/billing/split-dialog"

export default function NewInvoicePage() {
  return (
    <Suspense fallback={<div className="empty">Chargement…</div>}>
      <NewInvoicePageContent />
    </Suspense>
  )
}

function NewInvoicePageContent() {
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
  const { client, clientId, kind, lines, effectiveTotal } = b

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push("/billing")}
        >
          <Icon name="chevron-left" size={12} />
          Factures
        </button>
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle facture</h1>
          <div className="page-sub">
            Sélectionne un client, puis glisse des tasks Linear ou ajoute des
            lignes manuelles (utile pour la facturation rétroactive)
          </div>
        </div>
      </div>

      <CreateInvoiceConfigCard builder={b} />

      {!clientId ? (
        <div className="card">
          <div className="empty">
            <div className="empty-title">Choisis un client pour commencer</div>
            <div>
              Les tasks éligibles apparaîtront à gauche, le récap de la facture
              à droite.
            </div>
          </div>
        </div>
      ) : kind === "DEPOSIT" ? (
        <DepositCard
          builder={b}
          extraField={
            client?.billingMode === "FIXED" && (
              <div
                className="row gap-8 small"
                style={{
                  padding: 10,
                  background: "var(--info-soft)",
                  borderRadius: 7,
                }}
              >
                <Icon name="info" size={14} style={{ color: "var(--info)" }} />
                <span>
                  Forfait projet : {fmtEUR(client.fixedPrice)}
                  {client.deposit
                    ? ` · acompte suggéré ${fmtEUR(client.deposit)}`
                    : ""}
                </span>
                {client.deposit && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: "auto" }}
                    onClick={() => b.setDepositAmount(client.deposit!)}
                  >
                    Utiliser
                  </button>
                )}
              </div>
            )
          }
          actions={
            <div
              className="row gap-8"
              style={{ marginTop: 18, justifyContent: "space-between" }}
            >
              <button
                className="btn btn-secondary"
                disabled={!effectiveTotal || b.isPending}
                onClick={() => b.setShowSplit(true)}
              >
                <Icon name="grid" size={14} />
                Diviser en plusieurs
              </button>
              <div className="row gap-8">
                <button
                  className="btn btn-secondary"
                  disabled={!effectiveTotal || b.isPending}
                  onClick={() => b.submit("DRAFT")}
                >
                  Sauver brouillon
                </button>
                <button
                  className="btn btn-primary"
                  disabled={!effectiveTotal || b.isPending}
                  onClick={() => b.submit("SENT")}
                >
                  <Icon name="send" size={14} />
                  Émettre
                </button>
              </div>
            </div>
          }
        />
      ) : (
        <div className="builder">
          <EligibleTaskColumn
            builder={b}
            beforeList={
              b.eligibleTasks.length === 0 &&
              lines.length === 0 && (
                <div className="card">
                  <div className="empty">
                    <div className="empty-title">Aucune task à facturer</div>
                    <div>
                      {b.taskSearch
                        ? "Aucune task ne correspond à ta recherche."
                        : "Ce client n'a pas de task en statut Pending Invoice. Tu peux quand même créer une facture en ajoutant des lignes manuelles."}
                    </div>
                    {!b.taskSearch && (
                      <button
                        className="btn btn-secondary"
                        style={{ marginTop: 14 }}
                        onClick={b.addBlank}
                      >
                        <Icon name="plus" size={14} />
                        Ajouter une ligne manuelle
                      </button>
                    )}
                  </div>
                </div>
              )
            }
          />

          <InvoiceLinesPanel
            builder={b}
            dropzoneStyle={{
              minHeight: lines.length === 0 ? 200 : "auto",
              maxHeight: lines.length > 0 ? "calc(100vh - 480px)" : undefined,
              overflowY: lines.length > 0 ? "auto" : undefined,
            }}
            emptyHint="ou ajoute une ligne manuelle ci-dessous"
            addLineButton={
              <button
                className="btn btn-secondary"
                style={{
                  marginTop: 10,
                  width: "100%",
                  justifyContent: "center",
                }}
                onClick={b.addBlank}
              >
                <Icon name="plus" size={14} />
                Ajouter une ligne manuelle
              </button>
            }
            actions={
              <div className="col gap-8" style={{ marginTop: 18 }}>
                <div className="row gap-8">
                  <button
                    className="btn btn-secondary"
                    style={{ flex: 1, justifyContent: "center" }}
                    disabled={lines.length === 0 || b.isPending}
                    onClick={() => b.submit("DRAFT")}
                  >
                    Sauver brouillon
                  </button>
                  <button
                    className="btn btn-primary"
                    style={{ flex: 1, justifyContent: "center" }}
                    disabled={lines.length === 0 || b.isPending}
                    onClick={() => b.submit("SENT")}
                  >
                    <Icon name="send" size={14} />
                    Émettre
                  </button>
                </div>
                <button
                  className="btn btn-secondary"
                  disabled={!effectiveTotal || b.isPending}
                  onClick={() => b.setShowSplit(true)}
                >
                  <Icon name="grid" size={14} />
                  Diviser en plusieurs
                </button>
              </div>
            }
          />
        </div>
      )}

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
