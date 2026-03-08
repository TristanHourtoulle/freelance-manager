/** Allowed period preset values for the analytics time-range selector. */
export type PeriodPreset = "1m" | "3m" | "6m" | "1y" | "custom"

/** Revenue aggregated for a single calendar month. */
export interface RevenueByMonth {
  month: string
  label: string
  amount: number
}

/** Revenue aggregated per client. */
export interface RevenueByClient {
  clientId: string
  clientName: string
  amount: number
}

/** Billed hours aggregated per client. */
export interface HoursByClient {
  clientId: string
  clientName: string
  hours: number
}

/** Revenue aggregated per client category (e.g. FREELANCE, STUDY). */
export interface RevenueByCategory {
  category: string
  label: string
  amount: number
}

/** Hours and revenue aggregated per project within a client. */
export interface HoursByProject {
  projectId: string
  projectName: string
  hours: number
  amount: number
}

/** Per-client breakdown of project-level hours, returned by the client analytics API. */
export interface ClientProjectsData {
  clientId: string
  clientName: string
  projects: HoursByProject[]
}

/** Utilization data for a single calendar month. */
export interface UtilizationMonth {
  month: string
  label: string
  billedHours: number
  availableHours: number
  rate: number
}

/** Overall utilization summary with monthly breakdown. */
export interface Utilization {
  availableHoursPerMonth: number
  totalBilledHours: number
  totalAvailableHours: number
  rate: number
  byMonth: UtilizationMonth[]
}

/** Full analytics payload returned by the analytics API. */
export interface AnalyticsData {
  revenueByMonth: RevenueByMonth[]
  revenueByClient: RevenueByClient[]
  hoursByClient: HoursByClient[]
  revenueByCategory: RevenueByCategory[]
  utilization: Utilization
}
