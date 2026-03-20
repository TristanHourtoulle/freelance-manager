"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createExpenseSchema } from "@/lib/schemas/expense"

import type { Resolver } from "react-hook-form"
import type { CreateExpenseInput } from "@/lib/schemas/expense"
import type { SerializedExpense } from "@/hooks/use-expenses"

const CATEGORY_OPTIONS = [
  { value: "SOFTWARE", key: "SOFTWARE" },
  { value: "HARDWARE", key: "HARDWARE" },
  { value: "TRAVEL", key: "TRAVEL" },
  { value: "OFFICE", key: "OFFICE" },
  { value: "MARKETING", key: "MARKETING" },
  { value: "LEGAL", key: "LEGAL" },
  { value: "OTHER", key: "OTHER" },
] as const

interface ExpenseFormProps {
  clients: Array<{ id: string; name: string }>
  defaultValues?: SerializedExpense | null
  onSubmit: (data: CreateExpenseInput) => Promise<void>
  onCancel: () => void
  isSubmitting?: boolean
}

/**
 * Form for creating or editing an expense.
 * Uses react-hook-form with Zod validation.
 */
export function ExpenseForm({
  clients,
  defaultValues,
  onSubmit,
  onCancel,
  isSubmitting = false,
}: ExpenseFormProps) {
  const t = useTranslations("expenses")

  const isEdit = Boolean(defaultValues)

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
  } = useForm<CreateExpenseInput>({
    resolver: zodResolver(createExpenseSchema) as Resolver<CreateExpenseInput>,
    defaultValues: {
      description: defaultValues?.description ?? "",
      amount: defaultValues?.amount ?? 0,
      date: defaultValues?.date
        ? new Date(defaultValues.date).toISOString().split("T")[0]
        : new Date().toISOString().split("T")[0],
      category:
        (defaultValues?.category as CreateExpenseInput["category"]) ?? "OTHER",
      clientId: defaultValues?.clientId ?? undefined,
      recurring: defaultValues?.recurring ?? false,
      receiptUrl: defaultValues?.receiptUrl ?? "",
      taxDeductible: defaultValues?.taxDeductible ?? false,
    } as unknown as CreateExpenseInput,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <FormField
        label={t("form.description")}
        placeholder={t("form.descriptionPlaceholder")}
        error={errors.description?.message}
        {...register("description")}
      />

      <div className="grid grid-cols-2 gap-4">
        <FormField
          label={t("form.amount")}
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          error={errors.amount?.message}
          {...register("amount", { valueAsNumber: true })}
        />

        <FormField
          label={t("form.date")}
          type="date"
          error={errors.date?.message}
          {...register("date")}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <Label>{t("form.category")}</Label>
          <Controller
            name="category"
            control={control}
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger className="h-[38px]">
                  <SelectValue placeholder={t("form.selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {t(`categories.${opt.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
          {errors.category?.message && (
            <p className="text-sm text-destructive">
              {errors.category.message}
            </p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label>{t("form.client")}</Label>
          <Controller
            name="clientId"
            control={control}
            render={({ field }) => (
              <Select
                value={field.value ?? ""}
                onValueChange={(val) => field.onChange(val || undefined)}
              >
                <SelectTrigger className="h-[38px]">
                  <SelectValue placeholder={t("form.noClient")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">{t("form.noClient")}</SelectItem>
                  {clients.map((client) => (
                    <SelectItem key={client.id} value={client.id}>
                      {client.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <FormField
        label={t("form.receiptUrl")}
        type="url"
        placeholder={t("form.receiptUrlPlaceholder")}
        error={errors.receiptUrl?.message}
        {...register("receiptUrl")}
      />

      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <Controller
            name="recurring"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                id="recurring"
              />
            )}
          />
          <Label htmlFor="recurring" className="cursor-pointer">
            {t("form.recurring")}
          </Label>
        </div>

        <div className="flex items-center gap-2">
          <Controller
            name="taxDeductible"
            control={control}
            render={({ field }) => (
              <Checkbox
                checked={field.value}
                onCheckedChange={field.onChange}
                id="taxDeductible"
              />
            )}
          />
          <Label htmlFor="taxDeductible" className="cursor-pointer">
            {t("form.taxDeductible")}
          </Label>
        </div>
      </div>

      <div className="flex justify-end gap-2.5 pt-2">
        <Button
          type="button"
          variant="outline"
          shape="pill-left"
          size="lg"
          onClick={onCancel}
        >
          {t("form.cancel")}
        </Button>
        <Button
          type="submit"
          variant="gradient"
          shape="pill-right"
          size="lg"
          isLoading={isSubmitting}
        >
          {isEdit ? t("form.updateButton") : t("form.createButton")}
        </Button>
      </div>
    </form>
  )
}
