"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { StatusPill, taskStatusToPill } from "@/components/ui/pill"
import { fmtEUR, fmtRelative, initials, avatarColor } from "@/lib/format"
import { isSyncStale, SYNC_STALE_LABEL } from "@/lib/sync-staleness"
import {
  useTasks,
  useTaskCounts,
  useSyncLinear,
  useSetTaskBillability,
  useBulkSetTaskBillability,
} from "@/hooks/use-tasks"
import type { NonBillableReason } from "@/hooks/use-tasks"
import { useLinearSyncProgress } from "@/hooks/use-linear-sync"
import { useSettings } from "@/hooks/use-settings"
import { useClients, useClientsBillable } from "@/hooks/use-clients"
import { useProjects } from "@/hooks/use-projects"
import { useInvoices } from "@/hooks/use-invoices"
import { pipelineValueForTask } from "@/lib/billing-math"
import {
  isPipelineEligible,
  NON_BILLABLE_REASON_LABELS,
} from "@/domain/tasks/billability"
import dynamic from "next/dynamic"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { InfiniteScrollSentinel } from "@/components/ui/infinite-scroll-sentinel"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { TaskEffortInput } from "@/components/tasks/task-effort-input"
import { NonBillableDialog } from "@/components/tasks/non-billable-dialog"
import { TaskSelectionBar } from "@/components/tasks/task-selection-bar"
import { TasksLoadingSkeleton } from "@/components/tasks/tasks-loading-skeleton"
import {
  DEFAULT_STATUS_FILTER,
  TasksFilterBar,
  type StatusFilterId,
} from "@/components/tasks/tasks-filter-bar"
import { useTasksSelection } from "@/components/tasks/use-tasks-selection"

const MobileTasksPage = dynamic(
  () => import("./mobile").then((m) => m.MobileTasksPage),
  {
    ssr: false,
    loading: () => (
      <MobilePageSkeleton
        title="Tasks"
        heading="Linear · Tasks"
        variant="list"
        rows={7}
      />
    ),
  },
)

export default function TasksPage() {
  const isMobile = useIsMobile()
  return (
    <Suspense fallback={<PageSkeleton rows={10} />}>
      {isMobile ? <MobileTasksPage /> : <DesktopTasksPage />}
    </Suspense>
  )
}

export function DesktopTasksPage() {
  const router = useRouter()

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>(
    DEFAULT_STATUS_FILTER,
  )
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [billabilityDialog, setBillabilityDialog] = useState<{
    taskIds: string[]
    fromSelection: boolean
  } | null>(null)

  const { data: clients = [] } = useClients()
  const { data: billable } = useClientsBillable()
  const { data: projects = [] } = useProjects()
  const { data: invoices = [] } = useInvoices()
  const { clientIds, projectIds, setSelection } = useTasksSelection(projects)

  const {
    data: tasks = [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
    isPlaceholderData,
  } = useTasks({ clientIds, projectIds })
  const { data: settings } = useSettings()
  const sync = useSyncLinear()
  const setBillability = useSetTaskBillability()
  const bulkBillability = useBulkSetTaskBillability()
  const billabilityPending =
    setBillability.isPending || bulkBillability.isPending
  const syncProgress = useLinearSyncProgress()
  const isSyncing = sync.isPending || syncProgress.isRunning
  const isSyncOld =
    Boolean(settings) && isSyncStale(settings?.linearLastSyncedAt)

  const { data: counts } = useTaskCounts({ clientIds, projectIds })
  const visibleCount = counts ? counts[statusFilter] : null
  const unestimatedCount = counts?.unestimatedCount ?? 0

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (
          searchTerm &&
          !`${t.linearIdentifier} ${t.title}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        )
          return false
        if (statusFilter === "pending" && t.status !== "PENDING_INVOICE")
          return false
        if (statusFilter === "done" && t.status !== "DONE") return false
        if (statusFilter === "in_progress" && t.status !== "IN_PROGRESS")
          return false
        if (statusFilter === "non_billable" && t.billable) return false
        if (
          statusFilter === "all" &&
          !["PENDING_INVOICE", "DONE", "IN_PROGRESS"].includes(t.status)
        )
          return false
        if (clientIds.length > 0 && !clientIds.includes(t.clientId))
          return false
        if (projectIds.length > 0 && !projectIds.includes(t.projectId))
          return false
        return true
      }),
    [tasks, searchTerm, statusFilter, clientIds, projectIds],
  )

  type Group = {
    clientId: string
    projectId: string
    tasks: typeof filtered
  }
  const groups: Group[] = useMemo(() => {
    const m = new Map<string, Group>()
    for (const t of filtered) {
      const key = `${t.clientId}::${t.projectId}`
      let g = m.get(key)
      if (!g) {
        g = { clientId: t.clientId, projectId: t.projectId, tasks: [] }
        m.set(key, g)
      }
      g.tasks.push(t)
    }
    return Array.from(m.values())
  }, [filtered])

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  )
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  )

  const pendingPipeline = {
    value: billable?.totalValue ?? 0,
    count: billable?.totalCount ?? 0,
  }

  const hasNarrowingFilters =
    searchTerm !== "" || clientIds.length > 0 || projectIds.length > 0
  const hasActiveFilters =
    hasNarrowingFilters || statusFilter !== DEFAULT_STATUS_FILTER
  const isSettled = !isPending && !isPlaceholderData

  function resetFilters() {
    setSearchTerm("")
    setStatusFilter(DEFAULT_STATUS_FILTER)
    setSelection({ clientIds: [], projectIds: [] })
  }

  const selectedTasks = tasks.filter((t) => selected.has(t.id))
  const selectedClientIds = new Set(selectedTasks.map((t) => t.clientId))
  const canInvoiceSelected = selectedClientIds.size === 1

  const selectedValue = selectedTasks.reduce((s, t) => {
    const c = clientById.get(t.clientId)
    if (!c || !isPipelineEligible(t, c)) return s
    return (
      s +
      pipelineValueForTask({
        billingMode: c.billingMode,
        rate: c.rate,
        estimateDays: t.estimate,
      })
    )
  }, 0)

  const selectionAllNonBillable =
    selectedTasks.length > 0 && selectedTasks.every((t) => !t.billable)

  function confirmNonBillable(reason: NonBillableReason, note: string | null) {
    if (!billabilityDialog) return
    const payload = {
      billable: false as const,
      nonBillableReason: reason,
      nonBillableNote: note,
    }
    if (billabilityDialog.fromSelection) {
      bulkBillability.mutate(
        { taskIds: billabilityDialog.taskIds, ...payload },
        {
          onSuccess: () => {
            setBillabilityDialog(null)
            setSelected(new Set())
          },
        },
      )
      return
    }
    const id = billabilityDialog.taskIds[0]
    if (!id) return
    setBillability.mutate(
      { id, ...payload },
      { onSuccess: () => setBillabilityDialog(null) },
    )
  }

  function restoreSelectedBillable() {
    bulkBillability.mutate(
      {
        taskIds: [...selected],
        billable: true,
        nonBillableReason: null,
        nonBillableNote: null,
      },
      { onSuccess: () => setSelected(new Set()) },
    )
  }

  function restoreTaskBillable(id: string) {
    setBillability.mutate({
      id,
      billable: true,
      nonBillableReason: null,
      nonBillableNote: null,
    })
  }

  const selectedInViewCount = filtered.reduce(
    (n, t) => (selected.has(t.id) ? n + 1 : n),
    0,
  )
  const hiddenSelectedCount = selectedTasks.length - selectedInViewCount

  function doSync() {
    sync.mutate()
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <div className="page-sub">
            Synchronisées depuis Linear ·{" "}
            {visibleCount === null ? (
              <Skeleton
                width={54}
                height={10}
                className="inline-block align-middle"
              />
            ) : (
              `${visibleCount} tasks visibles`
            )}{" "}
            · dernière sync {fmtRelative(settings?.linearLastSyncedAt)}
            {isSyncOld && (
              <>
                {" "}
                <span
                  className="pill pill-partial"
                  title="Les tâches affichées peuvent être obsolètes : lance une synchronisation Linear."
                >
                  {SYNC_STALE_LABEL}
                </span>
              </>
            )}
            {pendingPipeline.count > 0 && (
              <>
                {" · "}
                <span className="strong" style={{ color: "var(--accent)" }}>
                  À facturer : {fmtEUR(pendingPipeline.value)}
                </span>{" "}
                <span className="muted">
                  ({pendingPipeline.count} task
                  {pendingPipeline.count > 1 ? "s" : ""})
                </span>
              </>
            )}
            {unestimatedCount > 0 && (
              <>
                {" "}
                <span
                  className="pill pill-partial"
                  title="Ces tâches comptent pour 0 € dans le pipeline tant qu'elles n'ont pas d'estimation Linear."
                >
                  {unestimatedCount} à estimer
                </span>
              </>
            )}
          </div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={doSync}
            disabled={isSyncing}
          >
            <Icon name="sync" size={14} className={isSyncing ? "spin" : ""} />
            {isSyncing ? syncProgress.buttonLabel : "Sync Linear"}
          </button>
          {selected.size > 0 && canInvoiceSelected && (
            <button
              className="btn btn-primary"
              onClick={() =>
                router.push(
                  `/billing/new?clientId=${[...selectedClientIds][0]}&taskIds=${[...selected].join(",")}`,
                )
              }
            >
              <Icon name="invoice" size={14} />
              Facturer ({selected.size}) · {fmtEUR(selectedValue)}
            </button>
          )}
          {selected.size > 0 && !canInvoiceSelected && (
            <button
              className="btn btn-secondary"
              disabled
              title="Sélectionne un seul client"
            >
              <Icon name="alert" size={14} />
              Plusieurs clients
            </button>
          )}
        </div>
      </div>

      <TasksFilterBar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        counts={counts}
        clients={clients}
        projects={projects}
        clientIds={clientIds}
        projectIds={projectIds}
        onSelectionChange={setSelection}
      />

      <div
        className={"col gap-16" + (isPlaceholderData ? " list-refreshing" : "")}
        aria-busy={isPlaceholderData || undefined}
      >
        {isPending && <TasksLoadingSkeleton />}
        {isSettled && groups.length === 0 && tasks.length === 0 && (
          <div className="card">
            <div className="empty">
              <div className="empty-title">Aucune task</div>
              <div>Ajuste les filtres ou lance une sync</div>
            </div>
          </div>
        )}
        {isSettled &&
          groups.length === 0 &&
          tasks.length > 0 &&
          !hasActiveFilters && (
            <div className="card">
              <div className="empty">
                <div className="empty-title">Aucune task à facturer</div>
                <div>
                  Le filtre « À facturer » est actif par défaut. Les tasks en
                  backlog ou annulées ne sont jamais listées ici.
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => setStatusFilter("all")}
                >
                  Voir toutes les tasks
                </button>
              </div>
            </div>
          )}
        {isSettled &&
          groups.length === 0 &&
          tasks.length > 0 &&
          hasActiveFilters &&
          statusFilter === "all" &&
          !hasNarrowingFilters && (
            <div className="card">
              <div className="empty">
                <div className="empty-title">Aucune task active</div>
                <div>
                  Toutes tes tasks sont en backlog ou annulées, elles ne sont
                  pas affichées ici
                </div>
              </div>
            </div>
          )}
        {isSettled &&
          groups.length === 0 &&
          tasks.length > 0 &&
          hasActiveFilters &&
          (statusFilter !== "all" || hasNarrowingFilters) && (
            <div className="card">
              <div className="empty">
                <div className="empty-title">Aucun résultat</div>
                <div>Aucune task ne correspond aux filtres actuels</div>
                <button
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={resetFilters}
                >
                  <Icon name="x" size={12} />
                  Réinitialiser les filtres
                </button>
              </div>
            </div>
          )}
        {!isPending &&
          groups.map((g) => {
            const c = clientById.get(g.clientId)
            const p = projectById.get(g.projectId)
            const groupValue = g.tasks.reduce((s, t) => {
              if (!c || !isPipelineEligible(t, c)) return s
              return (
                s +
                pipelineValueForTask({
                  billingMode: c.billingMode,
                  rate: c.rate,
                  estimateDays: t.estimate,
                })
              )
            }, 0)
            const allSelected = g.tasks.every((t) => selected.has(t.id))
            return (
              <div
                key={`${g.clientId}${g.projectId}`}
                className="card"
                style={{
                  padding: 0,
                  overflow: "hidden",
                  contentVisibility: "auto",
                  containIntrinsicSize: "auto 320px",
                }}
              >
                <div
                  className="row gap-12"
                  style={{
                    padding: "14px 18px",
                    borderBottom: "1px solid var(--border)",
                    background: "var(--bg-2)",
                  }}
                >
                  <div
                    className="av av-sm"
                    style={{
                      background: c
                        ? (c.color ??
                          avatarColor(`${c.firstName}${c.lastName}`))
                        : undefined,
                    }}
                  >
                    {c ? initials(`${c.firstName} ${c.lastName}`) : ""}
                  </div>
                  <div>
                    <div className="strong small">
                      {c?.company ?? "—"} ·{" "}
                      <span className="muted">{p?.name ?? "—"}</span>
                    </div>
                    <div className="xs muted">
                      {g.tasks.length} task{g.tasks.length > 1 ? "s" : ""} ·{" "}
                      {c?.billingMode === "DAILY"
                        ? `${c.rate}€/j`
                        : c?.billingMode === "HOURLY"
                          ? `${c.rate}€/h`
                          : "Forfait"}
                    </div>
                  </div>
                  <div style={{ marginLeft: "auto" }} className="num strong">
                    {groupValue > 0 ? fmtEUR(groupValue) : "—"}
                  </div>
                </div>
                <table className="table">
                  <thead>
                    <tr>
                      <th style={{ paddingLeft: 18, width: 40 }}>
                        <input
                          type="checkbox"
                          checked={allSelected}
                          onChange={(e) => {
                            const next = new Set(selected)
                            g.tasks.forEach((t) =>
                              e.target.checked
                                ? next.add(t.id)
                                : next.delete(t.id),
                            )
                            setSelected(next)
                          }}
                        />
                      </th>
                      <th style={{ width: 88 }}>ID</th>
                      <th>Title</th>
                      <th style={{ width: 130 }}>Statut</th>
                      <th className="right" style={{ width: 90 }}>
                        Estimate
                      </th>
                      <th className="right" style={{ width: 92 }}>
                        Réel
                      </th>
                      <th className="right" style={{ width: 110 }}>
                        Valeur
                      </th>
                      <th style={{ width: 110 }}>Facturée</th>
                      <th
                        style={{ width: 44, paddingRight: 18 }}
                        aria-label="Actions"
                      />
                    </tr>
                  </thead>
                  <tbody>
                    {g.tasks.map((t) => {
                      const value =
                        c && isPipelineEligible(t, c)
                          ? pipelineValueForTask({
                              billingMode: c.billingMode,
                              rate: c.rate,
                              estimateDays: t.estimate,
                            })
                          : 0
                      const inv = t.invoiceId
                        ? invoices.find((i) => i.id === t.invoiceId)
                        : null
                      const isSel = selected.has(t.id)
                      return (
                        <tr
                          key={t.id}
                          style={{
                            ...(isSel
                              ? { background: "var(--accent-soft)" }
                              : {}),
                            ...(t.billable ? {} : { opacity: 0.55 }),
                          }}
                        >
                          <td style={{ paddingLeft: 18 }}>
                            <input
                              type="checkbox"
                              checked={isSel}
                              onChange={(e) => {
                                const next = new Set(selected)
                                if (e.target.checked) next.add(t.id)
                                else next.delete(t.id)
                                setSelected(next)
                              }}
                            />
                          </td>
                          <td>
                            <TaskIdLink
                              identifier={t.linearIdentifier}
                              url={t.linearUrl}
                              className="task-id"
                            />
                          </td>
                          <td className="strong">{t.title}</td>
                          <td>
                            <StatusPill status={taskStatusToPill(t.status)} />
                            {!t.billable && t.nonBillableReason && (
                              <span
                                className="pill pill-no-dot xs pill-draft"
                                style={{ marginLeft: 6 }}
                                title={t.nonBillableNote ?? undefined}
                              >
                                {
                                  NON_BILLABLE_REASON_LABELS[
                                    t.nonBillableReason
                                  ]
                                }
                              </span>
                            )}
                          </td>
                          <td className="right num">
                            {t.estimate ? `${t.estimate}j` : "—"}
                          </td>
                          <td className="right">
                            <TaskEffortInput
                              taskId={t.id}
                              actualDays={t.actualDays}
                              className="num"
                              style={{
                                width: 68,
                                padding: "4px 8px",
                                textAlign: "right",
                              }}
                            />
                          </td>
                          <td className="right num">
                            {value > 0 ? fmtEUR(value) : "—"}
                          </td>
                          <td>
                            {inv ? (
                              <Link
                                href={`/billing?invoiceId=${t.invoiceId}`}
                                className="mono xs"
                                style={{ color: "var(--accent)" }}
                              >
                                {inv.number}
                              </Link>
                            ) : (
                              <span className="muted xs">—</span>
                            )}
                          </td>
                          <td style={{ paddingRight: 18 }}>
                            <button
                              type="button"
                              className="icon-btn"
                              aria-label={
                                t.billable
                                  ? `Marquer ${t.linearIdentifier} non facturable`
                                  : `Remettre ${t.linearIdentifier} en facturation`
                              }
                              title={
                                t.billable
                                  ? "Marquer non facturable"
                                  : "Marquer facturable"
                              }
                              disabled={
                                billabilityPending || t.invoiceId != null
                              }
                              onClick={() =>
                                t.billable
                                  ? setBillabilityDialog({
                                      taskIds: [t.id],
                                      fromSelection: false,
                                    })
                                  : restoreTaskBillable(t.id)
                              }
                            >
                              <Icon
                                name={t.billable ? "eye-off" : "eye"}
                                size={14}
                              />
                            </button>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )
          })}
      </div>

      <InfiniteScrollSentinel
        hasNextPage={Boolean(hasNextPage)}
        isFetchingNextPage={isFetchingNextPage}
        fetchNextPage={() => fetchNextPage()}
      />

      {selected.size > 0 && (
        <TaskSelectionBar
          selectedCount={selected.size}
          selectedValue={selectedValue}
          hiddenSelectedCount={hiddenSelectedCount}
          canInvoiceSelected={canInvoiceSelected}
          selectionAllNonBillable={selectionAllNonBillable}
          billabilityPending={billabilityPending}
          onClear={() => setSelected(new Set())}
          onMarkNonBillable={() =>
            setBillabilityDialog({
              taskIds: [...selected],
              fromSelection: true,
            })
          }
          onRestoreBillable={restoreSelectedBillable}
          onCreateInvoice={() =>
            router.push(
              `/billing/new?clientId=${[...selectedClientIds][0]}&taskIds=${[...selected].join(",")}`,
            )
          }
        />
      )}

      <NonBillableDialog
        open={billabilityDialog !== null}
        taskCount={billabilityDialog?.taskIds.length ?? 0}
        isPending={billabilityPending}
        onCancel={() => setBillabilityDialog(null)}
        onConfirm={confirmNonBillable}
      />
    </div>
  )
}
