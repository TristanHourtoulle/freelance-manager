"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  availableHoursSchema,
  type AvailableHoursInput,
} from "@/lib/schemas/settings"

import type { Resolver } from "react-hook-form"

interface AvailableHoursFormProps {
  defaultValue: number
  onSave: (value: number) => Promise<void>
}

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
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-foreground">Working Hours</h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Default: 140h/month. Used to calculate your utilization rate in
        analytics.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 flex items-center gap-2.5"
      >
        <Input
          type="number"
          {...register("availableHoursPerMonth", { valueAsNumber: true })}
          aria-invalid={!!errors.availableHoursPerMonth}
          className="h-[38px] w-32 px-4"
          style={{ borderRadius: "19px 12px 12px 19px" }}
        />
        <Button
          type="submit"
          variant="gradient"
          size="lg"
          isLoading={isSubmitting}
          style={{ borderRadius: "12px 19px 19px 12px" }}
        >
          Save
        </Button>
      </form>
      {errors.availableHoursPerMonth?.message && (
        <p className="mt-2 text-sm text-destructive">
          {errors.availableHoursPerMonth.message}
        </p>
      )}
    </div>
  )
}
