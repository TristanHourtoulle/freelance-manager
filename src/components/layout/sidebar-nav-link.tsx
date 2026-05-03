"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Icon, type IconName } from "@/components/ui/icon"

interface SidebarNavLinkProps {
  href: string
  label: string
  icon: IconName
  badge?: number
}

/**
 * One sidebar nav item. Client island so it can read the current pathname
 * and apply the active-link styling without forcing the parent Sidebar to
 * become a Client Component.
 */
export function SidebarNavLink({
  href,
  label,
  icon,
  badge,
}: SidebarNavLinkProps) {
  const pathname = usePathname()
  const active =
    href === "/dashboard"
      ? pathname === "/dashboard"
      : pathname.startsWith(href)
  return (
    <Link href={href} className={`nav-item${active ? " active" : ""}`}>
      <Icon name={icon} size={16} />
      <span>{label}</span>
      {badge != null && <span className="badge">{badge}</span>}
    </Link>
  )
}
