import { buildMonthlyBuckets, type MonthTotalRow } from "./month-buckets"

const referenceDate = new Date(Date.UTC(2026, 8, 6, 12, 0, 0))
const paidByMonth: MonthTotalRow[] = [
  { month: new Date(Date.UTC(2026, 6, 1)), total: 1000 },
  { month: new Date(Date.UTC(2026, 7, 1)), total: 3550 },
  { month: new Date(Date.UTC(2026, 8, 1)), total: 954.94 },
]
const issuedByMonth: MonthTotalRow[] = []

const buckets = buildMonthlyBuckets(referenceDate, 3, paidByMonth, issuedByMonth)
process.stdout.write(JSON.stringify(buckets))
