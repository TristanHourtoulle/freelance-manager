"use client"

import { useCallback } from "react"
import { useTranslations } from "next-intl"
import { useRouter, usePathname, useSearchParams } from "next/navigation"
import { ChevronLeftIcon, ChevronRightIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useAuditLogs } from "@/hooks/use-audit-logs"

const AUDIT_ACTIONS = [
  "CREATE",
  "UPDATE",
  "DELETE",
  "ARCHIVE",
  "UNARCHIVE",
  "EXPORT",
  "LOGIN",
] as const

const AUDIT_ENTITIES = [
  "Client",
  "Expense",
  "Invoice",
  "TaskOverride",
  "UserSettings",
  "UserData",
  "Tag",
  "BankTransaction",
] as const

const ACTION_BADGE_COLORS: Record<string, string> = {
  CREATE:
    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  UPDATE: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  DELETE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ARCHIVE:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  UNARCHIVE:
    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  EXPORT:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  LOGIN: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
}

function formatDate(iso: string): string {
  return new Intl.DateTimeFormat("default", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(iso))
}

function buildEntityDetail(
  entity: string,
  entityId: string | null,
  metadata: Record<string, unknown> | null,
): string {
  const parts: string[] = []
  if (entityId) parts.push(entityId.slice(0, 8))
  if (metadata && typeof metadata === "object") {
    const name =
      (metadata as Record<string, unknown>).name ??
      (metadata as Record<string, unknown>).description
    if (typeof name === "string") parts.push(name)
  }
  return parts.join(" - ") || "-"
}

export default function AuditLogPage() {
  const t = useTranslations("auditLog")
  const ta = useTranslations("auditLog.actions")
  const te = useTranslations("auditLog.entities")
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const updateFilter = useCallback(
    (key: string, value: string | null) => {
      const params = new URLSearchParams(searchParams.toString())
      if (value) {
        params.set(key, value)
      } else {
        params.delete(key)
      }
      params.delete("page")
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const goToPage = useCallback(
    (page: number) => {
      const params = new URLSearchParams(searchParams.toString())
      params.set("page", String(page))
      router.push(`${pathname}?${params.toString()}`, { scroll: false })
    },
    [router, pathname, searchParams],
  )

  const { data, isLoading } = useAuditLogs(searchParams.toString())

  const logs = data?.items ?? []
  const pagination = data?.pagination

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <p className="text-sm text-muted-foreground">{t("description")}</p>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2.5">
        <Select
          value={searchParams.get("action") ?? ""}
          onValueChange={(val) => updateFilter("action", val || null)}
        >
          <SelectTrigger
            className="w-[180px]"
            style={{ borderRadius: "19px 12px 12px 19px" }}
          >
            <SelectValue placeholder={t("allActions")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("allActions")}</SelectItem>
            {AUDIT_ACTIONS.map((action) => (
              <SelectItem key={action} value={action}>
                {ta(action)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={searchParams.get("entity") ?? ""}
          onValueChange={(val) => updateFilter("entity", val || null)}
        >
          <SelectTrigger
            className="w-[180px]"
            style={{ borderRadius: "12px 19px 19px 12px" }}
          >
            <SelectValue placeholder={t("allEntities")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="">{t("allEntities")}</SelectItem>
            {AUDIT_ENTITIES.map((entity) => (
              <SelectItem key={entity} value={entity}>
                {te(entity)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-12 rounded-xl" />
          ))}
        </div>
      ) : logs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">{t("noLogs")}</p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface overflow-hidden">
          {/* Header */}
          <div className="hidden sm:grid sm:grid-cols-[180px_120px_120px_1fr] gap-4 px-5 py-3 border-b border-border bg-muted/30">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("dateCol")}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("actionCol")}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("entityCol")}
            </span>
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {t("detailsCol")}
            </span>
          </div>

          {/* Rows */}
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div
                key={log.id}
                className="grid sm:grid-cols-[180px_120px_120px_1fr] gap-2 sm:gap-4 px-5 py-3 text-sm"
              >
                <span className="text-muted-foreground">
                  {formatDate(log.createdAt)}
                </span>
                <span>
                  <span
                    className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      ACTION_BADGE_COLORS[log.action] ??
                      "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
                    }`}
                  >
                    {ta(log.action as keyof typeof ta)}
                  </span>
                </span>
                <span className="text-foreground font-medium">
                  {te(log.entity as keyof typeof te)}
                </span>
                <span className="text-muted-foreground truncate">
                  {buildEntityDetail(
                    log.entity,
                    log.entityId,
                    log.metadata as Record<string, unknown> | null,
                  )}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Pagination */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2.5">
          <Button
            variant="outline"
            shape="pill-left"
            size="lg"
            disabled={pagination.page <= 1}
            onClick={() => goToPage(pagination.page - 1)}
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <span className="px-3 text-sm text-muted-foreground">
            {pagination.page} / {pagination.totalPages}
          </span>
          <Button
            variant="outline"
            shape="pill-right"
            size="lg"
            disabled={pagination.page >= pagination.totalPages}
            onClick={() => goToPage(pagination.page + 1)}
          >
            <ChevronRightIcon className="size-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
