"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  availableHoursSchema,
  type AvailableHoursInput,
} from "@/lib/schemas/settings"

import type { Resolver } from "react-hook-form"

interface AvailableHoursFormProps {
  defaultValue: number
  onSave: (value: number) => Promise<void>
}

/**
 * Form for configuring the user's available working hours per month.
 * Used on the `/settings` page.
 *
 * @param defaultValue - Current available hours setting
 * @param onSave - Callback to persist the new value
 */
export function AvailableHoursForm({
  defaultValue,
  onSave,
}: AvailableHoursFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<AvailableHoursInput>({
    resolver: zodResolver(
      availableHoursSchema,
    ) as Resolver<AvailableHoursInput>,
    defaultValues: { availableHoursPerMonth: defaultValue },
  })

  async function onSubmit(data: AvailableHoursInput) {
    await onSave(data.availableHoursPerMonth)
  }

  return (
    <Card title="Working Hours">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <Input
          label="Available hours per month"
          type="number"
          {...register("availableHoursPerMonth", { valueAsNumber: true })}
          error={errors.availableHoursPerMonth?.message}
        />
        <p className="text-sm text-text-secondary">
          Default: 140h/month. Used to calculate your utilization rate in
          analytics.
        </p>
        <Button type="submit" isLoading={isSubmitting}>
          Save
        </Button>
      </form>
    </Card>
  )
}
