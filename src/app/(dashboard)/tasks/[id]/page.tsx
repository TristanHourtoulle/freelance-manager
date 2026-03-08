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
} from "@heroicons/react/20/solid"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"

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
        <div className="grid gap-6 md:grid-cols-2">
          <Skeleton className="h-64" />
          <Skeleton className="h-64" />
        </div>
        <Skeleton className="h-48" />
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

  return (
    <div className="space-y-6">
      {/* Back + External Link */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-text-primary"
        >
          <ArrowLeftIcon className="h-4 w-4" />
          Back to tasks
        </button>
        <a
          href={issue.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-text-secondary hover:text-primary"
        >
          Open in Linear
          <ArrowTopRightOnSquareIcon className="h-4 w-4" />
        </a>
      </div>

      {/* Header */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-medium text-text-secondary">
            {issue.identifier}
          </span>
          {issue.status && <TaskStatusBadge status={issue.status} />}
          {issue.labels.map((label) => (
            <span
              key={label.id}
              className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${label.color}18`,
                color: label.color,
                borderColor: `${label.color}40`,
              }}
            >
              {label.name}
            </span>
          ))}
        </div>
        <h1 className="text-xl font-semibold text-text-primary">
          {issue.title}
        </h1>
      </div>

      {/* Info Grid + Billing */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Details Card */}
        <Card>
          <CardContent>
            <dl className="space-y-4">
              <InfoRow label="Priority" value={issue.priorityLabel || "-"} />
              <InfoRow
                label="Assignee"
                value={issue.assignee?.name ?? "Unassigned"}
              />
              <InfoRow label="Project" value={issue.projectName ?? "-"} />
              <div className="flex items-baseline justify-between">
                <dt className="text-sm font-medium text-text-secondary">
                  Estimate
                </dt>
                <dd className="text-sm text-text-primary">
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
                      className="cursor-pointer rounded px-1.5 py-0.5 hover:bg-surface-muted"
                    >
                      {issue.estimate !== undefined
                        ? `${issue.estimate}h`
                        : "-"}
                    </button>
                  )}
                </dd>
              </div>
              {issue.dueDate && (
                <InfoRow label="Due date" value={formatDate(issue.dueDate)} />
              )}
              <InfoRow label="Created" value={formatDate(issue.createdAt)} />
              <InfoRow label="Updated" value={formatDate(issue.updatedAt)} />
            </dl>
          </CardContent>
        </Card>

        {/* Billing Card */}
        <Card>
          <CardContent>
            <h3 className="mb-4 text-sm font-semibold text-text-primary">
              Billing
            </h3>
            {client ? (
              <dl className="space-y-4">
                <InfoRow label="Client" value={client.name} />
                <InfoRow label="Billing mode" value={client.billingMode} />
                <InfoRow label="Rate" value={`${client.rate} EUR`} />
                {billing && (
                  <>
                    <InfoRow
                      label="Amount"
                      value={formatAmount(billing.amount)}
                    />
                    <InfoRow label="Formula" value={billing.formula} />
                  </>
                )}
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium text-text-secondary">
                    To invoice
                  </dt>
                  <dd>
                    <input
                      type="checkbox"
                      checked={toInvoice}
                      onChange={(e) => handleToggleToInvoice(e.target.checked)}
                      className="h-4 w-4 rounded border-border-input text-primary focus:ring-primary"
                    />
                  </dd>
                </div>
                <div className="flex items-center justify-between">
                  <dt className="text-sm font-medium text-text-secondary">
                    Invoiced
                  </dt>
                  <dd>
                    {invoiced ? (
                      <button
                        onClick={() => handleToggleInvoiced(false)}
                        className="inline-flex items-center rounded-full bg-green-100 px-2 py-0.5 text-xs font-medium text-green-700 hover:bg-green-200"
                      >
                        Invoiced
                      </button>
                    ) : (
                      <button
                        onClick={() => handleToggleInvoiced(true)}
                        className="inline-flex items-center rounded-full bg-surface-muted px-2 py-0.5 text-xs font-medium text-text-secondary hover:bg-border"
                      >
                        Not invoiced
                      </button>
                    )}
                  </dd>
                </div>
              </dl>
            ) : (
              <p className="text-sm text-text-muted">
                No client mapped to this task.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Description */}
      {issue.description && (
        <Card>
          <CardContent>
            <h3 className="mb-4 text-sm font-semibold text-text-primary">
              Description
            </h3>
            <div className="prose prose-sm max-w-none text-text-primary prose-headings:text-text-primary prose-a:text-primary prose-code:rounded prose-code:bg-surface-muted prose-code:px-1 prose-code:py-0.5 prose-code:text-sm prose-pre:bg-surface-muted">
              <Markdown remarkPlugins={[remarkGfm]}>
                {issue.description}
              </Markdown>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-sm font-medium text-text-secondary">{label}</dt>
      <dd className="text-sm text-text-primary">{value}</dd>
    </div>
  )
}
