"use client"

import { Fragment } from "react"
import { Icon } from "@/components/ui/icon"

interface TopbarProps {
  crumbs: string[]
}

export function Topbar({ crumbs }: TopbarProps) {
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
      <div className="topbar-search">
        <Icon name="search" size={14} className="muted" />
        <input
          placeholder="Rechercher tasks, clients, factures…"
          aria-label="Rechercher"
        />
        <span className="kbd">⌘K</span>
      </div>
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
