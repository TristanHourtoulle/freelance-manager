"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { authClient } from "@/lib/auth-client"

export default function RegisterPage() {
  const router = useRouter()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError("")
    if (password.length < 8) {
      setError("Mot de passe : 8 caractères minimum")
      return
    }
    setLoading(true)
    const result = await authClient.signUp.email({ name, email, password })
    setLoading(false)
    if (result.error) {
      setError(result.error.message ?? "Inscription échouée")
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
            Créer un compte
          </div>
          <div className="muted small" style={{ marginTop: 4 }}>
            Démarre sur FreelanceManager
          </div>
        </div>
        <form onSubmit={onSubmit} className="col gap-12">
          <div className="field">
            <label className="field-label">Nom</label>
            <input
              className="input"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tristan Hourtoulle"
            />
          </div>
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
              minLength={8}
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
            {loading ? "Création…" : "Créer mon compte"}
          </button>
        </form>
        <div
          className="muted small"
          style={{ textAlign: "center", marginTop: 18 }}
        >
          Déjà un compte ?{" "}
          <Link
            href="/auth/login"
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            Se connecter
          </Link>
        </div>
      </div>
    </div>
  )
}
