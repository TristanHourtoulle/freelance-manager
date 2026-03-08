/** Boolean flags for each onboarding step completion. */
export interface OnboardingSteps {
  hasClient: boolean
  hasBillingDefaults: boolean
  hasLinearMapping: boolean
  hasTaskImported: boolean
  hasInvoiced: boolean
}

/** Aggregated onboarding progress with step flags, counts, and completion status. */
export interface OnboardingStatus {
  steps: OnboardingSteps
  completedCount: number
  totalSteps: number
  allCompleted: boolean
}

/** Configuration for a single onboarding step (label, description, CTA link). */
export interface OnboardingStepConfig {
  key: keyof OnboardingSteps
  label: string
  description: string
  href: string
  ctaLabel: string
}
