"use client"

import { useCallback, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownTrayIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { useToast } from "@/components/providers/toast-provider"

function ExportCard({
  title,
  description,
  endpoint,
}: {
  title: string
  description: string
  endpoint: string
}) {
  const { toast } = useToast()
  const [isExporting, setIsExporting] = useState<string | null>(null)

  const handleExport = useCallback(
    async (format: "csv" | "json") => {
      setIsExporting(format)
      try {
        const res = await fetch(`${endpoint}?format=${format}`)
        if (!res.ok) throw new Error("Export failed")

        const blob = await res.blob()
        const url = URL.createObjectURL(blob)
        const a = document.createElement("a")
        const disposition = res.headers.get("Content-Disposition") ?? ""
        const filename =
          disposition.match(/filename="(.+)"/)?.[1] ?? `export.${format}`
        a.href = url
        a.download = filename
        a.click()
        URL.revokeObjectURL(url)
        toast({
          variant: "success",
          title: `${title} exported as ${format.toUpperCase()}`,
        })
      } catch {
        toast({ variant: "error", title: "Export failed" })
      } finally {
        setIsExporting(null)
      }
    },
    [endpoint, title, toast],
  )

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
      </div>
      <div className="flex items-center gap-0">
        <Button
          variant="outline"
          shape="pill-left"
          size="sm"
          onClick={() => handleExport("csv")}
          isLoading={isExporting === "csv"}
        >
          <ArrowDownTrayIcon className="size-3.5" />
          CSV
        </Button>
        <Button
          variant="outline"
          shape="pill-right"
          size="sm"
          onClick={() => handleExport("json")}
          isLoading={isExporting === "json"}
        >
          <ArrowDownTrayIcon className="size-3.5" />
          JSON
        </Button>
      </div>
    </div>
  )
}

export default function DataSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [isDeleteOpen, setIsDeleteOpen] = useState(false)
  const [confirmText, setConfirmText] = useState("")
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDeleteAccount = useCallback(async () => {
    if (confirmText !== "DELETE") return
    setIsDeleting(true)
    const res = await fetch("/api/user/account", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm: "DELETE" }),
    })
    setIsDeleting(false)
    if (res.ok) {
      router.push("/auth/login")
    } else {
      toast({ variant: "error", title: "Failed to delete account" })
    }
  }, [confirmText, router, toast])

  return (
    <div className="space-y-6">
      <PageHeader title="Data & Export" />

      <div className="space-y-3">
        <ExportCard
          title="Clients"
          description="Export all your client data."
          endpoint="/api/export/clients"
        />
        <ExportCard
          title="Invoices"
          description="Export all your invoice history."
          endpoint="/api/export/invoices"
        />
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/30 bg-surface p-6">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-destructive">
              Delete Account
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              Permanently delete your account and all associated data. This
              action cannot be undone.
            </p>
            <Button
              variant="destructive"
              shape="pill"
              size="lg"
              className="mt-4"
              onClick={() => setIsDeleteOpen(true)}
            >
              Delete my account
            </Button>
          </div>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={() => {
              setIsDeleteOpen(false)
              setConfirmText("")
            }}
          />
          <div className="relative z-50 w-full max-w-md rounded-xl border border-border bg-surface p-6 shadow-lg">
            <h2 className="text-base font-semibold text-foreground">
              Delete your account?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              This will permanently delete your account, all clients, tasks,
              invoices, and settings. This cannot be undone.
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-foreground">
                Type <span className="font-mono font-bold">DELETE</span> to
                confirm
              </label>
              <Input
                value={confirmText}
                onChange={(e) => setConfirmText(e.target.value)}
                placeholder="DELETE"
                className="h-[38px] px-4 font-mono"
                style={{ borderRadius: "9999px" }}
              />
            </div>
            <div className="mt-6 flex justify-end gap-2.5">
              <Button
                variant="outline"
                shape="pill-left"
                size="lg"
                onClick={() => {
                  setIsDeleteOpen(false)
                  setConfirmText("")
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                shape="pill-right"
                size="lg"
                disabled={confirmText !== "DELETE"}
                onClick={handleDeleteAccount}
                isLoading={isDeleting}
              >
                Delete permanently
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
