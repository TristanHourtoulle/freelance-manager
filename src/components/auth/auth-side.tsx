import { Icon } from "@/components/ui/icon"

interface AuthSideProps {
  variant: "login" | "register"
}

/**
 * Left split-screen panel shown next to the login/register form.
 * Mirrors design-reference/src/page-auth.jsx AuthSide pixel-for-pixel:
 * gradient background, logo, headline, three feature pills, and two
 * "preview" cards floating at the bottom.
 */
export function AuthSide({ variant }: AuthSideProps) {
  void variant
  return (
    <div className="auth-side">
      <div className="auth-side-inner">
        <div className="auth-logo">
          <div className="auth-logo-mark">F</div>
          <div>
            <div className="auth-logo-name">FreelanceManager</div>
            <div className="muted xs">v0.4 · perso</div>
          </div>
        </div>

        <div>
          <h2 className="auth-side-headline">
            De Linear à <span className="accent">facturé</span>,
            <br />
            sans copier-coller.
          </h2>
          <p className="auth-side-sub">
            Synchronise tes projets Linear, transforme tes tasks en factures en
            3 clics, suis tes encaissements en temps réel.
          </p>

          <div
            className="row gap-12"
            style={{ marginTop: 28, flexWrap: "wrap" }}
          >
            {[
              { ic: "sync" as const, label: "Sync Linear" },
              { ic: "invoice" as const, label: "Drag & drop facturation" },
              { ic: "chart" as const, label: "Pipeline en clair" },
            ].map((f) => (
              <div
                key={f.label}
                className="row gap-8"
                style={{
                  padding: "8px 12px",
                  background: "oklch(0.235 0.009 240 / 0.7)",
                  border: "1px solid var(--border)",
                  borderRadius: 99,
                }}
              >
                <Icon
                  name={f.ic}
                  size={13}
                  style={{ color: "var(--accent)" }}
                />
                <span className="small">{f.label}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="auth-preview">
          <div className="preview-card float-1" style={{ width: 360 }}>
            <div className="row gap-8" style={{ marginBottom: 12 }}>
              <span className="task-id">TRI-198</span>
              <span className="strong small grow truncate">
                refactor: events register from single process
              </span>
              <span className="pill pill-pending xs">À facturer</span>
            </div>
            <div className="row gap-12 small">
              <div>
                <div className="muted xs">Estimate</div>
                <div className="num strong">5 j</div>
              </div>
              <div>
                <div className="muted xs">Valeur</div>
                <div className="num strong" style={{ color: "var(--accent)" }}>
                  1 500 €
                </div>
              </div>
              <div style={{ marginLeft: "auto" }}>
                <div className="muted xs">Client</div>
                <div className="strong small">Quintyss</div>
              </div>
            </div>
            <div className="divider" style={{ margin: "14px 0" }} />
            <div className="row gap-8 xs muted">
              <Icon name="arrow-right" size={11} />
              Glisse vers une facture pour facturer instantanément
            </div>
          </div>

          <div className="preview-card float-2">
            <div className="muted xs">Revenu mensuel</div>
            <div className="num strong" style={{ fontSize: 22, marginTop: 2 }}>
              4 357 €
            </div>
            <div
              className="row gap-4 xs"
              style={{ color: "var(--accent)", marginTop: 4 }}
            >
              <Icon name="arrow-up" size={10} />
              +18% vs mois dernier
            </div>
            <svg
              width="100%"
              height="48"
              viewBox="0 0 200 48"
              style={{ marginTop: 8 }}
            >
              <path
                d="M0 38 L25 32 L50 28 L75 30 L100 22 L125 24 L150 16 L175 12 L200 8"
                fill="none"
                stroke="oklch(0.86 0.19 128)"
                strokeWidth="2"
                strokeLinecap="round"
              />
              <circle cx="200" cy="8" r="3" fill="oklch(0.86 0.19 128)" />
            </svg>
          </div>
        </div>
      </div>
    </div>
  )
}

export function GoogleGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24">
      <path
        fill="#EA4335"
        d="M12 10v3.6h5.1c-.2 1.4-1.6 4.2-5.1 4.2-3.1 0-5.6-2.5-5.6-5.7s2.5-5.7 5.6-5.7c1.7 0 2.9.7 3.6 1.4l2.4-2.4C16.4 4 14.4 3 12 3 6.9 3 2.8 7.1 2.8 12.2S6.9 21.4 12 21.4c6.9 0 9.4-4.8 9.4-7.4 0-.5-.1-.9-.1-1.3H12z"
      />
    </svg>
  )
}

export function GithubGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.4-4-1.4-.6-1.4-1.4-1.8-1.4-1.8-1.1-.7.1-.7.1-.7 1.2.1 1.9 1.2 1.9 1.2 1.1 1.9 2.9 1.4 3.6 1 .1-.8.4-1.4.8-1.7-2.7-.3-5.5-1.3-5.5-6 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.7-2.8 5.7-5.5 6 .4.3.8 1 .8 2.1v3.1c0 .3.2.7.8.6A12 12 0 0 0 12 .3" />
    </svg>
  )
}

/**
 * Score a password 0-4 based on the heuristic from design-reference:
 * length>=8 + uppercase + digit + (symbol or length>=12).
 */
export function scorePassword(p: string): number {
  if (!p) return 0
  let s = 0
  if (p.length >= 8) s++
  if (/[A-Z]/.test(p)) s++
  if (/[0-9]/.test(p)) s++
  if (/[^A-Za-z0-9]/.test(p) || p.length >= 12) s++
  return Math.min(s, 4)
}
