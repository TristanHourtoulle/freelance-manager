"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    setLoading(true)
    const result = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (result.error) {
      setError(result.error.message ?? "Connexion échouée")
      return
    }
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div
      style={{
        display: "grid",
        placeItems: "center",
        minHeight: "100vh",
        padding: 24,
      }}
    >
      <div className="card" style={{ width: 400, maxWidth: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="brand-mark" style={{ margin: "0 auto 12px" }}>
            F
          </div>
          <div className="page-title" style={{ fontSize: 20 }}>
            Connexion
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            Bon retour sur FreelanceManager
          </div>
        </div>
        <form onSubmit={onSubmit} className="col gap-12">
          <div className="field">
            <label className="field-label">Email</label>
            <input
              className="input"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tristan@example.com"
            />
          </div>
          <div className="field">
            <label className="field-label">Mot de passe</label>
            <input
              className="input"
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          {error && (
            <div className="muted small" style={{ color: "var(--danger)" }}>
              {error}
            </div>
          )}
          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
            style={{ marginTop: 4 }}
          >
            {loading ? "Connexion…" : "Se connecter"}
          </button>
        </form>
        <div
          className="muted small"
          style={{ textAlign: "center", marginTop: 18 }}
        >
          Pas encore de compte ?{" "}
          <Link
            href="/auth/register"
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </div>
  )
}
