"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Icon } from "@/components/ui/icon"
import { GithubGlyph, GoogleGlyph } from "@/components/auth/auth-side"
import { useToast } from "@/components/providers/toast-provider"

export function MobileLoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !password) return
    setError("")
    setLoading(true)
    const result = await authClient.signIn.email({ email, password })
    setLoading(false)
    if (result.error) {
      setError(result.error.message ?? "Connexion échouée")
      return
    }
    toast({ variant: "success", title: "Connexion réussie" })
    router.push("/dashboard")
    router.refresh()
  }

  function notifyOAuth() {
    toast({
      variant: "info",
      title: "OAuth bientôt disponible",
      description: "La connexion via Google/GitHub n'est pas encore branchée.",
    })
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
        Bon retour, <br />
        reprenons.
      </h1>
      <p className="auth-sub">
        Reprends le contrôle de ta facturation freelance.
      </p>

      <form className="auth-form" onSubmit={onSubmit}>
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
              autoFocus
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
          <div style={{ textAlign: "right" }}>
            <button type="button" className="auth-link xs">
              Mot de passe oublié ?
            </button>
          </div>
        </div>

        {error && (
          <div
            className="small"
            style={{ color: "var(--danger)", padding: "0 0 4px" }}
          >
            {error}
          </div>
        )}

        <button type="submit" className="auth-cta" disabled={loading}>
          {loading ? "Connexion…" : "Se connecter"}
          <Icon name="arrow-right" size={14} />
        </button>
      </form>

      <div className="auth-divider">ou</div>
      <div className="auth-oauth-row">
        <button type="button" className="auth-oauth" onClick={notifyOAuth}>
          <GoogleGlyph />
          Google
        </button>
        <button type="button" className="auth-oauth" onClick={notifyOAuth}>
          <GithubGlyph />
          GitHub
        </button>
      </div>

      <div className="auth-bottom">
        Pas encore de compte ?{" "}
        <button
          type="button"
          className="auth-link"
          onClick={() => router.push("/auth/register")}
        >
          Créer un compte
        </button>
      </div>
    </div>
  )
}
