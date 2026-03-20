"use client"

import { useCallback } from "react"
import { useForm } from "react-hook-form"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/providers/toast-provider"
import { useSettings, useUpdateSettings } from "@/hooks/use-settings"

interface TaxFormValues {
  taxRegime: string
  tvaRate: number
  activityType: string
  acreEligible: boolean
}

export default function TaxSettingsPage() {
  const t = useTranslations("settingsTax")
  const tc = useTranslations("common")
  const { data: settings, isLoading } = useSettings()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <Skeleton className="h-64 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      {settings && (
        <TaxForm
          defaultValues={{
            taxRegime: settings.taxRegime ?? "micro",
            tvaRate: Number(settings.tvaRate ?? 0),
            activityType: settings.activityType ?? "services",
            acreEligible: settings.acreEligible ?? false,
          }}
        />
      )}
    </div>
  )
}

function TaxForm({ defaultValues }: { defaultValues: TaxFormValues }) {
  const t = useTranslations("settingsTax")
  const tc = useTranslations("common")
  const { toast } = useToast()
  const updateSettings = useUpdateSettings()

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { isSubmitting },
  } = useForm<TaxFormValues>({ defaultValues })

  const acreEligible = watch("acreEligible")

  const onSubmit = useCallback(
    async (data: TaxFormValues) => {
      try {
        await updateSettings.mutateAsync(data)
        toast({ variant: "success", title: t("toasts.success") })
      } catch {
        toast({ variant: "error", title: t("toasts.error") })
      }
    },
    [updateSettings, toast, t],
  )

  return (
    <div className="rounded-xl border border-border bg-surface p-6 space-y-6">
      <div>
        <h2 className="text-base font-semibold text-foreground">
          {t("taxConfig")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t("taxConfigDesc")}
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* Regime + Activity type + TVA rate — single row */}
        <div>
          <div className="grid grid-cols-[1fr_1fr_auto] gap-2.5 mb-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {t("regime")}
            </label>
            <label className="text-sm font-medium text-muted-foreground">
              {t("activityType")}
            </label>
            <label className="text-sm font-medium text-muted-foreground">
              {t("tvaRate")} (%)
            </label>
          </div>
          <div className="flex items-stretch gap-2.5">
            <div className="flex-1">
              <Select
                defaultValue={defaultValues.taxRegime}
                onValueChange={(val: string | null) => {
                  if (val) setValue("taxRegime", val)
                }}
              >
                <SelectTrigger
                  className="!h-[38px] w-full px-4"
                  style={{ borderRadius: "19px 12px 12px 19px" }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="micro">{t("micro")}</SelectItem>
                  <SelectItem value="reel">{t("reel")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Select
                defaultValue={defaultValues.activityType}
                onValueChange={(val: string | null) => {
                  if (val) setValue("activityType", val)
                }}
              >
                <SelectTrigger
                  className="!h-[38px] w-full px-4"
                  style={{ borderRadius: "12px" }}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="services">{t("services")}</SelectItem>
                  <SelectItem value="sales">{t("sales")}</SelectItem>
                  <SelectItem value="mixed">{t("mixed")}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Input
              type="number"
              step="0.1"
              min="0"
              max="100"
              className="h-[38px] w-24 px-4"
              style={{ borderRadius: "12px 19px 19px 12px" }}
              {...register("tvaRate", { valueAsNumber: true })}
            />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">{t("tvaRateHint")}</p>

        {/* ACRE */}
        <div className="flex items-center gap-3">
          <Checkbox
            checked={acreEligible}
            onCheckedChange={(checked) => setValue("acreEligible", !!checked)}
          />
          <div>
            <p className="text-sm font-medium text-foreground">
              {t("acreLabel")}
            </p>
            <p className="text-xs text-muted-foreground">{t("acreHint")}</p>
          </div>
        </div>

        <div className="flex justify-end">
          <Button
            type="submit"
            variant="gradient"
            shape="pill"
            size="lg"
            isLoading={isSubmitting}
          >
            {tc("save")}
          </Button>
        </div>
      </form>
    </div>
  )
}
