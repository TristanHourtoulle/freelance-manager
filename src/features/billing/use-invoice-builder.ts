"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  buildLinesPayload,
  buildTaskIds,
  buildTaskLine,
  computeEffectiveTotal,
  computeSubtotal,
  filterEligibleTasks,
  type BuilderLine,
} from "@/domain/billing/builder"
import type { InvoiceKind } from "@/domain/billing/types"
import type { InvoiceCreateInput } from "@/lib/schemas/invoice"
import { useClients } from "@/hooks/use-clients"
import { useTasks, type TaskDTO } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-projects"
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/use-invoices"
import { useSplitInvoice } from "@/hooks/use-invoice-split"
import { useToast } from "@/components/providers/toast-provider"
import type {
  BuilderBase,
  CreateBuilderArgs,
  CreateInvoiceBuilder,
  CreateStatus,
  EditBuilderArgs,
  EditInvoiceBuilder,
  EditStatus,
  SplitSchedule,
} from "@/features/billing/invoice-builder-types"

export type {
  CreateBuilderArgs,
  CreateInvoiceBuilder,
  EditBuilderArgs,
  EditInvoiceBuilder,
  InvoiceBuilder,
} from "@/features/billing/invoice-builder-types"

function newLineId(): string {
  return "L" + Math.random().toString(36).slice(2, 8)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

function plusDaysIso(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() + days)
  return d.toISOString().slice(0, 10)
}

export function useInvoiceBuilder(args: CreateBuilderArgs): CreateInvoiceBuilder
export function useInvoiceBuilder(args: EditBuilderArgs): EditInvoiceBuilder
export function useInvoiceBuilder(
  args: CreateBuilderArgs | EditBuilderArgs,
): CreateInvoiceBuilder | EditInvoiceBuilder {
  const router = useRouter()
  const { toast } = useToast()

  const { data: clients = [] } = useClients()
  const { data: tasks = [] } = useTasks()
  const { data: projects = [] } = useProjects()

  const createInvoice = useCreateInvoice()
  const splitInvoice = useSplitInvoice()
  const editInvoiceId = args.mode === "edit" ? args.invoice.id : ""
  const updateInvoice = useUpdateInvoice(editInvoiceId)

  const isEdit = args.mode === "edit"
  const editInvoice = isEdit ? args.invoice : null

  const [pickedClientId, setPickedClientId] = useState(
    args.mode === "create" ? args.initialClientId : "",
  )
  const [projectId, setProjectId] = useState<string>(
    editInvoice?.projectId ?? "all",
  )
  const [taskSearch, setTaskSearch] = useState("")
  const [issueDate, setIssueDate] = useState(() =>
    editInvoice ? editInvoice.issueDate.slice(0, 10) : todayIso(),
  )
  const [dueDate, setDueDate] = useState(() =>
    editInvoice ? editInvoice.dueDate.slice(0, 10) : plusDaysIso(30),
  )
  const [kind, setKind] = useState<InvoiceKind>(editInvoice?.kind ?? "STANDARD")
  const [customNumber, setCustomNumber] = useState(editInvoice?.number ?? "")

  const initialDeposit =
    editInvoice && editInvoice.kind === "DEPOSIT" && editInvoice.lines[0]
      ? {
          label: editInvoice.lines[0].label,
          amount:
            Number(editInvoice.lines[0].rate) *
            Number(editInvoice.lines[0].qty),
        }
      : { label: "Acompte 30%", amount: 0 }
  const [depositLabel, setDepositLabel] = useState(initialDeposit.label)
  const [depositAmount, setDepositAmount] = useState<number>(
    initialDeposit.amount,
  )

  const [lines, setLines] = useState<BuilderLine[]>(() =>
    editInvoice && editInvoice.kind !== "DEPOSIT"
      ? editInvoice.lines.map((l) => ({
          id: l.id,
          taskId: l.taskId,
          label: l.label,
          qty: l.qty,
          rate: l.rate,
        }))
      : [],
  )
  const [dragOver, setDragOver] = useState(false)
  const [useTotalOverride, setUseTotalOverride] = useState(
    editInvoice ? editInvoice.totalOverride != null : false,
  )
  const [totalOverride, setTotalOverride] = useState<number>(
    editInvoice?.totalOverride ?? 0,
  )

  const [initialStatus, setInitialStatus] = useState<CreateStatus>("DRAFT")
  const [markPaid, setMarkPaid] = useState(false)
  const [paidAt, setPaidAt] = useState(() => todayIso())
  const [showSplit, setShowSplit] = useState(false)
  const [status, setStatus] = useState<EditStatus>(
    editInvoice?.status ?? "DRAFT",
  )

  const clientById = useMemo(
    () => new Map(clients.map((c) => [c.id, c])),
    [clients],
  )
  const projectById = useMemo(
    () => new Map(projects.map((p) => [p.id, p])),
    [projects],
  )

  const clientId = isEdit
    ? (editInvoice?.clientId ?? "")
    : pickedClientId || clients[0]?.id || ""
  const client = clientById.get(clientId)

  const preselectedTaskIds =
    args.mode === "create" ? args.preselectedTaskIds : undefined

  useEffect(() => {
    if (isEdit) return
    if (!client || !preselectedTaskIds || preselectedTaskIds.length === 0)
      return
    const seeded: BuilderLine[] = []
    for (const tid of preselectedTaskIds) {
      const t = tasks.find((x) => x.id === tid)
      if (!t) continue
      seeded.push(buildTaskLine(newLineId(), client, t))
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLines(seeded)
  }, [isEdit, client, preselectedTaskIds, tasks])

  const eligibleTasks = useMemo(
    () =>
      filterEligibleTasks(tasks, {
        clientId,
        lines,
        projectId,
        search: taskSearch,
        excludeInvoiceId: editInvoice?.id,
      }),
    [tasks, clientId, lines, projectId, taskSearch, editInvoice],
  )

  const subtotal = computeSubtotal({ kind, lines, depositAmount })
  const effectiveTotal = computeEffectiveTotal({
    kind,
    lines,
    depositAmount,
    useTotalOverride,
    totalOverride,
  })

  function addTask(task: TaskDTO) {
    if (!client) return
    setLines((cur) => [...cur, buildTaskLine(newLineId(), client, task)])
  }
  function addTaskById(taskId: string) {
    const t = tasks.find((x) => x.id === taskId)
    if (t) addTask(t)
  }
  function addBlank() {
    setLines((cur) => [
      ...cur,
      {
        id: newLineId(),
        taskId: null,
        label: "Ligne personnalisée",
        qty: 1,
        rate: 0,
      },
    ])
  }
  function updateLine(id: string, patch: Partial<BuilderLine>) {
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function removeLine(id: string) {
    setLines((cur) => cur.filter((l) => l.id !== id))
  }
  function setTotalOverrideValue(amount: number) {
    setUseTotalOverride(true)
    setTotalOverride(amount)
  }
  function clearTotalOverride() {
    setUseTotalOverride(false)
    setTotalOverride(0)
  }

  const base: BuilderBase = {
    clients,
    projects,
    tasks,
    client,
    clientId,
    projectId,
    setProjectId,
    taskSearch,
    setTaskSearch,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate,
    kind,
    setKind,
    customNumber,
    setCustomNumber,
    depositLabel,
    setDepositLabel,
    depositAmount,
    setDepositAmount,
    lines,
    useTotalOverride,
    totalOverride,
    setTotalOverrideValue,
    clearTotalOverride,
    dragOver,
    setDragOver,
    projectById,
    eligibleTasks,
    subtotal,
    effectiveTotal,
    addTask,
    addTaskById,
    addBlank,
    updateLine,
    removeLine,
  }

  function buildCreatePayload(target: CreateStatus): InvoiceCreateInput | null {
    if (!client) return null
    return {
      clientId: client.id,
      projectId: projectId !== "all" ? projectId : null,
      number: customNumber.trim() || undefined,
      issueDate,
      dueDate,
      kind,
      status: target,
      totalOverride: useTotalOverride ? Number(totalOverride) || 0 : null,
      lines: buildLinesPayload({ kind, lines, depositLabel, depositAmount }),
      taskIds: buildTaskIds(kind, lines),
      initialPayment:
        markPaid && effectiveTotal > 0
          ? { amount: effectiveTotal, paidAt, method: null, note: null }
          : null,
    }
  }

  if (args.mode === "create") {
    const selectClient = (id: string) => {
      setPickedClientId(id)
      setLines([])
    }

    const submit = (target: CreateStatus) => {
      const payload = buildCreatePayload(target)
      if (!payload) return
      createInvoice.mutate(payload, {
        onSuccess: (created) => {
          toast({
            variant: "success",
            title:
              target === "DRAFT"
                ? "Brouillon créé"
                : markPaid
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

    const doSplit = (parts: number, schedule: SplitSchedule) => {
      const payload = buildCreatePayload(initialStatus)
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

    return {
      ...base,
      mode: "create",
      selectClient,
      initialStatus,
      setInitialStatus,
      markPaid,
      setMarkPaid,
      paidAt,
      setPaidAt,
      showSplit,
      setShowSplit,
      isPending: createInvoice.isPending,
      isSplitPending: splitInvoice.isPending,
      submit,
      doSplit,
    }
  }

  const invoice = args.invoice

  const save = (target: EditStatus) => {
    if (!client) return
    updateInvoice.mutate(
      {
        projectId: projectId !== "all" ? projectId : null,
        number: customNumber.trim() || undefined,
        issueDate,
        dueDate,
        kind,
        status: target,
        totalOverride: useTotalOverride ? Number(totalOverride) || 0 : null,
        lines: buildLinesPayload({ kind, lines, depositLabel, depositAmount }),
        taskIds: buildTaskIds(kind, lines),
      },
      {
        onSuccess: () => {
          toast({ variant: "success", title: "Facture mise à jour" })
          router.push(`/billing?invoiceId=${invoice.id}`)
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

  return {
    ...base,
    mode: "edit",
    invoice,
    status,
    setStatus,
    hasPayments: invoice.paidAmount > 0,
    isPending: updateInvoice.isPending,
    save,
  }
}
