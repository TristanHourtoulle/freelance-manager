"use client"

import { Card } from "@/components/ui/card"
import { OnboardingStepItem } from "./onboarding-step-item"

import type { OnboardingStatus, OnboardingStepConfig } from "./types"

const STEP_CONFIGS: OnboardingStepConfig[] = [
  {
    key: "hasClient",
    label: "Create your first client",
    description: "Add a client with their billing mode and rate",
    href: "/clients/new",
    ctaLabel: "Add client",
  },
  {
    key: "hasBillingDefaults",
    label: "Set your billing defaults",
    description: "Configure your working hours and revenue target",
    href: "/settings",
    ctaLabel: "Go to settings",
  },
  {
    key: "hasLinearMapping",
    label: "Connect a Linear project",
    description: "Link a Linear team or project to a client",
    href: "/clients",
    ctaLabel: "Go to clients",
  },
  {
    key: "hasTaskImported",
    label: "Import your first tasks",
    description: "Sync tasks from Linear to start tracking billable work",
    href: "/tasks",
    ctaLabel: "Go to tasks",
  },
  {
    key: "hasInvoiced",
    label: "Mark your first invoice",
    description: "Mark completed tasks as invoiced to track revenue",
    href: "/billing",
    ctaLabel: "Go to billing",
  },
]

interface OnboardingChecklistProps {
  onboardingStatus: OnboardingStatus | null
}

export function OnboardingChecklist({
  onboardingStatus,
}: OnboardingChecklistProps) {
  if (!onboardingStatus || onboardingStatus.allCompleted) return null

  const { steps, completedCount, totalSteps } = onboardingStatus
  const percentage = Math.round((completedCount / totalSteps) * 100)

  return (
    <Card>
      <div className="space-y-4">
        <div>
          <h3 className="mb-0">Getting Started</h3>
          <p className="mt-1 text-xs text-text-muted">
            Complete these steps to set up your workspace
          </p>
        </div>

        <div className="space-y-1">
          <div className="flex items-center justify-between text-sm">
            <span className="text-text-secondary">
              {completedCount} of {totalSteps} completed
            </span>
            <span className="font-medium text-primary">{percentage}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${percentage}%` }}
            />
          </div>
        </div>

        <div className="divide-y divide-border-light">
          {STEP_CONFIGS.map((config) => (
            <OnboardingStepItem
              key={config.key}
              config={config}
              isCompleted={steps[config.key]}
            />
          ))}
        </div>
      </div>
    </Card>
  )
}
