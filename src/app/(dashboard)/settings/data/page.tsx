"use client"

import { useCallback, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowDownTrayIcon,
  ArrowUpTrayIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { useToast } from "@/components/providers/toast-provider"

function ExportCard({
  titleKey,
  descriptionKey,
  endpoint,
}: {
  titleKey: string
  descriptionKey: string
  endpoint: string
}) {
  const { toast } = useToast()
  const t = useTranslations("settingsData")
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
          title: t("exportSuccess", {
            title: t(titleKey),
            format: format.toUpperCase(),
          }),
        })
      } catch {
        toast({ variant: "error", title: t("exportError") })
      } finally {
        setIsExporting(null)
      }
    },
    [endpoint, titleKey, toast, t],
  )

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t(titleKey)}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t(descriptionKey)}
        </p>
      </div>
      <div className="flex items-center gap-2.5">
        <Button
          variant="outline"
          shape="pill"
          size="sm"
          onClick={() => handleExport("csv")}
          isLoading={isExporting === "csv"}
        >
          <ArrowDownTrayIcon className="size-3.5" />
          {t("csvButton")}
        </Button>
        <Button
          variant="outline"
          shape="pill"
          size="sm"
          onClick={() => handleExport("json")}
          isLoading={isExporting === "json"}
        >
          <ArrowDownTrayIcon className="size-3.5" />
          {t("jsonButton")}
        </Button>
      </div>
    </div>
  )
}

function ImportCard({
  titleKey,
  descriptionKey,
  endpoint,
}: {
  titleKey: string
  descriptionKey: string
  endpoint: string
}) {
  const { toast } = useToast()
  const t = useTranslations("settingsData")
  const ti = useTranslations("import")
  const fileRef = useRef<HTMLInputElement>(null)
  const [isImporting, setIsImporting] = useState(false)

  const handleImport = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      setIsImporting(true)
      try {
        const formData = new FormData()
        formData.append("file", file)

        const res = await fetch(endpoint, {
          method: "POST",
          body: formData,
        })
        if (!res.ok) throw new Error("Import failed")

        const result = await res.json()
        toast({
          variant: "success",
          title: ti("success", { count: result.imported }),
        })
        if (result.errors?.length > 0) {
          toast({
            variant: "error",
            title: ti("errors", { count: result.errors.length }),
          })
        }
      } catch {
        toast({ variant: "error", title: t("exportError") })
      } finally {
        setIsImporting(false)
        if (fileRef.current) fileRef.current.value = ""
      }
    },
    [endpoint, toast, t, ti],
  )

  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-surface p-5">
      <div>
        <h3 className="text-sm font-semibold text-foreground">{t(titleKey)}</h3>
        <p className="mt-0.5 text-sm text-muted-foreground">
          {t(descriptionKey)}
        </p>
      </div>
      <div>
        <input
          ref={fileRef}
          type="file"
          accept=".csv"
          onChange={handleImport}
          className="hidden"
        />
        <Button
          variant="outline"
          shape="pill"
          size="sm"
          onClick={() => fileRef.current?.click()}
          isLoading={isImporting}
        >
          <ArrowUpTrayIcon className="size-3.5" />
          {ti("button")}
        </Button>
      </div>
    </div>
  )
}

export default function DataSettingsPage() {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations("settingsData")
  const tc = useTranslations("common")
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
      toast({ variant: "error", title: t("toasts.deleteError") })
    }
  }, [confirmText, router, toast, t])

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="space-y-3">
        <ExportCard
          titleKey="clientsExport"
          descriptionKey="clientsExportDesc"
          endpoint="/api/export/clients"
        />
        <ExportCard
          titleKey="invoicesExport"
          descriptionKey="invoicesExportDesc"
          endpoint="/api/export/invoices"
        />
        <ExportCard
          titleKey="expensesExport"
          descriptionKey="expensesExportDesc"
          endpoint="/api/export/expenses"
        />
        <ExportCard
          titleKey="analyticsExport"
          descriptionKey="analyticsExportDesc"
          endpoint="/api/export/analytics"
        />
      </div>

      {/* GDPR Full Data Export */}
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {t("gdprExport")}
            </h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {t("gdprExportDesc")}
            </p>
          </div>
          <Button
            variant="outline"
            shape="pill"
            size="sm"
            onClick={() => {
              const a = document.createElement("a")
              a.href = "/api/user/data-export"
              a.download = ""
              a.click()
            }}
          >
            <ArrowDownTrayIcon className="size-3.5" />
            {t("gdprExportButton")}
          </Button>
        </div>
      </div>

      {/* Import */}
      <div className="space-y-3">
        <ImportCard
          titleKey="clientsExport"
          descriptionKey="clientsExportDesc"
          endpoint="/api/import/clients"
        />
        <ImportCard
          titleKey="expensesExport"
          descriptionKey="expensesExportDesc"
          endpoint="/api/import/expenses"
        />
      </div>

      {/* Danger Zone */}
      <div className="rounded-xl border border-destructive/30 bg-surface p-6">
        <div className="flex items-start gap-3">
          <ExclamationTriangleIcon className="size-5 shrink-0 text-destructive" />
          <div className="flex-1">
            <h2 className="text-base font-semibold text-destructive">
              {t("deleteAccount")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {t("deleteAccountDesc")}
            </p>
            <Button
              variant="destructive"
              shape="pill"
              size="lg"
              className="mt-4"
              onClick={() => setIsDeleteOpen(true)}
            >
              {t("deleteButton")}
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
              {t("deleteConfirmTitle")}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {t("deleteConfirmDesc")}
            </p>
            <div className="mt-4 space-y-2">
              <label className="text-sm font-medium text-foreground">
                {t.rich("deleteConfirmInstruction", {
                  keyword: () => (
                    <span className="font-mono font-bold">DELETE</span>
                  ),
                })}
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
                {tc("cancel")}
              </Button>
              <Button
                variant="destructive"
                shape="pill-right"
                size="lg"
                disabled={confirmText !== "DELETE"}
                onClick={handleDeleteAccount}
                isLoading={isDeleting}
              >
                {t("deleteConfirmButton")}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
