"use client"

import { useState, useCallback, useRef } from "react"
import { useTranslations } from "next-intl"
import {
  ArrowUpTrayIcon,
  TrashIcon,
  LinkIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/components/providers/toast-provider"
import {
  useBankTransactions,
  useUploadBankCsv,
  useMatchBankTransaction,
  useDeleteBankTransaction,
} from "@/hooks/use-bank-transactions"

export default function BankSettingsPage() {
  const t = useTranslations("bankTransactions")
  const { toast } = useToast()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [filter, setFilter] = useState<"all" | "matched" | "unmatched">("all")

  const params = new URLSearchParams({ page: "1", limit: "50" })
  if (filter === "matched") params.set("matched", "true")
  if (filter === "unmatched") params.set("matched", "false")

  const { data, isLoading } = useBankTransactions(params.toString())
  const uploadCsv = useUploadBankCsv()
  const matchTransaction = useMatchBankTransaction()
  const deleteTransaction = useDeleteBankTransaction()

  const transactions = data?.items ?? []

  const handleFileChange = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0]
      if (!file) return

      try {
        const result = await uploadCsv.mutateAsync(file)
        toast({
          variant: "success",
          title: t("importSuccess", { count: result.count }),
        })
      } catch {
        toast({ variant: "error", title: t("importError") })
      }

      if (fileInputRef.current) fileInputRef.current.value = ""
    },
    [uploadCsv, toast, t],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteTransaction.mutateAsync(id)
      } catch {
        toast({ variant: "error", title: "Failed to delete" })
      }
    },
    [deleteTransaction, toast],
  )

  const handleUnmatch = useCallback(
    async (id: string) => {
      try {
        await matchTransaction.mutateAsync({
          id,
          matchedExpenseId: null,
        })
      } catch {
        toast({ variant: "error", title: "Failed to unmatch" })
      }
    },
    [matchTransaction, toast],
  )

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")}>
        <div className="flex items-center gap-2.5">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button
            variant="gradient"
            shape="pill"
            size="lg"
            onClick={() => fileInputRef.current?.click()}
            isLoading={uploadCsv.isPending}
          >
            <ArrowUpTrayIcon className="size-5" />
            {t("import")}
          </Button>
        </div>
      </PageHeader>

      <p className="text-sm text-muted-foreground">{t("importDesc")}</p>

      {/* Filter chips */}
      <div className="flex gap-2">
        {(["all", "matched", "unmatched"] as const).map((f, idx) => {
          const isActive = filter === f
          const isFirst = idx === 0
          const isLast = idx === 2
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`h-[34px] px-4 text-sm font-medium border transition-colors ${
                isActive
                  ? "bg-primary text-white border-primary"
                  : "bg-surface border-border text-text-secondary hover:bg-surface-muted"
              }`}
              style={{
                borderRadius: isFirst
                  ? "19px 12px 12px 19px"
                  : isLast
                    ? "12px 19px 19px 12px"
                    : "12px",
              }}
            >
              {f === "all"
                ? "All"
                : f === "matched"
                  ? t("matched")
                  : t("unmatched")}
            </button>
          )
        })}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : transactions.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface px-6 py-16 text-center">
          <p className="text-sm font-medium text-foreground">
            {t("noTransactions")}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {t("noTransactionsHint")}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface divide-y divide-border">
          {transactions.map(
            (tx: {
              id: string
              date: string
              description: string
              amount: number
              bankName: string | null
              matchedExpenseId: string | null
            }) => (
              <div key={tx.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">
                      {tx.description}
                    </p>
                    {tx.matchedExpenseId && (
                      <Badge variant="secondary">
                        <LinkIcon className="size-3 mr-1" />
                        {t("matched")}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">
                      {new Date(tx.date).toLocaleDateString()}
                    </span>
                    {tx.bankName && (
                      <span className="text-xs text-muted-foreground">
                        {tx.bankName}
                      </span>
                    )}
                  </div>
                </div>
                <span
                  className={`text-sm font-medium tabular-nums ${
                    tx.amount < 0
                      ? "text-red-600 dark:text-red-400"
                      : "text-emerald-600 dark:text-emerald-400"
                  }`}
                >
                  {new Intl.NumberFormat("fr-FR", {
                    style: "currency",
                    currency: "EUR",
                  }).format(tx.amount)}
                </span>
                <div className="flex items-center gap-1">
                  {tx.matchedExpenseId && (
                    <button
                      onClick={() => handleUnmatch(tx.id)}
                      className="rounded-lg p-1.5 text-muted-foreground hover:bg-surface-muted hover:text-foreground transition-colors"
                      title={t("unmatch")}
                    >
                      <XMarkIcon className="size-4" />
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(tx.id)}
                    className="rounded-lg p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </div>
            ),
          )}
        </div>
      )}
    </div>
  )
}
