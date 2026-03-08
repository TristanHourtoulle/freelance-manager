"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { FormField } from "@/components/ui/form-field"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  revenueTargetSchema,
  type RevenueTargetInput,
} from "@/lib/schemas/settings"

import type { Resolver } from "react-hook-form"

interface RevenueTargetFormProps {
  defaultValue: number
  onSave: (value: number) => Promise<void>
}

/**
 * Form for setting the monthly revenue target in EUR.
 * Used on the `/settings` page.
 *
 * @param defaultValue - Current revenue target
 * @param onSave - Callback to persist the new value
 */
export function RevenueTargetForm({
  defaultValue,
  onSave,
}: RevenueTargetFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RevenueTargetInput>({
    resolver: zodResolver(revenueTargetSchema) as Resolver<RevenueTargetInput>,
    defaultValues: { monthlyRevenueTarget: defaultValue },
  })

  async function onSubmit(data: RevenueTargetInput) {
    await onSave(data.monthlyRevenueTarget)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Revenue Target</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            label="Monthly revenue target (EUR)"
            type="number"
            step="0.01"
            {...register("monthlyRevenueTarget", { valueAsNumber: true })}
            error={errors.monthlyRevenueTarget?.message}
          />
          <p className="text-sm text-text-secondary">
            Set your monthly revenue goal. 0 means no target. Displayed as a
            progress bar on the dashboard.
          </p>
          <Button type="submit" isLoading={isSubmitting}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
