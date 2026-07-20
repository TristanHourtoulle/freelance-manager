"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import {
  fmtEUR,
  fmtRatio,
  fmtSharePct,
  initials,
  avatarColor,
} from "@/lib/format"
import {
  useAnalytics,
  type AnalyticsRange,
  type ClientCategoryKey,
} from "@/hooks/use-analytics"
import {
  Donut,
  Sparkline,
  ThroughputChart,
} from "@/components/analytics/charts"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"

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

const CATEGORY_LABEL: Record<ClientCategoryKey, string> = {
  FREELANCE: "Freelance",
  STUDY: "Études",
  PERSONAL: "Perso",
  SIDE_PROJECT: "Side project",
}

function concentrationColor(
  level: "ok" | "warn" | "danger",
): string | undefined {
  if (level === "danger") return "var(--danger)"
  if (level === "warn") return "var(--warn)"
  return undefined
}

function accuracyColor(ratio: number | null): string | undefined {
  if (ratio === null) return undefined
  if (ratio > 1.3) return "var(--danger)"
  if (ratio > 1.1) return "var(--warn)"
  return undefined
}

function nonFreelanceColor(share: number | null): string | undefined {
  return share !== null && share >= 0.3 ? "var(--warn)" : undefined
}

export function MobileAnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>("12m")
  const { data, isLoading } = useAnalytics(range)
  const monthsCount = range === "3m" ? 3 : range === "6m" ? 6 : 12

  if (isLoading || !data) {
    return (
      <MobilePageSkeleton
        title="Analytics"
        variant="list"
        rows={4}
        back="/more"
      />
    )
  }

  const {
    kpi,
    months,
    byClient,
    byType,
    weeks,
    concentration,
    estimateAccuracy,
    categoryMix,
  } = data
  const accuracy = estimateAccuracy.overall
  const nonFreelanceRows = categoryMix.rows.filter(
    (r) => r.category !== "FREELANCE",
  )
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
            <div
              className="xs muted"
              style={{ marginTop: -6, marginBottom: 10 }}
            >
              Revenu cumulé · part du revenu total · TJM effectif estimé
            </div>
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
                    <div className="xs muted">
                      {fmtSharePct(x.revenueShare)} du revenu
                      {x.revenueShare !== null &&
                        x.daysShare !== null &&
                        Math.abs(x.daysShare - x.revenueShare) > 0.1 && (
                          <span style={{ color: "var(--warn)" }}>
                            {" "}
                            · {fmtSharePct(x.daysShare)} du temps
                          </span>
                        )}
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
                  <div style={{ minWidth: 88, textAlign: "right" }}>
                    <div className="num strong small">{fmtEUR(x.revenue)}</div>
                    <div className="xs muted num">
                      {x.effectiveRate !== null
                        ? `${fmtEUR(x.effectiveRate)}/j`
                        : "—"}
                    </div>
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
            <div className="card-title">Signaux</div>
            <div className="col gap-8">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small muted grow">Concentration client</span>
                <span
                  className="num strong"
                  style={{ color: concentrationColor(concentration.level) }}
                >
                  {fmtSharePct(concentration.topClientShare)}
                </span>
              </div>
              <div className="xs muted">
                top 3 : {fmtSharePct(concentration.topThreeShare)}
              </div>
              <div className="divider" style={{ margin: 0 }} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small muted grow">
                  Précision des estimations
                </span>
                <span
                  className="num strong"
                  style={{
                    color: accuracy.reliable
                      ? accuracyColor(accuracy.ratio)
                      : undefined,
                  }}
                >
                  {accuracy.reliable ? fmtRatio(accuracy.ratio) : "—"}
                </span>
              </div>
              <div className="xs muted">
                {accuracy.reliable
                  ? `${accuracy.n} tasks mesurées · ${fmtSharePct(accuracy.coverage)} de couverture`
                  : `Pas assez de données (${accuracy.n}/5 tasks mesurées)`}
              </div>
              <div className="divider" style={{ margin: 0 }} />
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="small muted grow">Effort hors freelance</span>
                <span
                  className="num strong"
                  style={{
                    color: nonFreelanceColor(categoryMix.nonFreelanceDaysShare),
                  }}
                >
                  {fmtSharePct(categoryMix.nonFreelanceDaysShare)}
                </span>
              </div>
              <div className="xs muted">
                {nonFreelanceRows.length === 0
                  ? "Aucun effort hors freelance"
                  : nonFreelanceRows
                      .map((r) => `${CATEGORY_LABEL[r.category]} ${r.days} j`)
                      .join(" · ")}
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
