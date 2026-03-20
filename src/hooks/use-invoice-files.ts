"use client"

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

interface InvoiceFileDTO {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  uploadedAt: string
}

/**
 * Fetches file metadata for an invoice.
 */
export function useInvoiceFiles(invoiceId: string | undefined) {
  return useQuery<{ files: InvoiceFileDTO[] }>({
    queryKey: ["invoice-files", invoiceId],
    queryFn: async () => {
      const res = await fetch(`/api/billing/invoices/${invoiceId}/files`)
      if (!res.ok) throw new Error("Failed to fetch invoice files")
      return res.json()
    },
    enabled: Boolean(invoiceId),
    staleTime: 10 * 60 * 1000,
  })
}

/**
 * Uploads a PDF file to an invoice.
 */
export function useUploadInvoiceFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      invoiceId,
      file,
    }: {
      invoiceId: string
      file: File
    }) => {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(`/api/billing/invoices/${invoiceId}/files`, {
        method: "POST",
        body: formData,
      })
      if (!res.ok) {
        const error = await res.json().catch(() => ({}))
        throw new Error(
          (error as { message?: string }).message ?? "Failed to upload file",
        )
      }
      return res.json() as Promise<InvoiceFileDTO>
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["invoice-files", variables.invoiceId],
      })
      queryClient.invalidateQueries({ queryKey: ["billing-history"] })
    },
  })
}

/**
 * Deletes a file from an invoice.
 */
export function useDeleteInvoiceFile() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      invoiceId,
      fileId,
    }: {
      invoiceId: string
      fileId: string
    }) => {
      const res = await fetch(
        `/api/billing/invoices/${invoiceId}/files/${fileId}`,
        { method: "DELETE" },
      )
      if (!res.ok) throw new Error("Failed to delete file")
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({
        queryKey: ["invoice-files", variables.invoiceId],
      })
      queryClient.invalidateQueries({ queryKey: ["billing-history"] })
    },
  })
}
