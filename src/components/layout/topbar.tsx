"use client"

import { Fragment } from "react"
import { Icon } from "@/components/ui/icon"
import { useCmdK } from "@/components/cmdk/cmdk-provider"

interface TopbarProps {
  crumbs: string[]
}

export function Topbar({ crumbs }: TopbarProps) {
  const cmdk = useCmdK()
  return (
    <div className="topbar">
      <div className="crumbs">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && (
              <span className="sep">
                <Icon name="chevron-right" size={12} />
              </span>
            )}
            <span className={i === crumbs.length - 1 ? "cur" : ""}>{c}</span>
          </Fragment>
        ))}
      </div>
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
