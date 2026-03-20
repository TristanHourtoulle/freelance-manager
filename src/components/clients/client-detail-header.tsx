"use client"

import Link from "next/link"
import { useTranslations } from "next-intl"
import { PencilSquareIcon } from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"

const CATEGORY_BADGES: Record<string, string> = {
  FREELANCE:
    "bg-blue-50 text-blue-700 ring-blue-600/20 dark:bg-blue-500/10 dark:text-blue-400 dark:ring-blue-500/20",
  STUDY:
    "bg-purple-50 text-purple-700 ring-purple-600/20 dark:bg-purple-500/10 dark:text-purple-400 dark:ring-purple-500/20",
  PERSONAL:
    "bg-green-50 text-green-700 ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20",
  SIDE_PROJECT:
    "bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-400 dark:ring-amber-500/20",
}

const CATEGORY_KEYS: Record<string, string> = {
  FREELANCE: "freelance",
  STUDY: "study",
  PERSONAL: "personal",
  SIDE_PROJECT: "sideProject",
}

const BILLING_KEYS: Record<string, string> = {
  HOURLY: "hourly",
  DAILY: "daily",
  FIXED: "fixed",
  FREE: "free",
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function formatRate(billingMode: string, rate: number): string {
  if (billingMode === "FREE" || rate === 0) return "---"
  const suffix =
    billingMode === "HOURLY" ? "/h" : billingMode === "DAILY" ? "/d" : ""
  return `${rate}\u20AC${suffix}`
}

interface ClientDetailHeaderProps {
  id: string
  name: string
  company: string | null
  category: string
  billingMode: string
  rate: number
  createdAt: string
  logo: string | null
}

export function ClientDetailHeader({
  id,
  name,
  company,
  category,
  billingMode,
  rate,
  createdAt,
  logo,
}: ClientDetailHeaderProps) {
  const t = useTranslations("clients.detail")
  const tc = useTranslations("common")

  const memberSinceDate = new Date(createdAt).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  })

  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-card p-6 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        {logo ? (
          <img
            src={logo}
            alt={`${name} logo`}
            className="size-14 shrink-0 rounded-full object-cover"
          />
        ) : (
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-linear-to-r from-[var(--color-primary)] to-[color-mix(in_srgb,var(--color-primary),#000_30%)] text-lg font-semibold text-white">
            {getInitials(name)}
          </div>
        )}
        <div className="min-w-0">
          <div className="flex items-center gap-3">
            <h2 className="truncate text-xl font-semibold text-foreground">
              {name}
            </h2>
            <span
              className={`inline-flex shrink-0 items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${CATEGORY_BADGES[category] ?? "bg-gray-50 text-gray-700 ring-gray-600/20 dark:bg-gray-500/10 dark:text-gray-400 dark:ring-gray-500/20"}`}
            >
              {CATEGORY_KEYS[category]
                ? tc(`categories.${CATEGORY_KEYS[category]}`)
                : category}
            </span>
          </div>
          <p className="mt-0.5 text-sm text-muted-foreground">
            {company ?? tc("noCompany")}
          </p>
          <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
            <span>
              {BILLING_KEYS[billingMode]
                ? tc(`billingModes.${BILLING_KEYS[billingMode]}`)
                : billingMode}{" "}
              &middot; {formatRate(billingMode, rate)}
            </span>
            <span>&middot;</span>
            <span>
              {t("memberSince")} {memberSinceDate}
            </span>
          </div>
        </div>
      </div>
      <Link href={`/clients/${id}/edit`}>
        <Button variant="outline" size="lg" shape="pill">
          <PencilSquareIcon className="size-4" />
          {t("edit")}
        </Button>
      </Link>
    </div>
  )
}
