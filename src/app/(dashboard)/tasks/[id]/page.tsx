"use client"

import { useState, useCallback, useRef } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import Markdown from "react-markdown"
import remarkGfm from "remark-gfm"
import remarkBreaks from "remark-breaks"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"

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
  ChatBubbleLeftIcon,
  PaperClipIcon,
  ArrowsRightLeftIcon,
  ExclamationCircleIcon,
} from "@heroicons/react/20/solid"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"

import { useTaskDetail } from "@/hooks/use-task-detail"

import type {
  TaskDetailResponse,
  CommentDTO,
  AttachmentDTO,
  HistoryEntryDTO,
} from "@/components/tasks/types"

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
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
  const queryClient = useQueryClient()
  const t = useTranslations("taskDetail")

  const { data, isLoading, error } = useTaskDetail(id)

  const [isEditingEstimate, setIsEditingEstimate] = useState(false)
  const [estimateValue, setEstimateValue] = useState("")
  const estimateInputRef = useRef<HTMLInputElement>(null)

  const handleToggleToInvoice = useCallback(
    async (value: boolean) => {
      if (!data?.client) return

      queryClient.setQueryData<TaskDetailResponse>(
        ["task-detail", id],
        (prev) =>
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
    [data, id, queryClient],
  )

  const handleToggleInvoiced = useCallback(
    async (value: boolean) => {
      if (!data?.client) return

      queryClient.setQueryData<TaskDetailResponse>(
        ["task-detail", id],
        (prev) =>
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
    [data, id, queryClient],
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

    queryClient.setQueryData<TaskDetailResponse>(["task-detail", id], (prev) =>
      prev ? { ...prev, issue: { ...prev.issue, estimate: parsed } } : prev,
    )

    await fetch(`/api/linear/issues/${id}/estimate`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ estimate: parsed }),
    })
  }, [estimateValue, data?.issue.estimate, id, queryClient])

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
          {t("back")}
        </button>
        <Card className="py-0">
          <CardContent>
            <div className="py-8 text-center">
              <p className="text-text-secondary">
                {error instanceof Error ? error.message : t("taskNotFound")}
              </p>
              <Link
                href="/tasks"
                className="mt-4 inline-block text-sm text-primary hover:underline"
              >
                {t("returnToTasks")}
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
          {t("backToTasks")}
        </button>
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-sm text-text-secondary transition-colors hover:bg-accent hover:text-text-primary"
        >
          {t("openInLinear")}
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
          <Card className="py-0">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
                {t("description")}
              </h3>
              {issue.description ? (
                <div className="linear-markdown">
                  <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>
                    {issue.description}
                  </Markdown>
                </div>
              ) : (
                <p className="text-sm italic text-text-muted">
                  {t("noDescription")}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Attachments */}
          {issue.attachments.length > 0 && (
            <Card className="py-0">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
                  <PaperClipIcon className="h-4 w-4" />
                  {t("attachments")} ({issue.attachments.length})
                </h3>
                <div className="space-y-2">
                  {issue.attachments.map((attachment) => (
                    <AttachmentRow
                      key={attachment.id}
                      attachment={attachment}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Comments */}
          <Card className="py-0">
            <CardContent className="p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
                <ChatBubbleLeftIcon className="h-4 w-4" />
                {t("comments")} ({issue.comments.length})
              </h3>
              {issue.comments.length > 0 && (
                <div className="space-y-4 mb-5">
                  {issue.comments.map((comment) => (
                    <CommentCard key={comment.id} comment={comment} />
                  ))}
                </div>
              )}
              <AddCommentForm issueId={id} />
            </CardContent>
          </Card>

          {/* Activity / History */}
          {issue.history.length > 0 && (
            <Card className="py-0">
              <CardContent className="p-6">
                <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4 flex items-center gap-2">
                  <ArrowsRightLeftIcon className="h-4 w-4" />
                  {t("activity")} ({issue.history.length})
                </h3>
                <div className="space-y-0">
                  {issue.history.map((entry, i) => (
                    <HistoryRow
                      key={entry.id}
                      entry={entry}
                      isLast={i === issue.history.length - 1}
                    />
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right column: Sidebar */}
        <div className="space-y-4">
          {/* Priority card */}
          <Card className="py-0">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-3">
                {t("priority")}
              </h3>
              <div className="flex items-center gap-2.5">
                <ExclamationCircleIcon
                  className={`h-5 w-5 ${
                    issue.priority <= 1
                      ? "text-red-500"
                      : issue.priority === 2
                        ? "text-orange-500"
                        : issue.priority === 3
                          ? "text-yellow-500"
                          : "text-blue-500"
                  }`}
                />
                <span
                  className={`inline-flex items-center rounded-md px-2.5 py-1 text-sm font-medium ${priorityStyle}`}
                >
                  {issue.priorityLabel}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Details card */}
          <Card className="py-0">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
                {t("details")}
              </h3>
              <div className="space-y-3.5">
                <SidebarRow
                  icon={<UserIcon className="h-4 w-4" />}
                  label={t("assignee")}
                  value={issue.assignee?.name ?? t("unassigned")}
                />
                <SidebarRow
                  icon={<FolderIcon className="h-4 w-4" />}
                  label={t("project")}
                  value={issue.projectName ?? "-"}
                />
                <div className="flex items-center gap-3">
                  <ClockIcon className="h-4 w-4 shrink-0 text-text-muted" />
                  <span className="text-sm text-text-secondary">
                    {t("estimate")}
                  </span>
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
                    label={t("dueDate")}
                    value={formatDate(issue.dueDate)}
                  />
                )}

                <Separator />

                <SidebarRow
                  icon={<CalendarDaysIcon className="h-4 w-4" />}
                  label={t("created")}
                  value={formatDate(issue.createdAt)}
                />
                <SidebarRow
                  icon={<CalendarDaysIcon className="h-4 w-4" />}
                  label={t("updated")}
                  value={formatDate(issue.updatedAt)}
                />
                {issue.completedAt && (
                  <SidebarRow
                    icon={<CheckCircleIcon className="h-4 w-4" />}
                    label={t("completed")}
                    value={formatDate(issue.completedAt)}
                  />
                )}
              </div>
            </CardContent>
          </Card>

          {/* Billing card */}
          <Card className="py-0">
            <CardContent className="p-5">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-text-secondary mb-4">
                {t("billing")}
              </h3>
              {client ? (
                <div className="space-y-3.5">
                  <SidebarRow
                    icon={<UserIcon className="h-4 w-4" />}
                    label={t("client")}
                    value={client.name}
                  />
                  <SidebarRow
                    icon={<TagIcon className="h-4 w-4" />}
                    label={t("billingMode")}
                    value={client.billingMode}
                  />
                  <SidebarRow
                    icon={<CurrencyEuroIcon className="h-4 w-4" />}
                    label={t("rate")}
                    value={`${client.rate} EUR`}
                  />

                  {billing && (
                    <>
                      <Separator />
                      <div className="rounded-lg bg-surface-muted/50 p-3">
                        <div className="flex items-baseline justify-between">
                          <span className="text-sm text-text-secondary">
                            {t("amount")}
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
                      {t("toInvoice")}
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
                      {t("invoicedLabel")}
                    </span>
                    {invoiced ? (
                      <button
                        onClick={() => handleToggleInvoiced(false)}
                        className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 transition-colors hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
                      >
                        <CheckCircleIcon className="h-3.5 w-3.5" />
                        {t("invoicedStatus")}
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleInvoiced(true)}
                        className="inline-flex items-center rounded-full bg-surface-muted px-2.5 py-0.5 text-xs font-medium text-text-secondary transition-colors hover:bg-border"
                      >
                        {t("notInvoiced")}
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <p className="text-sm italic text-text-muted">
                  {t("noClientMapped")}
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

function CommentCard({ comment }: { comment: CommentDTO }) {
  const t = useTranslations("taskDetail")

  return (
    <div className="rounded-lg border border-border/50 p-3.5">
      <div className="flex items-center gap-2 mb-2">
        {comment.user?.avatarUrl ? (
          <img
            src={comment.user.avatarUrl}
            alt={comment.user.name}
            className="h-6 w-6 rounded-full"
          />
        ) : (
          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary/10 text-xs font-medium text-primary">
            {comment.user?.name?.charAt(0) ?? "?"}
          </div>
        )}
        <span className="text-sm font-medium text-text-primary">
          {comment.user?.name ?? t("unknown")}
        </span>
        <span className="text-xs text-text-muted">
          {formatDate(comment.createdAt)}
        </span>
      </div>
      <div className="linear-markdown text-[0.85rem]">
        <Markdown remarkPlugins={[remarkGfm, remarkBreaks]}>
          {comment.body}
        </Markdown>
      </div>
    </div>
  )
}

function AttachmentRow({ attachment }: { attachment: AttachmentDTO }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-surface-muted/50"
    >
      <PaperClipIcon className="h-4 w-4 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {attachment.title}
        </p>
        {attachment.subtitle && (
          <p className="truncate text-xs text-text-muted">
            {attachment.subtitle}
          </p>
        )}
      </div>
      <span className="text-xs text-text-muted">
        {formatDate(attachment.createdAt)}
      </span>
    </a>
  )
}

function HistoryRow({
  entry,
  isLast,
}: {
  entry: HistoryEntryDTO
  isLast: boolean
}) {
  const t = useTranslations("taskDetail")

  const PRIORITY_LABELS: Record<number, string> = {
    0: t("priorities.noPriority"),
    1: t("priorities.urgent"),
    2: t("priorities.high"),
    3: t("priorities.medium"),
    4: t("priorities.low"),
  }

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
      <div className={`pb-4 ${isLast ? "" : ""}`}>
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

function AddCommentForm({ issueId }: { issueId: string }) {
  const t = useTranslations("taskDetail")
  const [body, setBody] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const queryClient = useQueryClient()
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault()
      const trimmed = body.trim()
      if (!trimmed) return

      setIsSubmitting(true)
      try {
        const res = await fetch(`/api/linear/issues/${issueId}/comments`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ body: trimmed }),
        })

        if (!res.ok) throw new Error(t("failedToComment"))

        const newComment = await res.json()

        queryClient.setQueryData<TaskDetailResponse>(
          ["task-detail", issueId],
          (prev) =>
            prev
              ? {
                  ...prev,
                  issue: {
                    ...prev.issue,
                    comments: [...prev.issue.comments, newComment],
                  },
                }
              : prev,
        )

        setBody("")
        if (textareaRef.current) {
          textareaRef.current.style.height = "auto"
        }
      } finally {
        setIsSubmitting(false)
      }
    },
    [body, issueId, queryClient, t],
  )

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        handleSubmit(e)
      }
    },
    [handleSubmit],
  )

  const handleInput = useCallback(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = "auto"
    el.style.height = `${el.scrollHeight}px`
  }, [])

  const modKey =
    typeof navigator !== "undefined" && navigator.platform?.includes("Mac")
      ? "Cmd"
      : "Ctrl"

  return (
    <form onSubmit={handleSubmit} className="space-y-2">
      <textarea
        ref={textareaRef}
        value={body}
        onChange={(e) => setBody(e.target.value)}
        onKeyDown={handleKeyDown}
        onInput={handleInput}
        placeholder={t("addComment")}
        rows={2}
        className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
      />
      <div className="flex items-center justify-between">
        <span className="text-xs text-text-muted">
          {t("sendShortcut", { key: modKey })}
        </span>
        <button
          type="submit"
          disabled={!body.trim() || isSubmitting}
          className="inline-flex items-center gap-1.5 rounded-full bg-primary px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSubmitting ? t("sending") : t("comment")}
        </button>
      </div>
    </form>
  )
}
