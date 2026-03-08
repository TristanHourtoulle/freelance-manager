"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { createClientSchema } from "@/lib/schemas/client"
import { useToast } from "@/components/providers/toast-provider"

import type { Resolver } from "react-hook-form"
import type { CreateClientInput } from "@/lib/schemas/client"

const BILLING_MODE_OPTIONS = [
  { value: "HOURLY", label: "Hourly" },
  { value: "DAILY", label: "Daily" },
  { value: "FIXED", label: "Fixed" },
  { value: "FREE", label: "Free" },
]

const CATEGORY_OPTIONS = [
  { value: "FREELANCE", label: "Freelance" },
  { value: "STUDY", label: "Study" },
  { value: "PERSONAL", label: "Personal" },
  { value: "SIDE_PROJECT", label: "Side Project" },
]

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

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<CreateClientInput>({
    resolver: zodResolver(createClientSchema) as Resolver<CreateClientInput>,
    defaultValues: {
      name: "",
      email: undefined,
      company: undefined,
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
        title: isEdit ? "Client updated" : "Client created",
      })
    } catch (error) {
      toast({
        variant: "error",
        title: error instanceof Error ? error.message : "Something went wrong",
      })
    }
  }

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
      noValidate
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Name"
          placeholder="Client name"
          {...register("name")}
          error={errors.name?.message}
        />
        <Input
          label="Email"
          type="email"
          placeholder="client@example.com"
          {...register("email")}
          error={errors.email?.message}
        />
      </div>

      <Input
        label="Company"
        placeholder="Company name"
        {...register("company")}
        error={errors.company?.message}
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Select
          label="Billing Mode"
          options={BILLING_MODE_OPTIONS}
          {...register("billingMode")}
          error={errors.billingMode?.message}
        />
        <Input
          label="Rate"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          {...register("rate", {
            setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
          })}
          error={errors.rate?.message}
        />
        <Select
          label="Category"
          options={CATEGORY_OPTIONS}
          {...register("category")}
          error={errors.category?.message}
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="notes">Notes</label>
        <textarea
          id="notes"
          rows={3}
          placeholder="Additional notes..."
          {...register("notes")}
        />
        {errors.notes?.message && (
          <p className="text-sm text-destructive">{errors.notes.message}</p>
        )}
      </div>

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="secondary"
          onClick={() => router.push("/clients")}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          {isEdit ? "Update Client" : "Create Client"}
        </Button>
      </div>
    </form>
  )
}
