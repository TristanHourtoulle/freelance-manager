"use client"

import { Suspense, useMemo, useState } from "react"
import dynamic from "next/dynamic"
import { Icon } from "@/components/ui/icon"
import { fmtDate, fmtEUR, initials, avatarColor } from "@/lib/format"
import { useQuotes, type QuoteStatus } from "@/hooks/use-quotes"
import { useClients } from "@/hooks/use-clients"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { LoadMoreButton } from "@/components/ui/load-more-button"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { computeQuoteKpis } from "@/domain/quotes/kpis"

const MobileQuotesPage = dynamic(
  () => import("./mobile").then((m) => m.MobileQuotesPage),
  {
    ssr: false,
    loading: () => <MobilePageSkeleton title="Devis" variant="list" />,
  },
)

export type QuoteFilterId = "all" | QuoteStatus

export const QUOTE_FILTERS: { id: QuoteFilterId; label: string }[] = [
  { id: "all", label: "Tous" },
  { id: "DRAFT", label: "Brouillon" },
  { id: "SENT", label: "Envoyé" },
  { id: "ACCEPTED", label: "Accepté" },
  { id: "REFUSED", label: "Refusé" },
  { id: "EXPIRED", label: "Expiré" },
]

export const QUOTE_PILL_CLASS: Record<QuoteStatus, string> = {
  DRAFT: "pill pill-draft",
  SENT: "pill pill-sent",
  ACCEPTED: "pill pill-paid",
  REFUSED: "pill pill-overdue",
  EXPIRED: "pill pill-pending",
}

export const QUOTE_STATUS_LABEL: Record<QuoteStatus, string> = {
  DRAFT: "Brouillon",
  SENT: "Envoyé",
  ACCEPTED: "Accepté",
  REFUSED: "Refusé",
  EXPIRED: "Expiré",
}

export default function QuotesPage() {
  const isMobile = useIsMobile()
  return (
    <Suspense fallback={<PageSkeleton kpis={3} rows={10} />}>
      {isMobile ? <MobileQuotesPage /> : <DesktopQuotesPage />}
    </Suspense>
  )
}

function DesktopQuotesPage() {
  const [filter, setFilter] = useState<QuoteFilterId>("all")
  const [searchTerm, setSearchTerm] = useState("")

  const {
    data: quotes = [],
    isPending,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useQuotes(filter === "all" ? {} : { status: filter })
  const { data: clients = [] } = useClients()

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  )

  const filtered = useMemo(() => {
    if (!searchTerm) return quotes
    const term = searchTerm.toLowerCase()
    return quotes.filter((q) => {
      const c = clientById.get(q.clientId)
      const text =
        `${q.number} ${c?.company ?? ""} ${c?.firstName ?? ""} ${c?.lastName ?? ""}`.toLowerCase()
      return text.includes(term)
    })
  }, [quotes, clientById, searchTerm])

  const kpis = useMemo(() => computeQuoteKpis(quotes), [quotes])

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Devis</h1>
          <div className="page-sub">
            Suivi commercial · le document est émis depuis Abby
          </div>
        </div>
      </div>

      <div
        className="kpi-grid"
        style={{ gridTemplateColumns: "repeat(3, 1fr)" }}
      >
        <div className="kpi kpi-accent">
          <div className="kpi-label">
            <Icon name="check" size={11} />
            Taux de signature
          </div>
          <div className="kpi-value num">{kpis.winRate}%</div>
        </div>
        <div className="kpi kpi-info">
          <div className="kpi-label">
            <Icon name="clock" size={11} />
            Délai de décision
          </div>
          <div className="kpi-value num">{kpis.avgDecisionDays} j</div>
        </div>
        <div className="kpi">
          <div className="kpi-label">
            <Icon name="euro" size={11} />
            Pipeline
          </div>
          <div className="kpi-value num">{fmtEUR(kpis.pipelineValue)}</div>
        </div>
      </div>

      <div
        className="row gap-12"
        style={{ marginBottom: 18, justifyContent: "space-between" }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Icon
            name="search"
            size={14}
            className="muted"
            style={{ position: "absolute", left: 12, top: 10 }}
          />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Rechercher devis, client…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="chip-row">
          {QUOTE_FILTERS.map((f) => (
            <button
              key={f.id}
              className={"chip" + (filter === f.id ? " active" : "")}
              onClick={() => setFilter(f.id)}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Numéro</th>
              <th>Client</th>
              <th>Émis le</th>
              <th>Valable jusqu&apos;au</th>
              <th>Statut</th>
              <th className="right" style={{ paddingRight: 20 }}>
                Montant
              </th>
            </tr>
          </thead>
          <tbody>
            {!isPending && filtered.length === 0 && (
              <tr>
                <td colSpan={6}>
                  <div className="empty">
                    <div className="empty-title">Aucun devis</div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((q) => {
              const client = clientById.get(q.clientId)
              return (
                <tr key={q.id}>
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row gap-8">
                      <span className="mono small strong">{q.number}</span>
                      {q.externalUrl && (
                        <a
                          className="btn btn-ghost btn-sm"
                          href={q.externalUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Icon name="link" size={12} />
                          Voir sur Abby
                        </a>
                      )}
                    </div>
                    <div className="xs muted" style={{ marginTop: 2 }}>
                      {q.linesCount} ligne{q.linesCount > 1 ? "s" : ""}
                    </div>
                  </td>
                  <td>
                    {client && (
                      <div className="row gap-8">
                        <div
                          className="av av-sm"
                          style={{
                            background:
                              client.color ??
                              avatarColor(
                                `${client.firstName}${client.lastName}`,
                              ),
                          }}
                        >
                          {initials(`${client.firstName} ${client.lastName}`)}
                        </div>
                        <span className="small">
                          {client.company ??
                            `${client.firstName} ${client.lastName}`}
                        </span>
                      </div>
                    )}
                  </td>
                  <td className="muted small">{fmtDate(q.issueDate)}</td>
                  <td className="muted small">
                    {q.validUntil ? fmtDate(q.validUntil) : "—"}
                  </td>
                  <td>
                    <span className={QUOTE_PILL_CLASS[q.status]}>
                      {QUOTE_STATUS_LABEL[q.status]}
                    </span>
                  </td>
                  <td className="right num" style={{ paddingRight: 20 }}>
                    {fmtEUR(q.total)}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <LoadMoreButton
        hasMore={hasNextPage}
        isLoading={isFetchingNextPage}
        onClick={() => fetchNextPage()}
      />
    </div>
  )
}
