import type { IconName } from "@/components/ui/icon"

export interface NavItem {
  id: NavBadgeKey | "dashboard" | "analytics" | "settings"
  href: string
  label: string
  icon: IconName
  badgeKey?: NavBadgeKey
}

export interface NavSection {
  /** Section heading shown above its items. Empty for the first section. */
  title?: string
  items: NavItem[]
}

/** Keys for the badge counters fetched in /api/dashboard/nav-counts. */
export type NavBadgeKey = "clients" | "projects" | "tasks" | "invoices"

export const NAV_SECTIONS: NavSection[] = [
  {
    title: "Pilotage",
    items: [
      {
        id: "dashboard",
        href: "/dashboard",
        label: "Dashboard",
        icon: "dashboard",
      },
    ],
  },
  {
    title: "Travail",
    items: [
      {
        id: "clients",
        href: "/clients",
        label: "Clients",
        icon: "users",
        badgeKey: "clients",
      },
      {
        id: "projects",
        href: "/projects",
        label: "Projets",
        icon: "folder",
        badgeKey: "projects",
      },
      {
        id: "tasks",
        href: "/tasks",
        label: "Tasks",
        icon: "check-square",
        badgeKey: "tasks",
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        id: "invoices",
        href: "/billing",
        label: "Factures",
        icon: "invoice",
        badgeKey: "invoices",
      },
      {
        id: "analytics",
        href: "/analytics",
        label: "Analytics",
        icon: "chart",
      },
    ],
  },
  {
    title: "Système",
    items: [
      {
        id: "settings",
        href: "/settings",
        label: "Réglages",
        icon: "settings",
      },
    ],
  },
]
