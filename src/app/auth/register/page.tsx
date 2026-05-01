"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { authClient } from "@/lib/auth-client"
import { Icon } from "@/components/ui/icon"
import {
  AuthSide,
  GithubGlyph,
  GoogleGlyph,
  scorePassword,
} from "@/components/auth/auth-side"
import { useToast } from "@/components/providers/toast-provider"

const STRENGTH_LABEL = ["Trop court", "Faible", "Correct", "Fort", "Excellent"]

export default function RegisterPage() {
  const router = useRouter()
  const { toast } = useToast()
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPwd, setShowPwd] = useState(false)
  const [accept, setAccept] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  const strength = scorePassword(password)

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name || !email || !password || !accept) return
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

  function notifyOAuth() {
    toast({
      variant: "info",
      title: "OAuth bientôt disponible",
      description: "La connexion via Google/GitHub n'est pas encore branchée.",
    })
  }

  return (
    <div className="auth-page">
      <AuthSide variant="register" />
      <div className="auth-form-side">
        <form className="auth-card" onSubmit={onSubmit}>
          <div className="auth-eyebrow">
            <Icon name="plus" size={11} />
            Démarre en 30s
          </div>
          <h1 className="auth-title">Créer un compte</h1>
          <p className="auth-sub">
            Connecte ton Linear, suis ta pipeline, fais grandir ton activité.
          </p>

          <div className="auth-fields">
            <div className="field">
              <label className="field-label">Nom complet</label>
              <div className="auth-input-wrap">
                <Icon name="user" size={15} className="lead-ic" />
                <input
                  className="auth-input"
                  type="text"
                  placeholder="Tristan Hourtoulle"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  autoFocus
                  required
                />
              </div>
            </div>
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
                  required
                />
              </div>
            </div>
            <div className="field">
              <label className="field-label">Mot de passe</label>
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
              <div className="pwd-strength">
                {[1, 2, 3, 4].map((n) => (
                  <div
                    key={n}
                    className={
                      "pwd-strength-bar" +
                      (n <= strength ? " on-" + strength : "")
                    }
                  />
                ))}
              </div>
              <div className="xs muted" style={{ marginTop: 4 }}>
                {STRENGTH_LABEL[strength]} · 8 caractères, 1 chiffre, 1
                majuscule
              </div>
            </div>
            <label className="auth-checkbox" style={{ marginTop: 4 }}>
              <input
                type="checkbox"
                checked={accept}
                onChange={(e) => setAccept(e.target.checked)}
              />
              <span>
                J&apos;accepte les <span className="auth-link">CGU</span> et la{" "}
                <span className="auth-link">politique de confidentialité</span>
              </span>
            </label>
          </div>

          {error && (
            <div
              className="small"
              style={{ color: "var(--danger)", marginTop: 12 }}
            >
              {error}
            </div>
          )}

          <button
            type="submit"
            className="auth-cta"
            disabled={loading || !accept || strength < 2 || !name || !email}
          >
            {loading ? "Création…" : "Créer mon compte"}
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
            Déjà un compte ?{" "}
            <button
              type="button"
              className="auth-link"
              onClick={() => router.push("/auth/login")}
            >
              Se connecter
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
