"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import {
  buildLinesPayload,
  buildTaskIds,
  buildTaskLine,
  computeEffectiveTotal,
  computeSubtotal,
  filterEligibleTasks,
  type BuilderLine,
  type BuilderTaskGroup,
} from "@/domain/billing/builder"
import type { InvoiceDetail, InvoiceKind } from "@/domain/billing/types"
import type { InvoiceCreateInput } from "@/lib/schemas/invoice"
import { useClients } from "@/hooks/use-clients"
import { useTasks, type TaskDTO } from "@/hooks/use-tasks"
import { useProjects } from "@/hooks/use-projects"
import { useSettings } from "@/hooks/use-settings"
import { useCreateInvoice, useUpdateInvoice } from "@/hooks/use-invoices"
import { useSplitInvoice } from "@/hooks/use-invoice-split"
import { useTaskGroups, type TaskGroupDTO } from "@/hooks/use-task-groups"
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

const FALLBACK_PAYMENT_DAYS = 30

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

type EditSyncField =
  | "projectId"
  | "issueDate"
  | "dueDate"
  | "kind"
  | "customNumber"
  | "status"
  | "depositLabel"
  | "depositAmount"
  | "lines"
  | "totalOverride"

interface DepositDraft {
  label: string
  amount: number
}

function depositFromInvoice(invoice: InvoiceDetail | null): DepositDraft {
  const line = invoice?.kind === "DEPOSIT" ? invoice.lines[0] : undefined
  if (!line) return { label: "Acompte 30%", amount: 0 }
  return { label: line.label, amount: Number(line.rate) * Number(line.qty) }
}

function linesFromInvoice(invoice: InvoiceDetail | null): BuilderLine[] {
  if (!invoice || invoice.kind === "DEPOSIT") return []
  return invoice.lines.map((l) => ({
    id: l.id,
    taskId: l.taskId,
    taskGroupId: l.taskGroupId ?? null,
    label: l.label,
    qty: l.qty,
    rate: l.rate,
  }))
}

function groupsFromInvoice(invoice: InvoiceDetail | null): BuilderTaskGroup[] {
  return (
    invoice?.taskGroups?.map((group) => ({
      id: group.id,
      name: group.name,
    })) ?? []
  )
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
  const { data: settings } = useSettings()
  const { data: pendingTaskGroups = [], isPending: taskGroupsPending } =
    useTaskGroups({ status: "pending" })

  const createInvoice = useCreateInvoice()
  const splitInvoice = useSplitInvoice()
  const editInvoiceId = args.mode === "edit" ? args.invoice.id : ""
  const updateInvoice = useUpdateInvoice(editInvoiceId)

  const isEdit = args.mode === "edit"
  const editInvoice = isEdit ? args.invoice : null

  const [pickedClientId, setPickedClientId] = useState(
    args.mode === "create" ? args.initialClientId : "",
  )
  const [projectId, setProjectIdState] = useState<string>(
    editInvoice?.projectId ?? "all",
  )
  const [taskSearch, setTaskSearch] = useState("")
  const [issueDate, setIssueDateState] = useState(() =>
    editInvoice ? editInvoice.issueDate.slice(0, 10) : todayIso(),
  )
  const [dueDate, setDueDate] = useState(() =>
    editInvoice
      ? editInvoice.dueDate.slice(0, 10)
      : plusDaysIso(FALLBACK_PAYMENT_DAYS),
  )
  const [kind, setKindState] = useState<InvoiceKind>(
    editInvoice?.kind ?? "STANDARD",
  )
  const [customNumber, setCustomNumberState] = useState(
    editInvoice?.number ?? "",
  )

  const initialDeposit = depositFromInvoice(editInvoice)
  const [depositLabel, setDepositLabelState] = useState(initialDeposit.label)
  const [depositAmount, setDepositAmountState] = useState<number>(
    initialDeposit.amount,
  )

  const [lines, setLines] = useState<BuilderLine[]>(() =>
    linesFromInvoice(editInvoice),
  )
  const [groups, setGroups] = useState<BuilderTaskGroup[]>(() =>
    groupsFromInvoice(editInvoice),
  )
  const [dragOver, setDragOver] = useState(false)
  const [useTotalOverride, setUseTotalOverrideState] = useState(
    editInvoice ? editInvoice.totalOverride != null : false,
  )
  const [totalOverride, setTotalOverrideState] = useState<number>(
    editInvoice?.totalOverride ?? 0,
  )

  const [initialStatus, setInitialStatus] = useState<CreateStatus>("SENT")
  const [markPaid, setMarkPaid] = useState(false)
  const [paidAt, setPaidAt] = useState(() => todayIso())
  const [showSplit, setShowSplit] = useState(false)
  const [status, setStatusState] = useState<EditStatus>(
    editInvoice?.status ?? "DRAFT",
  )

  const dueDateEditedRef = useRef(false)
  const defaultDueDateAppliedRef = useRef(false)
  const dirtyFieldsRef = useRef<Set<EditSyncField>>(new Set())
  const syncedInvoiceIdRef = useRef<string | undefined>(editInvoice?.id)

  function markFieldDirty(field: EditSyncField): void {
    dirtyFieldsRef.current.add(field)
  }

  function setProjectId(value: string): void {
    markFieldDirty("projectId")
    setProjectIdState(value)
  }
  function setIssueDate(value: string): void {
    markFieldDirty("issueDate")
    setIssueDateState(value)
  }
  function setKind(value: InvoiceKind): void {
    markFieldDirty("kind")
    setKindState(value)
  }
  function setCustomNumber(value: string): void {
    markFieldDirty("customNumber")
    setCustomNumberState(value)
  }
  function setStatus(value: EditStatus): void {
    markFieldDirty("status")
    setStatusState(value)
  }
  function setDepositLabel(value: string): void {
    markFieldDirty("depositLabel")
    setDepositLabelState(value)
  }
  function setDepositAmount(value: number): void {
    markFieldDirty("depositAmount")
    setDepositAmountState(value)
  }

  const setDueDateValue = useCallback((value: string) => {
    dueDateEditedRef.current = true
    markFieldDirty("dueDate")
    setDueDate(value)
  }, [])

  const defaultPaymentDays = settings?.defaultPaymentDays

  useEffect(() => {
    if (isEdit || defaultPaymentDays == null) return
    if (defaultDueDateAppliedRef.current || dueDateEditedRef.current) return
    defaultDueDateAppliedRef.current = true
    if (defaultPaymentDays === FALLBACK_PAYMENT_DAYS) return
    setDueDate(plusDaysIso(defaultPaymentDays))
  }, [isEdit, defaultPaymentDays])

  useEffect(() => {
    if (!isEdit || !editInvoice) return
    const dirty = dirtyFieldsRef.current
    if (editInvoice.id !== syncedInvoiceIdRef.current) {
      dirty.clear()
      syncedInvoiceIdRef.current = editInvoice.id
    }

    if (!dirty.has("projectId"))
      setProjectIdState(editInvoice.projectId ?? "all")
    if (!dirty.has("issueDate"))
      setIssueDateState(editInvoice.issueDate.slice(0, 10))
    if (!dirty.has("dueDate")) setDueDate(editInvoice.dueDate.slice(0, 10))
    if (!dirty.has("kind")) setKindState(editInvoice.kind)
    if (!dirty.has("customNumber")) setCustomNumberState(editInvoice.number)
    if (!dirty.has("status")) setStatusState(editInvoice.status)

    const deposit = depositFromInvoice(editInvoice)
    if (!dirty.has("depositLabel")) setDepositLabelState(deposit.label)
    if (!dirty.has("depositAmount")) setDepositAmountState(deposit.amount)

    if (!dirty.has("lines")) {
      setLines(linesFromInvoice(editInvoice))
      setGroups(groupsFromInvoice(editInvoice))
    }

    if (!dirty.has("totalOverride")) {
      setUseTotalOverrideState(editInvoice.totalOverride != null)
      setTotalOverrideState(editInvoice.totalOverride ?? 0)
    }
  }, [isEdit, editInvoice])

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
  const preselectedTaskGroupIds =
    args.mode === "create" ? args.preselectedTaskGroupIds : undefined

  const preselectedKey = useMemo(
    () =>
      `${preselectedTaskIds ? [...preselectedTaskIds].sort().join(",") : ""}|${
        preselectedTaskGroupIds
          ? [...preselectedTaskGroupIds].sort().join(",")
          : ""
      }`,
    [preselectedTaskIds, preselectedTaskGroupIds],
  )

  useEffect(() => {
    if (isEdit) return
    if (!client || preselectedKey === "|") return
    const selectedGroups = pendingTaskGroups.filter((group) =>
      preselectedTaskGroupIds?.includes(group.id),
    )
    if (
      preselectedTaskGroupIds?.length &&
      selectedGroups.length !== preselectedTaskGroupIds.length
    )
      return
    const seeded: BuilderLine[] = []
    const groupedTaskIds = new Set<string>()
    for (const group of selectedGroups) {
      for (const task of group.tasks) {
        groupedTaskIds.add(task.id)
        seeded.push(buildTaskLine(newLineId(), client, task, group.id))
      }
    }
    for (const tid of preselectedTaskIds ?? []) {
      if (groupedTaskIds.has(tid)) continue
      const t = tasks.find((x) => x.id === tid)
      if (!t) continue
      seeded.push(buildTaskLine(newLineId(), client, t))
    }
    setGroups(selectedGroups.map(({ id, name }) => ({ id, name })))
    setLines(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, client, preselectedKey, tasks, pendingTaskGroups])

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

  const eligibleGroups = useMemo(
    () =>
      pendingTaskGroups.filter(
        (group) =>
          group.clientId === clientId &&
          !groups.some((selected) => selected.id === group.id) &&
          group.tasks.length > 0 &&
          (projectId === "all" ||
            group.tasks.every((task) => task.projectId === projectId)) &&
          (!taskSearch.trim() ||
            `${group.name} ${group.tasks
              .map((task) => `${task.linearIdentifier} ${task.title}`)
              .join(" ")}`
              .toLowerCase()
              .includes(taskSearch.trim().toLowerCase())),
      ),
    [pendingTaskGroups, clientId, groups, projectId, taskSearch],
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
    markFieldDirty("lines")
    setLines((cur) => [...cur, buildTaskLine(newLineId(), client, task)])
  }
  function addTaskGroup(group: TaskGroupDTO) {
    if (!client || group.clientId !== clientId || group.invoiceId) return
    if (groups.some((selected) => selected.id === group.id)) return
    const existingTaskIds = new Set(
      lines
        .map((line) => line.taskId)
        .filter((id): id is string => Boolean(id)),
    )
    const groupLines = group.tasks
      .filter((task) => !existingTaskIds.has(task.id))
      .map((task) => buildTaskLine(newLineId(), client, task, group.id))
    if (groupLines.length !== group.tasks.length || groupLines.length === 0)
      return
    markFieldDirty("lines")
    setGroups((current) => [...current, { id: group.id, name: group.name }])
    setLines((current) => [...current, ...groupLines])
  }
  function removeTaskGroup(groupId: string) {
    markFieldDirty("lines")
    setGroups((current) => current.filter((group) => group.id !== groupId))
    setLines((current) =>
      current.filter((line) => line.taskGroupId !== groupId),
    )
  }
  function addTaskById(taskId: string) {
    const t = tasks.find((x) => x.id === taskId)
    if (t) addTask(t)
  }
  function addBlank() {
    markFieldDirty("lines")
    setLines((cur) => [
      ...cur,
      {
        id: newLineId(),
        taskId: null,
        taskGroupId: null,
        label: "Ligne personnalisée",
        qty: 1,
        rate: 0,
      },
    ])
  }
  function updateLine(id: string, patch: Partial<BuilderLine>) {
    markFieldDirty("lines")
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function removeLine(id: string) {
    const line = lines.find((candidate) => candidate.id === id)
    if (line?.taskGroupId) {
      removeTaskGroup(line.taskGroupId)
      return
    }
    markFieldDirty("lines")
    setLines((cur) => cur.filter((l) => l.id !== id))
  }
  function setTotalOverrideValue(amount: number) {
    markFieldDirty("totalOverride")
    setUseTotalOverrideState(true)
    setTotalOverrideState(amount)
  }
  function clearTotalOverride() {
    markFieldDirty("totalOverride")
    setUseTotalOverrideState(false)
    setTotalOverrideState(0)
  }

  const base: BuilderBase = {
    clients,
    projects,
    tasks,
    groups,
    client,
    clientId,
    projectId,
    setProjectId,
    taskSearch,
    setTaskSearch,
    issueDate,
    setIssueDate,
    dueDate,
    setDueDate: setDueDateValue,
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
    eligibleGroups,
    taskGroupsPending,
    subtotal,
    effectiveTotal,
    addTask,
    addTaskGroup,
    removeTaskGroup,
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
      taskGroupIds: kind === "STANDARD" ? groups.map((group) => group.id) : [],
      initialPayment:
        markPaid && target === "SENT" && effectiveTotal > 0
          ? { amount: effectiveTotal, paidAt, method: null, note: null }
          : null,
    }
  }

  if (args.mode === "create") {
    const selectClient = (id: string) => {
      setPickedClientId(id)
      setLines([])
      setGroups([])
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
        taskGroupIds:
          kind === "STANDARD" ? groups.map((group) => group.id) : [],
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
