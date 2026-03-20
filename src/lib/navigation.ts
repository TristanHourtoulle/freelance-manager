import {
  ArrowDownTrayIcon,
  ArrowLeftIcon,
  ArrowPathIcon,
  BanknotesIcon,
  BellIcon,
  CalendarDaysIcon,
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
  /** Translation key used to look up the label at render time */
  translationKey: string
  /** Fallback label (used for fuzzy search in command palette) */
  label: string
  href: string
  icon: React.ComponentType<{ className?: string }>
}

export interface NavSection {
  titleKey?: string
  items: NavItem[]
}

export const NAV_ITEMS: NavItem[] = [
  {
    translationKey: "dashboard",
    label: "Dashboard",
    href: "/dashboard",
    icon: Squares2X2Icon,
  },
  {
    translationKey: "clients",
    label: "Clients",
    href: "/clients",
    icon: UsersIcon,
  },
  {
    translationKey: "tasks",
    label: "Tasks",
    href: "/tasks",
    icon: CheckCircleIcon,
  },
  {
    translationKey: "billing",
    label: "Billing",
    href: "/billing",
    icon: DocumentTextIcon,
  },
  {
    translationKey: "expenses",
    label: "Expenses",
    href: "/expenses",
    icon: BanknotesIcon,
  },
  {
    translationKey: "calendar",
    label: "Calendar",
    href: "/calendar",
    icon: CalendarDaysIcon,
  },
  {
    translationKey: "analytics",
    label: "Analytics",
    href: "/analytics",
    icon: ChartBarIcon,
  },
  {
    translationKey: "settings",
    label: "Settings",
    href: "/settings",
    icon: Cog6ToothIcon,
  },
]

export const SETTINGS_NAV_SECTIONS: NavSection[] = [
  {
    items: [
      {
        translationKey: "backToApp",
        label: "Back to app",
        href: "/dashboard",
        icon: ArrowLeftIcon,
      },
    ],
  },
  {
    titleKey: "account",
    items: [
      {
        translationKey: "profile",
        label: "Profile",
        href: "/settings",
        icon: UserCircleIcon,
      },
      {
        translationKey: "appearance",
        label: "Appearance",
        href: "/settings/appearance",
        icon: PaintBrushIcon,
      },
    ],
  },
  {
    titleKey: "workspace",
    items: [
      {
        translationKey: "billingInvoicing",
        label: "Billing & Invoicing",
        href: "/settings/billing",
        icon: WalletIcon,
      },
      {
        translationKey: "notifications",
        label: "Notifications",
        href: "/settings/notifications",
        icon: BellIcon,
      },
      {
        translationKey: "integrations",
        label: "Integrations",
        href: "/settings/integrations",
        icon: LinkIcon,
      },
    ],
  },
  {
    titleKey: "advanced",
    items: [
      {
        translationKey: "dataExport",
        label: "Data & Export",
        href: "/settings/data",
        icon: ServerStackIcon,
      },
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
    id: "new-task",
    label: "New task",
    icon: PlusIcon,
    href: "/tasks/new",
  },
  {
    id: "sync-linear",
    label: "Sync Linear",
    icon: ArrowPathIcon,
    apiCall: "/api/linear/refresh",
  },
  {
    id: "go-billing-history",
    label: "Billing history",
    icon: DocumentTextIcon,
    href: "/billing/history",
  },
  {
    id: "go-settings-appearance",
    label: "Appearance settings",
    icon: PaintBrushIcon,
    href: "/settings/appearance",
  },
  {
    id: "go-settings-integrations",
    label: "Integrations settings",
    icon: LinkIcon,
    href: "/settings/integrations",
  },
  {
    id: "go-settings-billing",
    label: "Billing settings",
    icon: WalletIcon,
    href: "/settings/billing",
  },
  {
    id: "go-settings-notifications",
    label: "Notification settings",
    icon: BellIcon,
    href: "/settings/notifications",
  },
  {
    id: "go-settings-data",
    label: "Data & Export",
    icon: ServerStackIcon,
    href: "/settings/data",
  },
  {
    id: "export-data",
    label: "Export data",
    icon: ArrowDownTrayIcon,
    comingSoon: true,
  },
]
