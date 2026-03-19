"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { ClientForm } from "@/components/clients/client-form"
import { LinearMappingsSection } from "@/components/clients/linear-mappings-section"
import { Button } from "@/components/ui/button"
import { useToast } from "@/components/providers/toast-provider"

import type { SerializedClient } from "@/components/clients/types"
import type { CreateClientInput } from "@/lib/schemas/client"

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const t = useTranslations("editClient")
  const tCommon = useTranslations("common")

  const [client, setClient] = useState<SerializedClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")
  const [isUnarchiving, setIsUnarchiving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    async function fetchClient() {
      const res = await fetch(`/api/clients/${id}`, { cache: "no-store" })
      if (res.ok) {
        setClient(await res.json())
      } else {
        setError("Client not found")
      }
      setIsLoading(false)
    }
    fetchClient()
  }, [id])

  async function handleSubmit(data: CreateClientInput): Promise<void> {
    const res = await fetch(`/api/clients/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const body = await res.json()
      throw new Error(body.error?.message ?? t("updateError"))
    }

    router.push("/clients")
  }

  async function handleUnarchive() {
    setIsUnarchiving(true)
    const res = await fetch(`/api/clients/${id}/unarchive`, {
      method: "PATCH",
    })
    if (res.ok) {
      const updated = await res.json()
      setClient(updated)
      toast({ variant: "success", title: t("unarchiveSuccess") })
    } else {
      toast({ variant: "error", title: t("unarchiveError") })
    }
    setIsUnarchiving(false)
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-text-secondary">{tCommon("loading")}</p>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm font-medium text-text-primary">{t("notFound")}</p>
        <p className="mt-1 text-sm text-text-secondary">{t("notFoundDesc")}</p>
      </div>
    )
  }

  const defaultValues: Partial<CreateClientInput> = {
    name: client.name,
    email: client.email ?? undefined,
    company: client.company ?? undefined,
    logo: client.logo ?? undefined,
    billingMode: client.billingMode as CreateClientInput["billingMode"],
    rate: client.rate,
    category: client.category as CreateClientInput["category"],
    notes: client.notes ?? undefined,
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6">{t("title")}</h1>

      {client.archivedAt && (
        <div className="mb-6 flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm text-amber-800">
            {t("archivedOn", {
              date: new Date(client.archivedAt).toLocaleDateString(),
            })}
          </p>
          <Button
            variant="outline"
            onClick={handleUnarchive}
            isLoading={isUnarchiving}
            className="text-xs"
          >
            {t("unarchive")}
          </Button>
        </div>
      )}

      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ClientForm
          defaultValues={defaultValues}
          isEdit
          onSubmit={handleSubmit}
        />
      </div>
      <div className="mt-6 rounded-xl border border-border bg-surface p-6 shadow-sm">
        <LinearMappingsSection clientId={id} />
      </div>
    </div>
  )
}
