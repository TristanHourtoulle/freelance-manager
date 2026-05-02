"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icon"
import { fmtEUR, initials } from "@/lib/format"
import { useAnalytics, type AnalyticsRange } from "@/hooks/use-analytics"
import {
  ActivityHeatmap,
  Donut,
  DualChart,
  Sparkline,
  ThroughputChart,
} from "@/components/analytics/charts"
import dynamic from "next/dynamic"
import { useIsMobile } from "@/hooks/use-is-mobile"

const MobileAnalyticsPage = dynamic(
  () => import("./mobile").then((m) => m.MobileAnalyticsPage),
  { ssr: false, loading: () => <div className="empty">Chargement…</div> },
)

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

export default function AnalyticsPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileAnalyticsPage />
  return <DesktopAnalyticsPage />
}

function DesktopAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("12m")
  const { data, isLoading } = useAnalytics(range)

  const monthsCount = range === "3m" ? 3 : range === "6m" ? 6 : 12

  if (isLoading || !data) {
    return (
      <div className="page" style={{ maxWidth: 1500 }}>
        <div className="page-header">
          <div>
            <h1 className="page-title">Analytics</h1>
            <div className="page-sub">Chargement…</div>
          </div>
        </div>
      </div>
    )
  }

  const { kpi, months, byClient, byType, weeks, heatmap } = data
  const trendUp = kpi.trend >= 0
  const totalByType = byType.reduce((s, b) => s + b.revenue, 0)

  const topMax = byClient[0]?.revenue ?? 1

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <div className="page-header">
        <div>
          <h1 className="page-title">Analytics</h1>
          <div className="page-sub">
            Performances financières · {monthsCount} derniers mois
          </div>
        </div>
        <div className="page-actions row gap-12">
          <div className="ana-rangepicker">
            {(["3m", "6m", "12m"] as AnalyticsRange[]).map((r) => (
              <button
                key={r}
                className={range === r ? "active" : ""}
                onClick={() => setRange(r)}
                type="button"
              >
                {r === "3m" ? "3 mois" : r === "6m" ? "6 mois" : "12 mois"}
              </button>
            ))}
          </div>
          <button className="btn btn-secondary" type="button">
            <Icon name="download" size={14} />
            Export
          </button>
        </div>
      </div>

      <div className="ana-hero">
        <div className="ana-hero-content">
          <div>
            <div className="row gap-8" style={{ marginBottom: 6 }}>
              <span className="auth-eyebrow" style={{ margin: 0 }}>
                <Icon name="chart" size={11} />
                Revenu total · {monthsCount}M
              </span>
              <span className={"kpi-trend " + (trendUp ? "up" : "down")}>
                <Icon name={trendUp ? "arrow-up" : "arrow-down"} size={10} />
                {trendUp ? "+" : ""}
                {kpi.trend}%
              </span>
            </div>
            <h2 className="ana-headline">Tu encaisses</h2>
            <div className="ana-bigfig">{fmtEUR(kpi.totalRevenue)}</div>
            <div
              className="small muted"
              style={{
                marginTop: 14,
                display: "flex",
                flexWrap: "wrap",
                gap: "6px 16px",
              }}
            >
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <Icon name="euro" size={11} /> Moyenne {fmtEUR(kpi.avgRevenue)}
                /mois
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <Icon name="clock" size={11} /> Délai moyen de paiement{" "}
                {kpi.avgDelay}j
              </span>
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  whiteSpace: "nowrap",
                }}
              >
                <Icon name="invoice" size={11} /> {kpi.paidCount} factures
                payées
              </span>
            </div>
          </div>
          <Sparkline data={months.map((m) => m.paid)} />
        </div>
      </div>

      <div className="ana-grid" style={{ marginBottom: 16 }}>
        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Revenu vs Facturation</h3>
              <div className="ana-card-sub">
                Comparaison mensuelle · payé (encaissé) vs émis
              </div>
            </div>
            <div className="legend">
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "var(--accent)" }}
                />
                Payé
              </span>
              <span>
                <span
                  className="legend-dot"
                  style={{ background: "var(--info)" }}
                />
                Émis
              </span>
            </div>
          </div>
          <DualChart months={months} />
        </div>
      </div>

      <div className="ana-grid ana-grid-3" style={{ marginBottom: 16 }}>
        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Top clients</h3>
              <div className="ana-card-sub">Revenu cumulé par client</div>
            </div>
          </div>
          <div>
            {byClient.length === 0 && (
              <div className="muted small" style={{ padding: "10px 0" }}>
                Pas encore de paiements encaissés.
              </div>
            )}
            {byClient.map((x, i) => (
              <div key={x.client.id} className="top-row">
                <div
                  className="av av-sm"
                  style={{
                    background: x.client.color ?? "var(--bg-3)",
                  }}
                >
                  {initials(`${x.client.firstName} ${x.client.lastName}`)}
                </div>
                <div>
                  <div className="strong small">
                    {x.client.company ??
                      `${x.client.firstName} ${x.client.lastName}`}
                  </div>
                  <div className="xs muted">
                    {x.client.firstName} {x.client.lastName}
                  </div>
                </div>
                <div className="top-bar-bg" style={{ width: 100 }}>
                  <div
                    className="top-bar-fill"
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
                <div
                  className="num strong"
                  style={{ minWidth: 80, textAlign: "right" }}
                >
                  {fmtEUR(x.revenue)}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Mix par type</h3>
              <div className="ana-card-sub">Part de revenu</div>
            </div>
          </div>
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

        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Métriques clés</h3>
              <div className="ana-card-sub">Sur la période</div>
            </div>
          </div>
          <div>
            <div className="ana-metric">
              <div className="ana-metric-row">
                <span className="ana-metric-label">
                  Délai moyen de paiement
                </span>
                <span className="ana-metric-value">
                  {kpi.avgDelay} <span className="muted small">j</span>
                </span>
              </div>
            </div>
            <div className="ana-metric">
              <div className="ana-metric-row">
                <span className="ana-metric-label">Panier moyen / facture</span>
                <span className="ana-metric-value">
                  {fmtEUR(kpi.avgInvoice)}
                </span>
              </div>
              <div className="row gap-4 xs muted">
                {kpi.paidCount} facture{kpi.paidCount > 1 ? "s" : ""} payée
                {kpi.paidCount > 1 ? "s" : ""}
              </div>
            </div>
            <div className="ana-metric">
              <div className="ana-metric-row">
                <span className="ana-metric-label">Taux de conversion</span>
                <span className="ana-metric-value">{kpi.conversion}%</span>
              </div>
              <div className="row gap-4 xs muted">
                tasks done → factures payées
              </div>
            </div>
            <div className="ana-metric">
              <div className="ana-metric-row">
                <span className="ana-metric-label">Run-rate annuel</span>
                <span className="ana-metric-value">{fmtEUR(kpi.runRate)}</span>
              </div>
              <div className="row gap-4 xs muted">Sur la moyenne récente</div>
            </div>
          </div>
        </div>
      </div>

      <div className="ana-grid ana-grid-2">
        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Throughput tasks</h3>
              <div className="ana-card-sub">
                Tasks terminées vs facturées · 12 dernières semaines
              </div>
            </div>
            <div className="legend">
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
          </div>
          <ThroughputChart weeks={weeks} />
        </div>

        <div className="ana-card">
          <div className="ana-card-head">
            <div>
              <h3 className="ana-card-title">Activité hebdomadaire</h3>
              <div className="ana-card-sub">Heatmap tasks terminées</div>
            </div>
          </div>
          <ActivityHeatmap
            rows={heatmap}
            weekLabels={weeks.map((w, i) => (i % 3 === 0 ? w.label : ""))}
          />
        </div>
      </div>
    </div>
  )
}
