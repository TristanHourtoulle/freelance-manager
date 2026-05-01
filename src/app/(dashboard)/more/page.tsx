"use client"

import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Icon, type IconName } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { useToast } from "@/components/providers/toast-provider"

interface ListItem {
  href: string
  icon: IconName
  label: string
}

const ITEMS: ListItem[] = [
  { href: "/projects", icon: "folder", label: "Projets" },
  { href: "/analytics", icon: "chart", label: "Analytics" },
  { href: "/settings", icon: "settings", label: "Réglages" },
]

/**
 * Mobile-only "Plus" page reachable via the bottom-nav. Hosts the
 * secondary navigation (Projets / Analytics / Réglages) that on
 * desktop lives in the sidebar, plus the logout action.
 */
export default function MorePage() {
  const router = useRouter()
  const { toast } = useToast()

  async function handleLogout() {
    await authClient.signOut()
    toast({ variant: "success", title: "Déconnecté" })
    router.push("/auth/login")
    router.refresh()
  }

  return (
    <div className="m-screen">
      <MobileTopbar title="Plus" />
      <div className="m-content">
        <div className="m-stack" style={{ paddingTop: 8 }}>
          <div className="list-group">
            {ITEMS.map((it) => (
              <button
                key={it.href}
                type="button"
                className="list-row"
                onClick={() => router.push(it.href)}
              >
                <div className="av av-sm" style={{ background: "var(--bg-3)" }}>
                  <Icon
                    name={it.icon}
                    size={14}
                    style={{ color: "var(--text-1)" }}
                  />
                </div>
                <span className="grow small">{it.label}</span>
                <Icon name="chevron-right" size={14} className="muted" />
              </button>
            ))}
          </div>

          <div className="list-group">
            <button
              type="button"
              className="list-row"
              onClick={handleLogout}
              style={{ borderBottom: "none" }}
            >
              <div
                className="av av-sm"
                style={{ background: "var(--danger-soft)" }}
              >
                <Icon
                  name="logout"
                  size={14}
                  style={{ color: "var(--danger)" }}
                />
              </div>
              <span className="grow small" style={{ color: "var(--danger)" }}>
                Déconnexion
              </span>
            </button>
          </div>

          <div
            className="xs muted"
            style={{ textAlign: "center", padding: "20px 0" }}
          >
            FreelanceManager v0.4 · perso
          </div>
        </div>
      </div>
    </div>
  )
}
