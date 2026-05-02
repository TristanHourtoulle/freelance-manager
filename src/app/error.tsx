"use client"

import { useEffect } from "react"

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[error.digest]", error.digest, error)
  }, [error])

  return (
    <div className="page">
      <div className="empty">
        <div className="empty-title">Une erreur est survenue</div>
        <div style={{ marginBottom: 16 }}>
          {error.message || "Erreur inattendue."}
        </div>
        {error.digest ? (
          <div className="muted small" style={{ marginBottom: 16 }}>
            Code: {error.digest}
          </div>
        ) : null}
        <button className="btn btn-primary" onClick={reset}>
          Réessayer
        </button>
      </div>
    </div>
  )
}
