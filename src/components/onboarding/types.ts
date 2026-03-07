export interface OnboardingSteps {
  hasClient: boolean
  hasBillingDefaults: boolean
  hasLinearMapping: boolean
  hasTaskImported: boolean
  hasInvoiced: boolean
}

export interface OnboardingStatus {
  steps: OnboardingSteps
  completedCount: number
  totalSteps: number
  allCompleted: boolean
}

export interface OnboardingStepConfig {
  key: keyof OnboardingSteps
  label: string
  description: string
  href: string
  ctaLabel: string
}
