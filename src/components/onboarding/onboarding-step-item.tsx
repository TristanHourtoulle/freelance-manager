"use client"

import Link from "next/link"
import { CheckCircleIcon as CheckCircleSolid } from "@heroicons/react/24/solid"
import { CheckCircleIcon as CheckCircleOutline } from "@heroicons/react/24/outline"
import { ChevronRightIcon } from "@heroicons/react/24/outline"

import type { OnboardingStepConfig } from "./types"

interface OnboardingStepItemProps {
  config: OnboardingStepConfig
  isCompleted: boolean
}

export function OnboardingStepItem({
  config,
  isCompleted,
}: OnboardingStepItemProps) {
  return (
    <div className="flex items-center gap-3 py-2">
      {isCompleted ? (
        <CheckCircleSolid className="h-6 w-6 shrink-0 text-success" />
      ) : (
        <CheckCircleOutline className="h-6 w-6 shrink-0 text-text-muted" />
      )}

      <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-sm font-medium ${isCompleted ? "text-text-muted line-through" : "text-text-primary"}`}
          >
            {config.label}
          </p>
          <p className="text-xs text-text-muted">{config.description}</p>
        </div>

        {!isCompleted && (
          <Link
            href={config.href}
            className="inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium text-primary hover:bg-primary-light transition-colors"
          >
            {config.ctaLabel}
            <ChevronRightIcon className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>
    </div>
  )
}
