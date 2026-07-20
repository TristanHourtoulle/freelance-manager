"use client"

import { Fragment } from "react"
import { usePathname } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { useCmdK } from "@/components/cmdk/cmdk-provider"
import { deriveCrumbs } from "@/lib/breadcrumbs"

export function Topbar() {
  const cmdk = useCmdK()
  const pathname = usePathname()
  const crumbs = deriveCrumbs(pathname)
  return (
    <div className="topbar">
      <nav className="crumbs" aria-label="Fil d'Ariane">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="sep" aria-hidden="true">
                <Icon name="chevron-right" size={12} />
              </span>
            )}
            <span
              className={i === crumbs.length - 1 ? "cur" : ""}
              aria-current={i === crumbs.length - 1 ? "page" : undefined}
            >
              {c}
            </span>
          </Fragment>
        ))}
      </nav>
      <button
        type="button"
        className="topbar-search"
        onClick={cmdk.open}
        aria-label="Ouvrir la palette de commandes"
      >
        <Icon name="search" size={14} className="muted" />
        <span className="topbar-search-placeholder">
          Rechercher tasks, clients, factures…
        </span>
        <span className="kbd">⌘K</span>
      </button>
      <button
        className="icon-btn"
        title="Notifications"
        style={{ position: "relative" }}
        aria-label="Notifications"
      >
        <Icon name="bell" size={16} />
        <span
          style={{
            position: "absolute",
            top: 4,
            right: 4,
            width: 6,
            height: 6,
            background: "var(--danger)",
            borderRadius: "99px",
          }}
        />
      </button>
    </div>
  )
}
