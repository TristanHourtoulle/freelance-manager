import {
  ArrowDownTrayIcon,
  ArrowPathIcon,
  ClockIcon,
  CurrencyEuroIcon,
  ExclamationTriangleIcon,
  UserIcon,
} from "@heroicons/react/24/outline"

import type { NotificationType } from "@/generated/prisma/client"

interface NotificationTypeConfig {
  icon: React.ComponentType<{ className?: string }>
  color: string
}

export const NOTIFICATION_TYPE_CONFIG: Record<
  NotificationType,
  NotificationTypeConfig
> = {
  BILLING_REMINDER: {
    icon: CurrencyEuroIcon,
    color: "text-amber-500 bg-amber-50 dark:bg-amber-500/10",
  },
  INACTIVE_CLIENT: {
    icon: UserIcon,
    color: "text-blue-500 bg-blue-50 dark:bg-blue-500/10",
  },
  SYNC_ALERT: {
    icon: ExclamationTriangleIcon,
    color: "text-red-500 bg-red-50 dark:bg-red-500/10",
  },
  IMPORT_SUMMARY: {
    icon: ArrowDownTrayIcon,
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-500/10",
  },
  PAYMENT_OVERDUE: {
    icon: ClockIcon,
    color: "text-orange-500 bg-orange-50 dark:bg-orange-500/10",
  },
  RECURRING_EXPENSE: {
    icon: ArrowPathIcon,
    color: "text-violet-500 bg-violet-50 dark:bg-violet-500/10",
  },
}
