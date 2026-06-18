"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import {
  BillingTypePill,
  StatusPill,
  invoicePillStatus,
  taskStatusToPill,
} from "@/components/ui/pill"
import { fmtDate, fmtEUR, initials, avatarColor } from "@/lib/format"
import { useClientActivity, useClientDetail } from "@/hooks/use-client-detail"
import { EditClientModal } from "@/components/clients/edit-client-modal"
import { ClientActionsMenu } from "@/components/clients/client-actions-menu"
import { ClientActivityTimeline } from "@/components/clients/client-activity-timeline"

type Tab = "overview" | "projects" | "tasks" | "invoices" | "activity"

interface MobileClientDetailPageProps {
  id: string
}

export function MobileClientDetailPage({ id }: MobileClientDetailPageProps) {
  const router = useRouter()
  const { data: client, isLoading } = useClientDetail(id)
  const [tab, setTab] = useState<Tab>("overview")
  const [showEdit, setShowEdit] = useState(false)
  const { data: activity } = useClientActivity(tab === "activity" ? id : null)

  if (isLoading) {
    return (
      <div className="m-screen">
        <MobileTopbar title="Client" back="/clients" />
        <div className="m-content">
          <div className="empty">Chargement…</div>
        </div>
      </div>
    )
  }

  if (!client) {
    return (
      <div className="m-screen">
        <MobileTopbar title="Client" back="/clients" />
        <div className="m-content">
          <div className="empty">
            <div className="empty-title">Client introuvable</div>
          </div>
        </div>
      </div>
    )
  }

  const fullName = `${client.firstName} ${client.lastName}`
  const clientLabel = client.company ?? fullName
  const projects = client.projects
  const tasks = client.tasks
  const invoices = client.invoices

  const revenue = invoices.reduce((s, i) => s + i.paidAmount, 0)
  const outstanding = invoices
    .filter(
      (i) =>
        i.status === "SENT" &&
        (i.paymentStatus === "UNPAID" || i.paymentStatus === "PARTIALLY_PAID"),
    )
    .reduce((s, i) => s + i.balanceDue, 0)
  const pendingTasks = tasks.filter((t) => t.status === "PENDING_INVOICE")

  const gradient = client.color ?? avatarColor(fullName)

  return (
    <div className="m-screen">
      <MobileTopbar title={clientLabel} back="/clients" />
      <div className="m-content">
        <div
          className="row gap-12"
          style={{
            padding: "8px 14px 8px",
            alignItems: "flex-start",
          }}
        >
          <div className="av av-lg" style={{ background: gradient }}>
            {initials(fullName)}
          </div>
          <div className="grow" style={{ minWidth: 0 }}>
            <div className="strong" style={{ fontSize: 18 }}>
              {fullName}
            </div>
            {client.company && (
              <div className="xs muted truncate">{client.company}</div>
            )}
            <div className="row gap-6" style={{ marginTop: 6 }}>
              <BillingTypePill type={client.billingMode} />
              <span className="xs muted">
                {client.billingMode === "DAILY" && `${client.rate}€/j`}
                {client.billingMode === "HOURLY" && `${client.rate}€/h`}
                {client.billingMode === "FIXED" && fmtEUR(client.fixedPrice)}
              </span>
            </div>
          </div>
        </div>

        <div
          className="row gap-8"
          style={{ padding: "0 14px 14px", flexWrap: "wrap" }}
        >
          <button
            type="button"
            className="btn btn-primary btn-sm grow"
            onClick={() => setShowEdit(true)}
          >
            <Icon name="edit" size={12} />
            Modifier
          </button>
          {pendingTasks.length > 0 && (
            <button
              type="button"
              className="btn btn-secondary btn-sm grow"
              onClick={() => router.push(`/billing/new?clientId=${client.id}`)}
            >
              <Icon name="plus" size={12} />
              Facturer ({pendingTasks.length})
            </button>
          )}
          <ClientActionsMenu
            clientId={client.id}
            clientLabel={clientLabel}
            archived={client.archived}
            onArchived={() => router.push("/clients")}
          />
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
              {fmtEUR(revenue)}
            </div>
          </div>
          <div className="kpi-tile info">
            <div className="kpi-label">Encours</div>
            <div className="kpi-value">{fmtEUR(outstanding)}</div>
          </div>
          <div className="kpi-tile warn">
            <div className="kpi-label">À facturer</div>
            <div className="kpi-value">{pendingTasks.length}</div>
          </div>
          <div className="kpi-tile">
            <div className="kpi-label">Projets</div>
            <div className="kpi-value">{projects.length}</div>
          </div>
        </div>

        <div style={{ padding: "0 14px" }}>
          <div className="seg" style={{ overflowX: "auto" }}>
            {(
              [
                { id: "overview" as Tab, label: "Vue" },
                { id: "projects" as Tab, label: "Projets" },
                { id: "tasks" as Tab, label: "Tasks" },
                { id: "invoices" as Tab, label: "Factures" },
                { id: "activity" as Tab, label: "Activité" },
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
                <div className="card-title">Coordonnées</div>
                <div className="col gap-8">
                  {client.email && (
                    <div className="row gap-8">
                      <Icon name="mail" size={13} className="muted" />
                      <span className="small">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="row gap-8">
                      <Icon name="phone" size={13} className="muted" />
                      <span className="small mono">{client.phone}</span>
                    </div>
                  )}
                  {client.website && (
                    <div className="row gap-8">
                      <Icon name="globe" size={13} className="muted" />
                      <span className="small truncate">{client.website}</span>
                    </div>
                  )}
                  {client.address && (
                    <div className="row gap-8">
                      <Icon name="map" size={13} className="muted" />
                      <span className="small">{client.address}</span>
                    </div>
                  )}
                  <div className="row gap-8">
                    <Icon name="calendar" size={13} className="muted" />
                    <span className="small">
                      Client depuis {fmtDate(client.createdAt)}
                    </span>
                  </div>
                </div>
              </div>

              {client.notes && (
                <div className="card">
                  <div className="card-title">Notes</div>
                  <div
                    className="small"
                    style={{
                      color: "var(--text-1)",
                      lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {client.notes}
                  </div>
                </div>
              )}

              {client.deposit && client.billingMode === "FIXED" && (
                <div className="card">
                  <div className="card-title">Acompte</div>
                  <div
                    className="row"
                    style={{ justifyContent: "space-between" }}
                  >
                    <div>
                      <div className="small">Acompte configuré</div>
                      <div className="xs muted">30% du forfait</div>
                    </div>
                    <div className="num strong">{fmtEUR(client.deposit)}</div>
                  </div>
                </div>
              )}
            </>
          )}

          {tab === "projects" && (
            <div className="col gap-8">
              {projects.map((p) => (
                <div key={p.id} className="card card-tight">
                  <div className="row gap-8">
                    <Icon
                      name="folder"
                      size={14}
                      style={{ color: "var(--info)" }}
                    />
                    <div className="grow" style={{ minWidth: 0 }}>
                      <div className="strong small truncate">{p.name}</div>
                      <div className="xs muted truncate">
                        {p.description ?? "—"}
                      </div>
                    </div>
                    <span className="task-id">{p.key}</span>
                  </div>
                </div>
              ))}
              {projects.length === 0 && (
                <div className="empty">
                  <div className="empty-title">Aucun projet</div>
                </div>
              )}
            </div>
          )}

          {tab === "tasks" && (
            <div className="col gap-8">
              {tasks.slice(0, 30).map((t) => (
                <div key={t.id} className="task-item">
                  <div className="row gap-8">
                    <span className="task-id">{t.linearIdentifier}</span>
                    <StatusPill status={taskStatusToPill(t.status)} />
                  </div>
                  <div className="task-title">{t.title}</div>
                </div>
              ))}
              {tasks.length === 0 && (
                <div className="empty">
                  <div className="empty-title">Aucune task</div>
                </div>
              )}
            </div>
          )}

          {tab === "invoices" && (
            <div className="col gap-8">
              {invoices.map((inv) => (
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
              {invoices.length === 0 && (
                <div className="empty">
                  <div className="empty-title">Aucune facture</div>
                </div>
              )}
            </div>
          )}

          {tab === "activity" && (
            <div className="card">
              <ClientActivityTimeline items={activity ?? []} />
            </div>
          )}
        </div>
      </div>

      {showEdit && (
        <EditClientModal client={client} onClose={() => setShowEdit(false)} />
      )}
    </div>
  )
}
