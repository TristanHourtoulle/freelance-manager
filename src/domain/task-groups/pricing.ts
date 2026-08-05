export type TaskGroupBillingMode = "DAILY" | "HOURLY" | "FIXED"

interface TaskGroupBilling {
  billingMode: TaskGroupBillingMode
  rate: number
}

interface TaskEffort {
  actualDays: number | null
}

export interface TaskGroupPricing {
  capturedTasks: number
  missingTasks: number
  totalDays: number
  totalPrice: number | null
  complete: boolean
}

export function priceForActualDays(
  actualDays: number | null,
  billing: TaskGroupBilling,
): number | null {
  if (actualDays === null || billing.billingMode === "FIXED") return null
  const quantity =
    billing.billingMode === "HOURLY" ? actualDays * 8 : actualDays
  return quantity * billing.rate
}

export function computeTaskGroupPricing(
  tasks: readonly TaskEffort[],
  billing: TaskGroupBilling,
): TaskGroupPricing {
  const captured = tasks.filter(
    (task): task is { actualDays: number } => task.actualDays !== null,
  )
  const totalDays = captured.reduce((sum, task) => sum + task.actualDays, 0)
  const totalPrice =
    billing.billingMode === "FIXED"
      ? null
      : captured.reduce(
          (sum, task) =>
            sum + (priceForActualDays(task.actualDays, billing) ?? 0),
          0,
        )

  return {
    capturedTasks: captured.length,
    missingTasks: tasks.length - captured.length,
    totalDays,
    totalPrice,
    complete: captured.length === tasks.length,
  }
}
