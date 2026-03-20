/** Aggregated KPI data returned by the dashboard API. */
export interface DashboardKPIs {
  pipeline: number
  monthlyRevenue: number
  billedHours: number
  monthlyRevenueTarget: number
  activeClients: number
  monthlyExpenses: number
  overdueInvoices: number
  revenueByMonth: Array<{
    month: string
    label: string
    amount: number
  }>
  dashboardKpis: string[] | null
  lastSyncedAt: number | null
  isStale: boolean
}
