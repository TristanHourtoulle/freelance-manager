"use client"

import { useTranslations } from "next-intl"
import { Card, CardContent } from "@/components/ui/card"
import { OnboardingStepItem } from "./onboarding-step-item"

import type { OnboardingStatus, OnboardingStepConfig } from "./types"

const STEP_CONFIGS: OnboardingStepConfig[] = [
  {
    key: "hasClient",
    label: "steps.createClient",
    description: "steps.createClientDesc",
    href: "/clients/new",
    ctaLabel: "steps.createClientAction",
  },
  {
    key: "hasBillingDefaults",
    label: "steps.setDefaults",
    description: "steps.setDefaultsDesc",
    href: "/settings",
    ctaLabel: "steps.setDefaultsAction",
  },
  {
    key: "hasLinearMapping",
    label: "steps.connectLinear",
    description: "steps.connectLinearDesc",
    href: "/clients",
    ctaLabel: "steps.connectLinearAction",
  },
  {
    key: "hasTaskImported",
    label: "steps.importTasks",
    description: "steps.importTasksDesc",
    href: "/tasks",
    ctaLabel: "steps.importTasksAction",
  },
  {
    key: "hasInvoiced",
    label: "steps.markInvoice",
    description: "steps.markInvoiceDesc",
    href: "/billing",
    ctaLabel: "steps.markInvoiceAction",
  },
]

interface OnboardingChecklistProps {
  onboardingStatus: OnboardingStatus | null
}

/**
 * Displays the getting-started checklist with a progress bar.
 * Hidden once all steps are completed. Used on the `/dashboard` page.
 *
 * @param onboardingStatus - Current onboarding progress (null hides the checklist)
 */
export function OnboardingChecklist({
  onboardingStatus,
}: OnboardingChecklistProps) {
  const t = useTranslations("onboarding")

  if (!onboardingStatus || onboardingStatus.allCompleted) return null

  const { steps, completedCount, totalSteps } = onboardingStatus
  const percentage = Math.round((completedCount / totalSteps) * 100)

  return (
    <Card>
      <CardContent>
        <div className="space-y-4">
          <div>
            <h3 className="mb-0">{t("title")}</h3>
            <p className="mt-1 text-xs text-text-muted">{t("description")}</p>
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">
                {t("progress", {
                  completed: completedCount,
                  total: totalSteps,
                })}
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
                config={{
                  ...config,
                  label: t(config.label),
                  description: t(config.description),
                  ctaLabel: t(config.ctaLabel),
                }}
                isCompleted={steps[config.key]}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
