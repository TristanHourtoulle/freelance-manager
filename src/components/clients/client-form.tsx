"use client"

import { useForm, Controller } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import { ImageUpload } from "@/components/ui/image-upload"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClientSchema } from "@/lib/schemas/client"
import { useToast } from "@/components/providers/toast-provider"

import type { Resolver } from "react-hook-form"
import type { CreateClientInput } from "@/lib/schemas/client"

const BILLING_MODE_OPTIONS = [
  { value: "HOURLY", key: "hourly" },
  { value: "DAILY", key: "daily" },
  { value: "FIXED", key: "fixed" },
  { value: "FREE", key: "free" },
] as const

const CATEGORY_OPTIONS = [
  { value: "FREELANCE", key: "freelance" },
  { value: "STUDY", key: "study" },
  { value: "PERSONAL", key: "personal" },
  { value: "SIDE_PROJECT", key: "sideProject" },
] as const

interface ClientFormProps {
  defaultValues?: Partial<CreateClientInput>
  isEdit?: boolean
  onSubmit: (data: CreateClientInput) => Promise<void>
}

/**
 * Form for creating or editing a client (name, email, billing mode, rate, category, notes).
 * Uses react-hook-form with Zod validation.
 * Used on the /clients/new and /clients/[id]/edit pages.
 */
export function ClientForm({
  defaultValues,
  isEdit = false,
  onSubmit,
}: ClientFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations("clients.form")
  const tc = useTranslations("common")
  const tt = useTranslations("clients.toasts")

  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema) as Resolver<CreateClientInput>,
    defaultValues: {
      name: "",
      email: undefined,
      company: undefined,
      logo: undefined,
      billingMode: "HOURLY",
      rate: 0,
      category: "FREELANCE",
      notes: undefined,
      ...defaultValues,
    },
  })

  async function handleFormSubmit(data: CreateClientInput) {
    try {
      await onSubmit(data)
      toast({
        variant: "success",
        title: isEdit ? tt("updated") : tt("created"),
      })
    } catch (error) {
      toast({
        variant: "error",
        title: error instanceof Error ? error.message : tc("error"),
      })
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
      noValidate
    >
      <div className="flex items-start gap-5">
        <Controller
          name="logo"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("logo")}
              </label>
              <ImageUpload
                value={field.value}
                onChange={(v) => field.onChange(v)}
                size="lg"
                shape="rounded"
              />
            </div>
          )}
        />
        <div className="grid flex-1 gap-4 sm:grid-cols-2">
          <FormField
            label={t("name")}
            placeholder={t("namePlaceholder")}
            {...register("name")}
            error={errors.name?.message}
          />
          <FormField
            label={t("email")}
            type="email"
            placeholder={t("emailPlaceholder")}
            {...register("email")}
            error={errors.email?.message}
          />
        </div>
      </div>

      <FormField
        label={t("company")}
        placeholder={t("companyPlaceholder")}
        {...register("company")}
        error={errors.company?.message}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Controller
          name="billingMode"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("billingMode")}
              </label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectBillingMode")} />
                </SelectTrigger>
                <SelectContent>
                  {BILLING_MODE_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {tc(`billingModes.${opt.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.billingMode?.message && (
                <p className="text-sm text-destructive">
                  {errors.billingMode.message}
                </p>
              )}
            </div>
          )}
        />
        <FormField
          label={t("rate")}
          type="number"
          step="0.01"
          min="0"
          placeholder={t("ratePlaceholder")}
          {...register("rate", {
            setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
          })}
          error={errors.rate?.message}
        />
        <Controller
          name="category"
          control={control}
          render={({ field }) => (
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("category")}
              </label>
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder={t("selectCategory")} />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {tc(`categories.${opt.key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category?.message && (
                <p className="text-sm text-destructive">
                  {errors.category.message}
                </p>
              )}
            </div>
          )}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes">{t("notes")}</label>
        <textarea
          id="notes"
          rows={3}
          placeholder={t("notesPlaceholder")}
          {...register("notes")}
        />
        {errors.notes?.message && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/clients")}
        >
          {tc("cancel")}
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {isEdit ? t("updateButton") : t("createButton")}
        </Button>
      </div>
    </form>
  )
}
