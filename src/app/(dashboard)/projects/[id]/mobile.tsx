"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { MobilePageSkeleton } from "@/components/mobile/mobile-page-skeleton"
import {
  StatusPill,
  invoicePillStatus,
  taskStatusToPill,
} from "@/components/ui/pill"
import { fmtDate, fmtEUR, fmtRelative } from "@/lib/format"
import { Markdown } from "@/lib/markdown"
import { TaskIdLink } from "@/components/ui/task-id-link"
import { useProjectDetail } from "@/hooks/use-project-detail"
import { ProjectWorkspaceForm } from "@/components/projects/project-workspace-form"

type Tab = "overview" | "tasks" | "invoices" | "runbook"

interface MobileProjectDetailPageProps {
  id: string
}

/**
 * Mobile twin of the project detail page.
 *
 * Exposes the same data and the same app-owned edit capability as the desktop
 * view, through the mobile shell primitives.
 *
 * @param id - Project id resolved from the route params.
 */
export function MobileProjectDetailPage({ id }: MobileProjectDetailPageProps) {
  const router = useRouter()
  const { data: project, isLoading } = useProjectDetail(id)
  const [tab, setTab] = useState<Tab>("overview")
  const [showEdit, setShowEdit] = useState(false)

  if (isLoading) {
    return (
      <MobilePageSkeleton title="Projet" variant="tiles" back="/projects" />
    )
  }

  if (!project) {
    return (
      <div className="m-screen">
        <MobileTopbar title="Projet" back="/projects" />
        <div className="m-content">
          <div className="empty">
            <div className="empty-title">Projet introuvable</div>
          </div>
        </div>
      </div>
    )
  }

  const clientLabel =
    project.client.company ??
    `${project.client.firstName} ${project.client.lastName}`
  const { counts, totals } = project
  const access: { label: string; url: string | null }[] = [
    { label: "Dépôt", url: project.repoUrl },
    { label: "Staging", url: project.stagingUrl },
    { label: "Production", url: project.prodUrl },
  ]

  return (
    <div className="m-screen">
      <MobileTopbar
        title={project.name}
        back="/projects"
        action={
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => setShowEdit((v) => !v)}
          >
            <Icon name="edit" size={14} />
          </button>
        }
      />
      <div className="m-content">
        <div style={{ padding: "8px 14px 8px" }}>
          <div className="row gap-8">
            <span className="task-id">{project.key}</span>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => router.push(`/clients/${project.client.id}`)}
            >
              <Icon name="user" size={12} />
              {clientLabel}
            </button>
          </div>
          <div className="xs muted" style={{ marginTop: 6 }}>
            Synchronisé {fmtRelative(project.lastSyncedAt)}
          </div>
        </div>

        <div
          className="row gap-8"
          style={{ padding: "0 14px 14px", flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="btn btn-secondary btn-sm grow"
            onClick={() => router.push(`/tasks?projectId=${project.id}`)}
          >
            <Icon name="tasks" size={12} />
            Voir les tasks
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm grow"
            onClick={() => setShowEdit((v) => !v)}
          >
            <Icon name="edit" size={12} />
            Modifier
          </button>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(2, 1fr)",
            gap: 10,
            padding: "0 14px 16px",
          }}
        >
          <div className="kpi-tile accent">
            <div className="kpi-label">Revenu</div>
            <div className="kpi-value" style={{ color: "var(--accent)" }}>
              {fmtEUR(totals.revenue)}
            </div>
          </div>
          <div className="kpi-tile info">
            <div className="kpi-label">Encours</div>
            <div className="kpi-value">{fmtEUR(totals.outstanding)}</div>
          </div>
          <div className="kpi-tile warn">
            <div className="kpi-label">À facturer</div>
            <div className="kpi-value">{counts.tasksPendingInvoice}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Factures</div>
            <div className="kpi-value">{counts.invoicesTotal}</div>
          </div>
        </div>

        {showEdit && (
          <div style={{ padding: "0 14px 16px" }}>
            <ProjectWorkspaceForm
              project={project}
              onDone={() => setShowEdit(false)}
            />
          </div>
        )}

        <div style={{ padding: "0 14px" }}>
          <div className="seg" style={{ overflowX: "auto" }}>
            {(
              [
                { id: "overview" as Tab, label: "Vue" },
                { id: "tasks" as Tab, label: "Tasks" },
                { id: "invoices" as Tab, label: "Factures" },
                { id: "runbook" as Tab, label: "Runbook" },
              ] as { id: Tab; label: string }[]
            ).map((t) => (
              <button
                key={t.id}
                type="button"
                className={tab === t.id ? "active" : ""}
                onClick={() => setTab(t.id)}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="m-stack" style={{ marginTop: 14 }}>
          {tab === "overview" && (
            <>
              <div className="card">
                <div className="card-title">Accès</div>
                <div className="col gap-8">
                  {access.map((a) => (
                    <div key={a.label} className="row gap-8">
                      <Icon name="link" size={13} className="muted" />
                      <span className="small strong" style={{ minWidth: 84 }}>
                        {a.label}
                      </span>
                      {a.url ? (
                        <a
                          className="small truncate"
                          href={a.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {a.url}
                        </a>
                      ) : (
                        <span className="muted small">Non renseigné</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
              <div className="card">
                <div className="card-title">Description</div>
                {project.description ? (
                  <div
                    className="small"
                    style={{ color: "var(--text-1)", lineHeight: 1.6 }}
                  >
                    {project.description}
                  </div>
                ) : (
                  <div className="muted small">Aucune description.</div>
                )}
              </div>
            </>
          )}

          {tab === "tasks" && (
            <div className="col gap-8">
              {project.tasks.map((t) => (
                <div key={t.id} className="task-item">
                  <div className="row gap-8">
                    <TaskIdLink
                      identifier={t.linearIdentifier}
                      url={t.linearUrl}
                      className="task-id"
                    />
                    <StatusPill status={taskStatusToPill(t.status)} />
                  </div>
                  <div className="task-title">{t.title}</div>
                </div>
              ))}
              {project.tasks.length === 0 && (
                <div className="empty">
                  <div className="empty-title">Aucune task</div>
                </div>
              )}
            </div>
          )}

          {tab === "invoices" && (
            <div className="col gap-8">
              {project.invoices.map((inv) => (
                <button
                  key={inv.id}
                  type="button"
                  className="card card-tight"
                  onClick={() => router.push(`/billing?invoiceId=${inv.id}`)}
                  style={{ textAlign: "left", width: "100%" }}
                >
                  <div className="row gap-8">
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong small truncate">{inv.number}</div>
                      <div className="xs muted">{fmtDate(inv.issueDate)}</div>
                    </div>
                    <div className="num strong">{fmtEUR(inv.total)}</div>
                    <StatusPill status={invoicePillStatus(inv)} />
                  </div>
                </button>
              ))}
              {project.invoices.length === 0 && (
                <div className="empty">
                  <div className="empty-title">Aucune facture</div>
                </div>
              )}
            </div>
          )}

          {tab === "runbook" && (
            <div className="card">
              {project.runbook ? (
                <Markdown source={project.runbook} />
              ) : (
                <div className="empty">
                  <div className="empty-title">Aucun runbook</div>
                  <div className="empty-sub">
                    Documente ici le déploiement, les accès non sensibles et les
                    gotchas du projet.
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
