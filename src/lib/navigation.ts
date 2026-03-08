import {
  ChartBarIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  Squares2X2Icon,
  UsersIcon,
  PlusIcon,
  ArrowPathIcon,
  ArrowDownTrayIcon,
} from "@heroicons/react/24/outline"

/** A navigation entry displayed in the sidebar. */
export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

/** Sidebar navigation items displayed in the app shell. */
export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Squares2X2Icon },
  { label: "Clients", href: "/clients", icon: UsersIcon },
  { label: "Tasks", href: "/tasks", icon: CheckCircleIcon },
  { label: "Billing", href: "/billing", icon: DocumentTextIcon },
  { label: "Analytics", href: "/analytics", icon: ChartBarIcon },
  { label: "Settings", href: "/settings", icon: Cog6ToothIcon },
]

/** A quick action available in the command palette. */
export interface ActionItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  apiCall?: string
  comingSoon?: boolean
}

/** Quick action items available in the command palette. */
export const ACTION_ITEMS: ActionItem[] = [
  {
    id: "new-client",
    label: "New client",
    icon: PlusIcon,
    href: "/clients/new",
  },
  {
    id: "sync-linear",
    label: "Sync Linear",
    icon: ArrowPathIcon,
    apiCall: "/api/linear/refresh",
  },
  {
    id: "export-data",
    label: "Export data",
    icon: ArrowDownTrayIcon,
    comingSoon: true,
  },
]
