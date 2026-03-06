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

    router.push("/clients")
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        New Client
      </h1>
      <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <ClientForm onSubmit={handleSubmit} />
      </div>
    </div>
  )
}
