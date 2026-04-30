"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { useProjects } from "@/hooks/use-projects"
import { useTasks } from "@/hooks/use-tasks"
import { useInvoices } from "@/hooks/use-invoices"
import { useClients } from "@/hooks/use-clients"
import { useSyncLinear } from "@/hooks/use-tasks"
import { fmtEUR, initials, avatarColor } from "@/lib/format"
import { LinearMappingsModal } from "@/components/clients/linear-mappings-modal"

type FilterId = "all" | "DAILY" | "FIXED" | "HOURLY"
type SortKey =
  | "name"
  | "client"
  | "key"
  | "tasksTotal"
  | "tasksPending"
  | "pipeline"
  | "revenue"
type SortDir = "asc" | "desc"

interface ProjectRow {
  id: string
  name: string
  description: string | null
  key: string
  clientId: string
  clientLabel: string
  clientFirstName: string
  clientLastName: string
  clientCompany: string | null
  clientColor: string | null
  clientBillingMode: "DAILY" | "FIXED" | "HOURLY" | undefined
  tasksTotal: number
  tasksDone: number
  tasksPending: number
  pipeline: number
  revenue: number
}

export default function ProjectsPage() {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [filter, setFilter] = useState<FilterId>("all")
  const [sortKey, setSortKey] = useState<SortKey>("name")
  const [sortDir, setSortDir] = useState<SortDir>("asc")
  const [showLink, setShowLink] = useState(false)
  const sync = useSyncLinear()

  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  const { data: invoices = [] } = useInvoices()
  const { data: clients = [] } = useClients()

  const rows: ProjectRow[] = useMemo(() => {
    return projects.map((p) => {
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
      const clientLabel =
        p.client.company ?? `${p.client.firstName} ${p.client.lastName}`
      return {
        id: p.id,
        name: p.name,
        description: p.description ?? null,
        key: p.key,
        clientId: p.clientId,
        clientLabel,
        clientFirstName: p.client.firstName,
        clientLastName: p.client.lastName,
        clientCompany: p.client.company ?? null,
        clientColor: p.client.color ?? null,
        clientBillingMode: client?.billingMode,
        tasksTotal: projectTasks.length,
        tasksDone: doneTasks.length,
        tasksPending: pendingTasks.length,
        pipeline,
        revenue,
      }
    })
  }, [projects, tasks, invoices, clients])

  const counts = useMemo(
    () => ({
      all: rows.length,
      daily: rows.filter((r) => r.clientBillingMode === "DAILY").length,
      fixed: rows.filter((r) => r.clientBillingMode === "FIXED").length,
      hourly: rows.filter((r) => r.clientBillingMode === "HOURLY").length,
    }),
    [rows],
  )

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (
        search &&
        !`${r.name} ${r.clientLabel}`
          .toLowerCase()
          .includes(search.toLowerCase())
      )
        return false
      if (filter !== "all" && r.clientBillingMode !== filter) return false
      return true
    })
  }, [rows, search, filter])

  const sorted = useMemo(() => {
    const arr = [...filtered]
    arr.sort((a, b) => {
      let cmp = 0
      switch (sortKey) {
        case "name":
          cmp = a.name.localeCompare(b.name)
          break
        case "client":
          cmp = a.clientLabel.localeCompare(b.clientLabel)
          break
        case "key":
          cmp = a.key.localeCompare(b.key)
          break
        case "tasksTotal":
          cmp = a.tasksTotal - b.tasksTotal
          break
        case "tasksPending":
          cmp = a.tasksPending - b.tasksPending
          break
        case "pipeline":
          cmp = a.pipeline - b.pipeline
          break
        case "revenue":
          cmp = a.revenue - b.revenue
          break
      }
      return sortDir === "asc" ? cmp : -cmp
    })
    return arr
  }, [filtered, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortKey(key)
      setSortDir(
        ["tasksTotal", "tasksPending", "pipeline", "revenue"].includes(key)
          ? "desc"
          : "asc",
      )
    }
  }

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
          <button className="btn btn-primary" onClick={() => setShowLink(true)}>
            <Icon name="link" size={14} />
            Lier projets Linear
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
            placeholder="Rechercher projet…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="chip-row">
          {(
            [
              { id: "all", label: "Tous", count: counts.all },
              { id: "DAILY", label: "TJM", count: counts.daily },
              { id: "FIXED", label: "Forfait", count: counts.fixed },
              { id: "HOURLY", label: "Horaire", count: counts.hourly },
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
      </div>

      <div className="card" style={{ padding: 0 }}>
        <table className="table">
          <thead>
            <tr>
              <SortableTh
                label="Projet"
                k="name"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
                style={{ paddingLeft: 20 }}
              />
              <SortableTh
                label="Client"
                k="client"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <SortableTh
                label="Linear"
                k="key"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <SortableTh
                label="Tasks"
                k="tasksTotal"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <SortableTh
                label="À facturer"
                k="tasksPending"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
              />
              <SortableTh
                label="Pipeline"
                k="pipeline"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
                align="right"
              />
              <SortableTh
                label="Revenu"
                k="revenue"
                sortKey={sortKey}
                sortDir={sortDir}
                onClick={toggleSort}
                align="right"
                style={{ paddingRight: 20 }}
              />
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
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
            {sorted.map((p) => (
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
                  <div className="row gap-8">
                    <div
                      className="av av-sm"
                      style={{
                        background:
                          p.clientColor ??
                          avatarColor(
                            `${p.clientFirstName}${p.clientLastName}`,
                          ),
                      }}
                    >
                      {initials(`${p.clientFirstName} ${p.clientLastName}`)}
                    </div>
                    <span className="small">{p.clientLabel}</span>
                  </div>
                </td>
                <td>
                  <span className="task-id">{p.key}</span>
                </td>
                <td className="num small">
                  <div className="row gap-8">
                    <span>{p.tasksTotal} total</span>
                    <span className="muted">·</span>
                    <span className="muted">{p.tasksDone} done</span>
                  </div>
                </td>
                <td className="num">
                  {p.tasksPending > 0 ? (
                    <span className="pill pill-pending xs">
                      {p.tasksPending}
                    </span>
                  ) : (
                    <span className="muted">—</span>
                  )}
                </td>
                <td
                  className="right num"
                  style={{ color: p.pipeline > 0 ? "var(--info)" : undefined }}
                >
                  {p.pipeline > 0 ? fmtEUR(p.pipeline) : "—"}
                </td>
                <td
                  className="right num strong"
                  style={{
                    paddingRight: 20,
                    color: p.revenue > 0 ? "var(--accent)" : undefined,
                  }}
                >
                  {p.revenue > 0 ? fmtEUR(p.revenue) : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showLink && <LinearMappingsModal onClose={() => setShowLink(false)} />}
    </div>
  )
}

interface SortableThProps {
  label: string
  k: SortKey
  sortKey: SortKey
  sortDir: SortDir
  onClick: (k: SortKey) => void
  align?: "left" | "right"
  style?: React.CSSProperties
}

function SortableTh({
  label,
  k,
  sortKey,
  sortDir,
  onClick,
  align = "left",
  style,
}: SortableThProps) {
  const active = sortKey === k
  return (
    <th
      className={align === "right" ? "right" : undefined}
      style={{ cursor: "pointer", userSelect: "none", ...style }}
      onClick={() => onClick(k)}
    >
      <span
        className="row gap-4"
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: align === "right" ? "flex-end" : "flex-start",
          color: active ? "var(--text-0)" : undefined,
        }}
      >
        {label}
        <Icon
          name="chevron-down"
          size={10}
          style={{
            opacity: active ? 0.9 : 0.3,
            transform:
              active && sortDir === "asc" ? "rotate(180deg)" : undefined,
            transition: "transform 120ms",
          }}
        />
      </span>
    </th>
  )
}
