"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"

interface MobileTopbarProps {
  title: ReactNode
  back?: string | (() => void)
  action?: ReactNode
}

/**
 * Compact mobile topbar: optional back button (string href or callback),
 * title in the middle, optional trailing action button.
 */
export function MobileTopbar({ title, back, action }: MobileTopbarProps) {
  const router = useRouter()
  return (
    <div className="m-topbar">
      {back && (
        <button
          type="button"
          className="m-topbar-back"
          onClick={() => {
            if (typeof back === "function") back()
            else router.push(back)
          }}
          aria-label="Retour"
        >
          <Icon name="chevron-left" size={16} />
        </button>
      )}
      <div className="m-topbar-title truncate">{title}</div>
      {action}
    </div>
  )
}
