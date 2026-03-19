"use client"

import { useCallback, useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod/v4"
import { useTranslations } from "next-intl"
import { ProfilePhotoForm } from "@/components/settings/profile-photo-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { PageHeader } from "@/components/ui/page-header"
import { Skeleton } from "@/components/ui/skeleton"
import { useToast } from "@/components/providers/toast-provider"

import type { Resolver } from "react-hook-form"

const profileSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).trim(),
  email: z.email("Invalid email address"),
})

type ProfileInput = z.infer<typeof profileSchema>

interface UserProfile {
  name: string
  email: string
}

export default function ProfileSettingsPage() {
  const { toast } = useToast()
  const t = useTranslations("settingsProfile")
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch("/api/user", { cache: "no-store" })
      if (!cancelled && res.ok) {
        const data = await res.json()
        setProfile({ name: data.name, email: data.email })
      }
      if (!cancelled) setIsLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (isLoading) {
    return (
      <div className="space-y-6">
        <PageHeader title={t("title")} />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <PageHeader title={t("title")} />
      <ProfilePhotoForm />
      {profile && <ProfileForm defaultValues={profile} onSaved={setProfile} />}
    </div>
  )
}

function ProfileForm({
  defaultValues,
  onSaved,
}: {
  defaultValues: ProfileInput
  onSaved: (p: UserProfile) => void
}) {
  const { toast } = useToast()
  const t = useTranslations("settingsProfile")
  const tc = useTranslations("common")
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ProfileInput>({
    resolver: zodResolver(profileSchema) as Resolver<ProfileInput>,
    defaultValues,
  })

  const onSubmit = useCallback(
    async (data: ProfileInput) => {
      const res = await fetch("/api/user", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })
      if (res.ok) {
        const user = await res.json()
        onSaved({ name: user.name, email: user.email })
        toast({ variant: "success", title: t("toasts.success") })
      } else {
        toast({ variant: "error", title: t("toasts.error") })
      }
    },
    [onSaved, toast, t],
  )

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <h2 className="text-base font-semibold text-foreground">
        {t("personalInfo")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {t("personalInfoDesc")}
      </p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-4 space-y-4">
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {t("nameLabel")}
            </label>
            <Input
              placeholder={t("namePlaceholder")}
              {...register("name")}
              aria-invalid={!!errors.name}
              className="h-[38px] px-4"
              style={{ borderRadius: "19px 12px 12px 19px" }}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <label className="text-sm font-medium text-muted-foreground">
              {t("emailLabel")}
            </label>
            <Input
              type="email"
              placeholder={t("emailPlaceholder")}
              {...register("email")}
              aria-invalid={!!errors.email}
              className="h-[38px] px-4"
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
        </div>
        {(errors.name?.message || errors.email?.message) && (
          <p className="text-sm text-destructive">
            {errors.name?.message || errors.email?.message}
          </p>
        )}
      </form>
    </div>
  )
}
