"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Modal } from "@/components/ui/modal"
import { Icon } from "@/components/ui/icon"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import { fmtDate, fmtEUR, initials, avatarColor } from "@/lib/format"
import { useQuote, useSetQuoteStatus, useDeleteQuote } from "@/hooks/use-quotes"
import type { QuoteStatus } from "@/domain/quotes/types"
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton"

interface QuoteDrawerProps {
  quoteId: string
  onClose: () => void
}

const PILL_CLASS: Record<QuoteStatus, string> = {
  DRAFT: "pill pill-draft",
  SENT: "pill pill-sent",
  ACCEPTED: "pill pill-paid",
  REFUSED: "pill pill-overdue",
  EXPIRED: "pill pill-pending",
}

const STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
}

/**
 * Read-only detail drawer for a devis (quote) with status actions.
 *
 * The devis document is emitted by Abby.fr; this drawer only tracks status
 * (send/accept/refuse), edits our local mirror, or deletes it. No PDF or
 * send-to-client action lives here.
 *
 * @param quoteId Quote id to load and display.
 * @param onClose Called on backdrop click, Escape, close button, or delete.
 */
export function QuoteDrawer({ quoteId, onClose }: QuoteDrawerProps) {
  const router = useRouter()
  const { data: quote, isLoading } = useQuote(quoteId)
  const setStatus = useSetQuoteStatus()
  const deleteQuote = useDeleteQuote()
  const [confirmDelete, setConfirmDelete] = useState(false)

  if (isLoading || !quote) {
    return (
      <Modal title="Devis" onClose={onClose} width={680}>
        <div role="status" aria-live="polite">
          <span className="sr-only">Chargement en cours…</span>
          <div className="row gap-12" style={{ marginBottom: 16 }}>
            <Skeleton width={40} height={40} radius={10} />
            <div className="grow" style={{ minWidth: 0 }}>
              <Skeleton width="45%" height={14} />
              <div style={{ marginTop: 6 }}>
                <Skeleton width="30%" height={11} />
              </div>
            </div>
            <Skeleton width={78} height={22} radius={99} />
          </div>
          <div className="card card-tight">
            {Array.from({ length: 4 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      </Modal>
    )
  }

  const client = quote.client
  const busy = setStatus.isPending || deleteQuote.isPending

  const footer = (
    <>
      <button
        className="btn btn-ghost"
        onClick={() => router.push(`/quotes/${quoteId}/edit`)}
        disabled={busy}
      >
        <Icon name="edit" size={14} />
        Modifier
      </button>
      {quote.status === "DRAFT" && (
        <button
          className="btn btn-secondary"
          onClick={() => setStatus.mutate({ id: quoteId, status: "SENT" })}
          disabled={busy}
        >
          <Icon name="send" size={14} />
          Marquer envoyé
        </button>
      )}
      {quote.status === "SENT" && (
        <>
          <button
            className="btn btn-ghost"
            onClick={() => setStatus.mutate({ id: quoteId, status: "REFUSED" })}
            disabled={busy}
          >
            <Icon name="x" size={14} />
            Marquer refusé
          </button>
          <button
            className="btn btn-primary"
            onClick={() =>
              setStatus.mutate({ id: quoteId, status: "ACCEPTED" })
            }
            disabled={busy}
          >
            <Icon name="check" size={14} />
            Marquer accepté
          </button>
        </>
      )}
      <button
        className="btn btn-ghost"
        style={{ color: "var(--danger)" }}
        onClick={() => setConfirmDelete(true)}
        disabled={busy}
      >
        <Icon name="trash" size={14} />
        Supprimer
      </button>
    </>
  )

  return (
    <Modal
      title={quote.number}
      onClose={onClose}
      width={680}
      footer={footer}
      bodyStyle={{ padding: 0, gap: 0, overflow: "hidden" }}
    >
      <div
        style={{
          flexShrink: 0,
          padding: "16px 24px 0",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <div className="row gap-8">
          <span className={PILL_CLASS[quote.status]}>
            {STATUS_LABEL[quote.status]}
          </span>
          <span className="muted xs" style={{ marginLeft: "auto" }}>
            Émis le {fmtDate(quote.issueDate)}
            {quote.validUntil
              ? ` · valable jusqu'au ${fmtDate(quote.validUntil)}`
              : ""}
          </span>
          {quote.externalUrl && (
            <a
              className="btn btn-ghost btn-sm"
              href={quote.externalUrl}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Icon name="link" size={12} />
              Voir sur Abby
            </a>
          )}
        </div>
        <div
          className="row gap-12"
          role="link"
          tabIndex={0}
          onClick={() => router.push(`/clients/${client.id}`)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault()
              router.push(`/clients/${client.id}`)
            }
          }}
          style={{
            padding: 12,
            background: "var(--bg-2)",
            borderRadius: 8,
            cursor: "pointer",
          }}
        >
          <div
            className="av av-lg"
            style={{
              background:
                client.color ??
                avatarColor(`${client.firstName}${client.lastName}`),
            }}
          >
            {initials(`${client.firstName} ${client.lastName}`)}
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong">
              {client.company ?? `${client.firstName} ${client.lastName}`}
            </div>
            <div className="muted small">
              {client.company
                ? `${client.firstName} ${client.lastName}`
                : "—"}
            </div>
          </div>
          <Icon
            name="chevron-right"
            size={16}
            style={{ color: "var(--text-3)", flexShrink: 0 }}
          />
        </div>
        {quote.notes && (
          <div className="muted xs" style={{ whiteSpace: "pre-wrap" }}>
            {quote.notes}
          </div>
        )}
        <div
          className="card-title"
          style={{ marginBottom: 0, paddingBottom: 10 }}
        >
          <span>Lignes</span>
        </div>
      </div>

      <div
        style={{
          flex: 1,
          minHeight: 0,
          overflowY: "auto",
          padding: "0 24px 14px",
        }}
      >
        <div
          className="card"
          style={{
            padding: 0,
            borderTop: "none",
            borderTopLeftRadius: 0,
            borderTopRightRadius: 0,
          }}
        >
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 14 }}>Label</th>
                <th className="right">Qté</th>
                <th className="right">PU</th>
                <th className="right" style={{ paddingRight: 14 }}>
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {quote.lines.map((l) => (
                <tr key={l.id}>
                  <td style={{ paddingLeft: 14 }} className="small">
                    {l.label}
                  </td>
                  <td className="right num small">{l.qty}</td>
                  <td className="right num small">{fmtEUR(l.rate)}</td>
                  <td
                    className="right num strong"
                    style={{ paddingRight: 14 }}
                  >
                    {fmtEUR(l.qty * l.rate)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div
        style={{
          flexShrink: 0,
          padding: "12px 24px 16px",
          borderTop: "1px solid var(--border)",
          background: "var(--bg-1)",
        }}
      >
        <div className="row" style={{ justifyContent: "flex-end" }}>
          <div style={{ minWidth: 240 }}>
            <div
              className="row"
              style={{ justifyContent: "space-between", padding: "8px 0 0" }}
            >
              <span className="strong">Total</span>
              <span className="num strong" style={{ fontSize: 18 }}>
                {fmtEUR(quote.total)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Supprimer ce devis ?"
          description="Cette action est définitive. Le devis Abby reste inchangé."
          confirmLabel="Supprimer"
          danger
          isPending={deleteQuote.isPending}
          icon="trash"
          onCancel={() => setConfirmDelete(false)}
          onConfirm={() =>
            deleteQuote.mutate(quoteId, { onSuccess: onClose })
          }
        />
      )}
    </Modal>
  )
}
