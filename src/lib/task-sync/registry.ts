import "server-only"
import { linearTaskProvider } from "@/lib/task-providers/linear"
import type { TaskProvider } from "@/lib/task-sync/provider"

const providers = {
  linear: linearTaskProvider,
} as const satisfies Record<string, TaskProvider>

export type TaskProviderId = keyof typeof providers

export class UnknownTaskProviderError extends Error {
  constructor(providerId: string) {
    super(`Unknown task provider: ${providerId}`)
    this.name = "UnknownTaskProviderError"
  }
}

export function isTaskProviderId(value: string): value is TaskProviderId {
  return Object.hasOwn(providers, value)
}

export function getTaskProvider(providerId: string): TaskProvider {
  if (!isTaskProviderId(providerId)) {
    throw new UnknownTaskProviderError(providerId)
  }
  return providers[providerId]
}

export function listTaskProviders(): readonly TaskProvider[] {
  return Object.values(providers)
}
