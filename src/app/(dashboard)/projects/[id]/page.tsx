"use client"

import { Activity, use, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { fmtEUR, fmtRelative, initials, avatarColor } from "@/lib/format"
import { Markdown } from "@/lib/markdown"
import { Skeleton, SkeletonKpi } from "@/components/ui/skeleton"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { useProjectDetail } from "@/hooks/use-project-detail"
import type { ProjectDetailDTO } from "@/hooks/use-project-detail"
import { ProjectWorkspaceForm } from "@/components/projects/project-workspace-form"
import {
  ProjectInvoicesPanel,
  ProjectTasksTable,
} from "@/components/projects/project-detail-panels"
import { MobileProjectDetailPage } from "./mobile"

type Tab = "overview" | "tasks" | "invoices" | "runbook"

interface PageProps {
  params: Promise<{ id: string }>
}

/** Number of KPI tiles in the project hero, mirrored by the loading skeleton. */
export const PROJECT_KPI_COUNT = 3

interface ProjectStatusPresentation {
  label: string
  className: string
}

/**
 * Map a mirrored project status to its French label and pill class.
 *
 * @param status - The local project status column.
 * @returns The label and pill class to render in the hero.
 */
export function projectStatusPresentation(
  status: ProjectDetailDTO["status"],
): ProjectStatusPresentation {
  if (status === "COMPLETED") {
    return { label: "Terminé", className: "pill pill-sent pill-no-dot" }
  }
  if (status === "PAUSED") {
    return { label: "En pause", className: "pill pill-draft pill-no-dot" }
  }
  return { label: "Actif", className: "pill pill-paid pill-no-dot" }
}

export default function ProjectDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const isMobile = useIsMobile()
  if (isMobile) return <MobileProjectDetailPage id={id} />
  return <DesktopProjectDetailPage id={id} />
}

/**
 * Desktop project detail view.
 *
 * @param id - Project id resolved from the route params.
 */
export function DesktopProjectDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [showEdit, setShowEdit] = useState(false)
  const { data: project, isLoading } = useProjectDetail(id)

  if (isLoading) return <ProjectDetailSkeleton />
  if (!project) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-title">Projet introuvable</div>
        </div>
      </div>
    )
  }

  const clientLabel =
    project.client.company ??
    `${project.client.firstName} ${project.client.lastName}`
  const { counts, totals } = project
  const statusPill = projectStatusPresentation(project.status)
  const access: { label: string; url: string | null }[] = [
    { label: "Dépôt", url: project.repoUrl },
    { label: "Staging", url: project.stagingUrl },
    { label: "Production", url: project.prodUrl },
  ]

  return (
    <div className="page">
      <div
        className="row gap-8"
        style={{ marginBottom: 16, justifyContent: "space-between" }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push("/projects")}
        >
          <Icon name="chevron-left" size={12} />
          Retour aux projets
        </button>
        <div className="row gap-8">
          <button
            className="btn btn-secondary"
            onClick={() => router.push(`/tasks?projectId=${project.id}`)}
          >
            <Icon name="tasks" size={13} />
            Voir les tasks
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowEdit((v) => !v)}
          >
            <Icon name="edit" size={13} />
            Modifier
          </button>
        </div>
      </div>

      <div className="detail-hero">
        <div className="hero-top">
          <div
            className="hero-av"
            style={{
              background: avatarColor(project.name),
              width: 64,
              height: 64,
              fontSize: 22,
            }}
          >
            {initials(project.name)}
          </div>
          <div className="hero-info">
            <div className="hero-name-row">
              <h1 className="hero-name">{project.name}</h1>
              <span className="pill pill-draft pill-no-dot">{project.key}</span>
              <span className={statusPill.className}>{statusPill.label}</span>
            </div>
            <div className="hero-sub">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => router.push(`/clients/${project.client.id}`)}
              >
                <Icon name="user" size={12} />
                {clientLabel}
              </button>
            </div>
            <div className="hero-meta">
              <span className="hero-meta-item">
                <Icon name="sync" size={13} />
                Synchronisé {fmtRelative(project.lastSyncedAt)}
              </span>
              <span className="hero-meta-item">
                <Icon name="tasks" size={13} />
                {counts.tasksTotal} task{counts.tasksTotal > 1 ? "s" : ""}
              </span>
              <span className="hero-meta-item">
                <Icon name="invoice" size={13} />
                {counts.invoicesTotal} facture
                {counts.invoicesTotal > 1 ? "s" : ""}
              </span>
            </div>
          </div>
        </div>

        <div className="kpi-grid" data-testid="project-kpi-grid">
          <div className="kpi">
            <div className="kpi-label">
              <Icon name="arrow-up" size={11} />
              Revenu généré
            </div>
            <div className="kpi-value accent">{fmtEUR(totals.revenue)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              <Icon name="invoice" size={11} />
              Encours
            </div>
            <div className="kpi-value warn">{fmtEUR(totals.outstanding)}</div>
          </div>
          <div className="kpi">
            <div className="kpi-label">
              <Icon name="tasks" size={11} />À facturer
            </div>
            <div className="kpi-value">{counts.tasksPendingInvoice}</div>
          </div>
        </div>
      </div>

      {showEdit && (
        <div style={{ marginBottom: 16 }}>
          <ProjectWorkspaceForm
            project={project}
            onDone={() => setShowEdit(false)}
          />
        </div>
      )}

      <div className="tabs" role="tablist">
        {(
          [
            { id: "overview", label: "Vue d'ensemble", icon: "home" as const },
            {
              id: "tasks",
              label: "Tasks",
              icon: "tasks" as const,
              count: counts.tasksTotal,
            },
            {
              id: "invoices",
              label: "Factures",
              icon: "invoice" as const,
              count: counts.invoicesTotal,
            },
            { id: "runbook", label: "Runbook", icon: "list" as const },
          ] as const
        ).map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            <Icon name={t.icon} size={13} />
            {t.label}
            {"count" in t && t.count !== undefined && (
              <span className="count">{t.count}</span>
            )}
          </button>
        ))}
      </div>

      <Activity mode={tab === "overview" ? "visible" : "hidden"}>
        <div className="detail-cols">
          <div className="col gap-12" style={{ minWidth: 0 }}>
            <div className="detail-card">
              <div className="detail-card-header">
                <div className="detail-card-title">Accès</div>
              </div>
              <div className="col gap-8">
                {access.map((a) => (
                  <div key={a.label} className="row gap-8">
                    <Icon name="link" size={13} className="muted" />
                    <span className="small strong" style={{ minWidth: 90 }}>
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
            <div className="detail-card">
              <div className="detail-card-header">
                <div className="detail-card-title">Description</div>
              </div>
              {project.description ? (
                <div className="muted small" style={{ lineHeight: 1.6 }}>
                  {project.description}
                </div>
              ) : (
                <div className="muted small">Aucune description.</div>
              )}
            </div>
          </div>
        </div>
      </Activity>

      <Activity mode={tab === "tasks" ? "visible" : "hidden"}>
        <ProjectTasksTable tasks={project.tasks} />
      </Activity>

      <Activity mode={tab === "invoices" ? "visible" : "hidden"}>
        <ProjectInvoicesPanel
          invoices={project.invoices}
          onOpen={(invoiceId) => router.push(`/billing?invoiceId=${invoiceId}`)}
        />
      </Activity>

      <Activity mode={tab === "runbook" ? "visible" : "hidden"}>
        <div className="detail-card">
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
      </Activity>
    </div>
  )
}

function ProjectDetailSkeleton() {
  return (
    <div className="page">
      <div
        className="row gap-8"
        style={{ marginBottom: 16, justifyContent: "space-between" }}
      >
        <Skeleton width={160} height={28} radius={8} />
        <div className="row gap-8">
          <Skeleton width={130} height={34} radius={8} />
          <Skeleton width={110} height={34} radius={8} />
        </div>
      </div>

      <div className="detail-hero">
        <div className="hero-top">
          <Skeleton width={64} height={64} radius={12} />
          <div className="hero-info col gap-8" style={{ minWidth: 0 }}>
            <Skeleton width={240} height={22} radius={6} />
            <Skeleton width={320} height={13} radius={6} />
            <Skeleton width={280} height={13} radius={6} />
          </div>
        </div>
        <div className="kpi-grid" data-testid="project-kpi-skeleton">
          {Array.from({ length: PROJECT_KPI_COUNT }, (_, i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
      </div>

      <div className="tabs" role="tablist" aria-hidden>
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} width={96} height={30} radius={8} />
        ))}
      </div>

      <div className="detail-cols">
        <div className="col gap-12" style={{ minWidth: 0 }}>
          <Skeleton height={200} radius={10} />
          <Skeleton height={160} radius={10} />
        </div>
      </div>
    </div>
  )
}
