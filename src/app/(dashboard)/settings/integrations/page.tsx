"use client"

import { useCallback, useEffect, useState } from "react"
import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClipboardIcon,
  ExclamationTriangleIcon,
  EyeIcon,
  EyeSlashIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/providers/toast-provider"

interface TokenStatus {
  configured: boolean
  maskedToken: string | null
}

interface WebhookStatus {
  configured: boolean
  webhookUrl: string | null
}

interface SyncStatus {
  lastSyncedAt: number | null
  isStale: boolean
}

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

  // Token state
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const [token, setToken] = useState("")
  const [showToken, setShowToken] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  // Webhook state
  const [webhook, setWebhook] = useState<WebhookStatus | null>(null)

  // Sync state
  const [sync, setSync] = useState<SyncStatus | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)

  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [tokenRes, webhookRes, syncRes] = await Promise.all([
        fetch("/api/settings/linear-token", { cache: "no-store" }),
        fetch("/api/settings/webhook-status", { cache: "no-store" }),
        fetch("/api/linear/cache-status", { cache: "no-store" }),
      ])
      if (cancelled) return
      if (tokenRes.ok) setTokenStatus(await tokenRes.json())
      if (webhookRes.ok) setWebhook(await webhookRes.json())
      if (syncRes.ok) setSync(await syncRes.json())
      setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

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
      setTokenStatus(data)
      setToken("")
      setShowToken(false)
      toast({
        variant: "success",
        title: "Linear API token saved and verified",
      })
    } else {
      toast({
        variant: "error",
        title: data.error?.message ?? "Failed to save token",
      })
    }
  }, [token, toast])

  const handleDeleteToken = useCallback(async () => {
    setIsDeleting(true)
    const res = await fetch("/api/settings/linear-token", { method: "DELETE" })
    setIsDeleting(false)
    if (res.ok) {
      setTokenStatus({ configured: false, maskedToken: null })
      toast({ variant: "success", title: "Linear API token removed" })
    } else {
      toast({ variant: "error", title: "Failed to remove token" })
    }
  }, [toast])

  const handleCopyUrl = useCallback(async () => {
    if (!webhook?.webhookUrl) return
    await navigator.clipboard.writeText(webhook.webhookUrl)
    toast({ variant: "success", title: "Webhook URL copied" })
  }, [webhook, toast])

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true)
    const res = await fetch("/api/linear/refresh", { method: "POST" })
    if (res.ok) {
      const data = await res.json()
      // Use the refresh response directly (cache-status may hit a different worker in dev)
      setSync({
        lastSyncedAt: data.lastSyncedAt ?? Date.now(),
        isStale: false,
      })
    }
    setIsRefreshing(false)
    toast({ variant: "success", title: "Linear data refreshed" })
  }, [toast])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title="Integrations" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title="Integrations" />

      {/* Linear API Token */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">API Token</h2>
          {tokenStatus?.configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="size-3" />
              Connected
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <ExclamationTriangleIcon className="size-3" />
              Not configured
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Connect your Linear workspace to sync tasks and track time.
        </p>

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
              title="Remove token"
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
                  ? "Enter new token to replace..."
                  : "lin_api_..."
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
            {tokenStatus?.configured ? "Update" : "Connect"}
          </Button>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Generate from{" "}
          <span className="font-medium text-foreground">
            Linear &gt; Settings &gt; API &gt; Personal API keys
          </span>
          . Encrypted with AES-256-GCM.
        </p>
      </div>

      {/* Webhook Configuration */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-foreground">Webhook</h2>
          {webhook?.configured ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
              <CheckCircleIcon className="size-3" />
              Configured
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700">
              <ExclamationTriangleIcon className="size-3" />
              Not configured
            </span>
          )}
        </div>
        <p className="mt-1 text-sm text-muted-foreground">
          Set up a webhook in Linear for real-time task sync. Add this URL in{" "}
          <span className="font-medium text-foreground">
            Linear &gt; Settings &gt; API &gt; Webhooks
          </span>
          .
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
              Copy
            </Button>
          </div>
        )}

        <p className="mt-2 text-xs text-muted-foreground">
          The webhook secret is configured via the{" "}
          <code className="rounded bg-muted px-1">LINEAR_WEBHOOK_SECRET</code>{" "}
          environment variable.
        </p>
      </div>

      {/* Sync Status */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <h2 className="text-base font-semibold text-foreground">
              Sync Status
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
            Refresh now
          </Button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-muted-foreground">Last sync</p>
            <p className="text-sm font-medium text-foreground">
              {sync?.lastSyncedAt
                ? formatTimeAgo(sync.lastSyncedAt)
                : "Not synced yet — click Refresh"}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <p className="text-sm font-medium text-foreground">
              {!sync?.lastSyncedAt
                ? "Waiting for first sync"
                : sync.isStale
                  ? "Stale — data may be outdated"
                  : "Up to date"}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
