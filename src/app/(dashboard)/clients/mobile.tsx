"use client"

import { useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { fmtEUR, initials, avatarColor } from "@/lib/format"
import { BillingTypePill } from "@/components/ui/pill"
import { useClients } from "@/hooks/use-clients"
import { useInvoices } from "@/hooks/use-invoices"
import { useTasks } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-projects"

type Filter = "all" | "DAILY" | "FIXED" | "HOURLY"

export function MobileClientsPage() {
  const router = useRouter()
  const { data: clients = [] } = useClients()
  const { data: invoices = [] } = useInvoices()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const [filter, setFilter] = useState<Filter>("all")
  const [search, setSearch] = useState("")

  const enriched = useMemo(() => {
    return clients
      .filter((c) => !c.archived)
      .filter((c) => filter === "all" || c.billingMode === filter)
      .filter((c) => {
        if (!search) return true
        return (c.firstName + " " + c.lastName + " " + (c.company ?? ""))
          .toLowerCase()
          .includes(search.toLowerCase())
      })
      .map((c) => {
        const myInvoices = invoices.filter((i) => i.clientId === c.id)
        const revenue = myInvoices.reduce((s, i) => s + i.paidAmount, 0)
        const pendingTasksCount = tasks.filter(
          (t) => t.clientId === c.id && t.status === "PENDING_INVOICE",
        ).length
        const projectsCount = projects.filter((p) => p.clientId === c.id).length
        return { ...c, projectsCount, pendingTasksCount, revenue }
      })
  }, [clients, invoices, tasks, projects, filter, search])

  return (
    <div className="m-screen">
      <MobileTopbar
        title="Clients"
        action={
          <button
            type="button"
            className="m-topbar-action primary"
            onClick={() => router.push("/clients?new=1")}
            aria-label="Nouveau client"
          >
            <Icon name="plus" size={16} />
          </button>
        }
      />

      <div className="m-content">
        <div className="m-stack" style={{ paddingTop: 8 }}>
          <div className="searchbar">
            <Icon name="search" size={14} className="muted" />
            <input
              type="search"
              placeholder="Rechercher un client"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="chip-row">
            {(
              [
                { id: "all" as Filter, label: "Tous" },
                { id: "DAILY" as Filter, label: "TJM" },
                { id: "FIXED" as Filter, label: "Forfait" },
                { id: "HOURLY" as Filter, label: "Horaire" },
              ] as { id: Filter; label: string }[]
            ).map((f) => (
              <button
                key={f.id}
                type="button"
                className={"chip" + (filter === f.id ? " active" : "")}
                onClick={() => setFilter(f.id)}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="col gap-8">
            {enriched.map((c) => (
              <button
                key={c.id}
                type="button"
                className="card card-tight"
                onClick={() => router.push(`/clients/${c.id}`)}
                style={{ textAlign: "left", width: "100%" }}
              >
                <div className="row gap-12">
                  <div
                    className="av"
                    style={{
                      background:
                        c.color ?? avatarColor(`${c.firstName}${c.lastName}`),
                    }}
                  >
                    {initials(`${c.firstName} ${c.lastName}`)}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong truncate">
                      {c.company ?? `${c.firstName} ${c.lastName}`}
                    </div>
                    <div className="xs muted truncate">
                      {c.firstName} {c.lastName}
                    </div>
                  </div>
                  <BillingTypePill type={c.billingMode} />
                </div>
                <div className="divider" style={{ margin: "10px 0" }} />
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(3, 1fr)",
                    gap: 8,
                  }}
                >
                  <div>
                    <div
                      className="xs"
                      style={{
                        color: "var(--text-3)",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        fontSize: 10,
                      }}
                    >
                      Projets
                    </div>
                    <div className="num strong small" style={{ marginTop: 2 }}>
                      {c.projectsCount}
                    </div>
                  </div>
                  <div>
                    <div
                      className="xs"
                      style={{
                        color: "var(--text-3)",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        fontSize: 10,
                      }}
                    >
                      À facturer
                    </div>
                    <div className="num strong small" style={{ marginTop: 2 }}>
                      {c.pendingTasksCount}
                    </div>
                  </div>
                  <div>
                    <div
                      className="xs"
                      style={{
                        color: "var(--text-3)",
                        textTransform: "uppercase",
                        fontWeight: 600,
                        fontSize: 10,
                      }}
                    >
                      Revenu
                    </div>
                    <div
                      className="num strong small"
                      style={{ marginTop: 2, color: "var(--accent)" }}
                    >
                      {fmtEUR(c.revenue)}
                    </div>
                  </div>
                </div>
              </button>
            ))}

            {enriched.length === 0 && (
              <div className="empty">
                <div className="empty-title">Aucun client</div>
                <div>Ajoute ton premier client pour démarrer.</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
