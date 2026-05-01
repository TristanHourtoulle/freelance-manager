"use client"

import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { fmtEUR, fmtRelative } from "@/lib/format"
import { useDashboard } from "@/hooks/use-dashboard"

export function MobileDashboardPage() {
  const router = useRouter()
  const { data } = useDashboard()

  const kpi = data?.kpi ?? {
    revenueMonth: 0,
    revenueYear: 0,
    paidCount: 0,
    outstanding: 0,
    sentCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    pipelineValue: 0,
    pipelineCount: 0,
  }
  const months = data?.months ?? []
  const overdue = data?.overdue ?? []
  const recentTasks = data?.recentTasks ?? []
  const monthlyTotal = months.reduce((s, m) => s + m.total, 0)

  return (
    <div className="m-screen">
      <MobileTopbar
        title="Pilotage"
        action={
          <button
            type="button"
            className="m-topbar-action"
            onClick={() => router.push("/analytics")}
            aria-label="Analytics"
          >
            <Icon name="chart" size={17} />
          </button>
        }
      />

      <div className="m-content">
        <div className="big-header">
          <div className="big-title">Pilotage</div>
          <div className="big-sub">Vue d&apos;ensemble du mois</div>
        </div>

        <div className="m-stack">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 10,
            }}
          >
            <div className="kpi-tile accent">
              <div className="kpi-label">
                <Icon name="euro" size={11} />
                Mois
              </div>
              <div className="kpi-value">{fmtEUR(kpi.revenueMonth)}</div>
              <div className="kpi-sub muted">{kpi.paidCount} paiements</div>
            </div>
            <div className="kpi-tile info">
              <div className="kpi-label">
                <Icon name="chart" size={11} />
                Année
              </div>
              <div className="kpi-value">{fmtEUR(kpi.revenueYear)}</div>
              <div className="kpi-sub muted">YTD</div>
            </div>
            <div className="kpi-tile warn">
              <div className="kpi-label">
                <Icon name="clock" size={11} />
                Pipeline
              </div>
              <div className="kpi-value">{fmtEUR(kpi.pipelineValue)}</div>
              <div className="kpi-sub muted">
                {kpi.pipelineCount} task
                {kpi.pipelineCount > 1 ? "s" : ""}
              </div>
            </div>
            <div className="kpi-tile danger">
              <div className="kpi-label">
                <Icon name="invoice" size={11} />
                Encours
              </div>
              <div className="kpi-value">{fmtEUR(kpi.outstanding)}</div>
              <div className="kpi-sub muted">{kpi.overdueCount} en retard</div>
            </div>
          </div>

          <div className="card">
            <div className="card-title">
              <span>Revenus mensuels</span>
              <span className="muted xs num">{fmtEUR(monthlyTotal)}</span>
            </div>
            <BarChart
              months={months.map((m) => ({
                label: m.month,
                value: m.total,
                isCurrent: m.isCurrent,
              }))}
            />
          </div>

          {overdue.length > 0 && (
            <div
              className="card"
              style={{ borderLeft: "2px solid var(--danger)" }}
            >
              <div className="row gap-8" style={{ marginBottom: 8 }}>
                <Icon
                  name="alert"
                  size={14}
                  style={{ color: "var(--danger)" }}
                />
                <div className="strong small">
                  {overdue.length} facture{overdue.length > 1 ? "s" : ""} en
                  retard
                </div>
              </div>
              {overdue.slice(0, 2).map((o) => (
                <div
                  key={o.id}
                  className="row gap-8"
                  style={{
                    padding: "8px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="small strong truncate">{o.number}</div>
                    <div className="xs muted">
                      Échue {fmtRelative(o.dueDate)}
                    </div>
                  </div>
                  <div
                    className="num strong"
                    style={{ color: "var(--danger)" }}
                  >
                    {fmtEUR(o.total)}
                  </div>
                </div>
              ))}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                style={{ marginTop: 8, width: "100%" }}
                onClick={() => router.push("/billing?filter=overdue")}
              >
                Tout voir
              </button>
            </div>
          )}

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: 8,
            }}
          >
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => router.push("/billing/new")}
            >
              <Icon name="plus" size={13} />
              Nouvelle facture
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => router.push("/tasks")}
            >
              <Icon name="sync" size={13} />
              Voir les tasks
            </button>
          </div>

          {recentTasks.length > 0 && (
            <div className="card">
              <div className="card-title">
                <span>Activité récente</span>
                <button
                  type="button"
                  className="sec-link"
                  onClick={() => router.push("/tasks")}
                >
                  Tasks →
                </button>
              </div>
              <div className="col gap-8" style={{ marginTop: -4 }}>
                {recentTasks.slice(0, 4).map((t) => (
                  <div
                    key={t.id}
                    className="row gap-8"
                    style={{ padding: "6px 0" }}
                  >
                    <span
                      className={
                        "pill pill-no-dot " +
                        (t.status === "DONE" ? "pill-paid" : "pill-pending")
                      }
                      style={{
                        width: 8,
                        height: 8,
                        padding: 0,
                        flexShrink: 0,
                      }}
                    />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="small strong truncate">{t.title}</div>
                      <div className="xs muted truncate">
                        {t.linearIdentifier} · {t.projectKey ?? "—"}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

interface BarChartProps {
  months: { label: string; value: number; isCurrent: boolean }[]
}

function BarChart({ months }: BarChartProps) {
  if (!months.length) return null
  const max = Math.max(...months.map((m) => m.value), 1)
  const W = 320,
    H = 140,
    pad = 24
  const innerW = W - pad * 2,
    innerH = H - 30
  const stepX = innerW / months.length
  const barW = stepX * 0.42
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 140 }}>
      <defs>
        <linearGradient id="m-bar" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.19 128)" stopOpacity="1" />
          <stop
            offset="100%"
            stopColor="oklch(0.86 0.19 128)"
            stopOpacity="0.5"
          />
        </linearGradient>
      </defs>
      {months.map((m, i) => {
        const x = pad + i * stepX + (stepX - barW) / 2
        const h = (m.value / max) * innerH
        const y = innerH - h + 6
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="3"
              fill={m.isCurrent ? "url(#m-bar)" : "oklch(0.30 0.01 240)"}
            />
            <text
              x={pad + i * stepX + stepX / 2}
              y={H - 6}
              textAnchor="middle"
              fontSize="10"
              fill={m.isCurrent ? "var(--text-0)" : "var(--text-3)"}
              fontWeight={m.isCurrent ? 600 : 400}
            >
              {m.label}
            </text>
          </g>
        )
      })}
    </svg>
  )
}
