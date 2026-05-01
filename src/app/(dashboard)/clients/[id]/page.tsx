"use client"

import { use, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import {
  BillingTypePill,
  StatusPill,
  invoicePillStatus,
  taskStatusToPill,
} from "@/components/ui/pill"
import { fmtDate, fmtEUR, initials, avatarColor } from "@/lib/format"
import { useClientDetail } from "@/hooks/use-client-detail"
import { LinearMappingsModal } from "@/components/clients/linear-mappings-modal"

type Tab = "overview" | "projects" | "tasks" | "invoices"

interface PageProps {
  params: Promise<{ id: string }>
}

export default function ClientDetailPage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const [tab, setTab] = useState<Tab>("overview")
  const [showLink, setShowLink] = useState(false)
  const { data: client, isLoading } = useClientDetail(id)

  if (isLoading) {
    return (
      <div className="page">
        <div className="empty">Chargement…</div>
      </div>
    )
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

  const gradient =
    client.color ?? avatarColor(`${client.firstName}${client.lastName}`)

  const revenue = client.invoices.reduce((s, i) => s + i.paidAmount, 0)
  const outstanding = client.invoices
    .filter(
      (i) =>
        i.status === "SENT" &&
        (i.paymentStatus === "UNPAID" || i.paymentStatus === "PARTIALLY_PAID"),
    )
    .reduce((s, i) => s + i.balanceDue, 0)
  const pendingTasks = client.tasks.filter(
    (t) => t.status === "PENDING_INVOICE",
  )
  const pipeline = pendingTasks.reduce((s, t) => {
    if (client.billingMode === "DAILY")
      return s + (t.estimate ?? 0) * client.rate
    if (client.billingMode === "HOURLY")
      return s + (t.estimate ?? 0) * 8 * client.rate
    return s
  }, 0)

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
          Clients
        </button>
        <button
          className="btn btn-secondary btn-sm"
          onClick={() => setShowLink(true)}
        >
          <Icon name="link" size={12} />
          Lier projets Linear
        </button>
      </div>

      <div className="detail-hero">
        <div
          className="av av-lg"
          style={{
            background: gradient,
            width: 56,
            height: 56,
            fontSize: 18,
            borderRadius: 12,
          }}
        >
          {initials(`${client.firstName} ${client.lastName}`)}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="row gap-8">
            <h1 className="page-title" style={{ fontSize: 22, margin: 0 }}>
              {client.firstName} {client.lastName}
            </h1>
            <BillingTypePill type={client.billingMode} />
          </div>
          <div className="muted" style={{ marginTop: 4 }}>
            {client.company ?? "—"}
            {client.email ? ` · ${client.email}` : ""}
          </div>
          <div
            className="small muted"
            style={{
              marginTop: 8,
              display: "flex",
              flexWrap: "wrap",
              gap: "4px 14px",
            }}
          >
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <Icon name="calendar" size={11} /> Client depuis{" "}
              {fmtDate(client.createdAt)}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <Icon name="briefcase" size={11} /> {client.projects.length}{" "}
              projet{client.projects.length > 1 ? "s" : ""}
            </span>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                whiteSpace: "nowrap",
              }}
            >
              <Icon name="invoice" size={11} /> {client.invoices.length} facture
              {client.invoices.length > 1 ? "s" : ""}
            </span>
          </div>
        </div>
        <div className="hero-stats">
          <div>
            <div className="hero-stat-label">Taux</div>
            <div className="hero-stat-value">
              {client.billingMode === "DAILY" && `${client.rate}€/j`}
              {client.billingMode === "HOURLY" && `${client.rate}€/h`}
              {client.billingMode === "FIXED" && fmtEUR(client.fixedPrice)}
            </div>
          </div>
          <div>
            <div className="hero-stat-label">Revenu</div>
            <div className="hero-stat-value" style={{ color: "var(--accent)" }}>
              {fmtEUR(revenue)}
            </div>
          </div>
          <div>
            <div className="hero-stat-label">Encours</div>
            <div
              className="hero-stat-value"
              style={{ color: outstanding > 0 ? "var(--warn)" : undefined }}
            >
              {fmtEUR(outstanding)}
            </div>
          </div>
          <div>
            <div className="hero-stat-label">Pipeline</div>
            <div
              className="hero-stat-value"
              style={{ color: pipeline > 0 ? "var(--info)" : undefined }}
            >
              {pipeline > 0 ? fmtEUR(pipeline) : "—"}
            </div>
          </div>
        </div>
      </div>

      <div className="tabs">
        {(
          [
            { id: "overview", label: "Vue d'ensemble" },
            { id: "projects", label: `Projets (${client.projects.length})` },
            { id: "tasks", label: `Tasks (${client.tasks.length})` },
            { id: "invoices", label: `Factures (${client.invoices.length})` },
          ] as { id: Tab; label: string }[]
        ).map((t) => (
          <div
            key={t.id}
            className={"tab" + (tab === t.id ? " active" : "")}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </div>
        ))}
        <div style={{ marginLeft: "auto", paddingBottom: 6 }}>
          {pendingTasks.length > 0 && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() => router.push(`/billing/new?clientId=${client.id}`)}
            >
              <Icon name="plus" size={12} />
              Facturer ({pendingTasks.length})
            </button>
          )}
        </div>
      </div>

      {tab === "overview" && (
        <div className="chart-grid">
          <div className="card">
            <div className="card-h2" style={{ marginBottom: 16 }}>
              Projets en cours
            </div>
            {client.projects.length === 0 && (
              <div className="muted small">Aucun projet</div>
            )}
            <div className="col gap-12">
              {client.projects.map((p) => {
                const projectTasks = client.tasks.filter(
                  (t) => t.projectId === p.id,
                )
                const done = projectTasks.filter(
                  (t) => t.status === "DONE" || t.status === "PENDING_INVOICE",
                ).length
                return (
                  <div
                    key={p.id}
                    style={{
                      padding: 14,
                      background: "var(--bg-2)",
                      borderRadius: 8,
                      border: "1px solid var(--border)",
                    }}
                  >
                    <div className="row gap-8" style={{ marginBottom: 8 }}>
                      <Icon name="folder" size={14} className="muted" />
                      <div className="strong grow truncate">{p.name}</div>
                      <span className="task-id">{p.key}</span>
                    </div>
                    <div className="muted xs" style={{ marginBottom: 10 }}>
                      {p.description ?? ""}
                    </div>
                    <div
                      className="row gap-8 xs muted"
                      style={{ marginBottom: 6 }}
                    >
                      <span>
                        {done}/{projectTasks.length} tasks
                      </span>
                      <span style={{ marginLeft: "auto" }}>
                        {Math.round(
                          (done / Math.max(projectTasks.length, 1)) * 100,
                        )}
                        %
                      </span>
                    </div>
                    <div className="pbar">
                      <span
                        style={{
                          width: `${(done / Math.max(projectTasks.length, 1)) * 100}%`,
                        }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
          <div className="card">
            <div className="card-h2" style={{ marginBottom: 16 }}>
              Dernières factures
            </div>
            <div className="col gap-8">
              {client.invoices.slice(0, 5).map((inv) => (
                <div
                  key={inv.id}
                  className="row gap-12"
                  style={{
                    padding: "10px 0",
                    borderBottom: "1px solid var(--border)",
                  }}
                >
                  <span className="mono small">{inv.number}</span>
                  {inv.kind === "DEPOSIT" && (
                    <span className="pill pill-deposit pill-no-dot xs">
                      acompte
                    </span>
                  )}
                  <div className="grow muted xs">{fmtDate(inv.issueDate)}</div>
                  <StatusPill status={invoicePillStatus(inv)} />
                  <span
                    className="num strong"
                    style={{ width: 90, textAlign: "right" }}
                  >
                    {fmtEUR(inv.total)}
                  </span>
                </div>
              ))}
              {client.invoices.length === 0 && (
                <div className="muted small">Aucune facture</div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "projects" && (
        <div className="client-grid">
          {client.projects.map((p) => {
            const projectTasks = client.tasks.filter(
              (t) => t.projectId === p.id,
            )
            return (
              <div
                key={p.id}
                className="client-card"
                onClick={() => router.push(`/tasks?projectId=${p.id}`)}
              >
                <div className="row gap-12">
                  <div
                    style={{
                      width: 40,
                      height: 40,
                      background: "var(--bg-3)",
                      borderRadius: 9,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    <Icon name="folder" size={18} />
                  </div>
                  <div className="grow">
                    <div className="strong">{p.name}</div>
                    <div className="muted small">{p.description ?? ""}</div>
                  </div>
                </div>
                <div className="client-stats">
                  <div className="client-stat">
                    <div className="client-stat-label">Total</div>
                    <div className="client-stat-value">
                      {projectTasks.length}
                    </div>
                  </div>
                  <div className="client-stat">
                    <div className="client-stat-label">Done</div>
                    <div
                      className="client-stat-value"
                      style={{ color: "var(--accent)" }}
                    >
                      {
                        projectTasks.filter(
                          (t) =>
                            t.status === "DONE" ||
                            t.status === "PENDING_INVOICE",
                        ).length
                      }
                    </div>
                  </div>
                  <div className="client-stat">
                    <div className="client-stat-label">À facturer</div>
                    <div
                      className="client-stat-value"
                      style={{ color: "var(--warn)" }}
                    >
                      {
                        projectTasks.filter(
                          (t) => t.status === "PENDING_INVOICE",
                        ).length
                      }
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {tab === "tasks" && (
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
                const project = client.projects.find(
                  (p) => p.id === t.projectId,
                )
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
      )}

      {tab === "invoices" && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Numéro</th>
                <th>Émise</th>
                <th>Échéance</th>
                <th>Type</th>
                <th>Statut</th>
                <th className="right" style={{ paddingRight: 20 }}>
                  Montant
                </th>
              </tr>
            </thead>
            <tbody>
              {client.invoices.map((inv) => (
                <tr
                  key={inv.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/billing?invoiceId=${inv.id}`)}
                >
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row gap-8">
                      <span className="mono small strong">{inv.number}</span>
                      {inv.kind === "DEPOSIT" && (
                        <span className="pill pill-deposit pill-no-dot xs">
                          acompte
                        </span>
                      )}
                    </div>
                    <div className="xs muted" style={{ marginTop: 2 }}>
                      {inv.linesCount} ligne{inv.linesCount > 1 ? "s" : ""}
                    </div>
                  </td>
                  <td className="muted small">{fmtDate(inv.issueDate)}</td>
                  <td className="muted small">{fmtDate(inv.dueDate)}</td>
                  <td className="small">
                    {inv.kind === "DEPOSIT" ? "Acompte" : "Standard"}
                  </td>
                  <td>
                    <StatusPill status={invoicePillStatus(inv)} />
                  </td>
                  <td className="right num strong" style={{ paddingRight: 20 }}>
                    {fmtEUR(inv.total)}
                  </td>
                </tr>
              ))}
              {client.invoices.length === 0 && (
                <tr>
                  <td colSpan={6}>
                    <div className="empty">
                      <div className="empty-title">Aucune facture</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showLink && (
        <LinearMappingsModal
          initialClientId={client.id}
          onClose={() => setShowLink(false)}
        />
      )}
    </div>
  )
}
