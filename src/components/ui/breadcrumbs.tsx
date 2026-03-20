import Link from "next/link"
import { ChevronRightIcon } from "@heroicons/react/24/outline"

interface BreadcrumbItem {
  label: string
  href?: string
}

interface BreadcrumbsProps {
  items: BreadcrumbItem[]
}

export function Breadcrumbs({ items }: BreadcrumbsProps) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="mb-3 flex items-center gap-1.5 text-sm"
    >
      {items.map((item, index) => {
        const isLast = index === items.length - 1
        return (
          <span key={index} className="flex items-center gap-1.5">
            {index > 0 && (
              <ChevronRightIcon className="size-3 shrink-0 text-text-muted" />
            )}
            {isLast || !item.href ? (
              <span className="text-text-primary font-medium">
                {item.label}
              </span>
            ) : (
              <Link
                href={item.href}
                className="text-text-secondary transition-colors hover:text-text-primary"
              >
                {item.label}
              </Link>
            )}
          </span>
        )
      })}
    </nav>
  )
}
