import { useMemo } from "react"
import { useTranslations } from "next-intl"
import type { HistoryEntryDTO } from "@/components/tasks/types"
import { formatDate } from "./utils"

export function HistoryRow({
  entry,
  isLast,
}: {
  entry: HistoryEntryDTO
  isLast: boolean
}) {
  const t = useTranslations("taskDetail")

  const PRIORITY_LABELS: Record<number, string> = useMemo(
    () => ({
      0: t("priorities.noPriority"),
      1: t("priorities.urgent"),
      2: t("priorities.high"),
      3: t("priorities.medium"),
      4: t("priorities.low"),
    }),
    [t],
  )

  const parts: string[] = []
  const actorName = entry.actor?.name ?? t("someone")

  if (entry.fromState && entry.toState) {
    parts.push(
      t("history.movedFromTo", {
        from: entry.fromState.name,
        to: entry.toState.name,
      }),
    )
  } else if (entry.toState) {
    parts.push(t("history.setStatusTo", { to: entry.toState.name }))
  }

  if (entry.fromAssignee && entry.toAssignee) {
    parts.push(
      t("history.reassignedFromTo", {
        from: entry.fromAssignee.name,
        to: entry.toAssignee.name,
      }),
    )
  } else if (entry.toAssignee) {
    parts.push(t("history.assignedTo", { to: entry.toAssignee.name }))
  } else if (entry.fromAssignee && !entry.toAssignee) {
    parts.push(t("history.unassigned", { from: entry.fromAssignee.name }))
  }

  if (
    entry.fromPriority !== undefined &&
    entry.toPriority !== undefined &&
    entry.fromPriority !== entry.toPriority
  ) {
    parts.push(
      t("history.changedPriority", {
        from: PRIORITY_LABELS[entry.fromPriority] ?? String(entry.fromPriority),
        to: PRIORITY_LABELS[entry.toPriority] ?? String(entry.toPriority),
      }),
    )
  }

  if (parts.length === 0) return null

  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className="mt-1.5 h-2 w-2 rounded-full bg-border" />
        {!isLast && <div className="w-px flex-1 bg-border/50" />}
      </div>
      <div className="pb-4">
        <p className="text-sm text-text-primary">
          <span className="font-medium">{actorName}</span>{" "}
          <span className="text-text-secondary">{parts.join(", ")}</span>
        </p>
        <p className="mt-0.5 text-xs text-text-muted">
          {formatDate(entry.createdAt)}
        </p>
      </div>
    </div>
  )
}
