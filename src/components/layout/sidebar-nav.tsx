"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import {
  ChartBarIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  ArrowRightStartOnRectangleIcon,
  Squares2X2Icon,
  UsersIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { authClient } from "@/lib/auth-client"

interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Squares2X2Icon },
  { label: "Clients", href: "/clients", icon: UsersIcon },
  { label: "Tasks", href: "/tasks", icon: CheckCircleIcon },
  { label: "Billing", href: "/billing", icon: DocumentTextIcon },
  { label: "Analytics", href: "/analytics", icon: ChartBarIcon },
  { label: "Settings", href: "/settings", icon: Cog6ToothIcon },
]

interface SidebarNavProps {
  userName: string
  userEmail: string
  isOpen: boolean
  onClose: () => void
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function NavContent({
  userName,
  userEmail,
}: {
  userName: string
  userEmail: string
}) {
  const pathname = usePathname()
  const router = useRouter()

  function isActive(href: string): boolean {
    if (href === "/dashboard") {
      return pathname === "/dashboard"
    }
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await authClient.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="flex h-full flex-col">
      <div className="border-b border-border p-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-medium text-white">
            {getInitials(userName)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-text-primary">
              {userName}
            </p>
            <p className="truncate text-xs text-text-secondary">{userEmail}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {NAV_ITEMS.map((item) => {
          const active = isActive(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                active
                  ? "bg-primary text-white"
                  : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
              }`}
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {item.label}
            </Link>
          )
        })}
      </nav>

      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
        >
          <ArrowRightStartOnRectangleIcon className="h-5 w-5 shrink-0" />
          Logout
        </button>
      </div>
    </div>
  )
}

export function SidebarNav({
  userName,
  userEmail,
  isOpen,
  onClose,
}: SidebarNavProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-border bg-surface lg:block">
        <NavContent userName={userName} userEmail={userEmail} />
      </aside>

      {/* Mobile overlay */}
      {isOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="fixed inset-0 bg-black/50"
            onClick={onClose}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose()
            }}
          />
          <aside className="fixed inset-y-0 left-0 z-50 w-64 bg-surface">
            <div className="flex items-center justify-end p-2">
              <button
                onClick={onClose}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-muted"
              >
                <XMarkIcon className="h-5 w-5" />
              </button>
            </div>
            <NavContent userName={userName} userEmail={userEmail} />
          </aside>
        </div>
      )}
    </>
  )
}
