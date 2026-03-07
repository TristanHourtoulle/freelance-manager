"use client"

import { useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

const registerSchema = z
  .object({
    name: z.string().min(1, "Name is required").max(100).trim(),
    email: z.email("Invalid email address"),
    password: z.string().min(8, "Password must be at least 8 characters"),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

type RegisterInput = z.infer<typeof registerSchema>

export default function RegisterPage() {
  const router = useRouter()
  const [apiError, setApiError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema) as Resolver<RegisterInput>,
  })

  async function onSubmit(data: RegisterInput) {
    setApiError("")

    const result = await authClient.signUp.email({
      name: data.name,
      email: data.email,
      password: data.password,
    })

    if (result.error) {
      setApiError(result.error.message ?? "Sign up failed")
      return
    }

    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-secondary">
      <div className="w-full max-w-sm space-y-6 rounded-xl border border-border bg-surface p-8 shadow-sm">
        <div className="space-y-2 text-center">
          <h1>FreelanceDash</h1>
          <p className="text-sm text-text-secondary">Create your account</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <Input
            label="Name"
            placeholder="John Doe"
            {...register("name")}
            error={errors.name?.message}
          />

          <Input
            label="Email"
            type="email"
            placeholder="you@example.com"
            {...register("email")}
            error={errors.email?.message}
          />

          <Input
            label="Password"
            type="password"
            placeholder="At least 8 characters"
            {...register("password")}
            error={errors.password?.message}
          />

          <Input
            label="Confirm password"
            type="password"
            placeholder="Repeat your password"
            {...register("confirmPassword")}
            error={errors.confirmPassword?.message}
          />

          {apiError && <p className="text-sm text-destructive">{apiError}</p>}

          <Button type="submit" isLoading={isSubmitting} className="w-full">
            Sign up
          </Button>
        </form>

        <p className="text-center text-sm text-text-secondary">
          Already have an account?{" "}
          <Link href="/auth/login" className="text-primary hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  )
}
