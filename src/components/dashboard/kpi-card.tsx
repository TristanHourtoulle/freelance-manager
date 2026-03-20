import Link from "next/link"
import { Card, CardContent } from "@/components/ui/card"

interface KpiCardProps {
  title: string
  value: string
  subtitle?: string
  /** When provided, the card becomes a link to this URL. */
  href?: string
}

/** Single metric card displaying a title, large value, and optional subtitle. Used on the dashboard. */
export function KpiCard({ title, value, subtitle, href }: KpiCardProps) {
  const content = (
    <Card className={href ? "transition-shadow hover:shadow-md" : undefined}>
      <CardContent>
        <p className="text-sm font-medium text-text-secondary">{title}</p>
        <p className="mt-2 text-3xl font-semibold tracking-tight text-text-primary">
          {value}
        </p>
        {subtitle && (
          <p className="mt-1 text-sm text-text-secondary">{subtitle}</p>
        )}
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block">
        {content}
      </Link>
    )
  }

  return content
}
