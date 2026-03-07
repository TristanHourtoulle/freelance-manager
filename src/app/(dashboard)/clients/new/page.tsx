"use client"

import { useRouter } from "next/navigation"
import { ClientForm } from "@/components/clients/client-form"

import type { CreateClientInput } from "@/lib/schemas/client"

export default function NewClientPage() {
  const router = useRouter()

  async function handleSubmit(data: CreateClientInput): Promise<void> {
    const res = await fetch("/api/clients", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })

    if (!res.ok) {
      const body = await res.json()
      throw new Error(body.error?.message ?? "Failed to create client")
    }

    const created = await res.json()
    router.push(`/clients/${created.id}/edit`)
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6">New Client</h1>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <ClientForm onSubmit={handleSubmit} />
      </div>
    </div>
  )
}
