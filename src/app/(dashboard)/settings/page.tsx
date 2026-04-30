import { LinearIntegrationCard } from "@/components/settings/linear-integration-card"

export default function SettingsPage() {
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
