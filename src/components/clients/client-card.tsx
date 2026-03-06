"use client"

import Link from "next/link"
import { Button } from "@/components/ui/button"

import type { SerializedClient } from "@/components/clients/types"

const CATEGORY_BADGES: Record<string, string> = {
  FREELANCE: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
  STUDY:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
  PERSONAL:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  SIDE_PROJECT:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
}

const CATEGORY_LABELS: Record<string, string> = {
  FREELANCE: "Freelance",
  STUDY: "Study",
  PERSONAL: "Personal",
  SIDE_PROJECT: "Side Project",
}

const BILLING_LABELS: Record<string, string> = {
  HOURLY: "Hourly",
  DAILY: "Daily",
  FIXED: "Fixed",
  FREE: "Free",
}

interface ClientCardProps {
  client: SerializedClient
  onDelete: (id: string) => void
}

export function ClientCard({ client, onDelete }: ClientCardProps) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-start justify-between">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {client.name}
            </h3>
            <span
              className={`inline-flex shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${CATEGORY_BADGES[client.category] ?? ""}`}
            >
              {CATEGORY_LABELS[client.category] ?? client.category}
            </span>
          </div>
          {client.company && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {client.company}
            </p>
          )}
          {client.email && (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {client.email}
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex items-center gap-4 text-sm text-zinc-600 dark:text-zinc-400">
        <span>{BILLING_LABELS[client.billingMode] ?? client.billingMode}</span>
        {client.billingMode !== "FREE" && client.rate > 0 && (
          <span className="font-medium text-zinc-900 dark:text-zinc-100">
            {client.rate}
            {client.billingMode === "HOURLY"
              ? "/h"
              : client.billingMode === "DAILY"
                ? "/d"
                : ""}
          </span>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <Link href={`/clients/${client.id}/edit`}>
          <Button variant="ghost" className="text-xs">
            Edit
          </Button>
        </Link>
        <Button
          variant="ghost"
          className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
          onClick={() => onDelete(client.id)}
        >
          Delete
        </Button>
      </div>
    </div>
  )
}
