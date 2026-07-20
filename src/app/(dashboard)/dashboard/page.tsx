"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { StatusPill, invoicePillStatus } from "@/components/ui/pill"
import { RevenueChart } from "@/components/dashboard/revenue-chart"
import { RelanceButton } from "@/components/dashboard/relance-button"
import { TodayBlock } from "@/components/suivi/today-block"
import { Skeleton, SkeletonKpi, SkeletonRow } from "@/components/ui/skeleton"
import { fmtDate, fmtEUR, fmtRelative, initials } from "@/lib/format"
import { useDashboard } from "@/hooks/use-dashboard"
import {
  formatWorkloadCoverage,
  formatWorkloadDays,
} from "@/domain/capacity/workload"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"
import { TaskIdLink } from "@/components/ui/task-id-link"

const MobileDashboardPage = dynamic(
  () => import("./mobile").then((m) => m.MobileDashboardPage),
  {
    ssr: false,
    loading: () => (
      <MobilePageSkeleton
        title="Pilotage"
        heading="Pilotage"
        subtitle="Vue d'ensemble du mois"
        variant="tiles"
        rows={4}
      />
    ),
  },
)

export default function DashboardPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileDashboardPage />
  return <DesktopDashboardPage />
}

function DesktopDashboardPage() {
  const router = useRouter()
  const { data, isPending } = useDashboard()
  const today = useMemo(() => new Date(), [])

  const months = data?.months ?? []
  const overdue = data?.overdue ?? []
  const recentInvoices = data?.recentInvoices ?? []
  const recentTasks = data?.recentTasks ?? []

  const kpi = data?.kpi ?? {
    revenueMonth: 0,
    revenueYear: 0,
    paidCount: 0,
    paidCountMonth: 0,
    paidCountYear: 0,
    outstanding: 0,
    sentCount: 0,
    overdueAmount: 0,
    overdueCount: 0,
    pipelineCount: 0,
    pipelineEur: 0,
    pipelineClientCount: 0,
  }

  const capacity = data?.capacity ?? {
    days: 0,
    taskCount: 0,
    estimatedTaskCount: 0,
    missingEstimateCount: 0,
    workingDaysPerWeek: 5,
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <div className="page-sub">Vue d&apos;ensemble · {fmtDate(today)}</div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => router.push("/tasks")}
          >
            <Icon name="check-square" size={14} />
            Voir tasks
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/billing/new")}
          >
            <Icon name="plus" size={14} />
            Nouvelle facture
          </button>
        </div>
      </div>

      {isPending ? (
        <div className="kpi-grid kpi-grid-5">
          {Array.from({ length: 5 }, (_, i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
      ) : (
        <div className="kpi-grid kpi-grid-5">
          <div className="kpi kpi-accent">
            <div className="kpi-label">
              <Icon name="euro" size={11} />
              Revenu · ce mois
            </div>
            <div className="kpi-value">{fmtEUR(kpi.revenueMonth)}</div>
            <div className="kpi-sub">
              <span>{kpi.paidCountMonth} factures payées</span>
            </div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              <Icon name="chart" size={11} />
              Revenu · {today.getFullYear()}
            </div>
            <div className="kpi-value">{fmtEUR(kpi.revenueYear)}</div>
            <div className="kpi-sub">
              <span>{kpi.paidCountYear} factures payées</span>
            </div>
          </div>
          <div className="kpi kpi-info">
            <div className="kpi-label">
              <Icon name="clock" size={11} />
              Pipeline
            </div>
            <div className="kpi-value">{fmtEUR(kpi.pipelineEur)}</div>
            <div className="kpi-sub">
              <span>{kpi.pipelineCount} tasks à facturer</span>
            </div>
          </div>
          <div className="kpi kpi-warn">
            <div className="kpi-label">
              <Icon name="send" size={11} />
              Encours
            </div>
            <div className="kpi-value">{fmtEUR(kpi.outstanding)}</div>
            <div className="kpi-sub">
              <span>{kpi.sentCount} factures envoyées</span>
              {kpi.overdueAmount > 0 && (
                <span className="kpi-trend down" style={{ marginLeft: "auto" }}>
                  <Icon name="alert" size={10} />
                  {fmtEUR(kpi.overdueAmount)} en retard
                </span>
              )}
            </div>
          </div>
          <div className="kpi kpi-purple">
            <div className="kpi-label">
              <Icon name="clock" size={11} />
              Charge
            </div>
            <div className="kpi-value num">
              {formatWorkloadDays(capacity.days)}
            </div>
            <div className="kpi-sub">
              <span>{formatWorkloadCoverage(capacity)}</span>
            </div>
          </div>
        </div>
      )}

      <TodayBlock />

      {isPending ? (
        <DashboardChartsSkeleton />
      ) : (
        <>
          <div className="chart-grid">
            <div className="chart-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "baseline",
                  justifyContent: "space-between",
                  marginBottom: 18,
                }}
              >
                <div>
                  <div className="card-h2">Évolution mensuelle</div>
                  <div className="muted small" style={{ marginTop: 4 }}>
                    Revenus payés · 8 derniers mois
                  </div>
                </div>
                <div className="row gap-12">
                  <div className="row gap-4 small muted">
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        background: "var(--accent)",
                        borderRadius: 99,
                      }}
                    />
                    Payé
                  </div>
                </div>
              </div>
              <RevenueChart months={months} />
            </div>

            <div className="chart-card">
              <div className="card-h2" style={{ marginBottom: 16 }}>
                Alertes
              </div>
              <div className="col gap-12">
                {overdue.length === 0 && (
                  <div className="muted small" style={{ padding: "16px 0" }}>
                    Aucune alerte ✦ tout est sous contrôle
                  </div>
                )}
                {overdue.map((inv) => {
                  const daysLate = Math.floor(
                    (today.getTime() - new Date(inv.dueDate).getTime()) /
                      (1000 * 60 * 60 * 24),
                  )
                  return (
                    <div
                      key={inv.id}
                      className="row gap-12"
                      style={{
                        padding: 12,
                        background: "var(--danger-soft)",
                        borderRadius: 8,
                        border: "1px solid oklch(0.70 0.20 25 / 0.3)",
                      }}
                    >
                      <Icon
                        name="alert"
                        size={16}
                        style={{ color: "var(--danger)" }}
                      />
                      <div className="grow">
                        <div className="strong small">{inv.number}</div>
                        <div className="xs muted">
                          Échue il y a {daysLate}j · {fmtEUR(inv.total)}
                        </div>
                      </div>
                      <RelanceButton
                        invoiceId={inv.id}
                        clientId={inv.clientId}
                      />
                    </div>
                  )
                })}
                {kpi.pipelineEur > 5000 && (
                  <div
                    className="row gap-12"
                    style={{
                      padding: 12,
                      background: "var(--accent-soft)",
                      borderRadius: 8,
                    }}
                  >
                    <Icon
                      name="info"
                      size={16}
                      style={{ color: "var(--accent)" }}
                    />
                    <div className="grow">
                      <div className="strong small">Pipeline conséquente</div>
                      <div className="xs muted">
                        {kpi.pipelineCount} tasks à facturer ·{" "}
                        {fmtEUR(kpi.pipelineEur)}
                      </div>
                    </div>
                    <button
                      className="btn btn-sm btn-primary"
                      onClick={() => router.push("/billing/new")}
                    >
                      Facturer
                    </button>
                  </div>
                )}
                <div
                  className="row gap-12"
                  style={{
                    padding: 12,
                    background: "var(--bg-2)",
                    borderRadius: 8,
                  }}
                >
                  <Icon name="sync" size={16} className="muted" />
                  <div className="grow">
                    <div className="small">Dernière sync Linear</div>
                    <div className="xs muted">
                      {data?.lastSync ? fmtRelative(data.lastSync) : "—"}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="chart-grid">
            <div className="chart-card" style={{ padding: 0 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  padding: "20px 22px 14px",
                }}
              >
                <div className="card-h2">Factures récentes</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => router.push("/billing")}
                >
                  Tout voir <Icon name="arrow-right" size={12} />
                </button>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 22 }}>Numéro</th>
                    <th>Client</th>
                    <th>Date</th>
                    <th>Statut</th>
                    <th className="right" style={{ paddingRight: 22 }}>
                      Montant
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {recentInvoices.map((inv) => (
                    <tr
                      key={inv.id}
                      style={{ cursor: "pointer" }}
                      onClick={() =>
                        router.push(`/billing?invoiceId=${inv.id}`)
                      }
                    >
                      <td style={{ paddingLeft: 22 }}>
                        <span className="mono small">{inv.number}</span>
                        {inv.kind === "DEPOSIT" && (
                          <span
                            className="pill pill-deposit pill-no-dot"
                            style={{ marginLeft: 8, fontSize: 10 }}
                          >
                            acompte
                          </span>
                        )}
                      </td>
                      <td>
                        {inv.client.company ??
                          `${inv.client.firstName} ${inv.client.lastName}`}
                      </td>
                      <td className="muted small">{fmtDate(inv.issueDate)}</td>
                      <td>
                        <StatusPill status={invoicePillStatus(inv)} />
                      </td>
                      <td
                        className="right num strong"
                        style={{ paddingRight: 22 }}
                      >
                        {fmtEUR(inv.total)}
                      </td>
                    </tr>
                  ))}
                  {recentInvoices.length === 0 && (
                    <tr>
                      <td colSpan={5}>
                        <div className="empty">
                          <div className="empty-title">Aucune facture</div>
                          <button
                            className="btn btn-primary btn-sm"
                            style={{ marginTop: 12 }}
                            onClick={() => router.push("/billing/new")}
                          >
                            <Icon name="plus" size={14} />
                            Nouvelle facture
                          </button>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="chart-card">
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: 14,
                }}
              >
                <div className="card-h2">Tasks récemment terminées</div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => router.push("/tasks")}
                >
                  <Icon name="arrow-right" size={12} />
                </button>
              </div>
              <div className="col gap-8">
                {recentTasks.map((t) => (
                  <div
                    key={t.id}
                    className="row gap-12"
                    style={{
                      padding: "8px 0",
                      borderBottom: "1px solid var(--border)",
                    }}
                  >
                    <TaskIdLink
                      identifier={t.linearIdentifier}
                      url={t.linearUrl}
                      className="task-id mono"
                    />
                    <div className="grow truncate small">{t.title}</div>
                    <span className="xs muted">{t.projectKey ?? ""}</span>
                    <StatusPill
                      status={
                        t.status === "PENDING_INVOICE"
                          ? "pending_invoice"
                          : t.status === "DONE"
                            ? "done"
                            : t.status === "IN_PROGRESS"
                              ? "in_progress"
                              : "backlog"
                      }
                    />
                  </div>
                ))}
                {recentTasks.length === 0 && (
                  <div className="muted small">Aucune task terminée</div>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DashboardChartsSkeleton() {
  return (
    <>
      <div className="chart-grid">
        <div className="chart-card">
          <Skeleton width="40%" height={16} />
          <Skeleton height={220} radius="var(--radius)" className="mt-[18px]" />
        </div>
        <div className="chart-card">
          <Skeleton width="30%" height={16} />
          <div className="col gap-12 mt-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} height={56} radius="var(--radius-sm)" />
            ))}
          </div>
        </div>
      </div>

      <div className="chart-grid">
        <div className="chart-card">
          <Skeleton width="35%" height={16} />
          <div className="col mt-4">
            {Array.from({ length: 5 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
        <div className="chart-card">
          <Skeleton width="45%" height={16} />
          <div className="col mt-4">
            {Array.from({ length: 6 }, (_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        </div>
      </div>
    </>
  )
}

void initials
