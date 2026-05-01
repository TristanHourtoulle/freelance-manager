"use client"

import { Icon } from "@/components/ui/icon"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="page">
      <div className="empty">
        <div className="empty-title">
          <Icon name="alert" size={20} /> Une erreur est survenue
        </div>
        <div style={{ marginBottom: 16 }}>
          {error.message || "Erreur inattendue."}
        </div>
        <button className="btn btn-primary" onClick={reset}>
          Réessayer
        </button>
      </div>
    </div>
  )
}
