"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import {
  ArrowRightStartOnRectangleIcon,
  Cog6ToothIcon,
  MagnifyingGlassIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline"
import { authClient } from "@/lib/auth-client"
import { NAV_SECTIONS, SETTINGS_NAV_SECTIONS } from "@/lib/navigation"
import { NotificationBell } from "@/components/notifications/notification-bell"
import { useUserImage } from "@/components/providers/user-provider"

interface SidebarNavProps {
  userName: string
  userEmail: string
  isOpen: boolean
  onClose: () => void
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)
}

function AppNav({
  userName,
  userEmail,
}: {
  userName: string
  userEmail: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { image: userImage } = useUserImage()
  const t = useTranslations("nav")

  function isActive(href: string): boolean {
    if (href === "/dashboard") return pathname === "/dashboard"
    if (href === "/settings") return pathname.startsWith("/settings")
    return pathname.startsWith(href)
  }

  async function handleLogout() {
    await authClient.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="flex h-full flex-col">
      {/* User profile */}
      <div className="p-5 pb-4">
        <div className="flex items-center gap-3.5">
          {userImage ? (
            <img
              src={userImage}
              alt={userName}
              className="size-12 shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex size-12 shrink-0 items-center justify-center rounded-full text-sm font-normal text-white bg-linear-to-r from-[var(--color-primary)] to-[color-mix(in_srgb,var(--color-primary),#000_30%)]">
              {getInitials(userName)}
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-base font-medium text-text-primary">
              {userName}
            </p>
            <p className="truncate text-xs text-text-secondary">{userEmail}</p>
          </div>
        </div>
      </div>

      <div className="mx-5 border-t border-border" />

      {/* Search + Notification */}
      <div className="flex items-center gap-3 px-5 pt-5">
        <button
          onClick={() => {
            document.dispatchEvent(
              new KeyboardEvent("keydown", {
                key: "k",
                metaKey: true,
                bubbles: true,
              }),
            )
          }}
          className="flex h-10 flex-1 items-center justify-between border border-border bg-surface px-4 text-sm transition-colors hover:bg-surface-muted"
          style={{ borderRadius: "20px 12px 12px 20px" }}
        >
          <div className="flex items-center gap-2.5">
            <MagnifyingGlassIcon className="size-4 shrink-0 text-text-muted" />
            <span className="text-text-muted">{t("search")}</span>
          </div>
          <kbd className="rounded bg-surface-muted/50 px-1.5 py-0.5 text-[11px] text-text-muted">
            {typeof navigator !== "undefined" &&
            navigator.platform?.includes("Mac")
              ? "\u2318 K"
              : "Ctrl+K"}
          </kbd>
        </button>
        <NotificationBell />
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3 pt-4">
        {NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className={sIdx > 0 ? "mt-3" : ""}>
            {section.titleKey && (
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
                {t(section.titleKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "bg-primary text-white"
                        : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {t(item.translationKey)}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>

      {/* Logout */}
      <div className="border-t border-border p-3">
        <button
          onClick={handleLogout}
          className="flex w-full cursor-pointer items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-text-secondary transition-colors hover:bg-surface-muted hover:text-text-primary"
        >
          <ArrowRightStartOnRectangleIcon className="h-5 w-5 shrink-0" />
          {t("logout")}
        </button>
      </div>
    </div>
  )
}

function SettingsNav() {
  const pathname = usePathname()
  const t = useTranslations("settingsNav")

  function isActive(href: string): boolean {
    if (href === "/settings") return pathname === "/settings"
    return pathname.startsWith(href)
  }

  return (
    <div className="flex h-full flex-col">
      {/* Settings header */}
      <div className="flex items-center gap-3 p-5 pb-4">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-muted">
          <Cog6ToothIcon className="size-5 text-foreground" />
        </div>
        <div>
          <p className="text-base font-semibold text-foreground">
            {t("title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <div className="mx-5 border-t border-border" />

      {/* Settings navigation sections */}
      <nav className="flex-1 overflow-y-auto p-3 pt-2">
        {SETTINGS_NAV_SECTIONS.map((section, sIdx) => (
          <div key={sIdx} className={sIdx > 0 ? "mt-4" : "mt-1"}>
            {section.titleKey && (
              <p className="mb-1 px-3 text-xs font-medium uppercase tracking-wider text-muted-foreground/50">
                {t(section.titleKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {section.items.map((item) => {
                const active = isActive(item.href)
                const isBack = item.href === "/dashboard"
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      isBack
                        ? "text-muted-foreground hover:bg-surface-muted hover:text-foreground"
                        : active
                          ? "bg-primary text-white"
                          : "text-text-secondary hover:bg-surface-muted hover:text-text-primary"
                    }`}
                  >
                    <item.icon className="h-5 w-5 shrink-0" />
                    {t(item.translationKey)}
                  </Link>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </div>
  )
}

function NavContent({
  userName,
  userEmail,
}: {
  userName: string
  userEmail: string
}) {
  const pathname = usePathname()
  const isSettings = pathname.startsWith("/settings")

  if (isSettings) return <SettingsNav />
  return <AppNav userName={userName} userEmail={userEmail} />
}

export function SidebarNav({
  userName,
  userEmail,
  isOpen,
  onClose,
}: SidebarNavProps) {
  return (
    <>
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-72 border-r-2 border-border bg-surface lg:block">
        <NavContent userName={userName} userEmail={userEmail} />
      </aside>

      {/* Mobile overlay */}
      <div
        className={`fixed inset-0 z-40 lg:hidden ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
      >
        <div
          className={`fixed inset-0 bg-black/50 transition-opacity duration-200 ${isOpen ? "opacity-100" : "opacity-0"}`}
          onClick={onClose}
          onKeyDown={(e) => {
            if (e.key === "Escape") onClose()
          }}
        />
        <aside
          className={`fixed inset-y-0 left-0 z-50 w-72 bg-surface transition-transform duration-200 ${isOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <div className="flex items-center justify-end p-2">
            <button
              onClick={onClose}
              className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-muted"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
          </div>
          <NavContent userName={userName} userEmail={userEmail} />
        </aside>
      </div>
    </>
  )
}
