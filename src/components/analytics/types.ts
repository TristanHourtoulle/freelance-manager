export type PeriodPreset = "1m" | "3m" | "6m" | "1y" | "custom"

export interface RevenueByMonth {
  month: string
  label: string
  amount: number
}

export interface RevenueByClient {
  clientId: string
  clientName: string
  amount: number
}

export interface HoursByClient {
  clientId: string
  clientName: string
  hours: number
}

export interface AnalyticsData {
  revenueByMonth: RevenueByMonth[]
  revenueByClient: RevenueByClient[]
  hoursByClient: HoursByClient[]
}
