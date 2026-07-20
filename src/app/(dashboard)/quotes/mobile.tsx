"use client"

import { useMemo, useState } from "react"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { fmtDate, fmtEUR, initials, avatarColor } from "@/lib/format"
import { useQuotes } from "@/hooks/use-quotes"
import { useClients } from "@/hooks/use-clients"
import { LoadMoreButton } from "@/components/ui/load-more-button"
import { computeQuoteKpis } from "@/domain/quotes/kpis"
import {
  QUOTE_FILTERS,
  QUOTE_PILL_CLASS,
  QUOTE_STATUS_LABEL,
  type QuoteFilterId,
} from "./page"

export function MobileQuotesPage() {
  const [filter, setFilter] = useState<QuoteFilterId>("all")

  const {
    data: quotes = [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useQuotes(filter === "all" ? {} : { status: filter })
  const { data: clients = [] } = useClients()

  const kpis = useMemo(() => computeQuoteKpis(quotes), [quotes])

  const sorted = useMemo(
    () =>
      [...quotes].sort(
        (a, b) =>
          new Date(b.issueDate).getTime() - new Date(a.issueDate).getTime(),
      ),
    [quotes],
  )

  return (
    <div className="m-screen">
      <MobileTopbar title="Devis" />

      <div className="m-content">
        <div className="m-stack" style={{ paddingTop: 8 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div className="kpi-tile accent">
              <div className="kpi-label">
                <Icon name="check" size={11} />
                Taux de signature
              </div>
              <div className="kpi-value num">{kpis.winRate}%</div>
            </div>
            <div className="kpi-tile info">
              <div className="kpi-label">
                <Icon name="euro" size={11} />
                Pipeline
              </div>
              <div className="kpi-value num">{fmtEUR(kpis.pipelineValue)}</div>
            </div>
          </div>

          <div className="chip-row">
            {QUOTE_FILTERS.map((f) => (
              <button
                key={f.id}
                type="button"
                className={"chip" + (filter === f.id ? " active" : "")}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="col gap-8">
            {sorted.length === 0 && (
              <div className="empty">
                <div className="empty-title">Aucun devis</div>
              </div>
            )}
            {sorted.map((q) => {
              const c = clients.find((cl) => cl.id === q.clientId)
              return (
                <div key={q.id} className="card card-tight">
                  <div className="row gap-10">
                    <div
                      className="av av-sm"
                      style={{
                        background:
                          c?.color ??
                          avatarColor(
                            `${c?.firstName ?? ""}${c?.lastName ?? ""}`,
                          ),
                      }}
                    >
                      {initials(`${c?.firstName ?? ""} ${c?.lastName ?? ""}`)}
                    </div>
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="mono small strong truncate">
                        {q.number}
                      </div>
                      <div className="xs muted truncate">
                        {c?.company ??
                          `${c?.firstName ?? ""} ${c?.lastName ?? ""}`}
                      </div>
                    </div>
                    <span className={QUOTE_PILL_CLASS[q.status]}>
                      {QUOTE_STATUS_LABEL[q.status]}
                    </span>
                  </div>

                  <div className="divider" style={{ margin: "10px 0" }} />

                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <div className="xs muted">
                      Émis le {fmtDate(q.issueDate)}
                      {q.validUntil
                        ? ` · valable jusqu'au ${fmtDate(q.validUntil)}`
                        : ""}
                    </div>
                    <div className="num strong small">{fmtEUR(q.total)}</div>
                  </div>

                  {q.externalUrl && (
                    <a
                      className="btn btn-secondary btn-sm"
                      style={{ marginTop: 10 }}
                      href={q.externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Icon name="link" size={12} />
                      Voir sur Abby
                    </a>
                  )}
                </div>
              )
            })}
          </div>

          <LoadMoreButton
            hasMore={hasNextPage}
            isLoading={isFetchingNextPage}
            onClick={() => fetchNextPage()}
          />
        </div>
      </div>
    </div>
  )
}
