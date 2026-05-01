"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Icon } from "@/components/ui/icon"
import { scorePassword } from "@/components/auth/auth-side"
import { useToast } from "@/components/providers/toast-provider"

const STRENGTH_LABEL = ["Trop court", "Faible", "Correct", "Fort", "Excellent"]

export function MobileRegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const strength = scorePassword(password)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !password) return
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
    toast({ variant: "success", title: "Compte créé · bienvenue !" })
    router.push("/dashboard")
    router.refresh()
  }

  return (
    <div className="auth-screen">
      <div className="auth-logo-row">
        <div className="auth-logo-mark">F</div>
        <div>
          <div className="strong">FreelanceManager</div>
          <div className="xs muted">v0.4 · perso</div>
        </div>
      </div>
      <h1 className="auth-headline">
        Démarre <br />
        en 30 secondes.
      </h1>
      <p className="auth-sub">
        Connecte ton Linear, suis ta pipeline, fais grandir ton activité.
      </p>

      <form className="auth-form" onSubmit={onSubmit}>
        <div className="field">
          <label className="field-label">Nom complet</label>
          <div className="auth-input-wrap">
            <Icon name="user" size={16} className="lead-ic" />
            <input
              className="auth-input"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tristan Hourtoulle"
              autoFocus
              required
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Email</label>
          <div className="auth-input-wrap">
            <Icon name="mail" size={16} className="lead-ic" />
            <input
              className="auth-input"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@exemple.com"
              required
            />
          </div>
        </div>
        <div className="field">
          <label className="field-label">Mot de passe</label>
          <div className="auth-input-wrap">
            <Icon name="lock" size={16} className="lead-ic" />
            <input
              className="auth-input"
              type={showPwd ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
            />
            <button
              type="button"
              className="auth-toggle-pwd"
              onClick={() => setShowPwd((s) => !s)}
              aria-label={showPwd ? "Masquer" : "Afficher"}
            >
              <Icon name={showPwd ? "eye-off" : "eye"} size={16} />
            </button>
          </div>
          <div className="pwd-strength">
            {[1, 2, 3, 4].map((n) => (
              <div
                key={n}
                className={
                  "pwd-strength-bar" + (n <= strength ? " on-" + strength : "")
                }
              />
            ))}
          </div>
          <div className="xs muted" style={{ marginTop: 4 }}>
            {STRENGTH_LABEL[strength]}
          </div>
        </div>

        {error && (
          <div className="small" style={{ color: "var(--danger)" }}>
            {error}
          </div>
        )}

        <button type="submit" className="auth-cta" disabled={loading}>
          {loading ? "Création…" : "Créer mon compte"}
          <Icon name="arrow-right" size={14} />
        </button>
      </form>

      <div className="auth-bottom">
        Déjà un compte ?{" "}
        <button
          type="button"
          className="auth-link"
          onClick={() => router.push("/auth/login")}
        >
          Se connecter
        </button>
      </div>
    </div>
  )
}
