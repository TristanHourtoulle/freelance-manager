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

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Squares2X2Icon },
  { label: "Clients", href: "/clients", icon: UsersIcon },
  { label: "Tasks", href: "/tasks", icon: CheckCircleIcon },
  { label: "Billing", href: "/billing", icon: DocumentTextIcon },
  { label: "Analytics", href: "/analytics", icon: ChartBarIcon },
  { label: "Settings", href: "/settings", icon: Cog6ToothIcon },
]

export interface ActionItem {
  id: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  href?: string
  apiCall?: string
  comingSoon?: boolean
}

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
