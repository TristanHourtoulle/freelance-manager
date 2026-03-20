"use client"

import { forwardRef, useEffect, useRef, useState } from "react"
import { useForm, type Resolver } from "react-hook-form"
import { z } from "zod/v4"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { authClient } from "@/lib/auth-client"
import {
  ChartBarIcon,
  ClockIcon,
  CurrencyDollarIcon,
  EyeIcon,
  EyeSlashIcon,
  GlobeAltIcon,
  UserGroupIcon,
} from "@heroicons/react/24/outline"

/* ---------- schemas ---------- */

const loginSchema = z.object({
  email: z.email("Invalid email address"),
  password: z.string().min(1, "Password is required"),
})

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

type LoginInput = z.infer<typeof loginSchema>
type RegisterInput = z.infer<typeof registerSchema>

/* ---------- feature keys ---------- */

const FEATURE_KEYS = [
  {
    icon: UserGroupIcon,
    titleKey: "featureClients",
    descKey: "featureClientsDesc",
  },
  {
    icon: CurrencyDollarIcon,
    titleKey: "featureBilling",
    descKey: "featureBillingDesc",
  },
  { icon: ClockIcon, titleKey: "featureTasks", descKey: "featureTasksDesc" },
  {
    icon: ChartBarIcon,
    titleKey: "featureAnalytics",
    descKey: "featureAnalyticsDesc",
  },
] as const

/* ---------- locale switcher ---------- */

function LocaleSwitcher() {
  const router = useRouter()
  const [open, setOpen] = useState(false)

  async function switchLocale(locale: "en" | "fr") {
    setOpen(false)
    await fetch("/api/locale", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ locale }),
    })
    router.refresh()
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-lg border border-white/[0.06] bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-[#8a8f98] transition-colors hover:border-white/[0.12] hover:text-white"
      >
        <GlobeAltIcon className="size-3.5" />
        <span>EN / FR</span>
      </button>
      {open && (
        <div className="absolute right-0 top-full z-20 mt-1.5 overflow-hidden rounded-lg border border-white/[0.08] bg-[#0f1011] shadow-xl">
          <button
            type="button"
            onClick={() => switchLocale("en")}
            className="block w-full px-4 py-2 text-left text-xs text-[#8a8f98] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            English
          </button>
          <button
            type="button"
            onClick={() => switchLocale("fr")}
            className="block w-full px-4 py-2 text-left text-xs text-[#8a8f98] transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            Français
          </button>
        </div>
      )}
    </div>
  )
}

/* ---------- page ---------- */

export default function LandingPage() {
  const [tab, setTab] = useState<"login" | "register">("login")
  const t = useTranslations("landing")

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-[#08090a] text-[#f0f0f0] lg:flex-row">
      {/* Ambient glows */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute left-1/2 top-0 h-[700px] w-[900px] -translate-x-1/2 -translate-y-1/3 rounded-full bg-blue-500/[0.10] blur-[150px]" />
        <div className="absolute -right-20 top-1/3 h-[400px] w-[400px] rounded-full bg-blue-400/[0.06] blur-[120px]" />
        <div className="absolute inset-0 bg-[radial-gradient(70%_80%_at_50%_0%,rgba(59,130,246,0.05)_3%,transparent_70%)]" />
      </div>

      {/* Noise texture */}
      <div
        className="pointer-events-none fixed inset-0 z-50 opacity-[0.03]"
        style={{
          backgroundImage: "url('/noise.svg')",
          backgroundRepeat: "repeat",
        }}
      />

      {/* Locale switcher — top right corner */}
      <div className="absolute right-4 top-4 z-20 sm:right-6 sm:top-6 lg:right-8 lg:top-8">
        <LocaleSwitcher />
      </div>

      {/* Left — hero */}
      <div className="relative z-10 hidden flex-1 flex-col justify-between p-12 lg:flex xl:p-16">
        {/* Brand */}
        <div className="flex items-center">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white">
              FD
            </div>
            <span className="text-sm font-semibold tracking-tight text-white">
              FreelanceDash
            </span>
          </div>
        </div>

        {/* Hero content */}
        <div className="max-w-[50rem] space-y-10">
          <div className="space-y-6">
            <h1 className="text-5xl font-medium leading-[1] tracking-[-0.04em] text-white xl:text-7xl">
              {t("heroTitle")}
              <span className="text-blue-400">{t("heroAccent")}</span>
            </h1>
            <p className="max-w-lg text-lg leading-relaxed text-[#8a8f98]">
              {t("heroSubtitle")}
            </p>
          </div>

          {/* Feature grid */}
          <div className="grid grid-cols-2 gap-3">
            {FEATURE_KEYS.map((feature) => (
              <div
                key={feature.titleKey}
                className="group rounded-xl border border-white/[0.06] bg-[#0f1011] p-4 transition-all duration-300 hover:border-white/[0.12] hover:bg-[#161718]"
              >
                <feature.icon className="mb-3 size-5 text-blue-400" />
                <p className="text-sm font-medium text-[#f0f0f0]">
                  {t(feature.titleKey)}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-[#555a63]">
                  {t(feature.descKey)}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <p className="text-xs text-[#555a63]">
          &copy; {new Date().getFullYear()} FreelanceDash
        </p>
      </div>

      {/* Right — auth panel */}
      <div className="relative z-10 flex flex-shrink-0 flex-col items-center justify-center px-4 py-10 sm:p-6 lg:w-[26rem] lg:p-12 xl:w-[28rem] xl:p-16">
        {/* Mobile brand */}
        <div className="mb-10 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-500 text-sm font-bold text-white">
            FD
          </div>
          <span className="text-sm font-semibold tracking-tight text-white">
            FreelanceDash
          </span>
        </div>

        {/* Auth card */}
        <div className="w-full max-w-sm rounded-2xl border border-white/[0.08] bg-[radial-gradient(50%_10%_at_50%_0%,rgba(59,130,246,0.10)_0%,transparent_100%),linear-gradient(#0f1011,rgba(0,0,0,0.8))] p-6 shadow-2xl sm:p-8">
          {/* Header */}
          <div className="mb-6 text-center">
            <h2 className="text-xl font-medium tracking-tight text-white transition-all duration-300 sm:text-2xl">
              {tab === "login" ? t("welcomeBack") : t("getStarted")}
            </h2>
            <p className="mt-1 text-sm text-[#8a8f98] transition-all duration-300">
              {tab === "login" ? t("signInSubtitle") : t("signUpSubtitle")}
            </p>
          </div>

          {/* Tab switcher */}
          <div className="mb-6 flex rounded-lg border border-white/[0.06] bg-white/[0.03] p-1">
            <button
              type="button"
              onClick={() => setTab("login")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
                tab === "login"
                  ? "bg-white/[0.08] text-white"
                  : "text-[#555a63] hover:text-[#8a8f98]"
              }`}
            >
              {t("signIn")}
            </button>
            <button
              type="button"
              onClick={() => setTab("register")}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-all duration-200 ${
                tab === "register"
                  ? "bg-white/[0.08] text-white"
                  : "text-[#555a63] hover:text-[#8a8f98]"
              }`}
            >
              {t("createAccount")}
            </button>
          </div>

          <AuthFormPanel tab={tab} />
        </div>

        {/* Mobile footer */}
        <p className="mt-8 text-center text-xs text-[#555a63] lg:hidden">
          &copy; {new Date().getFullYear()} FreelanceDash
        </p>
      </div>
    </div>
  )
}

/* ---------- Animated form panel ---------- */

function AuthFormPanel({ tab }: { tab: "login" | "register" }) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [height, setHeight] = useState<number | undefined>(undefined)
  const [activeTab, setActiveTab] = useState(tab)

  const visible = tab === activeTab

  function handleTransitionEnd(e: React.TransitionEvent) {
    if (e.propertyName !== "opacity" || visible) return
    setActiveTab(tab)
  }

  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setHeight(entry.contentRect.height)
      }
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div
      className="overflow-hidden transition-[height] duration-300 ease-in-out"
      style={{ height }}
    >
      <div
        ref={containerRef}
        onTransitionEnd={handleTransitionEnd}
        className={`transition-opacity duration-200 ease-in-out ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {activeTab === "login" ? <LoginForm /> : <RegisterForm />}
      </div>
    </div>
  )
}

/* ---------- Login form ---------- */

function LoginForm() {
  const router = useRouter()
  const t = useTranslations("landing")
  const [apiError, setApiError] = useState("")

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema) as Resolver<LoginInput>,
  })

  async function onSubmit(data: LoginInput) {
    setApiError("")
    const result = await authClient.signIn.email({
      email: data.email,
      password: data.password,
    })
    if (result.error) {
      setApiError(result.error.message ?? "Login failed")
      return
    }
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <LandingFormField
        label={t("email")}
        type="email"
        placeholder={t("emailPlaceholder")}
        {...register("email")}
        error={errors.email?.message}
      />
      <LandingFormField
        label={t("password")}
        type="password"
        placeholder={t("passwordPlaceholder")}
        {...register("password")}
        error={errors.password?.message}
      />
      {apiError && <p className="text-sm text-red-400">{apiError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
      >
        {isSubmitting ? t("signingIn") : t("signIn")}
      </button>
    </form>
  )
}

/* ---------- Register form ---------- */

function RegisterForm() {
  const router = useRouter()
  const t = useTranslations("landing")
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
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <LandingFormField
        label={t("name")}
        placeholder={t("namePlaceholder")}
        {...register("name")}
        error={errors.name?.message}
      />
      <LandingFormField
        label={t("email")}
        type="email"
        placeholder={t("emailPlaceholder")}
        {...register("email")}
        error={errors.email?.message}
      />
      <LandingFormField
        label={t("password")}
        type="password"
        placeholder={t("passwordMinPlaceholder")}
        {...register("password")}
        error={errors.password?.message}
      />
      <LandingFormField
        label={t("confirmPassword")}
        type="password"
        placeholder={t("confirmPasswordPlaceholder")}
        {...register("confirmPassword")}
        error={errors.confirmPassword?.message}
      />
      {apiError && <p className="text-sm text-red-400">{apiError}</p>}
      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-2 w-full rounded-lg bg-blue-500 px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-blue-600 disabled:opacity-50"
      >
        {isSubmitting ? t("creatingAccount") : t("createAccount")}
      </button>
    </form>
  )
}

/* ---------- Dark-themed form field ---------- */

interface LandingFormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

const LandingFormField = forwardRef<HTMLInputElement, LandingFormFieldProps>(
  function LandingFormField({ label, error, className, type, ...props }, ref) {
    const isPassword = type === "password"
    const [visible, setVisible] = useState(false)

    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-medium text-[#8a8f98]">
          {label}
        </label>
        <div className="relative">
          <input
            ref={ref}
            type={isPassword && visible ? "text" : type}
            className={`h-10 w-full rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 text-sm text-white placeholder:text-[#555a63] transition-colors focus:border-white/[0.2] focus:outline-none ${
              isPassword ? "pr-10" : ""
            } ${error ? "border-red-400/50" : ""} ${className ?? ""}`}
            {...props}
          />
          {isPassword && (
            <button
              type="button"
              onClick={() => setVisible((v) => !v)}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#555a63] transition-colors hover:text-[#8a8f98]"
            >
              {visible ? (
                <EyeSlashIcon className="size-4" />
              ) : (
                <EyeIcon className="size-4" />
              )}
            </button>
          )}
        </div>
        {error && <p className="text-xs text-red-400">{error}</p>}
      </div>
    )
  },
)
