"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"

import { TaskStatusBadge } from "@/components/tasks/task-status-badge"
import {
  ArrowLeftIcon,
  ArrowTopRightOnSquareIcon,
  ClockIcon,
  CurrencyEuroIcon,
  UserIcon,
  FolderIcon,
  TagIcon,
  CalendarDaysIcon,
  CheckCircleIcon,
} from "@heroicons/react/20/solid"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import { normalizeLineBreaks } from "@/lib/format"

import type { TaskDetailResponse } from "@/components/tasks/types"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  })
}

function formatAmount(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "EUR",
  }).format(amount)
}

/** Priority label to visual style mapping. */
const PRIORITY_STYLES: Record<string, string> = {
  Urgent: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  High: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  Medium:
    "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  Low: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "No priority": "bg-muted text-muted-foreground",
}

export default function TaskDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<TaskDetailResponse | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isEditingEstimate, setIsEditingEstimate] = useState(false)
  const [estimateValue, setEstimateValue] = useState("")
  const estimateInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setIsLoading(true)
      setError(null)

      const res = await fetch(`/api/linear/issues/${id}`, {
        cache: "no-store",
      })

      if (cancelled) return

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        setError(body?.error?.message ?? "Failed to load task")
        setIsLoading(false)
        return
      }

      const json: TaskDetailResponse = await res.json()
      setData(json)
      setIsLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [id])

  const handleToggleToInvoice = useCallback(
    async (value: boolean) => {
      if (!data?.client) return
      setData((prev) =>
        prev
          ? {
              ...prev,
              override: prev.override
                ? { ...prev.override, toInvoice: value }
                : {
                    linearIssueId: id,
                    toInvoice: value,
                    invoiced: false,
                    invoicedAt: null,
                    rateOverride: null,
                  },
            }
          : prev,
      )

      await fetch(`/api/tasks/${id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: data.client.id, toInvoice: value }),
      })
    },
    [data, id],
  )

  const handleToggleInvoiced = useCallback(
    async (value: boolean) => {
      if (!data?.client) return
      setData((prev) =>
        prev
          ? {
              ...prev,
              override: prev.override
                ? { ...prev.override, invoiced: value }
                : {
                    linearIssueId: id,
                    toInvoice: false,
                    invoiced: value,
                    invoicedAt: null,
                    rateOverride: null,
                  },
            }
          : prev,
      )

      await fetch(`/api/tasks/${id}/override`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ clientId: data.client.id, invoiced: value }),
      })
    },
    [data, id],
  )

  const startEditingEstimate = useCallback(() => {
    if (!data) return
    setEstimateValue(
      data.issue.estimate !== undefined ? String(data.issue.estimate) : "",
    )
    setIsEditingEstimate(true)
    setTimeout(() => estimateInputRef.current?.select(), 0)
  }, [data])

  const submitEstimate = useCallback(async () => {
    setIsEditingEstimate(false)
    const parsed = parseInt(estimateValue, 10)
    if (isNaN(parsed) || parsed < 0) return
    if (parsed === data?.issue.estimate) return

    setData((prev) =>
      prev ? { ...prev, issue: { ...prev.issue, estimate: parsed } } : prev,
    )

    await fetch(`/api/linear/issues/${id}/estimate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimate: parsed }),
    })
  }, [estimateValue, data?.issue.estimate, id])

  const handleEstimateKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter") {
        e.preventDefault()
        submitEstimate()
      } else if (e.key === "Escape") {
        setIsEditingEstimate(false)
      }
    },
    [submitEstimate],
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-6 w-96" />
        <div className="grid gap-6 lg:grid-cols-3">
          <Skeleton className="h-64 lg:col-span-2" />
          <Skeleton className="h-64" />
        </div>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back
        </button>
        <Card>
          <CardContent>
            <div className="py-8 text-center">
              <p className="text-text-secondary">{error ?? "Task not found"}</p>
              <Link
                href="/tasks"
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                Return to tasks
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const { issue, override, billing, client } = data
  const toInvoice = override?.toInvoice ?? false
  const invoiced = override?.invoiced ?? false
  const priorityStyle =
    PRIORITY_STYLES[issue.priorityLabel] ?? PRIORITY_STYLES["No priority"]

  return (
    <div className="space-y-6">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to tasks
        </button>
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-accent hover:text-text-primary"
        >
          Open in Linear
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      </div>

      {/* Header */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-sm text-text-secondary">
            {issue.identifier}
          </span>
          {issue.status && <TaskStatusBadge status={issue.status} size="md" />}
          <span
            className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ${priorityStyle}`}
          >
            {issue.priorityLabel}
          </span>
          {issue.labels.map((label) => (
            <Badge
              key={label.id}
              variant="outline"
              style={{
                backgroundColor: `${label.color}12`,
                color: label.color,
                borderColor: `${label.color}30`,
              }}
            >
              <TagIcon className="h-3 w-3 mr-0.5" />
              {label.name}
            </Badge>
          ))}
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-text-primary">
          {issue.title}
        </h1>
      </div>

      {/* Main content: 2/3 + 1/3 layout */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Left column: Description */}
        <div className="space-y-6 lg:col-span-2">
          {/* Description */}
          <Card>
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
                Description
              </h3>
              {issue.description ? (
                <div
                  className={[
                    "prose max-w-none",
                    "text-text-primary text-[0.9rem] leading-7",
                    // Headings
                    "prose-headings:text-text-primary prose-headings:font-semibold",
                    "prose-h1:text-xl prose-h1:mt-10 prose-h1:mb-4 prose-h1:pb-2 prose-h1:border-b prose-h1:border-border",
                    "prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3 prose-h2:pb-1.5 prose-h2:border-b prose-h2:border-border/50",
                    "prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2",
                    // Paragraphs and lists
                    "prose-p:my-4 prose-p:leading-7",
                    "prose-ul:my-4 prose-ul:space-y-2 prose-ul:pl-5",
                    "prose-ol:my-4 prose-ol:space-y-2 prose-ol:pl-5",
                    "prose-li:leading-7",
                    // Links
                    "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
                    // Code
                    "prose-code:rounded prose-code:bg-surface-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:text-xs prose-code:font-mono prose-code:before:content-none prose-code:after:content-none",
                    "prose-pre:bg-surface-muted prose-pre:p-4 prose-pre:rounded-lg prose-pre:my-5 prose-pre:overflow-x-auto prose-pre:text-sm prose-pre:leading-6",
                    // Blockquotes
                    "prose-blockquote:border-l-2 prose-blockquote:border-border prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-text-secondary prose-blockquote:my-5",
                    // Horizontal rules
                    "prose-hr:my-8 prose-hr:border-border",
                    // Tables
                    "prose-table:my-5 prose-th:text-left prose-th:px-3 prose-th:py-2.5 prose-th:text-xs prose-th:font-semibold prose-th:uppercase prose-th:tracking-wider prose-th:text-text-secondary prose-th:border-b prose-th:border-border prose-th:bg-surface-muted/50",
                    "prose-td:px-3 prose-td:py-2 prose-td:text-sm prose-td:border-b prose-td:border-border/50",
                    // Images
                    "prose-img:rounded-lg prose-img:my-5",
                    // Strong/emphasis
                    "prose-strong:text-text-primary prose-strong:font-semibold",
                  ].join(" ")}
                >
                  <Markdown remarkPlugins={[remarkGfm]}>
                    {normalizeLineBreaks(issue.description)}
                  </Markdown>
                </div>
              ) : (
                <p className="text-sm italic text-text-muted">
                  No description provided.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right column: Sidebar */}
        <div className="space-y-4">
          {/* Details card */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
                Details
              </h3>
              <div className="space-y-3.5">
                <SidebarRow
                  icon={<UserIcon className="h-4 w-4" />}
                  label="Assignee"
                  value={issue.assignee?.name ?? "Unassigned"}
                />
                <SidebarRow
                  icon={<FolderIcon className="h-4 w-4" />}
                  label="Project"
                  value={issue.projectName ?? "-"}
                />
                <div className="flex items-center gap-3">
                  <ClockIcon className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="text-sm text-text-secondary">Estimate</span>
                  <span className="ml-auto text-sm text-text-primary">
                    {isEditingEstimate ? (
                      <input
                        ref={estimateInputRef}
                        type="number"
                        min={0}
                        max={100}
                        value={estimateValue}
                        onChange={(e) => setEstimateValue(e.target.value)}
                        onBlur={submitEstimate}
                        onKeyDown={handleEstimateKeyDown}
                        className="w-16 rounded border border-border-input bg-surface px-1.5 py-0.5 text-right text-sm tabular-nums text-text-primary focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
                      />
                    ) : (
                      <button
                        onClick={startEditingEstimate}
                        className="cursor-pointer rounded px-1.5 py-0.5 tabular-nums hover:bg-surface-muted"
                      >
                        {issue.estimate !== undefined
                          ? `${issue.estimate}h`
                          : "-"}
                      </button>
                    )}
                  </span>
                </div>
                {issue.dueDate && (
                  <SidebarRow
                    icon={<CalendarDaysIcon className="h-4 w-4" />}
                    label="Due date"
                    value={formatDate(issue.dueDate)}
                  />
                )}

                <Separator />

                <SidebarRow
                  icon={<CalendarDaysIcon className="h-4 w-4" />}
                  label="Created"
                  value={formatDate(issue.createdAt)}
                />
                <SidebarRow
                  icon={<CalendarDaysIcon className="h-4 w-4" />}
                  label="Updated"
                  value={formatDate(issue.updatedAt)}
                />
                {issue.completedAt && (
                  <SidebarRow
                    icon={<CheckCircleIcon className="h-4 w-4" />}
                    label="Completed"
                    value={formatDate(issue.completedAt)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Billing card */}
          <Card>
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
                Billing
              </h3>
              {client ? (
                <div className="space-y-3.5">
                  <SidebarRow
                    icon={<UserIcon className="h-4 w-4" />}
                    label="Client"
                    value={client.name}
                  />
                  <SidebarRow
                    icon={<TagIcon className="h-4 w-4" />}
                    label="Mode"
                    value={client.billingMode}
                  />
                  <SidebarRow
                    icon={<CurrencyEuroIcon className="h-4 w-4" />}
                    label="Rate"
                    value={`${client.rate} EUR`}
                  />

                  {billing && (
                    <>
                      <Separator />
                      <div className="rounded-lg bg-surface-muted/50 p-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-text-secondary">
                            Amount
                          </span>
                          <span className="text-lg font-bold tabular-nums text-text-primary">
                            {formatAmount(billing.amount)}
                          </span>
                        </div>
                        <p className="mt-1 text-xs text-text-muted">
                          {billing.formula}
                        </p>
                      </div>
                    </>
                  )}

                  <Separator />

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      To invoice
                    </span>
                    <Checkbox
                      checked={toInvoice}
                      onCheckedChange={(checked) =>
                        handleToggleToInvoice(!!checked)
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-text-secondary">
                      Invoiced
                    </span>
                    {invoiced ? (
                      <button
                        onClick={() => handleToggleInvoiced(false)}
                        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        Invoiced
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleInvoiced(true)}
                        className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary transition-colors hover:bg-border"
                      >
                        Not invoiced
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm italic text-text-muted">
                  No client mapped to this task.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function SidebarRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="shrink-0 text-text-muted">{icon}</span>
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="ml-auto text-sm font-medium text-text-primary truncate max-w-[140px]">
        {value}
      </span>
    </div>
  )
}
