"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { fmtEUR, initials, avatarColor, fmtRelative } from "@/lib/format"
import { useClients } from "@/hooks/use-clients"
import {
  useTasks,
  useTaskCounts,
  useSyncLinear,
  useBulkSetTaskBillability,
} from "@/hooks/use-tasks"
import type { NonBillableReason } from "@/hooks/use-tasks"
import { useLinearSyncProgress } from "@/hooks/use-linear-sync"
import { pipelineValueForTask } from "@/lib/billing-math"
import {
  isPipelineEligible,
  NON_BILLABLE_REASON_LABELS,
} from "@/domain/tasks/billability"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { NonBillableDialog } from "@/components/tasks/non-billable-dialog"
import { useToast } from "@/components/providers/toast-provider"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { TaskEffortInput } from "@/components/tasks/task-effort-input"
import { InfiniteScrollSentinel } from "@/components/ui/infinite-scroll-sentinel"

type Filter = "all" | "pending" | "done" | "invoiced" | "non_billable"

const DEFAULT_STATUS_FILTER: Filter = "pending"

export function MobileTasksPage() {
  const router = useRouter()
  const { toast } = useToast()
  const {
    data: tasks = [],
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending,
  } = useTasks()
  const { data: counts } = useTaskCounts()
  const { data: clients = [] } = useClients()
  const sync = useSyncLinear()
  const syncProgress = useLinearSyncProgress()
  const isSyncing = sync.isPending || syncProgress.isRunning
  const [filter, setFilter] = useState<Filter>(DEFAULT_STATUS_FILTER)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [billabilityDialogOpen, setBillabilityDialogOpen] = useState(false)
  const bulkBillability = useBulkSetTaskBillability()

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (filter === "pending") return t.status === "PENDING_INVOICE"
        if (filter === "done") return t.status === "DONE"
        if (filter === "invoiced") return t.invoiceId != null
        if (filter === "non_billable") return !t.billable
        return ["PENDING_INVOICE", "DONE", "IN_PROGRESS"].includes(t.status)
      })
      .sort(
        (a, b) =>
          new Date(b.completedAt ?? 0).getTime() -
          new Date(a.completedAt ?? 0).getTime(),
      )
  }, [tasks, filter])

  const unestimatedCount = counts?.unestimatedCount ?? 0

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { client: (typeof clients)[number] | undefined; tasks: typeof filtered }
    >()
    for (const t of filtered) {
      const c = clients.find((cl) => cl.id === t.clientId)
      const key = c?.id ?? "unknown"
      if (!map.has(key)) map.set(key, { client: c, tasks: [] })
      map.get(key)!.tasks.push(t)
    }
    return [...map.values()]
  }, [filtered, clients])

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function startInvoice() {
    const ids = [...selected]
    if (!ids.length) return
    const tasksSel = tasks.filter((t) => ids.includes(t.id))
    const clientId = tasksSel[0]!.clientId
    if (!tasksSel.every((t) => t.clientId === clientId)) {
      toast({
        variant: "error",
        title: "Tasks d'un même client",
        description: "Sélectionne uniquement des tasks d'un même client.",
      })
      return
    }
    router.push(`/billing/new?clientId=${clientId}&taskIds=${ids.join(",")}`)
  }

  function handleSync() {
    sync.mutate()
  }

  const selectedTasks = tasks.filter((t) => selected.has(t.id))
  const selectionAllNonBillable =
    selectedTasks.length > 0 && selectedTasks.every((t) => !t.billable)

  function confirmNonBillable(reason: NonBillableReason, note: string | null) {
    bulkBillability.mutate(
      {
        taskIds: [...selected],
        billable: false,
        nonBillableReason: reason,
        nonBillableNote: note,
      },
      {
        onSuccess: () => {
          setBillabilityDialogOpen(false)
          setSelected(new Set())
        },
      },
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

  return (
    <div className="m-screen">
      <MobileTopbar
        title="Tasks"
        action={
          <button
            type="button"
            className={"m-topbar-action " + (isSyncing ? "" : "primary")}
            onClick={handleSync}
            disabled={isSyncing}
            aria-label={
              isSyncing ? syncProgress.buttonLabel : "Synchroniser Linear"
            }
          >
            <Icon name="sync" size={15} className={isSyncing ? "spin" : ""} />
          </button>
        }
      />

      <div className="m-content">
        <div className="big-header">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="big-title" style={{ fontSize: 24 }}>
              Linear · Tasks
            </div>
          </div>
        </div>

        <div className="m-stack">
          <SegmentedControl<Filter>
            options={[
              { id: "all", label: "Tous", count: counts?.all },
              { id: "pending", label: "À facturer", count: counts?.pending },
              { id: "done", label: "Done" },
              { id: "invoiced", label: "Facturée", count: counts?.invoiced },
              {
                id: "non_billable",
                label: "Non facturable",
                count: counts?.non_billable,
              },
            ]}
            value={filter}
            onChange={setFilter}
            scrollable
            label="Filtrer par statut"
          />

          {unestimatedCount > 0 && (
            <div className="xs muted row gap-8">
              <Icon name="alert" size={12} />
              <span>
                {unestimatedCount} tâche{unestimatedCount > 1 ? "s" : ""} à
                facturer sans estimation — 0 € dans le pipeline
              </span>
            </div>
          )}

          {grouped.map(({ client, tasks: clientTasks }) => {
            if (!client) return null
            return (
              <div key={client.id} className="col gap-8">
                <div className="row gap-8" style={{ padding: "4px 0" }}>
                  <div
                    className="av av-sm"
                    style={{
                      background:
                        client.color ??
                        avatarColor(`${client.firstName}${client.lastName}`),
                    }}
                  >
                    {initials(`${client.firstName} ${client.lastName}`)}
                  </div>
                  <div className="grow">
                    <div className="small strong">
                      {client.company ??
                        `${client.firstName} ${client.lastName}`}
                    </div>
                    <div className="xs muted">
                      {clientTasks.length} task
                      {clientTasks.length > 1 ? "s" : ""} ·{" "}
                      {client.billingMode === "DAILY"
                        ? `${client.rate}€/j`
                        : client.billingMode === "HOURLY"
                          ? `${client.rate}€/h`
                          : "Forfait"}
                    </div>
                  </div>
                </div>

                {clientTasks.map((t) => {
                  const isSel = selected.has(t.id)
                  const value = isPipelineEligible(t, client)
                    ? pipelineValueForTask({
                        billingMode: client.billingMode,
                        rate: client.rate,
                        estimateDays: t.estimate,
                      })
                    : 0
                  return (
                    <div
                      key={t.id}
                      className={"task-item" + (isSel ? " selected" : "")}
                      style={{
                        opacity: t.invoiceId || !t.billable ? 0.7 : 1,
                      }}
                    >
                      <button
                        type="button"
                        className="task-item-hit"
                        onClick={() => !t.invoiceId && toggle(t.id)}
                        disabled={t.invoiceId != null}
                      >
                        <div className="row gap-8">
                          <div
                            className={
                              "checkbox-circle" + (isSel ? " checked" : "")
                            }
                          >
                            {isSel && <Icon name="check" size={13} />}
                          </div>
                          <TaskIdLink
                            identifier={t.linearIdentifier}
                            url={t.linearUrl}
                            className="task-id"
                            stopPropagation
                          />
                          <span
                            className={
                              "pill pill-no-dot xs " +
                              (t.status === "DONE"
                                ? "pill-paid"
                                : t.status === "IN_PROGRESS"
                                  ? "pill-draft"
                                  : "pill-pending")
                            }
                            style={{ marginLeft: "auto" }}
                          >
                            {t.status === "DONE"
                              ? "Done"
                              : t.status === "IN_PROGRESS"
                                ? "In Progress"
                                : "À facturer"}
                          </span>
                        </div>
                        <div className="task-title">{t.title}</div>
                        {!t.billable && t.nonBillableReason && (
                          <span
                            className="pill pill-no-dot xs pill-draft"
                            title={t.nonBillableNote ?? undefined}
                          >
                            {NON_BILLABLE_REASON_LABELS[t.nonBillableReason]}
                          </span>
                        )}
                      </button>
                      <div className="task-meta">
                        <span>
                          <Icon name="clock" size={11} /> {t.estimate ?? "—"}j
                        </span>
                        <span>·</span>
                        <span className="num">{fmtEUR(value)}</span>
                        {t.invoiceId && (
                          <>
                            <span>·</span>
                            <span style={{ color: "var(--accent)" }}>
                              Facturée
                            </span>
                          </>
                        )}
                        <span className="task-effort-inline">
                          <span aria-hidden="true">réel</span>
                          <TaskEffortInput
                            taskId={t.id}
                            actualDays={t.actualDays}
                            className="num"
                            disabled={t.invoiceId != null}
                          />
                          <span aria-hidden="true">j</span>
                        </span>
                        {t.completedAt && (
                          <span style={{ marginLeft: "auto" }}>
                            {fmtRelative(t.completedAt)}
                          </span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )
          })}

          {!isPending && filtered.length === 0 && tasks.length === 0 && (
            <div className="empty">
              <div className="empty-title">Aucune task</div>
              <div>Change le filtre ou sync depuis Linear.</div>
            </div>
          )}
          {!isPending &&
            filtered.length === 0 &&
            tasks.length > 0 &&
            filter === DEFAULT_STATUS_FILTER && (
              <div className="empty">
                <div className="empty-title">Aucune task à facturer</div>
                <div>
                  Le filtre « À facturer » est actif par défaut. Les tasks en
                  backlog ou annulées ne sont jamais listées ici.
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => setFilter("all")}
                >
                  Voir toutes les tasks
                </button>
              </div>
            )}
          {!isPending &&
            filtered.length === 0 &&
            tasks.length > 0 &&
            filter === "all" && (
              <div className="empty">
                <div className="empty-title">Aucune task active</div>
                <div>
                  Toutes tes tasks sont en backlog ou annulées, elles ne sont
                  pas affichées ici
                </div>
              </div>
            )}
          {!isPending &&
            filtered.length === 0 &&
            tasks.length > 0 &&
            filter !== DEFAULT_STATUS_FILTER &&
            filter !== "all" && (
              <div className="empty">
                <div className="empty-title">Aucun résultat</div>
                <div>Aucune task ne correspond au filtre actuel</div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  style={{ marginTop: 12 }}
                  onClick={() => setFilter(DEFAULT_STATUS_FILTER)}
                >
                  Réinitialiser le filtre
                </button>
              </div>
            )}

          <InfiniteScrollSentinel
            hasNextPage={Boolean(hasNextPage)}
            isFetchingNextPage={isFetchingNextPage}
            fetchNextPage={() => fetchNextPage()}
          />
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky-cta">
          <div className="grow">
            <div className="strong small">
              {selected.size} task{selected.size > 1 ? "s" : ""}
            </div>
            <div className="xs muted">
              prête{selected.size > 1 ? "s" : ""} pour la facturation
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelected(new Set())}
          >
            Annuler
          </button>
          {selectionAllNonBillable ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={restoreSelectedBillable}
              disabled={bulkBillability.isPending}
            >
              <Icon name="eye" size={13} />
              Facturable
            </button>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={() => setBillabilityDialogOpen(true)}
                disabled={bulkBillability.isPending}
              >
                <Icon name="eye-off" size={13} />
                Non facturable
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={startInvoice}
              >
                <Icon name="invoice" size={13} />
                Facturer
              </button>
            </>
          )}
        </div>
      )}

      <NonBillableDialog
        open={billabilityDialogOpen}
        taskCount={selected.size}
        isPending={bulkBillability.isPending}
        onCancel={() => setBillabilityDialogOpen(false)}
        onConfirm={confirmNonBillable}
      />
    </div>
  )
}
