"use client"

import { useEffect } from "react"

export default function AuthError({
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
        <div className="empty-title">Erreur d&apos;authentification</div>
        <div style={{ marginBottom: 16 }}>
          {error.message || "Une erreur est survenue."}
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
