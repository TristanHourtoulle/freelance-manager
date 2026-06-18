"use client"

import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { initials } from "@/lib/format"
import { authClient } from "@/lib/auth-client"

interface SidebarFooterProps {
  user: { name: string; email: string }
}

/**
 * Logged-in user identity + logout. Client island so the logout handler
 * can call `authClient.signOut()` and navigate via `useRouter()`.
 */
export function SidebarFooter({ user }: SidebarFooterProps) {
  const router = useRouter()

  async function handleLogout() {
    await authClient.signOut()
    router.push("/auth/login")
  }

  return (
    <div className="sidebar-footer">
      <div className="avatar">{initials(user.name)}</div>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="me-name truncate">{user.name}</div>
        <div className="me-email truncate">{user.email}</div>
      </div>
      <button
        className="icon-btn"
        title="Déconnexion"
        onClick={handleLogout}
        aria-label="Déconnexion"
      >
        <Icon name="logout" size={15} />
      </button>
    </div>
  )
}
