"use client"

import { useState, useMemo, useCallback } from "react"
import { useTranslations } from "next-intl"
import { ChevronUpIcon, ChevronDownIcon } from "@heroicons/react/20/solid"

import { Input } from "@/components/ui/input"
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

import { TaskRow } from "./task-row"

import type { EnrichedTask, TaskStatusDTO } from "./types"

type SortField = "identifier" | "title" | "estimate" | "amount"
type SortDirection = "asc" | "desc"

interface TaskTableProps {
  tasks: EnrichedTask[]
  clientRate?: number
  billingMode?: string
  availableStatuses?: TaskStatusDTO[]
  onToggleToInvoice?: (linearIssueId: string, value: boolean) => void
  onToggleInvoiced?: (linearIssueId: string, value: boolean) => void
  onUpdateEstimate?: (linearIssueId: string, estimate: number) => void
  onUpdateRate?: (linearIssueId: string, rate: number | null) => void
  onStatusChange?: (linearIssueId: string, newStatus: TaskStatusDTO) => void
}

function compareTasks(
  a: EnrichedTask,
  b: EnrichedTask,
  field: SortField,
  direction: SortDirection,
): number {
  const multiplier = direction === "asc" ? 1 : -1

  switch (field) {
    case "identifier":
      return (
        multiplier *
        a.identifier.localeCompare(b.identifier, undefined, { numeric: true })
      )
    case "title":
      return multiplier * a.title.localeCompare(b.title)
    case "estimate": {
      const aVal = a.estimate ?? -1
      const bVal = b.estimate ?? -1
      return multiplier * (aVal - bVal)
    }
    case "amount":
      return multiplier * (a.billingAmount - b.billingAmount)
    default:
      return 0
  }
}

/** Data table rendering a list of enriched tasks as TaskRow elements with sortable columns and inline search. Used inside TaskGroupList. */
export function TaskTable({
  tasks,
  clientRate,
  billingMode,
  availableStatuses,
  onToggleToInvoice,
  onToggleInvoiced,
  onUpdateEstimate,
  onUpdateRate,
  onStatusChange,
}: TaskTableProps) {
  const t = useTranslations("taskTable")
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc")
  const [search, setSearch] = useState("")

  const showRateColumn = billingMode === "HOURLY" || billingMode === "DAILY"

  const handleSort = useCallback(
    (field: SortField) => {
      if (sortField === field) {
        setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
      } else {
        setSortField(field)
        setSortDirection("asc")
      }
    },
    [sortField],
  )

  const filteredAndSortedTasks = useMemo(() => {
    const query = search.trim().toLowerCase()
    let result = tasks

    if (query) {
      result = tasks.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.identifier.toLowerCase().includes(query),
      )
    }

    if (sortField) {
      result = [...result].sort((a, b) =>
        compareTasks(a, b, sortField, sortDirection),
      )
    }

    return result
  }, [tasks, search, sortField, sortDirection])

  if (tasks.length === 0) {
    return (
      <p className="py-4 text-center text-sm text-text-secondary">
        {t("noTasks")}
      </p>
    )
  }

  function renderSortIcon(field: SortField) {
    if (sortField !== field) {
      return (
        <ChevronUpIcon className="ml-1 inline h-3.5 w-3.5 text-text-muted/40" />
      )
    }
    return sortDirection === "asc" ? (
      <ChevronUpIcon className="ml-1 inline h-3.5 w-3.5 text-text-primary" />
    ) : (
      <ChevronDownIcon className="ml-1 inline h-3.5 w-3.5 text-text-primary" />
    )
  }

  const sortableHeadClass =
    "cursor-pointer select-none text-xs font-medium uppercase tracking-wider text-text-secondary hover:text-text-primary transition-colors"

  return (
    <div>
      <div className="px-3 py-2">
        <Input
          type="text"
          placeholder={t("searchPlaceholder")}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
      </div>
      <Table>
        <TableHeader>
          <TableRow className="border-b border-border">
            {onToggleToInvoice && (
              <TableHead className="text-xs font-medium uppercase tracking-wider text-text-secondary">
                {t("bill")}
              </TableHead>
            )}
            <TableHead
              className={sortableHeadClass}
              onClick={() => handleSort("identifier")}
            >
              {t("id")}
              {renderSortIcon("identifier")}
            </TableHead>
            <TableHead
              className={sortableHeadClass}
              onClick={() => handleSort("title")}
            >
              {t("titleCol")}
              {renderSortIcon("title")}
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              {t("project")}
            </TableHead>
            <TableHead className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              {t("status")}
            </TableHead>
            <TableHead
              className={`text-right ${sortableHeadClass}`}
              onClick={() => handleSort("estimate")}
            >
              {t("estimate")}
              {renderSortIcon("estimate")}
            </TableHead>
            {showRateColumn && (
              <TableHead className="text-right text-xs font-medium uppercase tracking-wider text-text-secondary">
                {t("rate")}
              </TableHead>
            )}
            <TableHead
              className={`text-right ${sortableHeadClass}`}
              onClick={() => handleSort("amount")}
            >
              {t("amount")}
              {renderSortIcon("amount")}
            </TableHead>
            {onToggleInvoiced && (
              <TableHead className="text-center text-xs font-medium uppercase tracking-wider text-text-secondary">
                {t("invoiced")}
              </TableHead>
            )}
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSortedTasks.map((task) => (
            <TaskRow
              key={task.linearIssueId}
              task={task}
              clientRate={clientRate}
              billingMode={billingMode}
              availableStatuses={availableStatuses}
              onToggleToInvoice={onToggleToInvoice}
              onToggleInvoiced={onToggleInvoiced}
              onUpdateEstimate={onUpdateEstimate}
              onUpdateRate={onUpdateRate}
              onStatusChange={onStatusChange}
            />
          ))}
          {filteredAndSortedTasks.length === 0 && search && (
            <TableRow>
              <td
                colSpan={99}
                className="py-4 text-center text-sm text-text-secondary"
              >
                {t("noMatch", { search })}
              </td>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </div>
  )
}
