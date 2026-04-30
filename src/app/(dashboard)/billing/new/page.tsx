"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { BillingTypePill } from "@/components/ui/pill"
import { fmtEUR, fmtEURprecise, initials, avatarColor } from "@/lib/format"
import { lineFromTask, sumLines } from "@/lib/billing-math"
import { useClients } from "@/hooks/use-clients"
import { useTasks } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-projects"
import { useCreateInvoice } from "@/hooks/use-invoices"
import { useToast } from "@/components/providers/toast-provider"

interface Line {
  id: string
  taskId: string | null
  label: string
  qty: number
  rate: number
}

type Kind = "STANDARD" | "DEPOSIT"

function newId() {
  return "L" + Math.random().toString(36).slice(2, 8)
}

export default function NewInvoicePage() {
  const router = useRouter()
  const search = useSearchParams()
  const preselectedTaskIds = (search.get("taskIds") ?? "")
    .split(",")
    .filter(Boolean)
  const initialClientId = search.get("clientId") ?? ""

  const [clientId, setClientId] = useState(initialClientId)
  const [projectId, setProjectId] = useState<string>("all")
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [kind, setKind] = useState<Kind>("STANDARD")
  const [depositLabel, setDepositLabel] = useState("Acompte 30%")
  const [depositAmount, setDepositAmount] = useState<number>(0)
  const [lines, setLines] = useState<Line[]>([])
  const [dragOver, setDragOver] = useState(false)

  const { data: clients = [] } = useClients()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const createInvoice = useCreateInvoice()
  const { toast } = useToast()

  const client = clients.find((c) => c.id === clientId)

  // Pre-fill lines from preselected task IDs
  useEffect(() => {
    if (!client || preselectedTaskIds.length === 0) return
    const newLines: Line[] = []
    for (const tid of preselectedTaskIds) {
      const t = tasks.find((x) => x.id === tid)
      if (!t) continue
      const { qty, rate } = lineFromTask({
        billingMode: client.billingMode,
        rate: client.rate,
        estimateDays: t.estimate,
      })
      newLines.push({
        id: newId(),
        taskId: t.id,
        label: `[${t.linearIdentifier}] ${t.title}`,
        qty,
        rate,
      })
    }
    setLines(newLines)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [client?.id, tasks.length])

  const eligibleTasks = useMemo(() => {
    if (!clientId) return []
    return tasks.filter(
      (t) =>
        t.clientId === clientId &&
        t.status === "PENDING_INVOICE" &&
        !t.invoiceId &&
        !lines.some((l) => l.taskId === t.id) &&
        (projectId === "all" || t.projectId === projectId),
    )
  }, [clientId, tasks, lines, projectId])

  function addTask(t: (typeof tasks)[number]) {
    if (!client) return
    const { qty, rate } = lineFromTask({
      billingMode: client.billingMode,
      rate: client.rate,
      estimateDays: t.estimate,
    })
    setLines((cur) => [
      ...cur,
      {
        id: newId(),
        taskId: t.id,
        label: `[${t.linearIdentifier}] ${t.title}`,
        qty,
        rate,
      },
    ])
  }

  function updateLine(id: string, patch: Partial<Line>) {
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function removeLine(id: string) {
    setLines((cur) => cur.filter((l) => l.id !== id))
  }
  function addBlank() {
    setLines((cur) => [
      ...cur,
      {
        id: newId(),
        taskId: null,
        label: "Ligne personnalisée",
        qty: 1,
        rate: 0,
      },
    ])
  }

  const subtotal =
    kind === "DEPOSIT" ? Number(depositAmount) || 0 : sumLines(lines)

  function submit(status: "DRAFT" | "SENT") {
    if (!client) return
    const linesPayload =
      kind === "DEPOSIT"
        ? [
            {
              taskId: null,
              label: depositLabel,
              qty: 1,
              rate: Number(depositAmount) || 0,
            },
          ]
        : lines.map((l) => ({
            taskId: l.taskId ?? null,
            label: l.label,
            qty: Number(l.qty),
            rate: Number(l.rate),
          }))

    createInvoice.mutate(
      {
        clientId: client.id,
        projectId: projectId !== "all" ? projectId : null,
        issueDate,
        dueDate,
        kind,
        status,
        lines: linesPayload,
        taskIds:
          kind === "STANDARD"
            ? lines.map((l) => l.taskId).filter((x): x is string => Boolean(x))
            : [],
      },
      {
        onSuccess: (created) => {
          toast({
            variant: "success",
            title: status === "DRAFT" ? "Brouillon créé" : "Facture envoyée",
          })
          router.push(`/billing?invoiceId=${created.id}`)
        },
        onError: (e) =>
          toast({
            variant: "error",
            title: "Erreur",
            description: e instanceof Error ? e.message : String(e),
          }),
      },
    )
  }

  return (
    <div className="page" style={{ maxWidth: 1500 }}>
      <div className="row gap-8" style={{ marginBottom: 16 }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => router.push("/billing")}
        >
          <Icon name="chevron-left" size={12} />
          Factures
        </button>
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Nouvelle facture</h1>
          <div className="page-sub">
            Sélectionne un client puis ajoute des tasks par drag &amp; drop ou
            clic
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row gap-16" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label className="field-label">Client</label>
            <select
              className="select"
              value={clientId}
              onChange={(e) => {
                setClientId(e.target.value)
                setLines([])
              }}
            >
              <option value="">— choisir un client —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.company ?? `${c.firstName} ${c.lastName}`} · {c.firstName}{" "}
                  {c.lastName}
                </option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label className="field-label">Projet (optionnel)</label>
            <select
              className="select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              disabled={!clientId}
            >
              <option value="all">Tous les projets</option>
              {projects
                .filter((p) => p.clientId === clientId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field" style={{ width: 180 }}>
            <label className="field-label">Émise le</label>
            <input
              className="input"
              type="date"
              value={issueDate}
              onChange={(e) => setIssueDate(e.target.value)}
            />
          </div>
          <div className="field" style={{ width: 180 }}>
            <label className="field-label">Échéance</label>
            <input
              className="input"
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </div>
          <div className="field" style={{ width: 220 }}>
            <label className="field-label">Type</label>
            <div
              className="row gap-4"
              style={{
                background: "var(--bg-2)",
                borderRadius: 7,
                padding: 3,
                border: "1px solid var(--border)",
              }}
            >
              {(["STANDARD", "DEPOSIT"] as Kind[]).map((k) => (
                <button
                  key={k}
                  className="chip"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    background: kind === k ? "var(--accent)" : "transparent",
                    color: kind === k ? "var(--accent-text)" : "var(--text-1)",
                    border: "none",
                  }}
                  onClick={() => setKind(k)}
                >
                  {k === "STANDARD" ? "Standard" : "Acompte"}
                </button>
              ))}
            </div>
          </div>
        </div>
        {client && (
          <div
            className="row gap-12"
            style={{
              marginTop: 14,
              padding: 12,
              background: "var(--bg-2)",
              borderRadius: 8,
            }}
          >
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
              <div className="strong small">
                {client.firstName} {client.lastName} · {client.company ?? "—"}
              </div>
              <div className="muted xs">
                Type {client.billingMode.toLowerCase()} ·{" "}
                {client.billingMode === "DAILY"
                  ? `${client.rate}€/j`
                  : client.billingMode === "HOURLY"
                    ? `${client.rate}€/h`
                    : fmtEUR(client.fixedPrice)}
              </div>
            </div>
            <BillingTypePill type={client.billingMode} />
          </div>
        )}
      </div>

      {!clientId ? (
        <div className="card">
          <div className="empty">
            <div className="empty-title">Choisis un client pour commencer</div>
            <div>
              Les tasks éligibles apparaîtront à gauche, le récap de la facture
              à droite.
            </div>
          </div>
        </div>
      ) : kind === "DEPOSIT" ? (
        <div className="card" style={{ maxWidth: 600 }}>
          <div className="card-h2" style={{ marginBottom: 16 }}>
            Détails de l&apos;acompte
          </div>
          <div className="col gap-12">
            <div className="field">
              <label className="field-label">Description</label>
              <input
                className="input"
                value={depositLabel}
                onChange={(e) => setDepositLabel(e.target.value)}
              />
            </div>
            <div className="field">
              <label className="field-label">Montant (€)</label>
              <input
                className="input num"
                type="number"
                value={depositAmount}
                onChange={(e) => setDepositAmount(Number(e.target.value))}
              />
            </div>
            {client?.billingMode === "FIXED" && (
              <div
                className="row gap-8 small"
                style={{
                  padding: 10,
                  background: "var(--info-soft)",
                  borderRadius: 7,
                }}
              >
                <Icon name="info" size={14} style={{ color: "var(--info)" }} />
                <span>
                  Forfait projet : {fmtEUR(client.fixedPrice)}
                  {client.deposit
                    ? ` · acompte suggéré ${fmtEUR(client.deposit)}`
                    : ""}
                </span>
                {client.deposit && (
                  <button
                    className="btn btn-ghost btn-sm"
                    style={{ marginLeft: "auto" }}
                    onClick={() => setDepositAmount(client.deposit!)}
                  >
                    Utiliser
                  </button>
                )}
              </div>
            )}
          </div>
          <div className="divider" />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="strong">Total facture</span>
            <span className="num strong" style={{ fontSize: 22 }}>
              {fmtEUR(subtotal)}
            </span>
          </div>
          <div
            className="row gap-8"
            style={{ marginTop: 18, justifyContent: "flex-end" }}
          >
            <button
              className="btn btn-secondary"
              onClick={() => submit("DRAFT")}
              disabled={!subtotal || createInvoice.isPending}
            >
              Sauver brouillon
            </button>
            <button
              className="btn btn-primary"
              onClick={() => submit("SENT")}
              disabled={!subtotal || createInvoice.isPending}
            >
              <Icon name="send" size={14} />
              Créer et envoyer
            </button>
          </div>
        </div>
      ) : (
        <div className="builder">
          <div>
            <div className="card-title" style={{ marginBottom: 10 }}>
              <span>Tasks à facturer · {eligibleTasks.length}</span>
              <span className="xs muted">
                Glisse-déposer ou clique pour ajouter
              </span>
            </div>
            {eligibleTasks.length === 0 && lines.length === 0 && (
              <div className="card">
                <div className="empty">
                  <div className="empty-title">Aucune task à facturer</div>
                  <div>
                    Ce client n&apos;a pas de task en statut &quot;Pending
                    Invoice&quot;.
                  </div>
                </div>
              </div>
            )}
            <div>
              {eligibleTasks.map((t) => {
                const project = projects.find((p) => p.id === t.projectId)
                const value = client
                  ? lineFromTask({
                      billingMode: client.billingMode,
                      rate: client.rate,
                      estimateDays: t.estimate,
                    })
                  : { qty: 0, rate: 0 }
                return (
                  <div
                    key={t.id}
                    className="task-pickable"
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData("text/plain", t.id)
                      e.currentTarget.classList.add("dragging")
                    }}
                    onDragEnd={(e) =>
                      e.currentTarget.classList.remove("dragging")
                    }
                    onClick={() => addTask(t)}
                  >
                    <Icon name="grip" size={14} className="muted" />
                    <div>
                      <div className="row gap-8">
                        <span className="task-id">{t.linearIdentifier}</span>
                        <span className="strong small truncate">{t.title}</span>
                      </div>
                      <div className="xs muted" style={{ marginTop: 2 }}>
                        {project?.name ?? ""} · {t.estimate ?? "—"}j
                      </div>
                    </div>
                    <span className="num small">
                      {fmtEUR(value.qty * value.rate)}
                    </span>
                    <Icon name="plus" size={14} className="muted" />
                  </div>
                )
              })}
            </div>
          </div>

          <div className="invoice-side">
            <div className="card-h2" style={{ marginBottom: 14 }}>
              Aperçu facture
            </div>

            <div
              className={
                "dropzone" +
                (dragOver ? " over" : "") +
                (lines.length === 0 ? " empty" : "")
              }
              style={{ minHeight: lines.length === 0 ? 200 : "auto" }}
              onDragOver={(e) => {
                e.preventDefault()
                setDragOver(true)
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={(e) => {
                e.preventDefault()
                setDragOver(false)
                const tid = e.dataTransfer.getData("text/plain")
                const t = tasks.find((x) => x.id === tid)
                if (t) addTask(t)
              }}
            >
              {lines.length === 0 ? (
                <div>
                  <Icon name="plus" size={20} className="muted" />
                  <br />
                  <div style={{ marginTop: 6 }}>
                    Glisse une task ici
                    <br />
                    <span className="xs muted">
                      ou clique sur une task à gauche
                    </span>
                  </div>
                </div>
              ) : (
                <>
                  {lines.map((l) => (
                    <div key={l.id} className="line-item">
                      <Icon name="grip" size={12} className="muted" />
                      <div style={{ minWidth: 0 }}>
                        <input
                          className="input"
                          style={{ padding: "4px 7px", fontSize: 12 }}
                          value={l.label}
                          onChange={(e) =>
                            updateLine(l.id, { label: e.target.value })
                          }
                        />
                      </div>
                      <div className="row gap-4">
                        <input
                          type="number"
                          step="0.25"
                          value={l.qty}
                          onChange={(e) =>
                            updateLine(l.id, { qty: Number(e.target.value) })
                          }
                          title="Quantité"
                        />
                        <span className="muted xs">×</span>
                        <input
                          type="number"
                          value={l.rate}
                          onChange={(e) =>
                            updateLine(l.id, { rate: Number(e.target.value) })
                          }
                          title="Taux"
                        />
                      </div>
                      <button
                        className="line-remove"
                        onClick={() => removeLine(l.id)}
                      >
                        <Icon name="x" size={12} />
                      </button>
                    </div>
                  ))}
                </>
              )}
            </div>

            <button
              className="btn btn-ghost btn-sm"
              style={{ marginTop: 8 }}
              onClick={addBlank}
            >
              <Icon name="plus" size={12} />
              Ligne personnalisée
            </button>

            <div className="divider" />
            <div className="col gap-4">
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted small">Sous-total</span>
                <span className="num">{fmtEURprecise(subtotal)}</span>
              </div>
              <div className="row" style={{ justifyContent: "space-between" }}>
                <span className="muted small">TVA (0%)</span>
                <span className="num muted">—</span>
              </div>
              <div
                className="row"
                style={{
                  justifyContent: "space-between",
                  marginTop: 8,
                  paddingTop: 10,
                  borderTop: "1px solid var(--border)",
                }}
              >
                <span className="strong">Total</span>
                <span className="num strong" style={{ fontSize: 22 }}>
                  {fmtEURprecise(subtotal)}
                </span>
              </div>
            </div>

            <div className="col gap-8" style={{ marginTop: 18 }}>
              <button
                className="btn btn-primary"
                disabled={lines.length === 0 || createInvoice.isPending}
                onClick={() => submit("SENT")}
              >
                <Icon name="send" size={14} />
                Créer et envoyer
              </button>
              <button
                className="btn btn-secondary"
                disabled={lines.length === 0 || createInvoice.isPending}
                onClick={() => submit("DRAFT")}
              >
                Sauver en brouillon
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
