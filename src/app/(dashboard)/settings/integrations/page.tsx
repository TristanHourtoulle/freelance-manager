"use client"

import { useCallback, useState } from "react"
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClipboardIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { useQueryClient } from "@tanstack/react-query"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/providers/toast-provider"
import {
  useLinearTokenStatus,
  useWebhookStatus,
  useLinearCacheStatus,
} from "@/hooks/use-settings"

function formatTimeAgo(ts: number | null): string {
  if (!ts) return "Never"
  const diff = Math.floor((Date.now() - ts) / 1000)
  if (diff < 60) return "Just now"
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`
  return `${Math.floor(diff / 86400)}d ago`
}

export default function IntegrationsSettingsPage() {
  const { toast } = useToast()
  const t = useTranslations("settingsIntegrations")
  const queryClient = useQueryClient()

  const { data: tokenStatus, isLoading: isTokenLoading } =
    useLinearTokenStatus()
  const { data: webhook, isLoading: isWebhookLoading } = useWebhookStatus()
  const { data: sync, isLoading: isSyncLoading } = useLinearCacheStatus()

  // Local UI state
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const isLoading = isTokenLoading || isWebhookLoading || isSyncLoading

  const handleSaveToken = useCallback(async () => {
    if (!token.trim()) return
    setIsSaving(true)
    const res = await fetch("/api/settings/linear-token", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: token.trim() }),
    })
    const data = await res.json()
    setIsSaving(false)
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["linear-token-status"] })
      setToken("")
      setShowToken(false)
      toast({
        variant: "success",
        title: t("toasts.tokenSaved"),
      })
    } else {
      toast({
        variant: "error",
        title: data.error?.message ?? "Failed to save token",
      })
    }
  }, [token, toast, t, queryClient])

  const handleDeleteToken = useCallback(async () => {
    setIsDeleting(true)
    const res = await fetch("/api/settings/linear-token", { method: "DELETE" })
    setIsDeleting(false)
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["linear-token-status"] })
      toast({ variant: "success", title: t("toasts.tokenRemoved") })
    } else {
      toast({ variant: "error", title: t("toasts.tokenRemoveError") })
    }
  }, [toast, t, queryClient])

  const handleCopyUrl = useCallback(async () => {
    if (!webhook?.webhookUrl) return
    await navigator.clipboard.writeText(webhook.webhookUrl)
    toast({ variant: "success", title: t("toasts.webhookCopied") })
  }, [webhook, toast, t])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    const res = await fetch("/api/linear/refresh", { method: "POST" })
    if (res.ok) {
      queryClient.invalidateQueries({ queryKey: ["linear-cache-status"] })
    }
    setIsRefreshing(false)
    toast({ variant: "success", title: t("toasts.refreshed") })
  }, [toast, t, queryClient])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      {/* Linear API Token */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {t("apiToken")}
          </h2>
          {tokenStatus?.configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="size-3" />
              {t("connected")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <ExclamationTriangleIcon className="size-3" />
              {t("notConfigured")}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">{t("tokenDesc")}</p>

        {tokenStatus?.configured && tokenStatus.maskedToken && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-secondary/50 px-3 py-2">
            <code className="text-xs text-muted-foreground">
              {tokenStatus.maskedToken}
            </code>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={handleDeleteToken}
              isLoading={isDeleting}
              title={t("removeToken")}
              className="ml-auto text-destructive hover:bg-destructive/10"
            >
              <TrashIcon className="size-3.5" />
            </Button>
          </div>
        )}

        <div className="mt-4 flex items-center gap-2.5">
          <div className="relative flex-1">
            <Input
              type={showToken ? "text" : "password"}
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder={
                tokenStatus?.configured
                  ? t("tokenPlaceholderReplace")
                  : t("tokenPlaceholderNew")
              }
              className="h-[38px] pl-4 pr-9 font-mono text-xs"
              style={{ borderRadius: "19px 12px 12px 19px" }}
            />
            <button
              type="button"
              onClick={() => setShowToken((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showToken ? (
                <EyeSlashIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          </div>
          <Button
            variant="gradient"
            size="lg"
            onClick={handleSaveToken}
            disabled={!token.trim()}
            isLoading={isSaving}
            style={{ borderRadius: "12px 19px 19px 12px" }}
          >
            {tokenStatus?.configured ? t("updateButton") : t("connectButton")}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {t.rich("tokenInstructions", {
            path: () => (
              <span className="font-medium text-foreground">
                {t("tokenPath")}
              </span>
            ),
          })}
        </p>
      </div>

      {/* Webhook Configuration */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">
            {t("webhook")}
          </h2>
          {webhook?.configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="size-3" />
              {t("configured")}
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <ExclamationTriangleIcon className="size-3" />
              {t("notConfigured")}
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          {t.rich("webhookDesc", {
            path: () => (
              <span className="font-medium text-foreground">
                {t("webhookPath")}
              </span>
            ),
          })}
        </p>

        {webhook?.webhookUrl && (
          <div className="mt-3 flex items-center gap-2 rounded-lg bg-surface-secondary/50 px-3 py-2">
            <code className="flex-1 truncate text-xs text-muted-foreground">
              {webhook.webhookUrl}
            </code>
            <Button
              variant="outline"
              size="sm"
              shape="pill"
              onClick={handleCopyUrl}
            >
              <ClipboardIcon className="size-3.5" />
              {t("copyButton")}
            </Button>
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          {t.rich("webhookSecretNote", {
            code: () => (
              <code className="rounded bg-muted px-1">
                LINEAR_WEBHOOK_SECRET
              </code>
            ),
          })}
        </p>
      </div>

      {/* Sync Status */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">
              {t("syncStatus")}
            </h2>
            {sync && (
              <span
                className={`inline-block size-2 rounded-full ${sync.isStale ? "bg-amber-500" : "bg-emerald-500"}`}
              />
            )}
          </div>
          <Button
            variant="outline"
            shape="pill"
            size="sm"
            onClick={handleRefresh}
            isLoading={isRefreshing}
          >
            <ArrowPathIcon className="size-3.5" />
            {t("refreshNow")}
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">{t("lastSync")}</p>
            <p className="text-sm font-medium text-foreground">
              {sync?.lastSyncedAt
                ? formatTimeAgo(sync.lastSyncedAt)
                : t("notSyncedYet")}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">{t("status")}</p>
            <p className="text-sm font-medium text-foreground">
              {!sync?.lastSyncedAt
                ? t("waitingForSync")
                : sync.isStale
                  ? t("stale")
                  : t("upToDate")}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
