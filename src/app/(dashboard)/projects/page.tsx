"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { useProjects } from "@/hooks/use-projects"
import { useTasks } from "@/hooks/use-tasks"
import { useInvoices } from "@/hooks/use-invoices"
import { useClients } from "@/hooks/use-clients"
import { useSyncLinear } from "@/hooks/use-tasks"
import { fmtEUR, initials, avatarColor } from "@/lib/format"

export default function ProjectsPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const sync = useSyncLinear()

  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  const { data: invoices = [] } = useInvoices()
  const { data: clients = [] } = useClients()

  const filtered = projects.filter((p) => {
    if (!search) return true
    return `${p.name} ${p.client.company ?? ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  })

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Projets</h1>
          <div className="page-sub">
            {projects.length} projets · synchronisés depuis Linear
          </div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={() => sync.mutate()}
            disabled={sync.isPending}
          >
            <Icon
              name="sync"
              size={14}
              className={sync.isPending ? "spin" : ""}
            />
            {sync.isPending ? "Synchronisation…" : "Sync Linear"}
          </button>
          <button
            className="btn btn-primary"
            onClick={() => router.push("/clients")}
          >
            <Icon name="link" size={14} />
            Lier projet Linear
          </button>
        </div>
      </div>

      <div className="row gap-12" style={{ marginBottom: 18 }}>
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
            placeholder="Rechercher projet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <th style={{ paddingLeft: 20 }}>Projet</th>
              <th>Client</th>
              <th>Linear</th>
              <th>Tasks</th>
              <th>À facturer</th>
              <th className="right">Pipeline</th>
              <th className="right" style={{ paddingRight: 20 }}>
                Revenu
              </th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>
                  <div className="empty">
                    <div className="empty-title">Aucun projet</div>
                    <div>
                      Ajoute un mapping Linear sur un client pour récupérer ses
                      projets.
                    </div>
                  </div>
                </td>
              </tr>
            )}
            {filtered.map((p) => {
              const projectTasks = tasks.filter((t) => t.projectId === p.id)
              const pendingTasks = projectTasks.filter(
                (t) => t.status === "PENDING_INVOICE",
              )
              const doneTasks = projectTasks.filter(
                (t) => t.status === "DONE" || t.status === "PENDING_INVOICE",
              )
              const client = clients.find((c) => c.id === p.clientId)
              const pipeline =
                client?.billingMode === "DAILY"
                  ? pendingTasks.reduce(
                      (s, t) => s + (t.estimate ?? 0) * client.rate,
                      0,
                    )
                  : client?.billingMode === "HOURLY"
                    ? pendingTasks.reduce(
                        (s, t) => s + (t.estimate ?? 0) * 8 * client.rate,
                        0,
                      )
                    : 0
              const revenue = invoices
                .filter((i) => i.projectId === p.id && i.status === "PAID")
                .reduce((s, i) => s + i.total, 0)
              return (
                <tr
                  key={p.id}
                  style={{ cursor: "pointer" }}
                  onClick={() => router.push(`/tasks?projectId=${p.id}`)}
                >
                  <td style={{ paddingLeft: 20 }}>
                    <div className="row gap-12">
                      <div
                        style={{
                          width: 32,
                          height: 32,
                          background: "var(--bg-3)",
                          borderRadius: 7,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        <Icon name="folder" size={14} />
                      </div>
                      <div>
                        <div className="strong">{p.name}</div>
                        <div className="muted xs">{p.description ?? ""}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {p.client && (
                      <div className="row gap-8">
                        <div
                          className="av av-sm"
                          style={{
                            background:
                              p.client.color ??
                              avatarColor(
                                `${p.client.firstName}${p.client.lastName}`,
                              ),
                          }}
                        >
                          {initials(
                            `${p.client.firstName} ${p.client.lastName}`,
                          )}
                        </div>
                        <span className="small">{p.client.company ?? "—"}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span className="task-id">{p.key}</span>
                  </td>
                  <td className="num small">
                    <div className="row gap-8">
                      <span>{projectTasks.length} total</span>
                      <span className="muted">·</span>
                      <span className="muted">{doneTasks.length} done</span>
                    </div>
                  </td>
                  <td className="num">
                    {pendingTasks.length > 0 ? (
                      <span className="pill pill-pending xs">
                        {pendingTasks.length}
                      </span>
                    ) : (
                      <span className="muted">—</span>
                    )}
                  </td>
                  <td
                    className="right num"
                    style={{ color: pipeline > 0 ? "var(--info)" : undefined }}
                  >
                    {pipeline > 0 ? fmtEUR(pipeline) : "—"}
                  </td>
                  <td
                    className="right num strong"
                    style={{
                      paddingRight: 20,
                      color: revenue > 0 ? "var(--accent)" : undefined,
                    }}
                  >
                    {revenue > 0 ? fmtEUR(revenue) : "—"}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
