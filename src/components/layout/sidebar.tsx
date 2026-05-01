"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useQuery } from "@tanstack/react-query"
import { Icon } from "@/components/ui/icon"
import { NAV_SECTIONS, type NavBadgeKey } from "@/lib/navigation"
import { initials } from "@/lib/format"
import { authClient } from "@/lib/auth-client"

interface SidebarProps {
  user: { name: string; email: string }
}

type NavCounts = Record<NavBadgeKey, number>

async function fetchNavCounts(): Promise<NavCounts> {
  const res = await fetch("/api/nav-counts", { credentials: "include" })
  if (!res.ok) throw new Error("Failed to fetch nav counts")
  return res.json()
}

export function Sidebar({ user }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()

  const { data: counts } = useQuery({
    queryKey: ["nav-counts"],
    queryFn: fetchNavCounts,
    staleTime: 30_000,
    placeholderData: { clients: 0, projects: 0, tasks: 0, invoices: 0 },
  })

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await authClient.signOut()
    router.push("/auth/login")
  }

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <div className="brand-name">FreelanceManager</div>
          <div className="brand-sub">v0.4 · perso</div>
        </div>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 1,
          flex: 1,
          overflowY: "auto",
        }}
      >
        {NAV_SECTIONS.map((section) => (
          <div key={section.title ?? "_"}>
            {section.title && (
              <div className="nav-section">{section.title}</div>
            )}
            {section.items.map((item) => {
              const active = isActive(item.href)
              const badge =
                item.badgeKey && counts ? counts[item.badgeKey] : undefined
              return (
                <Link
                  key={item.id}
                  href={item.href}
                  className={`nav-item${active ? " active" : ""}`}
                >
                  <Icon name={item.icon} size={16} />
                  <span>{item.label}</span>
                  {badge != null && <span className="badge">{badge}</span>}
                </Link>
              )
            })}
          </div>
        ))}
      </div>

      <div className="sidebar-footer">
        <div className="avatar">{initials(user.name)}</div>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="me-name truncate">{user.name}</div>
          <div className="me-email truncate">{user.email}</div>
        </div>
        <button
          className="icon-btn"
          title="Déconnexion"
          onClick={handleLogout}
          aria-label="Déconnexion"
        >
          <Icon name="logout" size={15} />
        </button>
      </div>
    </aside>
  )
}
