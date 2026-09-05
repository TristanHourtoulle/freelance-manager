import { Suspense } from "react"
import { NAV_SECTIONS } from "@/lib/navigation"
import { getNavCounts, type NavCounts } from "@/lib/data/nav"
import { SidebarNavLink } from "./sidebar-nav-link"
import { SidebarFooter } from "./sidebar-footer"

interface SidebarProps {
  user: { id: string; name: string; email: string }
}

const ZERO_COUNTS: NavCounts = {
  clients: 0,
  projects: 0,
  tasks: 0,
  invoices: 0,
  quotes: 0,
}

/**
 * Server-rendered sidebar. Reads the badge counts from the cached
 * `getNavCounts(userId)` data fn so navigation between pages doesn't
 * refetch — the cache is invalidated via `revalidateTag(navTag(userId), 'max')`
 * by mutation routes. Active-link styling and logout live in client
 * islands so this tree never needs to be downloaded as JS.
 */
export function Sidebar({ user }: SidebarProps) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">F</div>
        <div>
          <div className="brand-name">FreelanceManager</div>
          <div className="brand-sub">v0.4 · perso</div>
        </div>
      </div>

      <Suspense fallback={<SidebarNav counts={ZERO_COUNTS} />}>
        <SidebarNavWithCounts userId={user.id} />
      </Suspense>

      <SidebarFooter user={user} />
    </aside>
  )
}

async function SidebarNavWithCounts({ userId }: { userId: string }) {
  const counts = await getNavCounts(userId)
  return <SidebarNav counts={counts} />
}

function SidebarNav({ counts }: { counts: NavCounts }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 1,
        flex: 1,
        overflowY: "auto",
      }}
    >
      {NAV_SECTIONS.map((section) => (
        <div key={section.title ?? "_"}>
          {section.title && <div className="nav-section">{section.title}</div>}
          {section.items.map((item) => {
            const badge = item.badgeKey ? counts[item.badgeKey] : undefined
            return (
              <SidebarNavLink
                key={item.id}
                href={item.href}
                label={item.label}
                icon={item.icon}
                badge={badge}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}
