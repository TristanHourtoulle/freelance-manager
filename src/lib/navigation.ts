import type { IconName } from "@/components/ui/icon"

export interface NavItem {
  id: NavBadgeKey | "dashboard" | "analytics" | "settings" | "quotes" | "suivi"
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

/** Keys for the sidebar badge counters. */
export type NavBadgeKey = "clients" | "projects" | "tasks" | "invoices" | "quotes"

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
      {
        id: "suivi",
        href: "/suivi",
        label: "Suivi",
        icon: "calendar",
      },
    ],
  },
  {
    title: "Finance",
    items: [
      {
        id: "quotes",
        href: "/quotes",
        label: "Devis",
        icon: "list",
        badgeKey: "quotes",
      },
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
