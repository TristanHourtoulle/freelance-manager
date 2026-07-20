"use client"

import { useId, useState } from "react"
import { Markdown } from "@/lib/markdown"
import { useUpdateProject } from "@/hooks/use-project-detail"
import type { ProjectDetailDTO } from "@/hooks/use-project-detail"

interface ProjectWorkspaceFormProps {
  project: ProjectDetailDTO
  onDone: () => void
}

/**
 * Edit form for the app-owned workspace fields of a mirrored Linear project.
 *
 * Only `repoUrl`, `stagingUrl`, `prodUrl` and `runbook` are editable here —
 * every other column belongs to the Linear sync. Shared by the desktop page
 * and its mobile twin so both offer the same capability.
 *
 * @param project - The resolved project detail used to seed the fields.
 * @param onDone - Called after a successful save or a cancel.
 */
export function ProjectWorkspaceForm({
  project,
  onDone,
}: ProjectWorkspaceFormProps) {
  const fieldId = useId()
  const update = useUpdateProject(project.id)
  const [repoUrl, setRepoUrl] = useState(project.repoUrl ?? "")
  const [stagingUrl, setStagingUrl] = useState(project.stagingUrl ?? "")
  const [prodUrl, setProdUrl] = useState(project.prodUrl ?? "")
  const [runbook, setRunbook] = useState(project.runbook ?? "")
  const [preview, setPreview] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    update.mutate(
      { repoUrl, stagingUrl, prodUrl, runbook },
      { onSuccess: onDone },
    )
  }

  return (
    <form className="detail-card" onSubmit={handleSubmit}>
      <div className="detail-card-header">
        <div>
          <div className="detail-card-title">Espace de travail</div>
          <div className="detail-card-sub">
            Ces champs t&apos;appartiennent : la synchronisation Linear ne les
            écrase jamais.
          </div>
        </div>
      </div>

      <div className="col gap-12">
        <div>
          <label className="field-label" htmlFor={`${fieldId}-repo`}>
            Dépôt Git
          </label>
          <input
            id={`${fieldId}-repo`}
            className="input"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fieldId}-staging`}>
            URL de staging
          </label>
          <input
            id={`${fieldId}-staging`}
            className="input"
            value={stagingUrl}
            onChange={(e) => setStagingUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>
        <div>
          <label className="field-label" htmlFor={`${fieldId}-prod`}>
            URL de production
          </label>
          <input
            id={`${fieldId}-prod`}
            className="input"
            value={prodUrl}
            onChange={(e) => setProdUrl(e.target.value)}
            placeholder="https://…"
          />
        </div>

        <div>
          <div
            className="row"
            style={{ justifyContent: "space-between", marginBottom: 8 }}
          >
            <label className="field-label" htmlFor={`${fieldId}-runbook`}>
              Runbook (markdown)
            </label>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "Éditer" : "Aperçu"}
            </button>
          </div>
          {preview ? (
            <div className="suivi-md-preview">
              {runbook.trim() ? (
                <Markdown source={runbook} />
              ) : (
                <span style={{ color: "var(--text-3)" }}>Rien à afficher.</span>
              )}
            </div>
          ) : (
            <textarea
              id={`${fieldId}-runbook`}
              className="textarea mono"
              rows={10}
              value={runbook}
              onChange={(e) => setRunbook(e.target.value)}
              placeholder={"## Déploiement\n1. …"}
            />
          )}
          <div className="xs muted" style={{ marginTop: 8, lineHeight: 1.6 }}>
            Ne stocke aucun mot de passe, token ou clé ici. Note uniquement les
            accès non sensibles (ex. «&nbsp;accès via l&apos;Okta du client,
            demander à Marie&nbsp;»).
          </div>
        </div>

        <div className="row gap-8" style={{ justifyContent: "flex-end" }}>
          <button type="button" className="btn btn-secondary" onClick={onDone}>
            Annuler
          </button>
          <button
            type="submit"
            className="btn btn-primary"
            disabled={update.isPending}
          >
            Enregistrer
          </button>
        </div>
      </div>
    </form>
  )
}
