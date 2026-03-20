"use client"

import { useCallback, useEffect, useState } from "react"
import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { useTranslations } from "next-intl"
import { AvailableHoursForm } from "@/components/settings/available-hours-form"
import { RevenueTargetForm } from "@/components/settings/revenue-target-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { useToast } from "@/components/providers/toast-provider"
import { SUPPORTED_CURRENCIES } from "@/lib/schemas/settings"

import type { Resolver } from "react-hook-form"

interface AllSettings {
  availableHoursPerMonth: number
  monthlyRevenueTarget: number
  defaultCurrency: string
  defaultPaymentDays: number
  defaultRate: number
}

const billingDefaultsSchema = z.object({
  defaultCurrency: z.enum(SUPPORTED_CURRENCIES),
  defaultPaymentDays: z.number().int().min(1).max(365),
  defaultRate: z.number().min(0),
})

type BillingDefaults = z.infer<typeof billingDefaultsSchema>

export default function BillingSettingsPage() {
  const [settings, setSettings] = useState<AllSettings | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const { toast } = useToast()
  const t = useTranslations("settingsBilling")
  const tc = useTranslations("common")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch("/api/settings", { cache: "no-store" })
      if (!cancelled && res.ok) setSettings(await res.json())
      if (!cancelled) setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  const save = useCallback(
    async (data: Record<string, unknown>) => {
      const res = await fetch("/api/settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        setSettings(await res.json())
        toast({ variant: "success", title: t("toasts.success") })
      } else {
        toast({ variant: "error", title: t("toasts.error") })
      }
    },
    [toast, t],
  )

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl" />
          ))}
        </div>
      </div>
    )
  }

  if (!settings) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <p className="text-sm text-destructive">{tc("failedToLoad")}</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />

      <div className="grid gap-6 lg:grid-cols-2">
        <AvailableHoursForm
          defaultValue={settings.availableHoursPerMonth}
          onSave={(v) => save({ availableHoursPerMonth: v })}
        />
        <RevenueTargetForm
          defaultValue={settings.monthlyRevenueTarget}
          onSave={(v) => save({ monthlyRevenueTarget: v })}
        />
      </div>

      <BillingDefaultsCard
        defaultValues={{
          defaultCurrency:
            settings.defaultCurrency as BillingDefaults["defaultCurrency"],
          defaultPaymentDays: settings.defaultPaymentDays,
          defaultRate: settings.defaultRate,
        }}
        onSave={save}
      />
    </div>
  )
}

function BillingDefaultsCard({
  defaultValues,
  onSave,
}: {
  defaultValues: BillingDefaults
  onSave: (data: Record<string, unknown>) => Promise<void>
}) {
  const t = useTranslations("settingsBilling")
  const tc = useTranslations("common")
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<BillingDefaults>({
    resolver: zodResolver(billingDefaultsSchema) as Resolver<BillingDefaults>,
    defaultValues,
  })

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-foreground">
        {t("billingDefaults")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("billingDefaultsDesc")}
      </p>
      <form
        onSubmit={handleSubmit((data) => onSave(data))}
        className="mt-4 flex flex-wrap items-end gap-2.5"
      >
        <Controller
          name="defaultCurrency"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("currencyLabel")}
              </label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger
                  className="h-[38px] w-auto border-border bg-surface px-5 text-sm font-medium"
                  style={{ borderRadius: "19px 12px 12px 19px" }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        />

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            {t("paymentTermsLabel")}
          </label>
          <Input
            type="number"
            min="1"
            max="365"
            {...register("defaultPaymentDays", { valueAsNumber: true })}
            aria-invalid={!!errors.defaultPaymentDays}
            className="h-[38px] w-24 px-4"
            style={{ borderRadius: "12px" }}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            {t("defaultRateLabel")}
          </label>
          <Input
            type="number"
            step="0.01"
            min="0"
            placeholder="0.00"
            {...register("defaultRate", { valueAsNumber: true })}
            aria-invalid={!!errors.defaultRate}
            className="h-[38px] w-28 px-4"
            style={{ borderRadius: "12px" }}
          />
        </div>

        <Button
          type="submit"
          variant="gradient"
          size="lg"
          isLoading={isSubmitting}
          style={{ borderRadius: "12px 19px 19px 12px" }}
        >
          {tc("save")}
        </Button>
      </form>
      {(errors.defaultPaymentDays?.message || errors.defaultRate?.message) && (
        <p className="mt-2 text-sm text-destructive">
          {errors.defaultPaymentDays?.message || errors.defaultRate?.message}
        </p>
      )}
    </div>
  )
}
