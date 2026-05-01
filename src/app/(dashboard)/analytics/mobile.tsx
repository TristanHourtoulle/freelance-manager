"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { fmtEUR, initials, avatarColor } from "@/lib/format"
import { useAnalytics, type AnalyticsRange } from "@/hooks/use-analytics"
import {
  Donut,
  Sparkline,
  ThroughputChart,
} from "@/components/analytics/charts"

const TYPE_LABEL: Record<"DAILY" | "FIXED" | "HOURLY", string> = {
  DAILY: "TJM",
  FIXED: "Forfait",
  HOURLY: "Horaire",
}
const TYPE_COLOR: Record<"DAILY" | "FIXED" | "HOURLY", string> = {
  DAILY: "oklch(0.86 0.19 128)",
  FIXED: "oklch(0.75 0.15 300)",
  HOURLY: "oklch(0.78 0.13 180)",
}

export function MobileAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("12m")
  const { data, isLoading } = useAnalytics(range)
  const monthsCount = range === "3m" ? 3 : range === "6m" ? 6 : 12

  if (isLoading || !data) {
    return (
      <div className="m-screen">
        <MobileTopbar title="Analytics" back="/more" />
        <div className="m-content">
          <div className="empty">Chargement…</div>
        </div>
      </div>
    )
  }

  const { kpi, months, byClient, byType, weeks } = data
  const trendUp = kpi.trend >= 0
  const totalByType = byType.reduce((s, b) => s + b.revenue, 0)
  const topMax = byClient[0]?.revenue ?? 1

  return (
    <div className="m-screen">
      <MobileTopbar
        title="Analytics"
        back="/more"
        action={
          <button type="button" className="m-topbar-action" aria-label="Export">
            <Icon name="download" size={15} />
          </button>
        }
      />

      <div className="m-content">
        <div className="big-header">
          <div className="big-title">Performances</div>
          <div className="big-sub">{monthsCount} derniers mois</div>
        </div>

        <div className="m-stack">
          <div className="ana-rangepicker" style={{ alignSelf: "flex-start" }}>
            {(["3m", "6m", "12m"] as AnalyticsRange[]).map((r) => (
              <button
                key={r}
                type="button"
                className={range === r ? "active" : ""}
                onClick={() => setRange(r)}
              >
                {r === "3m" ? "3 mois" : r === "6m" ? "6 mois" : "12 mois"}
              </button>
            ))}
          </div>

          <div
            className="card"
            style={{
              background: "linear-gradient(180deg, var(--bg-1), var(--bg-2))",
              borderLeft: "2px solid var(--accent)",
            }}
          >
            <div className="row" style={{ justifyContent: "space-between" }}>
              <div className="card-title" style={{ marginBottom: 0 }}>
                Revenu cumulé
              </div>
              <span className={"kpi-trend " + (trendUp ? "up" : "down")}>
                <Icon name={trendUp ? "arrow-up" : "arrow-down"} size={9} />
                {trendUp ? "+" : ""}
                {kpi.trend}%
              </span>
            </div>
            <div className="num strong" style={{ fontSize: 32, marginTop: 8 }}>
              {fmtEUR(kpi.totalRevenue)}
            </div>
            <div
              className="xs muted"
              style={{ marginTop: 6, marginBottom: 12 }}
            >
              Moyenne {fmtEUR(kpi.avgRevenue)}/mois · {kpi.paidCount} factures
              payées
            </div>
            <Sparkline
              data={months.map((m) => m.paid)}
              width={320}
              height={64}
            />
          </div>

          <div className="card">
            <div className="card-title">Top clients</div>
            <div className="col gap-12">
              {byClient.length === 0 && (
                <div className="muted small">
                  Pas encore de paiements encaissés.
                </div>
              )}
              {byClient.map((x, i) => (
                <div key={x.client.id} className="row gap-10">
                  <div
                    className="av av-sm"
                    style={{
                      background:
                        x.client.color ??
                        avatarColor(
                          `${x.client.firstName}${x.client.lastName}`,
                        ),
                    }}
                  >
                    {initials(`${x.client.firstName} ${x.client.lastName}`)}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">
                      {x.client.company ??
                        `${x.client.firstName} ${x.client.lastName}`}
                    </div>
                    <div className="pbar" style={{ marginTop: 4 }}>
                      <span
                        style={{
                          width: `${(x.revenue / topMax) * 100}%`,
                          background:
                            i === 0
                              ? "var(--accent)"
                              : i === 1
                                ? "var(--info)"
                                : "var(--purple)",
                        }}
                      />
                    </div>
                  </div>
                  <div
                    className="num strong small"
                    style={{ minWidth: 80, textAlign: "right" }}
                  >
                    {fmtEUR(x.revenue)}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="card">
            <div className="card-title">Mix par type</div>
            <Donut
              segments={byType.map((b) => ({
                label: TYPE_LABEL[b.type],
                value: b.revenue,
                color: TYPE_COLOR[b.type],
              }))}
              total={totalByType}
              format={fmtEUR}
            />
          </div>

          <div className="card">
            <div className="card-title">Métriques clés</div>
            <div className="col gap-8">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small muted">Délai moyen paiement</span>
                <span className="num strong">
                  {kpi.avgDelay} <span className="muted small">j</span>
                </span>
              </div>
              <div className="divider" style={{ margin: 0 }} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small muted">Panier moyen</span>
                <span className="num strong">{fmtEUR(kpi.avgInvoice)}</span>
              </div>
              <div className="divider" style={{ margin: 0 }} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small muted">Taux de conversion</span>
                <span className="num strong">{kpi.conversion}%</span>
              </div>
              <div className="divider" style={{ margin: 0 }} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small muted">Run-rate annuel</span>
                <span className="num strong" style={{ color: "var(--accent)" }}>
                  {fmtEUR(kpi.runRate)}
                </span>
              </div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>Throughput tasks</span>
            </div>
            <div className="legend" style={{ marginBottom: 12 }}>
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "var(--accent)" }}
                />
                Done
              </span>
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "var(--purple)" }}
                />
                Facturée
              </span>
            </div>
            <ThroughputChart weeks={weeks} />
          </div>
        </div>
      </div>
    </div>
  )
}
