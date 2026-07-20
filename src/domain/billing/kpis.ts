import type { BillingMode, Prisma } from "@/generated/prisma/client"
import { decimalToNumber } from "@/lib/api"
import { pipelineValueForTask } from "@/lib/billing-math"
import { getInvoiceComputed } from "@/lib/payments"
import {
  buildPipelineAging,
  type PipelineAging,
} from "@/domain/billing/pipeline-aging"
import type {
  InvoiceDocStatus,
  InvoiceKind,
  InvoicePaymentStatus,
} from "./types"

type DecimalLike = Prisma.Decimal | number

export interface OpenInvoiceRow {
  id: string
  number: string
  clientId: string
  status: InvoiceDocStatus
  paymentStatus: InvoicePaymentStatus
  total: DecimalLike
  dueDate: Date
  payments: { amount: DecimalLike; paidAt: Date }[]
}

export interface PaymentTotalsRow {
  paid_count: bigint
  paid_count_month: bigint
  paid_count_year: bigint
  revenue_month: number
  revenue_year: number
}

export interface PipelineTaskRow {
  clientId: string
  estimate: DecimalLike | null
  billingMode: BillingMode
  rate: DecimalLike
  completedAt: Date | null
}

export interface PaymentBucketRow {
  month: Date
  total: number
}

export interface RecentInvoiceClient {
  firstName: string
  lastName: string
  company: string | null
  color: string | null
}

export interface RecentInvoiceRow {
  id: string
  number: string
  kind: InvoiceKind
  status: InvoiceDocStatus
  paymentStatus: InvoicePaymentStatus
  issueDate: Date
  dueDate: Date
  total: DecimalLike
  client: RecentInvoiceClient
  payments: { amount: DecimalLike; paidAt: Date }[]
}

export interface DashboardKpiInput {
  now: Date
  openInvoices: OpenInvoiceRow[]
  paymentTotals: PaymentTotalsRow[]
  paymentBuckets: PaymentBucketRow[]
  pipelineTasks: PipelineTaskRow[]
  recentInvoices: RecentInvoiceRow[]
}

export interface DashboardKpi {
  revenueMonth: number
  revenueYear: number
  paidCount: number
  paidCountMonth: number
  paidCountYear: number
  outstanding: number
  sentCount: number
  overdueAmount: number
  overdueCount: number
  pipelineCount: number
  pipelineEur: number
  pipelineClientCount: number
}

export interface DashboardOverdueRow {
  id: string
  number: string
  clientId: string
  total: number
  dueDate: string
}

export interface DashboardMonthBucket {
  month: string
  total: number
  isCurrent: boolean
}

export interface DashboardRecentInvoice {
  id: string
  number: string
  kind: InvoiceKind
  status: InvoiceDocStatus
  paymentStatus: InvoicePaymentStatus
  isOverdue: boolean
  issueDate: string
  total: number
  balanceDue: number
  client: RecentInvoiceClient
}

export interface DashboardKpis {
  kpi: DashboardKpi
  months: DashboardMonthBucket[]
  overdue: DashboardOverdueRow[]
  recentInvoices: DashboardRecentInvoice[]
  pipelineAging: PipelineAging
}

/**
 * Pure aggregation of the dashboard billing KPIs from already-queried rows.
 *
 * Extracted verbatim from the former inline `/api/dashboard` logic: overdue
 * filtering, outstanding + overdue sums, the distinct pipeline-client count
 * derived from the pipeline tasks, the trailing 8-month payment buckets, and
 * the recent-invoice projection. No DB access, no framework imports —
 * deterministic given its inputs.
 */
export function computeDashboardKpis(input: DashboardKpiInput): DashboardKpis {
  const {
    now,
    openInvoices,
    paymentTotals,
    paymentBuckets,
    pipelineTasks,
    recentInvoices,
  } = input

  const totals = paymentTotals[0]
  const paidCount = totals ? Number(totals.paid_count) : 0
  const paidCountMonth = totals ? Number(totals.paid_count_month) : 0
  const paidCountYear = totals ? Number(totals.paid_count_year) : 0
  const revenueMonth = totals?.revenue_month ?? 0
  const revenueYear = totals?.revenue_year ?? 0

  const overdueList = openInvoices
    .map((inv) => ({ inv, computed: getInvoiceComputed(inv) }))
    .filter((x) => x.computed.isOverdue)

  const outstanding = openInvoices.reduce(
    (s, inv) => s + getInvoiceComputed(inv).balanceDue,
    0,
  )
  const overdueAmount = overdueList.reduce(
    (s, x) => s + x.computed.balanceDue,
    0,
  )

  const pipelineCount = pipelineTasks.length
  const pipelineValues = pipelineTasks.map((task) => ({
    completedAt: task.completedAt,
    value: pipelineValueForTask({
      billingMode: task.billingMode,
      rate: decimalToNumber(task.rate) ?? 0,
      estimateDays: decimalToNumber(task.estimate),
    }),
  }))
  const pipelineEur = pipelineValues.reduce((sum, row) => sum + row.value, 0)
  const pipelineAging = buildPipelineAging(now, pipelineValues)
  const pipelineClientCount = new Set(pipelineTasks.map((t) => t.clientId)).size

  const bucketByMonth = new Map(
    paymentBuckets.map(
      (b) => [b.month.toISOString().slice(0, 7), b.total] as const,
    ),
  )
  const months: DashboardMonthBucket[] = []
  for (let i = 7; i >= 0; i--) {
    const start = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = start.toISOString().slice(0, 7)
    months.push({
      month: start.toLocaleDateString("fr-FR", { month: "short" }),
      total: bucketByMonth.get(key) ?? 0,
      isCurrent: i === 0,
    })
  }

  const overdue: DashboardOverdueRow[] = overdueList.map(
    ({ inv, computed }) => ({
      id: inv.id,
      number: inv.number,
      clientId: inv.clientId,
      total: computed.balanceDue,
      dueDate: inv.dueDate.toISOString(),
    }),
  )

  const recent: DashboardRecentInvoice[] = recentInvoices.map((inv) => {
    const c = getInvoiceComputed(inv)
    return {
      id: inv.id,
      number: inv.number,
      kind: inv.kind,
      status: inv.status,
      paymentStatus: inv.paymentStatus,
      isOverdue: c.isOverdue,
      issueDate: inv.issueDate.toISOString(),
      total: decimalToNumber(inv.total) ?? 0,
      balanceDue: c.balanceDue,
      client: inv.client,
    }
  })

  return {
    kpi: {
      revenueMonth,
      revenueYear,
      paidCount,
      paidCountMonth,
      paidCountYear,
      outstanding,
      sentCount: openInvoices.length,
      overdueAmount,
      overdueCount: overdueList.length,
      pipelineCount,
      pipelineEur,
      pipelineClientCount,
    },
    months,
    overdue,
    recentInvoices: recent,
    pipelineAging,
  }
}
