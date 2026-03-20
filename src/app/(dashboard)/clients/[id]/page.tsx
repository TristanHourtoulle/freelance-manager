"use client"

import { lazy, Suspense } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { useTranslations } from "next-intl"
import {
  ArrowLeftIcon,
  BanknotesIcon,
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  CurrencyDollarIcon,
} from "@heroicons/react/24/outline"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { ClientDetailHeader } from "@/components/clients/client-detail-header"
import { formatCurrency } from "@/lib/format"
import { useClientDashboard } from "@/hooks/use-client-detail"

const ClientRevenueChart = lazy(() =>
  import("@/components/clients/client-revenue-chart").then((mod) => ({
    default: mod.ClientRevenueChart,
  })),
)

const STATUS_BADGES: Record<string, string> = {
  DRAFT: "bg-gray-100 text-gray-700 dark:bg-gray-500/10 dark:text-gray-400",
  SENT: "bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400",
  PAID: "bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400",
}

export default function ClientDetailPage() {
  const params = useParams<{ id: string }>()
  const t = useTranslations("clients.detail")
  const { data, isLoading, error } = useClientDashboard(params.id)

  if (isLoading) {
    return <ClientDetailSkeleton />
  }

  if (error || !data) {
    return (
      <div className="space-y-6">
        <Link href="/clients">
          <Button variant="ghost" size="lg" shape="pill">
            <ArrowLeftIcon className="size-4" />
            {t("backToClients")}
          </Button>
        </Link>
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            {error instanceof Error ? error.message : "Client not found"}
          </CardContent>
        </Card>
      </div>
    )
  }

  const { client, stats, revenueByMonth, recentInvoices, recentExpenses } = data

  return (
    <div className="space-y-6">
      {/* Back button */}
      <Link href="/clients">
        <Button variant="ghost" size="lg" shape="pill">
          <ArrowLeftIcon className="size-4" />
          {t("backToClients")}
        </Button>
      </Link>

      {/* Client header */}
      <ClientDetailHeader
        id={client.id}
        name={client.name}
        company={client.company}
        category={client.category}
        billingMode={client.billingMode}
        rate={client.rate}
        createdAt={client.createdAt}
        logo={client.logo}
      />

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard
          icon={
            <BanknotesIcon className="size-5 text-emerald-600 dark:text-emerald-400" />
          }
          label={t("totalRevenue")}
          value={formatCurrency(stats.totalRevenue)}
        />
        <KpiCard
          icon={
            <DocumentTextIcon className="size-5 text-blue-600 dark:text-blue-400" />
          }
          label={t("totalInvoices")}
          value={String(stats.totalInvoices)}
        />
        <KpiCard
          icon={
            <ClipboardDocumentListIcon className="size-5 text-purple-600 dark:text-purple-400" />
          }
          label={t("totalTasks")}
          value={String(stats.totalTasks)}
        />
        <KpiCard
          icon={
            <CurrencyDollarIcon className="size-5 text-amber-600 dark:text-amber-400" />
          }
          label={t("totalExpenses")}
          value={String(stats.totalExpenses)}
        />
      </div>

      {/* Revenue chart */}
      <Card>
        <CardHeader>
          <CardTitle>{t("revenueOverTime")}</CardTitle>
        </CardHeader>
        <CardContent>
          <Suspense
            fallback={<Skeleton className="h-48 w-full sm:h-56 md:h-64" />}
          >
            <ClientRevenueChart data={revenueByMonth} />
          </Suspense>
        </CardContent>
      </Card>

      {/* Two-column grid: invoices + expenses */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Recent invoices */}
        <Card>
          <CardHeader>
            <CardTitle>{t("recentInvoices")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentInvoices.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noInvoices")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Status</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentInvoices.map((inv) => (
                      <tr
                        key={inv.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2.5 text-foreground">
                          {new Date(inv.month).toLocaleDateString("en-US", {
                            month: "short",
                            year: "numeric",
                          })}
                        </td>
                        <td className="py-2.5">
                          <span
                            className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_BADGES[inv.status] ?? ""}`}
                          >
                            {inv.status}
                          </span>
                        </td>
                        <td className="py-2.5 text-right font-medium text-foreground">
                          {formatCurrency(inv.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Recent expenses */}
        <Card>
          <CardHeader>
            <CardTitle>{t("recentExpenses")}</CardTitle>
          </CardHeader>
          <CardContent>
            {recentExpenses.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t("noExpenses")}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted-foreground">
                      <th className="pb-2 font-medium">Date</th>
                      <th className="pb-2 font-medium">Description</th>
                      <th className="pb-2 text-right font-medium">Amount</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentExpenses.map((exp) => (
                      <tr
                        key={exp.id}
                        className="border-b border-border last:border-0"
                      >
                        <td className="py-2.5 text-foreground">
                          {new Date(exp.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}
                        </td>
                        <td className="max-w-[200px] truncate py-2.5 text-foreground">
                          {exp.description}
                        </td>
                        <td className="py-2.5 text-right font-medium text-foreground">
                          {formatCurrency(exp.amount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
}

function KpiCard({ icon, label, value }: KpiCardProps) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 py-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted">
          {icon}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs text-muted-foreground">{label}</p>
          <p className="truncate text-lg font-semibold text-foreground">
            {value}
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function ClientDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-9 w-40" />
      <Skeleton className="h-28 w-full rounded-xl" />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-64 rounded-xl" />
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    </div>
  )
}
