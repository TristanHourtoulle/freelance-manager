"use client"

import { useEffect } from "react"

/**
 * Catches errors thrown from the root layout itself (where regular
 * `error.tsx` boundaries don't run because there is no parent layout).
 * Must render its own `<html>` + `<body>`.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[global-error.digest]", error.digest, error)
  }, [error])

  return (
    <html lang="fr">
      <body
        style={{
          fontFamily: "system-ui, sans-serif",
          background: "#0a0a0a",
          color: "#fafafa",
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 32,
        }}
      >
        <div style={{ maxWidth: 480, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, marginBottom: 12 }}>
            Une erreur critique est survenue
          </h1>
          <p style={{ marginBottom: 24, opacity: 0.8 }}>
            {error.message || "Erreur inattendue."}
          </p>
          {error.digest ? (
            <p
              style={{
                fontSize: 12,
                fontFamily: "monospace",
                opacity: 0.5,
                marginBottom: 24,
              }}
            >
              Code: {error.digest}
            </p>
          ) : null}
          <button
            onClick={reset}
            style={{
              padding: "8px 16px",
              border: "1px solid #444",
              background: "transparent",
              color: "inherit",
              cursor: "pointer",
              borderRadius: 6,
            }}
          >
            Réessayer
          </button>
        </div>
      </body>
    </html>
  )
}
