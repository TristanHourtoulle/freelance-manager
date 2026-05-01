"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Icon } from "@/components/ui/icon"
import { AuthSide, GithubGlyph, GoogleGlyph } from "@/components/auth/auth-side"
import { useToast } from "@/components/providers/toast-provider"

export default function LoginPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [remember, setRemember] = useState(true)
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

  void remember

  return (
    <div className="auth-page">
      <AuthSide variant="login" />
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-eyebrow">
            <span
              style={{
                width: 6,
                height: 6,
                borderRadius: 99,
                background: "var(--accent)",
                display: "inline-block",
              }}
            />
            Bon retour
          </div>
          <h1 className="auth-title">Connexion</h1>
          <p className="auth-sub">
            Reprends le contrôle de ta facturation freelance.
          </p>

          <div className="auth-fields">
            <div className="field">
              <label className="field-label">Email</label>
              <div className="auth-input-wrap">
                <Icon name="mail" size={15} className="lead-ic" />
                <input
                  className="auth-input"
                  type="email"
                  placeholder="tu@exemple.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>
            <div className="field">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <label className="field-label">Mot de passe</label>
                <button type="button" className="auth-link xs">
                  Mot de passe oublié ?
                </button>
              </div>
              <div className="auth-input-wrap">
                <Icon name="lock" size={15} className="lead-ic" />
                <input
                  className="auth-input"
                  type={showPwd ? "text" : "password"}
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="auth-toggle-pwd"
                  onClick={() => setShowPwd((s) => !s)}
                  aria-label={showPwd ? "Masquer" : "Afficher"}
                >
                  <Icon name={showPwd ? "eye-off" : "eye"} size={15} />
                </button>
              </div>
            </div>
            <div className="auth-row-between">
              <label className="auth-checkbox">
                <input
                  type="checkbox"
                  checked={remember}
                  onChange={(e) => setRemember(e.target.checked)}
                />
                <span>Rester connecté</span>
              </label>
            </div>
          </div>

          {error && (
            <div
              className="small"
              style={{ color: "var(--danger)", marginTop: 12 }}
            >
              {error}
            </div>
          )}

          <button type="submit" className="auth-cta" disabled={loading}>
            {loading ? "Connexion…" : "Se connecter"}
            <Icon name="arrow-right" size={14} />
          </button>

          <div className="auth-divider">ou continuer avec</div>
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
        </form>
      </div>
    </div>
  )
}
