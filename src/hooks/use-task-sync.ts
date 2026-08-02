"use client"

import { useEffect, useRef } from "react"
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { useRouter } from "next/navigation"
import { api, isApiErrorWithStatus } from "@/lib/api-client"
import { qk } from "@/hooks/query-keys"
import { useToast } from "@/components/providers/toast-provider"

const RUNNING_POLL_MS = 1_000
const IDLE_POLL_MS = 15_000

export interface TaskSyncRunDTO {
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

export interface TaskSyncIdleDTO {
  status: "idle"
}

export type TaskSyncStatusDTO = TaskSyncRunDTO | TaskSyncIdleDTO

export interface TaskSyncProgress {
  isRunning: boolean
  currentLabel: string | null
  countLabel: string | null
  buttonLabel: string
  doneMappings: number
  totalMappings: number
}

interface TaskProviderUI {
  providerId: string
  displayName: string
}

const SYNCING_LABEL = "Synchronisation…"
const IDLE_PROGRESS: TaskSyncProgress = {
  isRunning: false,
  currentLabel: null,
  countLabel: null,
  buttonLabel: SYNCING_LABEL,
  doneMappings: 0,
  totalMappings: 0,
}

export function useTaskSyncStatus(providerId: string) {
  return useQuery({
    queryKey: qk.taskSync.status(providerId),
    queryFn: () =>
      api.get<TaskSyncStatusDTO>(`/api/task-sync/${providerId}/sync-status`),
    staleTime: 0,
    refetchInterval: (query) =>
      query.state.data?.status === "RUNNING" ? RUNNING_POLL_MS : IDLE_POLL_MS,
  })
}

export function useTaskSyncProgress(providerId: string): TaskSyncProgress {
  const { data } = useTaskSyncStatus(providerId)
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

export function useTaskSyncWatcher({
  providerId,
  displayName,
}: TaskProviderUI) {
  const { data } = useTaskSyncStatus(providerId)
  const qc = useQueryClient()
  const router = useRouter()
  const { toast } = useToast()
  const previousStatus = useRef<TaskSyncStatusDTO["status"] | null>(null)

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
        title: `Synchronisation ${displayName} terminée`,
        description: `${data.tasksUpserted} tasks · ${data.projectsUpserted} projets mis à jour.`,
      })
    } else {
      const message =
        data && data.status === "FAILED" ? data.errorMessage : null
      toast({
        variant: "error",
        title: `Synchronisation ${displayName} échouée`,
        description: message ?? "Réessaie dans quelques instants.",
      })
    }

    router.refresh()
  }, [data, displayName, qc, router, toast])
}

export function useTriggerTaskSync({
  providerId,
  displayName,
}: TaskProviderUI) {
  const qc = useQueryClient()
  const { toast } = useToast()
  return useMutation({
    mutationFn: () =>
      api.post<{ status: string; runId: string }>(
        `/api/task-sync/${providerId}/refresh`,
      ),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.taskSync.status(providerId) })
      toast({
        variant: "success",
        title: `Synchronisation ${displayName} lancée…`,
        description: "Les résultats apparaîtront dans quelques instants.",
      })
    },
    onError: (error) => {
      if (isApiErrorWithStatus(error, 409)) {
        qc.invalidateQueries({ queryKey: qk.taskSync.status(providerId) })
        toast({
          variant: "info",
          title: "Synchronisation déjà en cours",
          description: "Patiente qu'elle se termine avant d'en relancer une.",
        })
        return
      }
      toast({
        variant: "error",
        title: "Sync échouée",
        description: error instanceof Error ? error.message : String(error),
      })
    },
  })
}
