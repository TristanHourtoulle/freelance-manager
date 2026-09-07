import "dotenv/config"
import { computeDashboardKpis, type DashboardKpiInput } from "./kpis"

const now = new Date(Date.UTC(2026, 2, 15, 12, 0, 0))
const input: DashboardKpiInput = {
  now,
  openInvoices: [],
  paymentTotals: [],
  paymentBuckets: [
    { month: new Date(Date.UTC(2026, 2, 1)), total: 1200 },
    { month: new Date(Date.UTC(2026, 0, 1)), total: 500 },
  ],
  pipelineTasks: [],
  recentInvoices: [],
}

const { months } = computeDashboardKpis(input)
process.stdout.write(JSON.stringify(months))
