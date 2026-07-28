"use client"

import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { Skeleton } from "@/components/ui/skeleton"
import { fmtEUR } from "@/lib/format"
import { useDashboard, type DashboardDTO } from "@/hooks/use-dashboard"
import {
  formatWorkloadCoverage,
  formatWorkloadDays,
} from "@/domain/capacity/workload"
import { countEstimatedPipelineTasks } from "@/domain/dashboard/triage"
import { TriageQueue } from "@/components/dashboard/triage-queue"
import {
  InProgressCard,
  LastSyncLine,
  RecentDoneCard,
} from "@/components/dashboard/dashboard-rail"

const EMPTY_KPI: DashboardDTO["kpi"] = {
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
  unestimatedCount: 0,
}

const EMPTY_CAPACITY: DashboardDTO["capacity"] = {
  days: 0,
  taskCount: 0,
  estimatedTaskCount: 0,
  missingEstimateCount: 0,
  workingDaysPerWeek: 5,
}

const EMPTY_AGING: DashboardDTO["pipelineAging"] = {
  oldestDays: null,
  staleCount: 0,
  staleValue: 0,
  buckets: { fresh: 0, warm: 0, stale: 0, undated: 0 },
}

const EMPTY_IN_PROGRESS: DashboardDTO["inProgress"] = { count: 0, top: [] }

const TILE_GRID = {
  display: "grid",
  gridTemplateColumns: "1fr 1fr",
  gap: 10,
} as const

function MoneyTiles({
  kpi,
  capacity,
  year,
}: {
  kpi: DashboardDTO["kpi"]
  capacity: DashboardDTO["capacity"]
  year: number
}) {
  const estimatedCount = countEstimatedPipelineTasks(
    kpi.pipelineCount,
    kpi.unestimatedCount,
  )
  return (
    <div style={TILE_GRID}>
      <div className="kpi-tile accent">
        <div className="kpi-label">
          <Icon name="euro" size={11} />
          Revenu · ce mois
        </div>
        <div className="kpi-value">{fmtEUR(kpi.revenueMonth)}</div>
        <div className="kpi-sub muted">
          {kpi.paidCountMonth} factures payées
        </div>
      </div>
      <div className="kpi-tile warn">
        <div className="kpi-label">
          <Icon name="send" size={11} />
          Encours
        </div>
        <div className="kpi-value">{fmtEUR(kpi.outstanding)}</div>
        {kpi.overdueAmount > 0 && (
          <div className="kpi-sub" style={{ color: "var(--danger)" }}>
            dont {fmtEUR(kpi.overdueAmount)} en retard
          </div>
        )}
      </div>
      <div className="kpi-tile info">
        <div className="kpi-label">
          <Icon name="clock" size={11} />
          Facturable
        </div>
        <div className="kpi-value">{fmtEUR(kpi.pipelineEur)}</div>
        <div className="kpi-sub muted">
          {estimatedCount} tasks estimées · {kpi.pipelineClientCount} clients
        </div>
      </div>
      <div className="kpi-tile">
        <div className="kpi-label">
          <Icon name="clock" size={11} />
          Charge
        </div>
        <div className="kpi-value num">{formatWorkloadDays(capacity.days)}</div>
        <div className="kpi-sub muted">{formatWorkloadCoverage(capacity)}</div>
      </div>
      <div className="kpi-tile" style={{ gridColumn: "1 / -1" }}>
        <div className="kpi-label">
          <Icon name="chart" size={11} />
          Revenu · {year}
        </div>
        <div className="kpi-value">{fmtEUR(kpi.revenueYear)}</div>
        <div className="kpi-sub muted">{kpi.paidCountYear} factures payées</div>
      </div>
    </div>
  )
}

function MobileDashboardSkeleton() {
  return (
    <div aria-hidden className="m-stack">
      <div className="card">
        <Skeleton width="50%" height={14} />
        <div className="col gap-8" style={{ marginTop: 12 }}>
          {Array.from({ length: 3 }, (_, i) => (
            <Skeleton key={i} height={54} radius="var(--radius-sm)" />
          ))}
        </div>
      </div>
      <div style={TILE_GRID}>
        {Array.from({ length: 4 }, (_, i) => (
          <div key={i} className="kpi-tile">
            <div className="kpi-label">
              <Skeleton width="55%" height={9} />
            </div>
            <div className="kpi-value">
              <Skeleton width="70%" height={18} />
            </div>
            <div className="kpi-sub">
              <Skeleton width="45%" height={10} />
            </div>
          </div>
        ))}
        <div className="kpi-tile" style={{ gridColumn: "1 / -1" }}>
          <div className="kpi-label">
            <Skeleton width="40%" height={9} />
          </div>
          <div className="kpi-value">
            <Skeleton width="50%" height={18} />
          </div>
          <div className="kpi-sub">
            <Skeleton width="35%" height={10} />
          </div>
        </div>
      </div>
    </div>
  )
}

/**
 * Mobile dashboard twin of direction A « Matin ».
 *
 * Same information architecture as the desktop page: the triage queue first
 * and full width, then the money tiles mirroring the strip's semantics, the
 * quick actions, and the shared « En cours » / « Terminées récemment » rail.
 */
export function MobileDashboardPage() {
  const router = useRouter()
  const { data, isPending } = useDashboard()

  const kpi = data?.kpi ?? EMPTY_KPI
  const capacity = data?.capacity ?? EMPTY_CAPACITY
  const pipelineAging = data?.pipelineAging ?? EMPTY_AGING
  const inProgress = data?.inProgress ?? EMPTY_IN_PROGRESS
  const overdue = data?.overdue ?? []
  const recentTasks = data?.recentTasks ?? []
  const year = new Date().getFullYear()

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

        {isPending ? (
          <MobileDashboardSkeleton />
        ) : (
          <div className="m-stack">
            <TriageQueue
              overdue={overdue}
              pipelineAging={pipelineAging}
              unestimatedCount={kpi.unestimatedCount}
              pipelineCount={kpi.pipelineCount}
            />

            <MoneyTiles kpi={kpi} capacity={capacity} year={year} />

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

            <InProgressCard inProgress={inProgress} />
            <RecentDoneCard tasks={recentTasks} />
            <LastSyncLine lastSync={data?.lastSync ?? null} />
          </div>
        )}
      </div>
    </div>
  )
}
