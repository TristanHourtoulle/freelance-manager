"use client"

import type { ReactNode } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { useOptionalCmdK } from "@/components/cmdk/cmdk-provider"

interface MobileTopbarProps {
  title: ReactNode
  back?: string | (() => void)
  action?: ReactNode
  search?: boolean
}

/**
 * Compact mobile topbar: optional back button (string href or callback),
 * title in the middle, a search button opening the command palette, and an
 * optional trailing action button.
 *
 * @param search - Set to `false` to hide the search button on a screen that
 * needs the room. The button is also hidden when no command palette is
 * mounted, so the topbar stays usable in isolated unit tests.
 */
export function MobileTopbar({
  title,
  back,
  action,
  search = true,
}: MobileTopbarProps) {
  const router = useRouter()
  const cmdk = useOptionalCmdK()
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
      {search && cmdk && (
        <button
          type="button"
          className="m-topbar-action"
          onClick={cmdk.open}
          aria-label="Rechercher"
        >
          <Icon name="search" size={17} />
        </button>
      )}
      {action}
    </div>
  )
}
