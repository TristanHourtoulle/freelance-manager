"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { BillingTypePill } from "@/components/ui/pill"
import { NewClientModal } from "@/components/clients/new-client-modal"
import { useClients, type ClientDTO } from "@/hooks/use-clients"
import { useInvoices } from "@/hooks/use-invoices"
import { useTasks } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-projects"
import { fmtEUR, initials, avatarColor } from "@/lib/format"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { MobileClientsPage } from "./mobile"

type FilterId = "all" | "DAILY" | "FIXED" | "HOURLY"
type ViewMode = "grid" | "list"

interface EnrichedClient extends ClientDTO {
  projectsCount: number
  pendingTasksCount: number
  revenue: number
  outstanding: number
}

function gradient(c: ClientDTO): string {
  return c.color ?? avatarColor(`${c.firstName}${c.lastName}`)
}

export default function ClientsPage() {
  const isMobile = useIsMobile()
  if (isMobile) return <MobileClientsPage />
  return <DesktopClientsPage />
}

function DesktopClientsPage() {
  const router = useRouter()
  const [filter, setFilter] = useState<FilterId>("all")
  const [search, setSearch] = useState("")
  const [view, setView] = useState<ViewMode>("grid")
  const [showNew, setShowNew] = useState(false)

  const { data: clients = [] } = useClients()
  const { data: invoices = [] } = useInvoices()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()

  const enriched: EnrichedClient[] = useMemo(() => {
    const invoicesByClient = new Map<string, typeof invoices>()
    for (const i of invoices) {
      const arr = invoicesByClient.get(i.clientId) ?? []
      arr.push(i)
      invoicesByClient.set(i.clientId, arr)
    }
    const pendingTasksByClient = new Map<string, number>()
    for (const t of tasks) {
      if (t.status !== "PENDING_INVOICE") continue
      pendingTasksByClient.set(
        t.clientId,
        (pendingTasksByClient.get(t.clientId) ?? 0) + 1,
      )
    }
    const projectsByClient = new Map<string, number>()
    for (const p of projects) {
      projectsByClient.set(
        p.clientId,
        (projectsByClient.get(p.clientId) ?? 0) + 1,
      )
    }

    return clients.map((c) => {
      const myInvoices = invoicesByClient.get(c.id) ?? []
      let revenue = 0
      let outstanding = 0
      for (const i of myInvoices) {
        revenue += i.paidAmount
        if (
          i.status === "SENT" &&
          (i.paymentStatus === "UNPAID" || i.paymentStatus === "PARTIALLY_PAID")
        ) {
          outstanding += i.balanceDue
        }
      }
      return {
        ...c,
        projectsCount: projectsByClient.get(c.id) ?? 0,
        pendingTasksCount: pendingTasksByClient.get(c.id) ?? 0,
        revenue,
        outstanding,
      }
    })
  }, [clients, invoices, tasks, projects])

  const filtered = enriched.filter((c) => {
    if (
      search &&
      !`${c.firstName} ${c.lastName} ${c.company ?? ""}`
        .toLowerCase()
        .includes(search.toLowerCase())
    )
      return false
    if (filter !== "all" && c.billingMode !== filter) return false
    return true
  })

  const totalRevenue = enriched.reduce((s, c) => s + c.revenue, 0)

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Clients</h1>
          <div className="page-sub">
            {enriched.length} clients actifs · {fmtEUR(totalRevenue)} de revenus
            cumulés
          </div>
        </div>
        <div className="page-actions">
          <button className="btn btn-primary" onClick={() => setShowNew(true)}>
            <Icon name="plus" size={14} />
            Nouveau client
          </button>
        </div>
      </div>

      <div
        className="row gap-12"
        style={{ marginBottom: 18, justifyContent: "space-between" }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 360 }}>
          <Icon
            name="search"
            size={14}
            className="muted"
            style={{ position: "absolute", left: 12, top: 10 }}
          />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Rechercher par nom ou entreprise…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="row gap-12">
          <div className="chip-row">
            {(
              [
                { id: "all", label: "Tous", count: enriched.length },
                {
                  id: "DAILY",
                  label: "TJM",
                  count: enriched.filter((c) => c.billingMode === "DAILY")
                    .length,
                },
                {
                  id: "FIXED",
                  label: "Forfait",
                  count: enriched.filter((c) => c.billingMode === "FIXED")
                    .length,
                },
                {
                  id: "HOURLY",
                  label: "Horaire",
                  count: enriched.filter((c) => c.billingMode === "HOURLY")
                    .length,
                },
              ] as { id: FilterId; label: string; count: number }[]
            ).map((f) => (
              <button
                key={f.id}
                className={"chip" + (filter === f.id ? " active" : "")}
                onClick={() => setFilter(f.id)}
              >
                {f.label} <span className="count">{f.count}</span>
              </button>
            ))}
          </div>
          <div
            className="row gap-4"
            style={{
              background: "var(--bg-1)",
              borderRadius: 7,
              padding: 3,
              border: "1px solid var(--border)",
            }}
          >
            <button
              className="icon-btn"
              style={
                view === "grid"
                  ? { background: "var(--bg-3)", color: "var(--text-0)" }
                  : {}
              }
              onClick={() => setView("grid")}
            >
              <Icon name="grid" size={14} />
            </button>
            <button
              className="icon-btn"
              style={
                view === "list"
                  ? { background: "var(--bg-3)", color: "var(--text-0)" }
                  : {}
              }
              onClick={() => setView("list")}
            >
              <Icon name="list" size={14} />
            </button>
          </div>
        </div>
      </div>

      {view === "grid" ? (
        <div className="client-grid">
          {filtered.map((c) => (
            <div
              key={c.id}
              className="client-card"
              onClick={() => router.push(`/clients/${c.id}`)}
            >
              <div className="row gap-12">
                <div className="av av-lg" style={{ background: gradient(c) }}>
                  {initials(`${c.firstName} ${c.lastName}`)}
                </div>
                <div className="grow" style={{ minWidth: 0 }}>
                  <div className="strong truncate">
                    {c.firstName} {c.lastName}
                  </div>
                  <div className="muted small truncate">{c.company ?? "—"}</div>
                </div>
                <BillingTypePill type={c.billingMode} />
              </div>
              <div className="client-stats">
                <div className="client-stat">
                  <div className="client-stat-label">Taux</div>
                  <div className="client-stat-value">
                    {c.billingMode === "DAILY" && `${c.rate}€/j`}
                    {c.billingMode === "HOURLY" && `${c.rate}€/h`}
                    {c.billingMode === "FIXED" && fmtEUR(c.fixedPrice)}
                  </div>
                </div>
                <div className="client-stat">
                  <div className="client-stat-label">Revenu</div>
                  <div className="client-stat-value">
                    {c.revenue ? fmtEUR(c.revenue) : "—"}
                  </div>
                </div>
                <div className="client-stat">
                  <div className="client-stat-label">Encours</div>
                  <div
                    className="client-stat-value"
                    style={{
                      color: c.outstanding > 0 ? "var(--warn)" : undefined,
                    }}
                  >
                    {c.outstanding ? fmtEUR(c.outstanding) : "—"}
                  </div>
                </div>
              </div>
              <div
                className="row gap-8"
                style={{ marginTop: 14, justifyContent: "space-between" }}
              >
                <div className="row gap-4 xs muted">
                  <Icon name="folder" size={11} />
                  {c.projectsCount} projet{c.projectsCount > 1 ? "s" : ""}
                  <span
                    style={{
                      width: 3,
                      height: 3,
                      background: "currentColor",
                      borderRadius: 99,
                      opacity: 0.4,
                    }}
                  />
                  <Icon name="check-square" size={11} />
                  {c.pendingTasksCount} à facturer
                </div>
                <Icon name="arrow-right" size={14} className="muted" />
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <div className="card" style={{ gridColumn: "1 / -1" }}>
              <div className="empty">
                <div className="empty-title">Aucun client</div>
                <div>Crée ton premier client pour démarrer.</div>
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th style={{ paddingLeft: 20 }}>Client</th>
                <th>Type</th>
                <th>Taux</th>
                <th>Projets</th>
                <th>Pending</th>
                <th className="right">Revenu</th>
                <th className="right" style={{ paddingRight: 20 }}>
                  Encours
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((c) => (
                <tr
                  key={c.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/clients/${c.id}`)}
                >
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row gap-12">
                      <div className="av" style={{ background: gradient(c) }}>
                        {initials(`${c.firstName} ${c.lastName}`)}
                      </div>
                      <div>
                        <div className="strong">
                          {c.firstName} {c.lastName}
                        </div>
                        <div className="muted xs">{c.company ?? "—"}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <BillingTypePill type={c.billingMode} />
                  </td>
                  <td className="num">
                    {c.billingMode === "DAILY"
                      ? `${c.rate}€/j`
                      : c.billingMode === "HOURLY"
                        ? `${c.rate}€/h`
                        : fmtEUR(c.fixedPrice)}
                  </td>
                  <td className="num">{c.projectsCount}</td>
                  <td className="num muted">{c.pendingTasksCount}</td>
                  <td className="right num strong">
                    {c.revenue ? fmtEUR(c.revenue) : "—"}
                  </td>
                  <td
                    className="right num"
                    style={{
                      paddingRight: 20,
                      color: c.outstanding > 0 ? "var(--warn)" : undefined,
                    }}
                  >
                    {c.outstanding ? fmtEUR(c.outstanding) : "—"}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={7}>
                    <div className="empty">
                      <div className="empty-title">Aucun client</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showNew && <NewClientModal onClose={() => setShowNew(false)} />}
    </div>
  )
}
