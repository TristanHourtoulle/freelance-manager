"use client"

import { Suspense, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { StatusPill, taskStatusToPill } from "@/components/ui/pill"
import { fmtEUR, fmtRelative, initials, avatarColor } from "@/lib/format"
import { useTasks, useSyncLinear } from "@/hooks/use-tasks"
import { useClients } from "@/hooks/use-clients"
import { useProjects } from "@/hooks/use-projects"
import { useInvoices } from "@/hooks/use-invoices"
import { useToast } from "@/components/providers/toast-provider"
import { pipelineValueForTask } from "@/lib/billing-math"
import { useIsMobile } from "@/hooks/use-is-mobile"
import { MobileTasksPage } from "./mobile"

type StatusFilterId = "all" | "pending" | "done" | "in_progress"

export default function TasksPage() {
  const isMobile = useIsMobile()
  return (
    <Suspense fallback={<div className="empty">Chargement…</div>}>
      {isMobile ? <MobileTasksPage /> : <DesktopTasksPage />}
    </Suspense>
  )
}

function DesktopTasksPage() {
  const router = useRouter()
  const search = useSearchParams()
  const initialClient = search.get("clientId") ?? "all"
  const initialProject = search.get("projectId") ?? "all"

  const [searchTerm, setSearchTerm] = useState("")
  const [statusFilter, setStatusFilter] = useState<StatusFilterId>("all")
  const [clientFilter, setClientFilter] = useState<string>(initialClient)
  const [projectFilter, setProjectFilter] = useState<string>(initialProject)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 50

  const { data: tasks = [] } = useTasks()
  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const { data: invoices = [] } = useInvoices()
  const sync = useSyncLinear()
  const { toast } = useToast()

  const counts = useMemo(
    () => ({
      all: tasks.filter((t) =>
        ["PENDING_INVOICE", "DONE", "IN_PROGRESS"].includes(t.status),
      ).length,
      pending: tasks.filter((t) => t.status === "PENDING_INVOICE").length,
      done: tasks.filter((t) => t.status === "DONE").length,
      in_progress: tasks.filter((t) => t.status === "IN_PROGRESS").length,
    }),
    [tasks],
  )

  const filtered = useMemo(
    () =>
      tasks.filter((t) => {
        if (
          searchTerm &&
          !`${t.linearIdentifier} ${t.title}`
            .toLowerCase()
            .includes(searchTerm.toLowerCase())
        )
          return false
        if (statusFilter === "pending" && t.status !== "PENDING_INVOICE")
          return false
        if (statusFilter === "done" && t.status !== "DONE") return false
        if (statusFilter === "in_progress" && t.status !== "IN_PROGRESS")
          return false
        if (
          statusFilter === "all" &&
          !["PENDING_INVOICE", "DONE", "IN_PROGRESS"].includes(t.status)
        )
          return false
        if (clientFilter !== "all" && t.clientId !== clientFilter) return false
        if (projectFilter !== "all" && t.projectId !== projectFilter)
          return false
        return true
      }),
    [tasks, searchTerm, statusFilter, clientFilter, projectFilter],
  )

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPage(1)
  }, [searchTerm, statusFilter, clientFilter, projectFilter])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const safePage = Math.min(page, totalPages)
  const paged = useMemo(
    () => filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE),
    [filtered, safePage],
  )

  type Group = {
    clientId: string
    projectId: string
    tasks: typeof filtered
  }
  const groups: Group[] = useMemo(() => {
    const m = new Map<string, Group>()
    for (const t of paged) {
      const key = `${t.clientId}::${t.projectId}`
      let g = m.get(key)
      if (!g) {
        g = { clientId: t.clientId, projectId: t.projectId, tasks: [] }
        m.set(key, g)
      }
      g.tasks.push(t)
    }
    return Array.from(m.values())
  }, [paged])

  const selectedTasks = filtered.filter((t) => selected.has(t.id))
  const selectedClientIds = new Set(selectedTasks.map((t) => t.clientId))
  const canInvoiceSelected = selectedClientIds.size === 1

  const selectedValue = selectedTasks.reduce((s, t) => {
    const c = clients.find((cc) => cc.id === t.clientId)
    if (!c) return s
    return (
      s +
      pipelineValueForTask({
        billingMode: c.billingMode,
        rate: c.rate,
        estimateDays: t.estimate,
      })
    )
  }, 0)

  function doSync() {
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
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Tasks</h1>
          <div className="page-sub">
            Synchronisées depuis Linear · {counts.all} tasks visibles
          </div>
        </div>
        <div className="page-actions">
          <button
            className="btn btn-secondary"
            onClick={doSync}
            disabled={sync.isPending}
          >
            <Icon
              name="sync"
              size={14}
              className={sync.isPending ? "spin" : ""}
            />
            {sync.isPending ? "Synchronisation…" : "Sync Linear"}
          </button>
          {selected.size > 0 && canInvoiceSelected && (
            <button
              className="btn btn-primary"
              onClick={() =>
                router.push(
                  `/billing/new?clientId=${[...selectedClientIds][0]}&taskIds=${[...selected].join(",")}`,
                )
              }
            >
              <Icon name="invoice" size={14} />
              Facturer ({selected.size}) · {fmtEUR(selectedValue)}
            </button>
          )}
          {selected.size > 0 && !canInvoiceSelected && (
            <button
              className="btn btn-secondary"
              disabled
              title="Sélectionne un seul client"
            >
              <Icon name="alert" size={14} />
              Plusieurs clients
            </button>
          )}
        </div>
      </div>

      <div
        className="row gap-12"
        style={{
          marginBottom: 14,
          justifyContent: "space-between",
          flexWrap: "wrap",
        }}
      >
        <div style={{ position: "relative", flex: 1, maxWidth: 320 }}>
          <Icon
            name="search"
            size={14}
            className="muted"
            style={{ position: "absolute", left: 12, top: 10 }}
          />
          <input
            className="input"
            style={{ paddingLeft: 34 }}
            placeholder="Rechercher par ID ou titre…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="row gap-12" style={{ flexWrap: "wrap" }}>
          <div className="chip-row">
            {(
              [
                { id: "all", label: "Tout", count: counts.all },
                { id: "pending", label: "À facturer", count: counts.pending },
                { id: "done", label: "Facturée", count: counts.done },
                {
                  id: "in_progress",
                  label: "En cours",
                  count: counts.in_progress,
                },
              ] as { id: StatusFilterId; label: string; count: number }[]
            ).map((f) => (
              <button
                key={f.id}
                className={"chip" + (statusFilter === f.id ? " active" : "")}
                onClick={() => setStatusFilter(f.id)}
              >
                {f.label} <span className="count">{f.count}</span>
              </button>
            ))}
          </div>
          <select
            className="select"
            style={{ width: 200 }}
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value)
              setProjectFilter("all")
            }}
          >
            <option value="all">Tous les clients</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.company ?? `${c.firstName} ${c.lastName}`}
              </option>
            ))}
          </select>
          <select
            className="select"
            style={{ width: 220 }}
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
          >
            <option value="all">Tous les projets</option>
            {projects
              .filter(
                (p) => clientFilter === "all" || p.clientId === clientFilter,
              )
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
        </div>
      </div>

      <div className="col gap-16">
        {groups.length === 0 && (
          <div className="card">
            <div className="empty">
              <div className="empty-title">Aucune task</div>
              <div>Ajuste les filtres ou lance une sync</div>
            </div>
          </div>
        )}
        {groups.map((g) => {
          const c = clients.find((cc) => cc.id === g.clientId)
          const p = projects.find((pp) => pp.id === g.projectId)
          const groupValue = g.tasks.reduce((s, t) => {
            if (!c) return s
            return (
              s +
              pipelineValueForTask({
                billingMode: c.billingMode,
                rate: c.rate,
                estimateDays: t.estimate,
              })
            )
          }, 0)
          const allSelected = g.tasks.every((t) => selected.has(t.id))
          return (
            <div
              key={`${g.clientId}${g.projectId}`}
              className="card"
              style={{ padding: 0, overflow: "hidden" }}
            >
              <div
                className="row gap-12"
                style={{
                  padding: "14px 18px",
                  borderBottom: "1px solid var(--border)",
                  background: "var(--bg-2)",
                }}
              >
                <div
                  className="av av-sm"
                  style={{
                    background: c
                      ? (c.color ?? avatarColor(`${c.firstName}${c.lastName}`))
                      : undefined,
                  }}
                >
                  {c ? initials(`${c.firstName} ${c.lastName}`) : ""}
                </div>
                <div>
                  <div className="strong small">
                    {c?.company ?? "—"} ·{" "}
                    <span className="muted">{p?.name ?? "—"}</span>
                  </div>
                  <div className="xs muted">
                    {g.tasks.length} task{g.tasks.length > 1 ? "s" : ""} ·{" "}
                    {c?.billingMode === "DAILY"
                      ? `${c.rate}€/j`
                      : c?.billingMode === "HOURLY"
                        ? `${c.rate}€/h`
                        : "Forfait"}
                  </div>
                </div>
                <div style={{ marginLeft: "auto" }} className="num strong">
                  {groupValue > 0 ? fmtEUR(groupValue) : "—"}
                </div>
              </div>
              <table className="table">
                <thead>
                  <tr>
                    <th style={{ paddingLeft: 18, width: 40 }}>
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={(e) => {
                          const next = new Set(selected)
                          g.tasks.forEach((t) =>
                            e.target.checked
                              ? next.add(t.id)
                              : next.delete(t.id),
                          )
                          setSelected(next)
                        }}
                      />
                    </th>
                    <th style={{ width: 88 }}>ID</th>
                    <th>Title</th>
                    <th style={{ width: 130 }}>Statut</th>
                    <th className="right" style={{ width: 90 }}>
                      Estimate
                    </th>
                    <th className="right" style={{ width: 110 }}>
                      Valeur
                    </th>
                    <th style={{ width: 110, paddingRight: 18 }}>Facturée</th>
                  </tr>
                </thead>
                <tbody>
                  {g.tasks.map((t) => {
                    const value = c
                      ? pipelineValueForTask({
                          billingMode: c.billingMode,
                          rate: c.rate,
                          estimateDays: t.estimate,
                        })
                      : 0
                    const inv = t.invoiceId
                      ? invoices.find((i) => i.id === t.invoiceId)
                      : null
                    const isSel = selected.has(t.id)
                    return (
                      <tr
                        key={t.id}
                        style={
                          isSel ? { background: "var(--accent-soft)" } : {}
                        }
                      >
                        <td style={{ paddingLeft: 18 }}>
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={(e) => {
                              const next = new Set(selected)
                              if (e.target.checked) next.add(t.id)
                              else next.delete(t.id)
                              setSelected(next)
                            }}
                          />
                        </td>
                        <td>
                          <span className="task-id">{t.linearIdentifier}</span>
                        </td>
                        <td className="strong">{t.title}</td>
                        <td>
                          <StatusPill status={taskStatusToPill(t.status)} />
                        </td>
                        <td className="right num">
                          {t.estimate ? `${t.estimate}j` : "—"}
                        </td>
                        <td className="right num">
                          {value > 0 ? fmtEUR(value) : "—"}
                        </td>
                        <td style={{ paddingRight: 18 }}>
                          {inv ? (
                            <span className="mono xs muted">{inv.number}</span>
                          ) : (
                            <span className="muted xs">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )
        })}
      </div>

      {filtered.length > PAGE_SIZE && (
        <div
          className="row gap-12"
          style={{
            justifyContent: "space-between",
            marginTop: 18,
            padding: "12px 4px",
            color: "var(--text-2)",
            fontSize: 12,
          }}
        >
          <span>
            {(safePage - 1) * PAGE_SIZE + 1}–
            {Math.min(safePage * PAGE_SIZE, filtered.length)} sur{" "}
            {filtered.length} tasks
          </span>
          <div className="row gap-8">
            <button
              className="btn btn-secondary btn-sm"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
            >
              <Icon name="chevron-left" size={12} />
              Précédent
            </button>
            <span
              className="num small"
              style={{ minWidth: 64, textAlign: "center" }}
            >
              {safePage} / {totalPages}
            </span>
            <button
              className="btn btn-secondary btn-sm"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            >
              Suivant
              <Icon name="chevron-right" size={12} />
            </button>
          </div>
        </div>
      )}

      {selected.size > 0 && (
        <div
          style={{
            position: "fixed",
            bottom: 24,
            left: "50%",
            transform: "translateX(-50%)",
            background: "var(--bg-1)",
            border: "1px solid var(--border-strong)",
            borderRadius: 12,
            padding: "10px 16px",
            boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            gap: 14,
            zIndex: 20,
          }}
        >
          <span className="strong small">
            {selected.size} task{selected.size > 1 ? "s" : ""} sélectionnée
            {selected.size > 1 ? "s" : ""}
          </span>
          <span className="muted xs">·</span>
          <span className="num strong">{fmtEUR(selectedValue)}</span>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setSelected(new Set())}
          >
            <Icon name="x" size={12} /> Désélectionner
          </button>
          {canInvoiceSelected && (
            <button
              className="btn btn-primary btn-sm"
              onClick={() =>
                router.push(
                  `/billing/new?clientId=${[...selectedClientIds][0]}&taskIds=${[...selected].join(",")}`,
                )
              }
            >
              <Icon name="invoice" size={12} />
              Créer facture
            </button>
          )}
        </div>
      )}
    </div>
  )
}

void fmtRelative
