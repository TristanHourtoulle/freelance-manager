export interface DashboardKPIs {
  pipeline: number
  monthlyRevenue: number
  billedHours: number
  monthlyRevenueTarget: number
  revenueByMonth: Array<{
    month: string
    label: string
    amount: number
  }>
  lastSyncedAt: number | null
  isStale: boolean
}
