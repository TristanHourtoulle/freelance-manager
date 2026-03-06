export interface DashboardKPIs {
  pipeline: number
  monthlyRevenue: number
  billedHours: number
  revenueByMonth: Array<{
    month: string
    label: string
    amount: number
  }>
}
