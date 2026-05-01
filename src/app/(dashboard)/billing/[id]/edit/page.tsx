"use client"

import { use, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { Icon } from "@/components/ui/icon"
import { BillingTypePill } from "@/components/ui/pill"
import { fmtEUR, fmtEURprecise, initials, avatarColor } from "@/lib/format"
import { lineFromTask, sumLines } from "@/lib/billing-math"
import { useClients } from "@/hooks/use-clients"
import { useTasks } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-projects"
import { useInvoice, useUpdateInvoice } from "@/hooks/use-invoices"
import { useToast } from "@/components/providers/toast-provider"
import { EditableTotal } from "@/components/billing/editable-total"

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

interface PageProps {
  params: Promise<{ id: string }>
}

export default function EditInvoicePage({ params }: PageProps) {
  const { id } = use(params)
  const router = useRouter()
  const { toast } = useToast()

  const { data: invoice, isLoading } = useInvoice(id)
  const { data: clients = [] } = useClients()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const updateInvoice = useUpdateInvoice(id)

  const [projectId, setProjectId] = useState<string>("all")
  const [issueDate, setIssueDate] = useState("")
  const [dueDate, setDueDate] = useState("")
  const [status, setStatus] = useState<"DRAFT" | "SENT" | "CANCELLED">("DRAFT")
  const [kind, setKind] = useState<Kind>("STANDARD")
  const [depositLabel, setDepositLabel] = useState("Acompte 30%")
  const [depositAmount, setDepositAmount] = useState<number>(0)
  const [lines, setLines] = useState<Line[]>([])
  const [taskSearch, setTaskSearch] = useState("")
  const [dragOver, setDragOver] = useState(false)
  const [hydrated, setHydrated] = useState(false)
  const [customNumber, setCustomNumber] = useState("")
  const [useTotalOverride, setUseTotalOverride] = useState(false)
  const [totalOverride, setTotalOverride] = useState<number>(0)

  useEffect(() => {
    if (!invoice || hydrated) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjectId(invoice.projectId ?? "all")
    setIssueDate(invoice.issueDate.slice(0, 10))
    setDueDate(invoice.dueDate.slice(0, 10))
    setStatus(invoice.status)
    setKind(invoice.kind)
    setCustomNumber(invoice.number)
    if (invoice.totalOverride != null) {
      setUseTotalOverride(true)
      setTotalOverride(invoice.totalOverride)
    }
    if (invoice.kind === "DEPOSIT" && invoice.lines[0]) {
      setDepositLabel(invoice.lines[0].label)
      setDepositAmount(
        Number(invoice.lines[0].rate) * Number(invoice.lines[0].qty),
      )
    } else {
      setLines(
        invoice.lines.map((l) => ({
          id: l.id,
          taskId: l.taskId,
          label: l.label,
          qty: l.qty,
          rate: l.rate,
        })),
      )
    }
    setHydrated(true)
  }, [invoice, hydrated])

  const client = invoice
    ? clients.find((c) => c.id === invoice.clientId)
    : undefined

  const eligibleTasks = useMemo(() => {
    if (!client || !invoice) return []
    const q = taskSearch.trim().toLowerCase()
    const ownIds = new Set(lines.map((l) => l.taskId).filter(Boolean))
    return tasks.filter((t) => {
      if (t.clientId !== client.id) return false
      if (t.status !== "PENDING_INVOICE" && !ownIds.has(t.id)) return false
      if (t.invoiceId && t.invoiceId !== invoice.id) return false
      if (ownIds.has(t.id)) return false
      if (projectId !== "all" && t.projectId !== projectId) return false
      if (q && !`${t.linearIdentifier} ${t.title}`.toLowerCase().includes(q))
        return false
      return true
    })
  }, [client, invoice, tasks, lines, projectId, taskSearch])

  if (isLoading || !invoice) {
    return (
      <div className="page">
        <div className="empty">Chargement…</div>
      </div>
    )
  }

  if (
    invoice.paymentStatus === "PAID" ||
    invoice.paymentStatus === "OVERPAID"
  ) {
    return (
      <div className="page">
        <div className="empty">
          <div className="empty-title">Facture entièrement payée</div>
          <div>
            Pour modifier le contenu, supprime d&apos;abord les paiements
            associés depuis le drawer.
          </div>
          <button
            className="btn btn-primary"
            style={{ marginTop: 16 }}
            onClick={() => router.push(`/billing?invoiceId=${id}`)}
          >
            Retour
          </button>
        </div>
      </div>
    )
  }

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

  function updateLine(lineId: string, patch: Partial<Line>) {
    setLines((cur) =>
      cur.map((l) => (l.id === lineId ? { ...l, ...patch } : l)),
    )
  }
  function removeLine(lineId: string) {
    setLines((cur) => cur.filter((l) => l.id !== lineId))
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
  const effectiveTotal = useTotalOverride
    ? Number(totalOverride) || 0
    : subtotal

  function save(targetStatus: "DRAFT" | "SENT" | "CANCELLED") {
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

    updateInvoice.mutate(
      {
        projectId: projectId !== "all" ? projectId : null,
        number: customNumber.trim() || undefined,
        issueDate,
        dueDate,
        kind,
        status: targetStatus,
        totalOverride: useTotalOverride ? Number(totalOverride) || 0 : null,
        lines: linesPayload,
        taskIds:
          kind === "STANDARD"
            ? lines.map((l) => l.taskId).filter((x): x is string => Boolean(x))
            : [],
      },
      {
        onSuccess: () => {
          toast({ variant: "success", title: "Facture mise à jour" })
          router.push(`/billing?invoiceId=${id}`)
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
          onClick={() => router.push(`/billing?invoiceId=${id}`)}
        >
          <Icon name="chevron-left" size={12} />
          Facture
        </button>
      </div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Modifier {invoice.number}</h1>
          <div className="page-sub">
            Édite les dates, lignes ou tasks de la facture
          </div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="row gap-16" style={{ flexWrap: "wrap" }}>
          <div className="field" style={{ flex: 1, minWidth: 260 }}>
            <label className="field-label">Client</label>
            <input
              className="input"
              value={
                client
                  ? `${client.company ?? `${client.firstName} ${client.lastName}`}`
                  : "—"
              }
              disabled
            />
          </div>
          <div className="field" style={{ flex: 1, minWidth: 220 }}>
            <label className="field-label">Projet (optionnel)</label>
            <select
              className="select"
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
            >
              <option value="all">Tous les projets</option>
              {projects
                .filter((p) => p.clientId === invoice.clientId)
                .map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
            </select>
          </div>
          <div className="field" style={{ width: 200 }}>
            <label className="field-label">Numéro</label>
            <input
              className="input mono"
              value={customNumber}
              onChange={(e) => setCustomNumber(e.target.value)}
            />
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
          <div className="field" style={{ width: 320 }}>
            <label className="field-label">Statut</label>
            <div
              className="row gap-4"
              style={{
                background: "var(--bg-2)",
                borderRadius: 7,
                padding: 3,
                border: "1px solid var(--border)",
              }}
            >
              {(
                [
                  { id: "DRAFT", label: "Brouillon" },
                  { id: "SENT", label: "Émise" },
                  { id: "CANCELLED", label: "Annulée" },
                ] as {
                  id: "DRAFT" | "SENT" | "CANCELLED"
                  label: string
                }[]
              ).map((s) => (
                <button
                  key={s.id}
                  className="chip"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    background:
                      status === s.id ? "var(--accent)" : "transparent",
                    color:
                      status === s.id ? "var(--accent-text)" : "var(--text-1)",
                    border: "none",
                  }}
                  onClick={() => setStatus(s.id)}
                >
                  {s.label}
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

      {kind === "DEPOSIT" ? (
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
          </div>
          <div className="divider" />
          <div className="row" style={{ justifyContent: "space-between" }}>
            <span className="strong">Total facture</span>
            <span className="num strong" style={{ fontSize: 22 }}>
              {fmtEUR(effectiveTotal)}
            </span>
          </div>
          <div
            className="row gap-8"
            style={{ marginTop: 18, justifyContent: "flex-end" }}
          >
            <button
              className="btn btn-primary"
              onClick={() => save(status)}
              disabled={!subtotal || updateInvoice.isPending}
            >
              <Icon name="check" size={14} />
              Sauver les modifications
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
            <div style={{ position: "relative", marginBottom: 12 }}>
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
                value={taskSearch}
                onChange={(e) => setTaskSearch(e.target.value)}
              />
            </div>
            <div
              style={{
                maxHeight: "calc(100vh - 360px)",
                overflowY: "auto",
                paddingRight: 6,
              }}
            >
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
                      {useTotalOverride ? "" : fmtEUR(value.qty * value.rate)}
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
                    <div
                      key={l.id}
                      className="line-item"
                      style={
                        useTotalOverride
                          ? { gridTemplateColumns: "auto 1fr auto" }
                          : undefined
                      }
                    >
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
                      {!useTotalOverride && (
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
                              updateLine(l.id, {
                                rate: Number(e.target.value),
                              })
                            }
                            title="Taux"
                          />
                        </div>
                      )}
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
                <EditableTotal
                  value={effectiveTotal}
                  hasOverride={useTotalOverride}
                  onSet={(amount) => {
                    setUseTotalOverride(true)
                    setTotalOverride(amount)
                  }}
                  onClear={() => {
                    setUseTotalOverride(false)
                    setTotalOverride(0)
                  }}
                />
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
                  {fmtEURprecise(effectiveTotal)}
                </span>
              </div>
              {useTotalOverride && (
                <div
                  className="muted xs"
                  style={{ marginTop: 4, fontStyle: "italic" }}
                >
                  Forfait — les prix par ligne sont masqués.
                </div>
              )}
            </div>

            <div className="col gap-8" style={{ marginTop: 18 }}>
              <button
                className="btn btn-primary"
                disabled={lines.length === 0 || updateInvoice.isPending}
                onClick={() => save(status)}
              >
                <Icon name="check" size={14} />
                Sauver les modifications
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
