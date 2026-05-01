"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import type { ReactNode } from "react"

interface NavTab {
  href: string
  label: string
  icon: ReactNode
  badge?: number
}

function navIcon(name: "home" | "tasks" | "invoice" | "users" | "menu") {
  const common = {
    width: 22,
    height: 22,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  switch (name) {
    case "home":
      return (
        <svg {...common}>
          <path d="M3 12l9-9 9 9" />
          <path d="M5 10v10a1 1 0 0 0 1 1h3v-6h6v6h3a1 1 0 0 0 1-1V10" />
        </svg>
      )
    case "tasks":
      return (
        <svg {...common}>
          <polyline points="9 11 12 14 22 4" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
        </svg>
      )
    case "invoice":
      return (
        <svg {...common}>
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" />
          <line x1="8" y1="17" x2="13" y2="17" />
        </svg>
      )
    case "users":
      return (
        <svg {...common}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
          <circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
          <path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      )
    case "menu":
      return (
        <svg {...common}>
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      )
  }
}

const TABS: NavTab[] = [
  { href: "/dashboard", label: "Accueil", icon: navIcon("home") },
  { href: "/tasks", label: "Tasks", icon: navIcon("tasks") },
  { href: "/billing", label: "Factures", icon: navIcon("invoice") },
  { href: "/clients", label: "Clients", icon: navIcon("users") },
  { href: "/more", label: "Plus", icon: navIcon("menu") },
]

/**
 * Five-tab bottom navigation matching design-reference. Active tab is
 * inferred from `usePathname()` — first prefix match wins.
 */
export function BottomNav() {
  const pathname = usePathname()
  return (
    <nav className="bottom-nav">
      {TABS.map((t) => {
        const active = pathname === t.href || pathname.startsWith(t.href + "/")
        return (
          <Link
            key={t.href}
            href={t.href}
            className={"nav-tab" + (active ? " active" : "")}
          >
            {t.icon}
            <span className="lbl">{t.label}</span>
          </Link>
        )
      })}
    </nav>
  )
}
