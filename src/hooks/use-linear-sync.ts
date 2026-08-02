"use client"

import {
  useTaskSyncProgress,
  useTaskSyncStatus,
  useTaskSyncWatcher,
  type TaskSyncIdleDTO,
  type TaskSyncProgress,
  type TaskSyncRunDTO,
  type TaskSyncStatusDTO,
} from "@/hooks/use-task-sync"

const LINEAR = { providerId: "linear", displayName: "Linear" } as const

/** @deprecated Use the provider-neutral types from `use-task-sync`. */
export type LinearSyncRunDTO = TaskSyncRunDTO
export type LinearSyncIdleDTO = TaskSyncIdleDTO
export type LinearSyncStatusDTO = TaskSyncStatusDTO
export type LinearSyncProgress = TaskSyncProgress

/** @deprecated Use `useTaskSyncStatus("linear")`. */
export function useLinearSyncStatus() {
  return useTaskSyncStatus(LINEAR.providerId)
}

/** @deprecated Use `useTaskSyncProgress("linear")`. */
export function useLinearSyncProgress() {
  return useTaskSyncProgress(LINEAR.providerId)
}

/** @deprecated Use `useTaskSyncWatcher(...)`. */
export function useLinearSyncWatcher() {
  return useTaskSyncWatcher(LINEAR)
}
