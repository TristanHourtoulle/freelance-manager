"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  revenueTargetSchema,
  type RevenueTargetInput,
} from "@/lib/schemas/settings"

import type { Resolver } from "react-hook-form"

interface RevenueTargetFormProps {
  defaultValue: number
  onSave: (value: number) => Promise<void>
}

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
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-foreground">
        Revenue Target
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        Set your monthly revenue goal. 0 means no target. Displayed on the
        dashboard.
      </p>
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="mt-4 flex items-center gap-2.5"
      >
        <Input
          type="number"
          step="0.01"
          {...register("monthlyRevenueTarget", { valueAsNumber: true })}
          aria-invalid={!!errors.monthlyRevenueTarget}
          className="h-[38px] w-40 px-4"
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
      {errors.monthlyRevenueTarget?.message && (
        <p className="mt-2 text-sm text-destructive">
          {errors.monthlyRevenueTarget.message}
        </p>
      )}
    </div>
  )
}
