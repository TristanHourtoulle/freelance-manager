"use client"

import { useEffect, useRef } from "react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api } from "@/lib/api-client"
import { qk } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"

const RUNNING_POLL_MS = 1_000
const IDLE_POLL_MS = 15_000

export interface LinearSyncRunDTO {
  runId: string
  status: "RUNNING" | "COMPLETED" | "FAILED"
  totalMappings: number
  doneMappings: number
  currentLabel: string | null
  projectsUpserted: number
  tasksUpserted: number
  errorMessage: string | null
  startedAt: string
  finishedAt: string | null
}

export interface LinearSyncIdleDTO {
  status: "idle"
}

export type LinearSyncStatusDTO = LinearSyncRunDTO | LinearSyncIdleDTO

/**
 * Polls the current user's latest Linear sync run.
 *
 * The cadence is driven by the payload itself: ~1s while a run is `RUNNING` so
 * the UI feels live, ~15s otherwise. Idle polling is deliberate — it costs one
 * indexed row per tick and is what makes a sync started from another tab or
 * device show up here on its own.
 */
export function useLinearSyncStatus() {
  return useQuery({
    queryKey: qk.linear.syncStatus(),
    queryFn: () => api.get<LinearSyncStatusDTO>("/api/linear/sync-status"),
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.status === "RUNNING" ? RUNNING_POLL_MS : IDLE_POLL_MS,
  })
}

export interface LinearSyncProgress {
  isRunning: boolean
  currentLabel: string | null
  countLabel: string | null
  buttonLabel: string
  doneMappings: number
  totalMappings: number
}

const SYNCING_LABEL = "Synchronisation…"

const IDLE_PROGRESS: LinearSyncProgress = {
  isRunning: false,
  currentLabel: null,
  countLabel: null,
  buttonLabel: SYNCING_LABEL,
  doneMappings: 0,
  totalMappings: 0,
}

/**
 * Derived, display-ready view of the running sync for buttons and labels.
 *
 * @returns `isRunning`, the current mapping label, a `done/total` counter and
 * the in-flight button copy, or the idle shape when no run is in progress.
 */
export function useLinearSyncProgress(): LinearSyncProgress {
  const { data } = useLinearSyncStatus()
  if (!data || data.status !== "RUNNING") return IDLE_PROGRESS

  const countLabel =
    data.totalMappings > 0 ? `${data.doneMappings}/${data.totalMappings}` : null

  return {
    isRunning: true,
    currentLabel: data.currentLabel,
    countLabel,
    buttonLabel: countLabel ? `${SYNCING_LABEL} ${countLabel}` : SYNCING_LABEL,
    doneMappings: data.doneMappings,
    totalMappings: data.totalMappings,
  }
}

/**
 * Owns Linear sync completion for the whole app.
 *
 * Watches the polled run status and reacts only on the `RUNNING → COMPLETED`
 * and `RUNNING → FAILED` edges: it invalidates every cache the sync can have
 * changed, toasts the real counts (or the server error), and refreshes the RSC
 * tree so the nav badges follow. Staying on a terminal status across later
 * polls fires nothing.
 *
 * Mount it exactly once, in the dashboard layout — one mount per page would
 * multiply the toasts.
 */
export function useLinearSyncWatcher() {
  const { data } = useLinearSyncStatus()
  const qc = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const previousStatus = useRef<LinearSyncStatusDTO["status"] | null>(null)

  useEffect(() => {
    const previous = previousStatus.current
    const current = data?.status ?? null
    previousStatus.current = current

    if (previous !== "RUNNING") return
    if (current !== "COMPLETED" && current !== "FAILED") return

    qc.invalidateQueries({ queryKey: qk.tasks.all() })
    qc.invalidateQueries({ queryKey: qk.projects() })
    qc.invalidateQueries({ queryKey: qk.dashboard() })
    qc.invalidateQueries({ queryKey: qk.settings() })

    if (current === "COMPLETED" && data && data.status === "COMPLETED") {
      toast({
        variant: "success",
        title: "Synchronisation Linear terminée",
        description: `${data.tasksUpserted} tasks · ${data.projectsUpserted} projets mis à jour.`,
      })
    } else {
      const message =
        data && data.status === "FAILED" ? data.errorMessage : null
      toast({
        variant: "error",
        title: "Synchronisation Linear échouée",
        description: message ?? "Réessaie dans quelques instants.",
      })
    }

    router.refresh()
  }, [data, qc, router, toast])
}
