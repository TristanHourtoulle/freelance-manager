"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { fmtEUR, initials, avatarColor, fmtRelative } from "@/lib/format"
import { useClients } from "@/hooks/use-clients"
import { useTasks, useSyncLinear } from "@/hooks/use-tasks"
import { pipelineValueForTask } from "@/lib/billing-math"
import { useToast } from "@/components/providers/toast-provider"
import { SuiviView } from "@/components/suivi/suivi-view"

type Filter = "all" | "pending" | "done" | "invoiced"

export function MobileTasksPage() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: tasks = [] } = useTasks()
  const { data: clients = [] } = useClients()
  const sync = useSyncLinear()
  const [filter, setFilter] = useState<Filter>("all")
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [mode, setMode] = useState<"dev" | "suivi">("dev")

  const filtered = useMemo(() => {
    return tasks
      .filter((t) => {
        if (filter === "pending") return t.status === "PENDING_INVOICE"
        if (filter === "done") return t.status === "DONE"
        if (filter === "invoiced") return t.invoiceId != null
        return ["PENDING_INVOICE", "DONE", "IN_PROGRESS"].includes(t.status)
      })
      .sort(
        (a, b) =>
          new Date(b.completedAt ?? 0).getTime() -
          new Date(a.completedAt ?? 0).getTime(),
      )
  }, [tasks, filter])

  const counts = useMemo(
    () => ({
      all: tasks.filter((t) =>
        ["PENDING_INVOICE", "DONE", "IN_PROGRESS"].includes(t.status),
      ).length,
      pending: tasks.filter((t) => t.status === "PENDING_INVOICE").length,
      invoiced: tasks.filter((t) => t.invoiceId != null).length,
    }),
    [tasks],
  )

  const grouped = useMemo(() => {
    const map = new Map<
      string,
      { client: (typeof clients)[number] | undefined; tasks: typeof filtered }
    >()
    for (const t of filtered) {
      const c = clients.find((cl) => cl.id === t.clientId)
      const key = c?.id ?? "unknown"
      if (!map.has(key)) map.set(key, { client: c, tasks: [] })
      map.get(key)!.tasks.push(t)
    }
    return [...map.values()]
  }, [filtered, clients])

  function toggle(id: string) {
    setSelected((s) => {
      const n = new Set(s)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  function startInvoice() {
    const ids = [...selected]
    if (!ids.length) return
    const tasksSel = tasks.filter((t) => ids.includes(t.id))
    const clientId = tasksSel[0]!.clientId
    if (!tasksSel.every((t) => t.clientId === clientId)) {
      toast({
        variant: "error",
        title: "Tasks d'un même client",
        description: "Sélectionne uniquement des tasks d'un même client.",
      })
      return
    }
    router.push(`/billing/new?clientId=${clientId}&taskIds=${ids.join(",")}`)
  }

  function handleSync() {
    sync.mutate()
  }

  return (
    <div className="m-screen">
      <MobileTopbar
        title="Tasks"
        action={
          mode === "dev" ? (
            <button
              type="button"
              className={"m-topbar-action " + (sync.isPending ? "" : "primary")}
              onClick={handleSync}
              disabled={sync.isPending}
              aria-label="Synchroniser Linear"
            >
              <Icon
                name="sync"
                size={15}
                className={sync.isPending ? "spin" : ""}
              />
            </button>
          ) : undefined
        }
      />

      <div className="m-content">
        <div className="big-header">
          <div className="row" style={{ justifyContent: "space-between" }}>
            <div className="big-title" style={{ fontSize: 24 }}>
              {mode === "dev" ? "Linear · Tasks" : "Suivi"}
            </div>
          </div>
        </div>

        <div className="m-stack" style={{ marginBottom: 4 }}>
          <div className="seg">
            <button
              type="button"
              className={mode === "dev" ? "active" : ""}
              onClick={() => setMode("dev")}
            >
              Dev
            </button>
            <button
              type="button"
              className={mode === "suivi" ? "active" : ""}
              onClick={() => setMode("suivi")}
            >
              Suivi
            </button>
          </div>
        </div>

        {mode === "suivi" && (
          <div className="m-stack">
            <SuiviView />
          </div>
        )}

        {mode === "dev" && (
          <div className="m-stack">
            <div className="chip-row">
              {(
                [
                  { id: "all" as Filter, label: "Tous", count: counts.all },
                  {
                    id: "pending" as Filter,
                    label: "À facturer",
                    count: counts.pending,
                  },
                  { id: "done" as Filter, label: "Done", count: undefined },
                  {
                    id: "invoiced" as Filter,
                    label: "Facturée",
                    count: counts.invoiced,
                  },
                ] as { id: Filter; label: string; count: number | undefined }[]
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  className={"chip" + (filter === f.id ? " active" : "")}
                  onClick={() => setFilter(f.id)}
                >
                  {f.label}
                  {f.count != null && <span className="count">{f.count}</span>}
                </button>
              ))}
            </div>

            {grouped.map(({ client, tasks: clientTasks }) => {
              if (!client) return null
              return (
                <div key={client.id} className="col gap-8">
                  <div className="row gap-8" style={{ padding: "4px 0" }}>
                    <div
                      className="av av-sm"
                      style={{
                        background:
                          client.color ??
                          avatarColor(`${client.firstName}${client.lastName}`),
                      }}
                    >
                      {initials(`${client.firstName} ${client.lastName}`)}
                    </div>
                    <div className="grow">
                      <div className="small strong">
                        {client.company ??
                          `${client.firstName} ${client.lastName}`}
                      </div>
                      <div className="xs muted">
                        {clientTasks.length} task
                        {clientTasks.length > 1 ? "s" : ""} ·{" "}
                        {client.billingMode === "DAILY"
                          ? `${client.rate}€/j`
                          : client.billingMode === "HOURLY"
                            ? `${client.rate}€/h`
                            : "Forfait"}
                      </div>
                    </div>
                  </div>

                  {clientTasks.map((t) => {
                    const isSel = selected.has(t.id)
                    const value = pipelineValueForTask({
                      billingMode: client.billingMode,
                      rate: client.rate,
                      estimateDays: t.estimate,
                    })
                    return (
                      <button
                        key={t.id}
                        type="button"
                        className={"task-item" + (isSel ? " selected" : "")}
                        onClick={() => !t.invoiceId && toggle(t.id)}
                        disabled={t.invoiceId != null}
                        style={{
                          textAlign: "left",
                          opacity: t.invoiceId ? 0.7 : 1,
                        }}
                      >
                        <div className="row gap-8">
                          <div
                            className={
                              "checkbox-circle" + (isSel ? " checked" : "")
                            }
                          >
                            {isSel && <Icon name="check" size={13} />}
                          </div>
                          <span className="task-id">{t.linearIdentifier}</span>
                          <span
                            className={
                              "pill pill-no-dot xs " +
                              (t.status === "DONE"
                                ? "pill-paid"
                                : t.status === "IN_PROGRESS"
                                  ? "pill-draft"
                                  : "pill-pending")
                            }
                            style={{ marginLeft: "auto" }}
                          >
                            {t.status === "DONE"
                              ? "Done"
                              : t.status === "IN_PROGRESS"
                                ? "En cours"
                                : "À facturer"}
                          </span>
                        </div>
                        <div className="task-title">{t.title}</div>
                        <div className="task-meta">
                          <span>
                            <Icon name="clock" size={11} /> {t.estimate ?? "—"}j
                          </span>
                          <span>·</span>
                          <span className="num">{fmtEUR(value)}</span>
                          {t.invoiceId && (
                            <>
                              <span>·</span>
                              <span style={{ color: "var(--accent)" }}>
                                Facturée
                              </span>
                            </>
                          )}
                          {t.completedAt && (
                            <>
                              <span style={{ marginLeft: "auto" }}>
                                {fmtRelative(t.completedAt)}
                              </span>
                            </>
                          )}
                        </div>
                      </button>
                    )
                  })}
                </div>
              )
            })}

            {filtered.length === 0 && (
              <div className="empty">
                <div className="empty-title">Aucune task</div>
                <div>Change le filtre ou sync depuis Linear.</div>
              </div>
            )}
          </div>
        )}
      </div>

      {mode === "dev" && selected.size > 0 && (
        <div className="sticky-cta">
          <div className="grow">
            <div className="strong small">
              {selected.size} task{selected.size > 1 ? "s" : ""}
            </div>
            <div className="xs muted">
              prête{selected.size > 1 ? "s" : ""} pour la facturation
            </div>
          </div>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setSelected(new Set())}
          >
            Annuler
          </button>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={startInvoice}
          >
            <Icon name="invoice" size={13} />
            Facturer
          </button>
        </div>
      )}
    </div>
  )
}
