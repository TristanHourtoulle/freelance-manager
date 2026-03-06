import { Card } from "@/components/ui/card"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
}

export function KpiCard({ title, value, subtitle }: KpiCardProps) {
  return (
    <Card>
      <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
        {title}
      </p>
      <p className="mt-2 text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
        {value}
      </p>
      {subtitle && (
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {subtitle}
        </p>
      )}
    </Card>
  )
}
