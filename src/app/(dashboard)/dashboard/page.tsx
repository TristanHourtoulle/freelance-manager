"use client"

import { useMemo } from "react"
import dynamic from "next/dynamic"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { TriageQueue } from "@/components/dashboard/triage-queue"
import {
  InProgressCard,
  LastSyncLine,
  RecentDoneCard,
} from "@/components/dashboard/dashboard-rail"
import { Skeleton, SkeletonRow } from "@/components/ui/skeleton"
import { fmtDate, fmtEUR } from "@/lib/format"
import { useDashboard, type DashboardDTO } from "@/hooks/use-dashboard"
import {
  formatWorkloadCoverage,
  formatWorkloadDays,
} from "@/domain/capacity/workload"
import { countEstimatedPipelineTasks } from "@/domain/dashboard/triage"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"

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

export default function DashboardPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileDashboardPage />
  return <DesktopDashboardPage />
}

function MoneyStrip({
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
    <div className="strip">
      <div className="strip-cell">
        <div className="kpi-label">
          <Icon name="euro" size={11} />
          Revenu · ce mois
        </div>
        <div className="strip-value">{fmtEUR(kpi.revenueMonth)}</div>
        <div className="strip-sub">{kpi.paidCountMonth} factures payées</div>
      </div>
      <div className="strip-cell">
        <div className="kpi-label">
          <Icon name="send" size={11} />
          Encours
        </div>
        <div className="strip-value">{fmtEUR(kpi.outstanding)}</div>
        {kpi.overdueAmount > 0 && (
          <div className="strip-sub" style={{ color: "var(--danger)" }}>
            dont {fmtEUR(kpi.overdueAmount)} en retard
          </div>
        )}
      </div>
      <div className="strip-cell">
        <div className="kpi-label">
          <Icon name="clock" size={11} />
          Facturable
        </div>
        <div className="strip-value">{fmtEUR(kpi.pipelineEur)}</div>
        <div className="strip-sub">
          {estimatedCount} tasks estimées · {kpi.pipelineClientCount} clients
        </div>
      </div>
      <div className="strip-cell">
        <div className="kpi-label">
          <Icon name="clock" size={11} />
          Charge
        </div>
        <div className="strip-value">{formatWorkloadDays(capacity.days)}</div>
        <div className="strip-sub">{formatWorkloadCoverage(capacity)}</div>
      </div>
      <div className="strip-cell">
        <div className="kpi-label">
          <Icon name="chart" size={11} />
          Revenu · {year}
        </div>
        <div className="strip-value">{fmtEUR(kpi.revenueYear)}</div>
        <div className="strip-sub">{kpi.paidCountYear} factures payées</div>
      </div>
    </div>
  )
}

function DesktopDashboardPage() {
  const router = useRouter()
  const { data, isPending } = useDashboard()
  const today = useMemo(() => new Date(), [])

  const kpi = data?.kpi ?? EMPTY_KPI
  const capacity = data?.capacity ?? EMPTY_CAPACITY
  const pipelineAging = data?.pipelineAging ?? EMPTY_AGING
  const inProgress = data?.inProgress ?? EMPTY_IN_PROGRESS
  const overdue = data?.overdue ?? []
  const recentTasks = data?.recentTasks ?? []

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
        <DashboardSkeleton />
      ) : (
        <>
          <MoneyStrip
            kpi={kpi}
            capacity={capacity}
            year={today.getFullYear()}
          />

          <div className="triage-grid">
            <TriageQueue
              overdue={overdue}
              pipelineAging={pipelineAging}
              unestimatedCount={kpi.unestimatedCount}
              pipelineCount={kpi.pipelineCount}
            />

            <div className="col" style={{ gap: 18 }}>
              <InProgressCard inProgress={inProgress} />
              <RecentDoneCard tasks={recentTasks} />
              <LastSyncLine lastSync={data?.lastSync ?? null} />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function DashboardSkeleton() {
  return (
    <>
      <div className="strip" aria-hidden>
        {Array.from({ length: 5 }, (_, i) => (
          <div key={i} className="strip-cell">
            <div className="kpi-label h-[1.5em]">
              <Skeleton width="60%" height="0.75em" />
            </div>
            <div className="strip-value flex h-[1.4em] items-center">
              <Skeleton width="55%" height="0.7em" />
            </div>
            <div className="strip-sub h-[1.4em]">
              <Skeleton width="70%" height="0.75em" />
            </div>
          </div>
        ))}
      </div>

      <div className="triage-grid" aria-hidden>
        <div className="card">
          <Skeleton width="35%" height={16} />
          <div className="col gap-8 mt-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} height={58} radius="var(--radius-sm)" />
            ))}
          </div>
        </div>
        <div className="col" style={{ gap: 18 }}>
          <div className="card">
            <Skeleton width="40%" height={16} />
            <div className="col mt-4">
              {Array.from({ length: 3 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </div>
          <div className="card">
            <Skeleton width="55%" height={16} />
            <div className="col mt-4">
              {Array.from({ length: 5 }, (_, i) => (
                <SkeletonRow key={i} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
