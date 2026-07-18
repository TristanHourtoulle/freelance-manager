"use client"

import { Activity, use, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import {
  StatusPill,
  invoicePillStatus,
  taskStatusToPill,
} from "@/components/ui/pill"
import {
  fmtDate,
  fmtDateShort,
  fmtEUR,
  initials,
  avatarColor,
} from "@/lib/format"
import {
  useClientActivity,
  useClientDetail,
  type ClientDetailDTO,
} from "@/hooks/use-client-detail"
import { pipelineValueForTask } from "@/lib/billing-math"
import { Skeleton, SkeletonKpi } from "@/components/ui/skeleton"
import dynamic from "next/dynamic"

const LinearMappingsModal = dynamic(
  () =>
    import("@/components/clients/linear-mappings-modal").then(
      (m) => m.LinearMappingsModal,
    ),
  { ssr: false },
)
const EditClientModal = dynamic(
  () =>
    import("@/components/clients/edit-client-modal").then(
      (m) => m.EditClientModal,
    ),
  { ssr: false },
)
import { ClientActionsMenu } from "@/components/clients/client-actions-menu"
import { ClientRevenueChart } from "@/components/clients/client-revenue-chart"
import { ClientActivityTimeline } from "@/components/clients/client-activity-timeline"
import { SuiviView } from "@/components/suivi/suivi-view"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { MobileClientDetailPage } from "./mobile"

type Tab = "overview" | "projects" | "tasks" | "invoices" | "suivi" | "activity"

interface PageProps {
  params: Promise<{ id: string }>
}

interface ClientBillingSummary {
  billableTasks: ClientDetailDTO["tasks"]
  pipelineValue: number
}

/**
 * Derive the client's billable pipeline from its cached tasks.
 *
 * "Billable" is the same gate the invoice builder uses: a task must be
 * `PENDING_INVOICE` and not already attached to an invoice. The pipeline value
 * sums `pipelineValueForTask` over that set (FIXED clients contribute 0).
 *
 * @param client - Billing mode, rate and tasks from the client detail DTO.
 * @returns The billable task subset and its total pipeline value in euros.
 */
export function deriveClientBilling(
  client: Pick<ClientDetailDTO, "billingMode" | "rate" | "tasks">,
): ClientBillingSummary {
  const billableTasks = client.tasks.filter(
    (t) => t.status === "PENDING_INVOICE" && !t.invoiceId,
  )
  const pipelineValue = billableTasks.reduce(
    (sum, t) =>
      sum +
      pipelineValueForTask({
        billingMode: client.billingMode,
        rate: client.rate,
        estimateDays: t.estimate,
      }),
    0,
  )
  return { billableTasks, pipelineValue }
}

export default function ClientDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const isMobile = useIsMobile()
  if (isMobile) return <MobileClientDetailPage id={id} />
  return <DesktopClientDetailPage id={id} />
}

function DesktopClientDetailPage({ id }: { id: string }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [showLink, setShowLink] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const { data: client, isLoading } = useClientDetail(id)
  const { data: activity } = useClientActivity(tab === "activity" ? id : null)

  if (isLoading) {
    return <ClientDetailSkeleton />
  }
  if (!client) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-title">Client introuvable</div>
        </div>
      </div>
    )
  }

  const fullName = `${client.firstName} ${client.lastName}`
  const gradient = client.color ?? avatarColor(fullName)
  const clientLabel = client.company ?? fullName

  const tasksByProject = new Map<string, typeof client.tasks>()
  for (const t of client.tasks) {
    const arr = tasksByProject.get(t.projectId) ?? []
    arr.push(t)
    tasksByProject.set(t.projectId, arr)
  }
  const projectById = new Map(client.projects.map((p) => [p.id, p]))

  let totalRevenue = 0
  let outstanding = 0
  let sentCount = 0
  let paidCount = 0
  let overdueCount = 0
  for (const i of client.invoices) {
    totalRevenue += i.paidAmount
    if (
      i.status === "SENT" &&
      (i.paymentStatus === "UNPAID" || i.paymentStatus === "PARTIALLY_PAID")
    ) {
      outstanding += i.balanceDue
      sentCount++
    }
    if (i.paymentStatus === "PAID" || i.paymentStatus === "OVERPAID") {
      paidCount++
    }
    if (i.isOverdue) overdueCount++
  }
  const { billableTasks, pipelineValue } = deriveClientBilling(client)
  const billingLabel =
    client.billingMode === "DAILY"
      ? `TJM · ${client.rate} €/j`
      : client.billingMode === "HOURLY"
        ? `Horaire · ${client.rate} €/h`
        : "Forfait"
  const billingPillClass =
    client.billingMode === "DAILY"
      ? "pill pill-daily pill-no-dot"
      : client.billingMode === "HOURLY"
        ? "pill pill-hourly pill-no-dot"
        : "pill pill-deposit pill-no-dot"

  return (
    <div className="page">
      <div
        className="row gap-8"
        style={{ marginBottom: 16, justifyContent: "space-between" }}
      >
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push("/clients")}
        >
          <Icon name="chevron-left" size={12} />
          Retour aux clients
        </button>
        <div className="row gap-8">
          <button
            className="btn btn-secondary"
            onClick={() => setShowLink(true)}
          >
            <Icon name="link" size={13} />
            Lier projets Linear
          </button>
          <button
            className="btn btn-secondary"
            onClick={() => setShowEdit(true)}
          >
            <Icon name="edit" size={13} />
            Modifier
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push(`/billing/new?clientId=${client.id}`)}
            disabled={billableTasks.length === 0}
          >
            <Icon name="plus" size={13} />
            Facturer ({billableTasks.length})
          </button>
          <ClientActionsMenu
            clientId={client.id}
            clientLabel={clientLabel}
            archived={client.archived}
            onArchived={() => router.push("/clients")}
          />
        </div>
      </div>

      <div className="detail-hero">
        <div className="hero-top">
          <div
            className="hero-av"
            style={{
              background: gradient,
              width: 64,
              height: 64,
              fontSize: 22,
              boxShadow: "0 0 0 4px oklch(0.86 0.19 128 / 0.06)",
            }}
          >
            {initials(fullName)}
          </div>
          <div className="hero-info">
            <div className="hero-name-row">
              <h1 className="hero-name">{fullName}</h1>
              <span className={billingPillClass}>{billingLabel}</span>
              {!client.archived && (
                <span className="pill pill-paid pill-no-dot">Actif</span>
              )}
              {client.archived && (
                <span className="pill pill-draft pill-no-dot">Archivé</span>
              )}
              {client.starred && (
                <span style={{ color: "var(--warn)", display: "inline-flex" }}>
                  <Icon name="star" size={15} />
                </span>
              )}
            </div>
            <div className="hero-sub">
              {client.company && (
                <span style={{ color: "var(--text-0)", fontWeight: 600 }}>
                  {client.company}
                </span>
              )}
              {client.company && client.email && (
                <span className="dot-sep">·</span>
              )}
              {client.email && (
                <a href={`mailto:${client.email}`}>{client.email}</a>
              )}
              {client.phone && <span className="dot-sep">·</span>}
              {client.phone && (
                <a href={`tel:${client.phone}`}>{client.phone}</a>
              )}
            </div>
            <div className="hero-meta">
              <span className="hero-meta-item">
                <Icon name="calendar" size={13} />
                Client depuis {fmtDate(client.createdAt)}
              </span>
              <span className="hero-meta-item">
                <Icon name="folder" size={13} />
                {client.projects.length} projet
                {client.projects.length > 1 ? "s" : ""}
              </span>
              <span className="hero-meta-item">
                <Icon name="invoice" size={13} />
                {client.invoices.length} facture
                {client.invoices.length > 1 ? "s" : ""}
              </span>
              {client.address && (
                <span className="hero-meta-item">
                  <Icon name="map" size={13} />
                  {client.address}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="kpi-grid">
          <div className="kpi k-revenue">
            <div className="kpi-label">
              <Icon name="arrow-up" size={11} />
              Revenu généré
            </div>
            <div className="kpi-value accent">{fmtEUR(totalRevenue)}</div>
            <div className="kpi-sub">
              {paidCount} facture{paidCount > 1 ? "s" : ""} payée
              {paidCount > 1 ? "s" : ""}
            </div>
          </div>
          <div className="kpi k-outstanding">
            <div className="kpi-label">
              <Icon name="invoice" size={11} />
              Encours
            </div>
            <div className="kpi-value warn">{fmtEUR(outstanding)}</div>
            <div className="kpi-sub">
              {sentCount} facture{sentCount > 1 ? "s" : ""} envoyée
              {sentCount > 1 ? "s" : ""}
            </div>
          </div>
          <div className="kpi k-overdue">
            <div className="kpi-label">
              <Icon name="circle-dot" size={11} />
              En retard
            </div>
            <div className="kpi-value danger">
              {overdueCount}
              <span
                style={{
                  fontSize: 12,
                  color: "var(--text-2)",
                  marginLeft: 6,
                  fontFamily: "inherit",
                }}
              >
                facture{overdueCount > 1 ? "s" : ""}
              </span>
            </div>
            <div className="kpi-sub">à relancer</div>
          </div>
          <div className="kpi k-pipeline">
            <div className="kpi-label">
              <Icon name="tasks" size={11} />
              Pipeline
            </div>
            <div className="kpi-value" style={{ color: "var(--info)" }}>
              {fmtEUR(pipelineValue)}
            </div>
            <div className="kpi-sub">
              {billableTasks.length} task{billableTasks.length > 1 ? "s" : ""} à
              facturer
            </div>
          </div>
        </div>
      </div>

      <div className="tabs" role="tablist">
        {(
          [
            { id: "overview", label: "Vue d'ensemble", icon: "home" as const },
            {
              id: "projects",
              label: "Projets",
              icon: "folder" as const,
              count: client.projects.length,
            },
            {
              id: "tasks",
              label: "Tasks",
              icon: "tasks" as const,
              count: client.tasks.length,
            },
            {
              id: "invoices",
              label: "Factures",
              icon: "invoice" as const,
              count: client.invoices.length,
            },
            { id: "suivi", label: "Suivi", icon: "check-square" as const },
            { id: "activity", label: "Activité", icon: "clock" as const },
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
                <div>
                  <div className="detail-card-title">Évolution du revenu</div>
                  <div className="detail-card-sub">
                    12 derniers mois · {fmtEUR(totalRevenue)}
                  </div>
                </div>
              </div>
              <div className="mini-chart-wrap">
                <ClientRevenueChart data={client.monthlyRevenue} />
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-card-header">
                <div>
                  <div className="detail-card-title">Projets en cours</div>
                  <div className="detail-card-sub">
                    {client.projects.length} actif
                    {client.projects.length > 1 ? "s" : ""} · synchronisés
                    Linear
                  </div>
                </div>
                {client.projects.length > 3 && (
                  <button
                    type="button"
                    className="detail-card-link"
                    onClick={() => setTab("projects")}
                  >
                    Tout voir →
                  </button>
                )}
              </div>
              <div className="proj-stack">
                {client.projects.length === 0 && (
                  <div className="muted small">Aucun projet lié.</div>
                )}
                {client.projects.slice(0, 3).map((p) => {
                  const projectTasks = tasksByProject.get(p.id) ?? []
                  const done = projectTasks.filter(
                    (t) =>
                      t.status === "DONE" || t.status === "PENDING_INVOICE",
                  ).length
                  const total = projectTasks.length
                  const pct = total > 0 ? Math.round((done / total) * 100) : 0
                  return (
                    <button
                      key={p.id}
                      type="button"
                      className="proj-card"
                      onClick={() => router.push(`/tasks?projectId=${p.id}`)}
                    >
                      <div className="proj-row1">
                        <div className="proj-icon">
                          <Icon name="folder" size={13} />
                        </div>
                        <span className="proj-name">{p.name}</span>
                        <span className="proj-key">{p.key}</span>
                      </div>
                      {p.description && (
                        <div className="proj-desc">{p.description}</div>
                      )}
                      <div className="proj-progress">
                        <div className="proj-progress-row">
                          <span>
                            {done}/{total} tasks
                          </span>
                          <span
                            className="mono"
                            style={{ color: "var(--accent)", fontWeight: 600 }}
                          >
                            {pct}%
                          </span>
                        </div>
                        <div className="pbar">
                          <span style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>

          <div className="col gap-12" style={{ minWidth: 0 }}>
            <div className="detail-card">
              <div className="detail-card-header">
                <div className="detail-card-title">Informations</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                  onClick={() => setShowEdit(true)}
                >
                  <Icon name="edit" size={12} />
                </button>
              </div>
              <div>
                {client.company && (
                  <div className="info-row">
                    <Icon name="briefcase" size={14} />
                    <span className="lbl">Société</span>
                    <span className="val">{client.company}</span>
                  </div>
                )}
                {client.email && (
                  <div className="info-row">
                    <Icon name="mail" size={14} />
                    <span className="lbl">Email</span>
                    <span className="val">{client.email}</span>
                  </div>
                )}
                {client.phone && (
                  <div className="info-row">
                    <Icon name="phone" size={14} />
                    <span className="lbl">Téléphone</span>
                    <span className="val mono">{client.phone}</span>
                  </div>
                )}
                {client.website && (
                  <div className="info-row">
                    <Icon name="globe" size={14} />
                    <span className="lbl">Site</span>
                    <span className="val">{client.website}</span>
                  </div>
                )}
                {client.address && (
                  <div className="info-row">
                    <Icon name="map" size={14} />
                    <span className="lbl">Adresse</span>
                    <span className="val" style={{ fontSize: 12 }}>
                      {client.address}
                    </span>
                  </div>
                )}
                {client.paymentTerms != null && (
                  <div className="info-row">
                    <Icon name="clock" size={14} />
                    <span className="lbl">Délai paiement</span>
                    <span className="val mono">
                      {client.paymentTerms} jours
                    </span>
                  </div>
                )}
                <div className="info-row">
                  <Icon name="calendar" size={14} />
                  <span className="lbl">Client depuis</span>
                  <span className="val">{fmtDate(client.createdAt)}</span>
                </div>
              </div>
            </div>

            <div className="detail-card">
              <div className="detail-card-header">
                <div className="detail-card-title">Notes</div>
                <button
                  type="button"
                  className="btn btn-ghost"
                  style={{ padding: "4px 8px", fontSize: 12 }}
                  onClick={() => setShowEdit(true)}
                >
                  <Icon name="edit" size={12} />
                </button>
              </div>
              {client.notes ? (
                <div
                  style={{
                    color: "var(--text-1)",
                    fontSize: 13,
                    lineHeight: 1.6,
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {client.notes}
                </div>
              ) : (
                <div className="muted small">Aucune note pour ce client.</div>
              )}
            </div>

            <div className="detail-card">
              <div className="detail-card-header">
                <div>
                  <div className="detail-card-title">Dernières factures</div>
                  <div className="detail-card-sub">
                    {client.invoices.length} au total
                  </div>
                </div>
                {client.invoices.length > 4 && (
                  <button
                    type="button"
                    className="detail-card-link"
                    onClick={() => setTab("invoices")}
                  >
                    Tout voir →
                  </button>
                )}
              </div>
              {client.invoices.length === 0 ? (
                <div className="muted small">Aucune facture.</div>
              ) : (
                client.invoices.slice(0, 4).map((inv, i) => (
                  <div key={inv.id}>
                    {i > 0 && <div className="inv-divider" />}
                    <button
                      type="button"
                      className="inv-row"
                      onClick={() =>
                        router.push(`/billing?invoiceId=${inv.id}`)
                      }
                    >
                      <span className="inv-num">{inv.number}</span>
                      <span className="inv-date">
                        {fmtDateShort(inv.issueDate)}
                      </span>
                      <StatusPill status={invoicePillStatus(inv)} />
                      <span className="inv-total">{fmtEUR(inv.total)}</span>
                      <Icon
                        name="chevron-right"
                        size={13}
                        style={{ color: "var(--text-3)" }}
                      />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </Activity>

      <Activity mode={tab === "projects" ? "visible" : "hidden"}>
        <div className="detail-card">
          <div className="detail-card-header">
            <div className="detail-card-title">Tous les projets</div>
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setShowLink(true)}
            >
              <Icon name="plus" size={12} />
              Lier un projet
            </button>
          </div>
          {client.projects.length === 0 ? (
            <div className="muted small">Aucun projet lié.</div>
          ) : (
            <div className="proj-stack">
              {client.projects.map((p) => {
                const projectTasks = tasksByProject.get(p.id) ?? []
                const done = projectTasks.filter(
                  (t) => t.status === "DONE" || t.status === "PENDING_INVOICE",
                ).length
                const total = projectTasks.length
                const pct = total > 0 ? Math.round((done / total) * 100) : 0
                return (
                  <button
                    key={p.id}
                    type="button"
                    className="proj-card"
                    onClick={() => router.push(`/tasks?projectId=${p.id}`)}
                  >
                    <div className="proj-row1">
                      <div className="proj-icon">
                        <Icon name="folder" size={13} />
                      </div>
                      <span className="proj-name">{p.name}</span>
                      <span className="proj-key">{p.key}</span>
                    </div>
                    {p.description && (
                      <div className="proj-desc">{p.description}</div>
                    )}
                    <div className="proj-progress">
                      <div className="proj-progress-row">
                        <span>
                          {done}/{total} tasks
                        </span>
                        <span
                          className="mono"
                          style={{ color: "var(--accent)", fontWeight: 600 }}
                        >
                          {pct}%
                        </span>
                      </div>
                      <div className="pbar">
                        <span style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  </button>
                )
              })}
            </div>
          )}
        </div>
      </Activity>

      <Activity mode={tab === "tasks" ? "visible" : "hidden"}>
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>ID</th>
                <th>Title</th>
                <th>Projet</th>
                <th>Statut</th>
                <th className="right">Estimate</th>
                <th className="right" style={{ paddingRight: 20 }}>
                  Facturé
                </th>
              </tr>
            </thead>
            <tbody>
              {client.tasks.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      <div className="empty-title">Aucune task</div>
                    </div>
                  </td>
                </tr>
              )}
              {client.tasks.map((t) => {
                const project = projectById.get(t.projectId)
                return (
                  <tr key={t.id}>
                    <td style={{ paddingLeft: 20 }}>
                      <span className="task-id">{t.linearIdentifier}</span>
                    </td>
                    <td className="strong">{t.title}</td>
                    <td className="muted small">{project?.key ?? ""}</td>
                    <td>
                      <StatusPill status={taskStatusToPill(t.status)} />
                    </td>
                    <td className="right num">
                      {t.estimate ? `${t.estimate}j` : "—"}
                    </td>
                    <td className="right small" style={{ paddingRight: 20 }}>
                      {t.invoiceId ? (
                        <span className="pill pill-paid pill-no-dot xs">
                          Facturée
                        </span>
                      ) : (
                        <span className="muted">—</span>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Activity>

      <Activity mode={tab === "invoices" ? "visible" : "hidden"}>
        <div className="detail-card">
          <div className="detail-card-header">
            <div className="detail-card-title">Toutes les factures</div>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/billing/new?clientId=${client.id}`)}
            >
              <Icon name="plus" size={12} />
              Nouvelle facture
            </button>
          </div>
          {client.invoices.length === 0 ? (
            <div className="muted small">Aucune facture.</div>
          ) : (
            client.invoices.map((inv, i) => (
              <div key={inv.id}>
                {i > 0 && <div className="inv-divider" />}
                <button
                  type="button"
                  className="inv-row"
                  onClick={() => router.push(`/billing?invoiceId=${inv.id}`)}
                >
                  <span className="inv-num">{inv.number}</span>
                  <span className="inv-date">{fmtDate(inv.issueDate)}</span>
                  <StatusPill status={invoicePillStatus(inv)} />
                  <span className="inv-total">{fmtEUR(inv.total)}</span>
                  <Icon
                    name="chevron-right"
                    size={13}
                    style={{ color: "var(--text-3)" }}
                  />
                </button>
              </div>
            ))
          )}
        </div>
      </Activity>

      <Activity mode={tab === "suivi" ? "visible" : "hidden"}>
        <div className="detail-card">
          <SuiviView clientId={id} />
        </div>
      </Activity>

      <Activity mode={tab === "activity" ? "visible" : "hidden"}>
        <div className="detail-card">
          <div className="detail-card-header">
            <div className="detail-card-title">Activité récente</div>
          </div>
          <ClientActivityTimeline items={activity ?? []} />
        </div>
      </Activity>

      {showLink && (
        <LinearMappingsModal
          initialClientId={client.id}
          onClose={() => setShowLink(false)}
        />
      )}
      {showEdit && (
        <EditClientModal client={client} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}

function ClientDetailSkeleton() {
  return (
    <div className="page">
      <div
        className="row gap-8"
        style={{ marginBottom: 16, justifyContent: "space-between" }}
      >
        <Skeleton width={150} height={28} radius={8} />
        <div className="row gap-8">
          <Skeleton width={150} height={34} radius={8} />
          <Skeleton width={110} height={34} radius={8} />
          <Skeleton width={130} height={34} radius={8} />
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
        <div className="kpi-grid">
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
          <SkeletonKpi />
        </div>
      </div>

      <div className="tabs" role="tablist" aria-hidden>
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} width={96} height={30} radius={8} />
        ))}
      </div>

      <div className="detail-cols">
        <div className="col gap-12" style={{ minWidth: 0 }}>
          <Skeleton height={220} radius={10} />
          <Skeleton height={260} radius={10} />
        </div>
        <div className="col gap-12" style={{ minWidth: 0 }}>
          <Skeleton height={200} radius={10} />
          <Skeleton height={140} radius={10} />
        </div>
      </div>
    </div>
  )
}
