"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { ClientForm } from "@/components/clients/client-form"
import { LinearMappingsSection } from "@/components/clients/linear-mappings-section"

import type { SerializedClient } from "@/components/clients/types"
import type { CreateClientInput } from "@/lib/schemas/client"

export default function EditClientPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [client, setClient] = useState<SerializedClient | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState("")

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
      throw new Error(body.error?.message ?? "Failed to update client")
    }

    router.push("/clients")
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading...</p>
      </div>
    )
  }

  if (error || !client) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <p className="text-sm font-medium text-zinc-900 dark:text-zinc-50">
          Client not found
        </p>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          The client you are looking for does not exist.
        </p>
      </div>
    )
  }

  const defaultValues: Partial<CreateClientInput> = {
    name: client.name,
    email: client.email ?? undefined,
    company: client.company ?? undefined,
    billingMode: client.billingMode as CreateClientInput["billingMode"],
    rate: client.rate,
    category: client.category as CreateClientInput["category"],
    notes: client.notes ?? undefined,
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        Edit Client
      </h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <ClientForm
          defaultValues={defaultValues}
          isEdit
          onSubmit={handleSubmit}
        />
      </div>
      <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <LinearMappingsSection clientId={id} />
      </div>
    </div>
  )
}
