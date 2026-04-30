"use client"

export default function AuthError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="page">
      <div className="empty">
        <div className="empty-title">Erreur d&apos;authentification</div>
        <div style={{ marginBottom: 16 }}>
          {error.message || "Une erreur est survenue."}
        </div>
        <button className="btn btn-primary" onClick={reset}>
          Réessayer
        </button>
      </div>
    </div>
  )
}
