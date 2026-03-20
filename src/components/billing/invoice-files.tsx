"use client"

import { useRef } from "react"
import { useTranslations } from "next-intl"
import {
  PaperClipIcon,
  ArrowDownTrayIcon,
  TrashIcon,
} from "@heroicons/react/24/outline"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useInvoiceFiles,
  useUploadInvoiceFile,
  useDeleteInvoiceFile,
} from "@/hooks/use-invoice-files"

const ACCEPTED_TYPES = ".pdf,.png,.jpg,.jpeg"

interface InvoiceFilesProps {
  invoiceId: string
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function InvoiceFiles({ invoiceId }: InvoiceFilesProps) {
  const t = useTranslations("billing.files")
  const inputRef = useRef<HTMLInputElement>(null)
  const { data, isLoading } = useInvoiceFiles(invoiceId)
  const uploadMutation = useUploadInvoiceFile()
  const deleteMutation = useDeleteInvoiceFile()

  const files = data?.files ?? []

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    uploadMutation.mutate({ invoiceId, file })

    // Reset input so the same file can be re-selected
    if (inputRef.current) {
      inputRef.current.value = ""
    }
  }

  function handleDelete(fileId: string) {
    deleteMutation.mutate({ invoiceId, fileId })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PaperClipIcon className="size-5" />
            {t("title")}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <PaperClipIcon className="size-5" />
          {t("title")}
        </CardTitle>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES}
            onChange={handleFileChange}
            className="hidden"
            aria-label={t("upload")}
          />
          <Button
            variant="outline"
            size="lg"
            shape="pill"
            onClick={() => inputRef.current?.click()}
            disabled={uploadMutation.isPending}
            isLoading={uploadMutation.isPending}
          >
            {t("upload")}
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {files.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          <ul className="divide-y divide-border">
            {files.map((file) => (
              <li
                key={file.id}
                className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">
                    {file.fileName}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {formatFileSize(file.fileSize)}
                    {" · "}
                    {new Date(file.uploadedAt).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </p>
                </div>

                <div className="flex items-center gap-1">
                  <a
                    href={`/api/billing/invoices/${invoiceId}/files/${file.id}`}
                    download={file.fileName}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                    aria-label={t("download")}
                  >
                    <ArrowDownTrayIcon className="size-4" />
                  </a>

                  <button
                    type="button"
                    onClick={() => handleDelete(file.id)}
                    disabled={deleteMutation.isPending}
                    className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                    aria-label={t("delete")}
                  >
                    <TrashIcon className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
