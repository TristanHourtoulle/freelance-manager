"use client"

import { LinearIntegrationCard } from "@/components/settings/linear-integration-card"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { useIsMobile } from "@/hooks/use-is-mobile"

export default function SettingsPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileSettingsPage />
  return <DesktopSettingsPage />
}

function DesktopSettingsPage() {
  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Réglages</h1>
          <div className="page-sub">
            Intégrations et paramètres de facturation par défaut.
          </div>
        </div>
      </div>

      <div className="col gap-16">
        <LinearIntegrationCard />
      </div>
    </div>
  )
}

function MobileSettingsPage() {
  return (
    <div className="m-screen">
      <MobileTopbar title="Réglages" back="/more" />
      <div className="m-content">
        <div className="big-header">
          <div className="big-title">Réglages</div>
          <div className="big-sub">Intégrations et paramètres</div>
        </div>
        <div className="m-stack">
          <LinearIntegrationCard />
        </div>
      </div>
    </div>
  )
}
