"use client"

import { useState } from "react"
import { Icon } from "@/components/ui/icon"
import { ConfirmDialog } from "@/components/ui/confirm-dialog"
import {
  useClearLinearToken,
  useSetLinearToken,
  useSettings,
} from "@/hooks/use-settings"
import { useSyncLinear } from "@/hooks/use-tasks"
import { useToast } from "@/components/providers/toast-provider"
import { fmtRelative } from "@/lib/format"

/**
 * Settings card for the Linear integration.
 *
 * Shows the connection status, the masked token (first 8 + last 4 chars when
 * decryptable), the last sync timestamp and lets the user either rotate the
 * token (PUT) or fully disconnect (DELETE), with a styled confirmation
 * dialog. The PAT field is hidden by default; an eye toggle reveals it.
 */
export function LinearIntegrationCard() {
  const { data: settings } = useSettings()
  const setToken = useSetLinearToken()
  const clearToken = useClearLinearToken()
  const sync = useSyncLinear()
  const { toast } = useToast()
  const [tokenInput, setTokenInput] = useState("")
  const [revealing, setRevealing] = useState(false)
  const [confirmDisconnect, setConfirmDisconnect] = useState(false)

  const connected = Boolean(settings?.hasLinearToken)
  const preview = settings?.linearTokenPreview ?? null

  function handleConnect() {
    const token = tokenInput.trim()
    if (token.length < 10) {
      toast({
        variant: "error",
        title: "Token invalide",
        description: "Le token doit faire au moins 10 caractères.",
      })
      return
    }
    setToken.mutate(token, {
      onSuccess: () => {
        setTokenInput("")
        toast({
          variant: "success",
          title: connected ? "Token Linear mis à jour" : "Linear connecté",
          description: "Tu peux maintenant lier des projets à tes clients.",
        })
      },
      onError: (e) =>
        toast({
          variant: "error",
          title: "Erreur",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  function handleDisconnect() {
    clearToken.mutate(undefined, {
      onSuccess: () => {
        toast({ variant: "success", title: "Linear déconnecté" })
        setConfirmDisconnect(false)
      },
      onError: (e) =>
        toast({
          variant: "error",
          title: "Erreur",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  function handleSync() {
    sync.mutate(undefined, {
      onSuccess: (r) =>
        toast({
          variant: "success",
          title: "Sync Linear terminée",
          description: `${r.tasks} tasks · ${r.projects} projets`,
        }),
      onError: (e) =>
        toast({
          variant: "error",
          title: "Sync échouée",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  return (
    <div className="card">
      <div className="row gap-12" style={{ marginBottom: 16 }}>
        <div
          style={{
            width: 40,
            height: 40,
            borderRadius: 9,
            background: connected ? "var(--accent-soft)" : "var(--bg-3)",
            display: "grid",
            placeItems: "center",
            color: connected ? "var(--accent)" : "var(--text-2)",
          }}
        >
          <Icon name="link" size={18} />
        </div>
        <div className="grow">
          <div className="card-h2">Intégration Linear</div>
          <div className="muted small" style={{ marginTop: 2 }}>
            Synchronise tes projets et tasks Linear pour les facturer.
          </div>
        </div>
        <span
          className={`pill pill-no-dot ${connected ? "pill-paid" : "pill-draft"}`}
        >
          {connected ? "Connecté" : "Non connecté"}
        </span>
      </div>

      {connected && preview && (
        <div
          className="row gap-12"
          style={{
            padding: 12,
            background: "var(--bg-2)",
            borderRadius: 8,
            marginBottom: 12,
            border: "1px solid var(--border)",
          }}
        >
          <Icon name="link" size={14} style={{ color: "var(--accent)" }} />
          <div className="grow">
            <div className="small strong">Token actif</div>
            <div className="muted xs mono">{preview}</div>
          </div>
        </div>
      )}

      <div
        className="row gap-12"
        style={{
          padding: 12,
          background: "var(--bg-2)",
          borderRadius: 8,
          marginBottom: 16,
        }}
      >
        <Icon name="sync" size={14} className="muted" />
        <div className="grow">
          <div className="small strong">Dernière synchronisation</div>
          <div className="muted xs">
            {settings?.linearLastSyncedAt
              ? fmtRelative(settings.linearLastSyncedAt)
              : "jamais"}
          </div>
        </div>
        {connected && (
          <button
            className="btn btn-secondary btn-sm"
            onClick={handleSync}
            disabled={sync.isPending}
          >
            <Icon
              name="sync"
              size={12}
              className={sync.isPending ? "spin" : ""}
            />
            {sync.isPending ? "Sync…" : "Sync maintenant"}
          </button>
        )}
      </div>

      <div className="field">
        <label className="field-label">
          {connected ? "Remplacer le token" : "Token API Linear"}
        </label>
        <div className="row gap-8">
          <div style={{ position: "relative", flex: 1 }}>
            <input
              className="input mono"
              type={revealing ? "text" : "password"}
              placeholder={preview ?? "lin_api_…"}
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              style={{ paddingRight: 36 }}
              autoComplete="off"
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => setRevealing((v) => !v)}
              style={{ position: "absolute", right: 4, top: 4 }}
              title={revealing ? "Masquer" : "Afficher"}
            >
              <Icon name="eye" size={14} />
            </button>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleConnect}
            disabled={setToken.isPending || tokenInput.trim().length < 10}
          >
            <Icon name="check" size={14} />
            {connected ? "Mettre à jour" : "Connecter"}
          </button>
        </div>
        <div className="field-hint">
          Trouve ton token sur{" "}
          <a
            href="https://linear.app/settings/account/security"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--accent)", textDecoration: "none" }}
          >
            linear.app/settings/account/security
          </a>{" "}
          → Personal API keys.
        </div>
      </div>

      {connected && (
        <div
          className="row"
          style={{
            justifyContent: "flex-end",
            marginTop: 16,
            paddingTop: 16,
            borderTop: "1px solid var(--border)",
          }}
        >
          <button
            className="btn btn-danger btn-sm"
            onClick={() => setConfirmDisconnect(true)}
            disabled={clearToken.isPending}
          >
            <Icon name="trash" size={12} />
            Déconnecter Linear
          </button>
        </div>
      )}

      {confirmDisconnect && (
        <ConfirmDialog
          title="Déconnecter Linear ?"
          description="Tes projets et tasks importés seront conservés mais le sync sera désactivé. Tu pourras toujours reconnecter ton token plus tard."
          confirmLabel="Déconnecter"
          cancelLabel="Annuler"
          danger
          icon="trash"
          isPending={clearToken.isPending}
          onCancel={() => setConfirmDisconnect(false)}
          onConfirm={handleDisconnect}
        />
      )}
    </div>
  )
}
