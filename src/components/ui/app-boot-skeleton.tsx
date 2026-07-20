import { Icon } from "@/components/ui/icon"
import { PageSkeleton } from "@/components/ui/page-skeleton"
import { Skeleton } from "@/components/ui/skeleton"
import { NAV_SECTIONS } from "@/lib/navigation"

/**
 * Cold-boot chrome placeholder rendered while the authenticated shell
 * resolves. Mirrors `AppShell` one-for-one, including its
 * `.desktop-only` / `.mobile-only` wrappers, so the handover to the real
 * shell shifts nothing.
 *
 * Everything statically known — brand, nav sections, nav labels and icons,
 * search placeholder — is painted for real; only the badge counts, the
 * breadcrumb and the user identity are skeletonised. Nav items are plain
 * `div`s rather than links so keyboard users cannot tab into dead controls
 * during boot.
 */
export function AppBootSkeleton() {
  return (
    <div className="app">
      <div className="desktop-only">
        <aside className="sidebar">
          <div className="brand">
            <div className="brand-mark">F</div>
            <div>
              <div className="brand-name">FreelanceManager</div>
              <div className="brand-sub">v0.4 · perso</div>
            </div>
          </div>

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
                {section.title && (
                  <div className="nav-section">{section.title}</div>
                )}
                {section.items.map((item) => (
                  <div key={item.id} className="nav-item">
                    <Icon name={item.icon} size={16} />
                    <span>{item.label}</span>
                    {item.badgeKey && (
                      <span className="badge">
                        <Skeleton width={10} height={9} radius={3} />
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div className="sidebar-footer">
            <Skeleton width={32} height={32} radius={8} />
            <div style={{ minWidth: 0, flex: 1 }}>
              <Skeleton width="70%" height={13} />
              <div style={{ marginTop: 5 }}>
                <Skeleton width="90%" height={11} />
              </div>
            </div>
            <Skeleton width={28} height={28} radius={6} />
          </div>
        </aside>
      </div>

      <div className="main">
        <div className="desktop-only">
          <div className="topbar">
            <div className="crumbs">
              <Skeleton width={140} height={13} />
            </div>
            <div className="topbar-search">
              <Icon name="search" size={14} className="muted" />
              <span className="topbar-search-placeholder">
                Rechercher tasks, clients, factures…
              </span>
              <span className="kbd">⌘K</span>
            </div>
            <Skeleton width={28} height={28} radius={6} />
          </div>
        </div>

        <PageSkeleton showChart label="Chargement de l'espace de travail…" />
      </div>
    </div>
  )
}
