"use client"

import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { SuiviView } from "@/components/suivi/suivi-view"

/**
 * Mobile twin of the standalone Suivi page. Reuses the shared `SuiviView`
 * surface (client actions + Teams meetings) inside the mobile shell.
 */
export function MobileSuiviPage() {
  return (
    <div className="m-screen">
      <MobileTopbar title="Suivi" />
      <div className="m-content">
        <div className="m-stack" style={{ paddingTop: 8 }}>
          <SuiviView />
        </div>
      </div>
    </div>
  )
}
