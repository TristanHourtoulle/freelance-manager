"use client"

import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { fmtEUR, initials, avatarColor } from "@/lib/format"
import { useProjects } from "@/hooks/use-projects"
import { useTasks } from "@/hooks/use-tasks"
import { useInvoices } from "@/hooks/use-invoices"
import { useClients } from "@/hooks/use-clients"

export function MobileProjectsPage() {
  const router = useRouter()
  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()
  const { data: clients = [] } = useClients()
  const { data: invoices = [] } = useInvoices()

  return (
    <div className="m-screen">
      <MobileTopbar title="Projets" back="/more" />
      <div className="m-content">
        <div className="big-header">
          <div className="big-title">Projets</div>
          <div className="big-sub">
            {projects.length} projet{projects.length > 1 ? "s" : ""} ·
            synchronisés Linear
          </div>
        </div>

        <div className="m-stack">
          {projects.map((p) => {
            const c = clients.find((cl) => cl.id === p.clientId)
            const projectTasks = tasks.filter((t) => t.projectId === p.id)
            const done = projectTasks.filter((t) => t.status === "DONE").length
            const total = projectTasks.length
            const revenue = invoices
              .filter((i) => i.projectId === p.id)
              .reduce((s, i) => s + i.paidAmount, 0)
            return (
              <button
                key={p.id}
                type="button"
                className="card"
                onClick={() => c && router.push(`/clients/${c.id}`)}
                style={{ textAlign: "left", width: "100%" }}
              >
                <div className="row gap-12">
                  <div
                    className="av av-sm"
                    style={{
                      background:
                        c?.color ??
                        avatarColor(
                          `${c?.firstName ?? ""}${c?.lastName ?? ""}`,
                        ),
                    }}
                  >
                    {c ? initials(`${c.firstName} ${c.lastName}`) : "??"}
                  </div>
                  <div className="grow" style={{ minWidth: 0 }}>
                    <div className="strong small truncate">{p.name}</div>
                    <div className="xs muted truncate">
                      {c?.company ??
                        `${c?.firstName ?? ""} ${c?.lastName ?? ""}`}
                    </div>
                  </div>
                  <span className="task-id">{p.key}</span>
                </div>
                {p.description && (
                  <div className="xs muted truncate" style={{ marginTop: 8 }}>
                    {p.description}
                  </div>
                )}
                <div className="divider" style={{ margin: "12px 0" }} />
                <div className="row gap-12">
                  <div className="grow">
                    <div
                      className="row"
                      style={{
                        justifyContent: "space-between",
                        marginBottom: 4,
                      }}
                    >
                      <span className="xs muted">
                        {done}/{total} tasks done
                      </span>
                      <span
                        className="xs num strong"
                        style={{ color: "var(--accent)" }}
                      >
                        {fmtEUR(revenue)}
                      </span>
                    </div>
                    <div className="pbar">
                      <span
                        style={{
                          width: total ? `${(done / total) * 100}%` : "0%",
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className={
                      "pill pill-no-dot " +
                      (p.status === "ACTIVE" ? "pill-paid" : "pill-draft")
                    }
                  >
                    {p.status === "ACTIVE" ? "Actif" : "Pause"}
                  </span>
                </div>
              </button>
            )
          })}

          {projects.length === 0 && (
            <div className="empty">
              <div className="empty-title">Aucun projet</div>
              <div>Lie un projet Linear depuis un client.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
