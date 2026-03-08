import { Card } from "@/components/ui/card"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
}

/** Single metric card displaying a title, large value, and optional subtitle. Used on the dashboard. */
export function KpiCard({ title, value, subtitle }: KpiCardProps) {
  return (
    <Card>
      <p className="text-sm font-medium text-text-secondary">{title}</p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
      )}
    </Card>
  )
}
