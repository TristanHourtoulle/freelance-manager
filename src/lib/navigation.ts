import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  BellIcon,
  ChartBarIcon,
  CheckCircleIcon,
  Cog6ToothIcon,
  DocumentTextIcon,
  LinkIcon,
  PaintBrushIcon,
  PlusIcon,
  ServerStackIcon,
  Squares2X2Icon,
  UserCircleIcon,
  UsersIcon,
  WalletIcon,
} from "@heroicons/react/24/outline"

export interface NavItem {
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export interface NavSection {
  title?: string
  items: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: Squares2X2Icon },
  { label: "Clients", href: "/clients", icon: UsersIcon },
  { label: "Tasks", href: "/tasks", icon: CheckCircleIcon },
  { label: "Billing", href: "/billing", icon: DocumentTextIcon },
  { label: "Analytics", href: "/analytics", icon: ChartBarIcon },
  { label: "Settings", href: "/settings", icon: Cog6ToothIcon },
]

export const SETTINGS_NAV_SECTIONS: NavSection[] = [
  {
    items: [{ label: "Back to app", href: "/dashboard", icon: ArrowLeftIcon }],
  },
  {
    title: "Account",
    items: [
      { label: "Profile", href: "/settings", icon: UserCircleIcon },
      {
        label: "Appearance",
        href: "/settings/appearance",
        icon: PaintBrushIcon,
      },
    ],
  },
  {
    title: "Workspace",
    items: [
      {
        label: "Billing & Invoicing",
        href: "/settings/billing",
        icon: WalletIcon,
      },
      {
        label: "Notifications",
        href: "/settings/notifications",
        icon: BellIcon,
      },
      { label: "Integrations", href: "/settings/integrations", icon: LinkIcon },
    ],
  },
  {
    title: "Advanced",
    items: [
      { label: "Data & Export", href: "/settings/data", icon: ServerStackIcon },
    ],
  },
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
