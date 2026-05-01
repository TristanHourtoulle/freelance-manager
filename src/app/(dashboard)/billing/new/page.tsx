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
import { useSplitInvoice } from "@/hooks/use-invoice-split"
import { useToast } from "@/components/providers/toast-provider"
import { SplitDialog } from "@/components/billing/split-dialog"
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

export default function NewInvoicePage() {
  const router = useRouter()
  const search = useSearchParams()
  const taskIdsParam = search.get("taskIds") ?? ""
  const preselectedTaskIds = useMemo(
    () => taskIdsParam.split(",").filter(Boolean),
    [taskIdsParam],
  )
  const initialClientId = search.get("clientId") ?? ""

  const [clientId, setClientId] = useState(initialClientId)
  const [projectId, setProjectId] = useState<string>("all")
  const [taskSearch, setTaskSearch] = useState("")
  const [issueDate, setIssueDate] = useState(
    new Date().toISOString().slice(0, 10),
  )
  const [dueDate, setDueDate] = useState(() => {
    const d = new Date()
    d.setDate(d.getDate() + 30)
    return d.toISOString().slice(0, 10)
  })
  const [kind, setKind] = useState<Kind>("STANDARD")
  const [initialStatus, setInitialStatus] = useState<"DRAFT" | "SENT" | "PAID">(
    "DRAFT",
  )
  const [paidAt, setPaidAt] = useState(new Date().toISOString().slice(0, 10))
  const [depositLabel, setDepositLabel] = useState("Acompte 30%")
  const [depositAmount, setDepositAmount] = useState<number>(0)
  const [lines, setLines] = useState<Line[]>([])
  const [dragOver, setDragOver] = useState(false)
  const [customNumber, setCustomNumber] = useState("")
  const [useTotalOverride, setUseTotalOverride] = useState(false)
  const [totalOverride, setTotalOverride] = useState<number>(0)
  const [showSplit, setShowSplit] = useState(false)

  const { data: clients = [] } = useClients()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()
  const createInvoice = useCreateInvoice()
  const splitInvoice = useSplitInvoice()
  const { toast } = useToast()

  const client = clients.find((c) => c.id === clientId)

  useEffect(() => {
    if (clientId) return
    const first = clients[0]
    if (!first) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setClientId(first.id)
  }, [clientId, clients])

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
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(newLines)
  }, [client, preselectedTaskIds, tasks])

  const eligibleTasks = useMemo(() => {
    if (!clientId) return []
    const q = taskSearch.trim().toLowerCase()
    return tasks.filter((t) => {
      if (t.clientId !== clientId) return false
      if (t.status !== "PENDING_INVOICE") return false
      if (t.invoiceId) return false
      if (lines.some((l) => l.taskId === t.id)) return false
      if (projectId !== "all" && t.projectId !== projectId) return false
      if (q && !`${t.linearIdentifier} ${t.title}`.toLowerCase().includes(q))
        return false
      return true
    })
  }, [clientId, tasks, lines, projectId, taskSearch])

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
  const effectiveTotal = useTotalOverride
    ? Number(totalOverride) || 0
    : subtotal

  function buildPayload(status: "DRAFT" | "SENT" | "PAID") {
    if (!client) return null
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
    return {
      clientId: client.id,
      projectId: projectId !== "all" ? projectId : null,
      number: customNumber.trim() || undefined,
      issueDate,
      dueDate,
      paidAt: status === "PAID" ? paidAt : null,
      kind,
      status,
      totalOverride: useTotalOverride ? Number(totalOverride) || 0 : null,
      lines: linesPayload,
      taskIds:
        kind === "STANDARD"
          ? lines.map((l) => l.taskId).filter((x): x is string => Boolean(x))
          : [],
    }
  }

  function submit(status: "DRAFT" | "SENT" | "PAID") {
    const payload = buildPayload(status)
    if (!payload) return
    createInvoice.mutate(payload, {
      onSuccess: (created) => {
        toast({
          variant: "success",
          title:
            status === "DRAFT"
              ? "Brouillon créé"
              : status === "PAID"
                ? "Facture créée et payée"
                : "Facture émise",
        })
        router.push(`/billing?invoiceId=${created.id}`)
      },
      onError: (e) =>
        toast({
          variant: "error",
          title: "Erreur",
          description: e instanceof Error ? e.message : String(e),
        }),
    })
  }

  function doSplit(parts: number, schedule: "MONTHLY" | "WEEKLY" | "ONCE") {
    const payload = buildPayload(initialStatus)
    if (!payload) return
    splitInvoice.mutate(
      { parts, schedule, base: payload },
      {
        onSuccess: (r) => {
          toast({
            variant: "success",
            title: `${r.items.length} factures créées`,
            description: `Total réparti : ${effectiveTotal} € en ${r.items.length} parts`,
          })
          setShowSplit(false)
          router.push("/billing")
        },
        onError: (e) =>
          toast({
            variant: "error",
            title: "Split échoué",
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
            Sélectionne un client, puis glisse des tasks Linear ou ajoute des
            lignes manuelles (utile pour la facturation rétroactive)
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
          <div className="field" style={{ width: 200 }}>
            <label className="field-label">
              Numéro <span className="muted xs">— auto si vide</span>
            </label>
            <input
              className="input mono"
              placeholder="2026-1042"
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
          <div className="field" style={{ width: 280 }}>
            <label className="field-label">Statut initial</label>
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
                  { id: "PAID", label: "Payée" },
                ] as { id: "DRAFT" | "SENT" | "PAID"; label: string }[]
              ).map((s) => (
                <button
                  key={s.id}
                  className="chip"
                  style={{
                    flex: 1,
                    justifyContent: "center",
                    background:
                      initialStatus === s.id ? "var(--accent)" : "transparent",
                    color:
                      initialStatus === s.id
                        ? "var(--accent-text)"
                        : "var(--text-1)",
                    border: "none",
                  }}
                  onClick={() => setInitialStatus(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
          {initialStatus === "PAID" && (
            <div className="field" style={{ width: 180 }}>
              <label className="field-label">Date de paiement</label>
              <input
                className="input"
                type="date"
                value={paidAt}
                onChange={(e) => setPaidAt(e.target.value)}
              />
            </div>
          )}
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
              {fmtEUR(effectiveTotal)}
            </span>
          </div>
          <div
            className="row gap-8"
            style={{ marginTop: 18, justifyContent: "space-between" }}
          >
            <button
              className="btn btn-secondary"
              disabled={!effectiveTotal || createInvoice.isPending}
              onClick={() => setShowSplit(true)}
            >
              <Icon name="grid" size={14} />
              Diviser en plusieurs
            </button>
            <button
              className="btn btn-primary"
              onClick={() => submit(initialStatus)}
              disabled={!effectiveTotal || createInvoice.isPending}
            >
              <Icon name="check" size={14} />
              {initialStatus === "DRAFT"
                ? "Sauver le brouillon"
                : initialStatus === "SENT"
                  ? "Émettre la facture"
                  : "Créer la facture (payée)"}
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
            {eligibleTasks.length === 0 && lines.length === 0 && (
              <div className="card">
                <div className="empty">
                  <div className="empty-title">Aucune task à facturer</div>
                  <div>
                    {taskSearch
                      ? "Aucune task ne correspond à ta recherche."
                      : "Ce client n'a pas de task en statut Pending Invoice. Tu peux quand même créer une facture en ajoutant des lignes manuelles."}
                  </div>
                  {!taskSearch && (
                    <button
                      className="btn btn-secondary"
                      style={{ marginTop: 14 }}
                      onClick={addBlank}
                    >
                      <Icon name="plus" size={14} />
                      Ajouter une ligne manuelle
                    </button>
                  )}
                </div>
              </div>
            )}
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
              style={{
                minHeight: lines.length === 0 ? 200 : "auto",
                maxHeight: lines.length > 0 ? "calc(100vh - 480px)" : undefined,
                overflowY: lines.length > 0 ? "auto" : undefined,
              }}
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
                      ou ajoute une ligne manuelle ci-dessous
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
              className="btn btn-secondary"
              style={{ marginTop: 10, width: "100%", justifyContent: "center" }}
              onClick={addBlank}
            >
              <Icon name="plus" size={14} />
              Ajouter une ligne manuelle
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
                disabled={lines.length === 0 || createInvoice.isPending}
                onClick={() => submit(initialStatus)}
              >
                <Icon name="check" size={14} />
                {initialStatus === "DRAFT"
                  ? "Sauver le brouillon"
                  : initialStatus === "SENT"
                    ? "Émettre la facture"
                    : "Créer la facture (payée)"}
              </button>
              <button
                className="btn btn-secondary"
                disabled={!effectiveTotal || createInvoice.isPending}
                onClick={() => setShowSplit(true)}
              >
                <Icon name="grid" size={14} />
                Diviser en plusieurs
              </button>
            </div>
          </div>
        </div>
      )}

      {showSplit && (
        <SplitDialog
          total={effectiveTotal}
          initialIssueDate={issueDate}
          initialDueDate={dueDate}
          isPending={splitInvoice.isPending}
          onClose={() => setShowSplit(false)}
          onConfirm={(parts, schedule) => doSplit(parts, schedule)}
        />
      )}
    </div>
  )
}
