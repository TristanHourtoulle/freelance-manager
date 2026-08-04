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
import type { InvoiceKind } from "@/domain/billing/types"
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
  const [projectId, setProjectId] = useState<string>(
    editInvoice?.projectId ?? "all",
  )
  const [taskSearch, setTaskSearch] = useState("")
  const [issueDate, setIssueDate] = useState(() =>
    editInvoice ? editInvoice.issueDate.slice(0, 10) : todayIso(),
  )
  const [dueDate, setDueDate] = useState(() =>
    editInvoice
      ? editInvoice.dueDate.slice(0, 10)
      : plusDaysIso(FALLBACK_PAYMENT_DAYS),
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
          taskGroupId: l.taskGroupId ?? null,
          label: l.label,
          qty: l.qty,
          rate: l.rate,
        }))
      : [],
  )
  const [groups, setGroups] = useState<BuilderTaskGroup[]>(
    () =>
      editInvoice?.taskGroups?.map((group) => ({
        id: group.id,
        name: group.name,
      })) ?? [],
  )
  const [dragOver, setDragOver] = useState(false)
  const [useTotalOverride, setUseTotalOverride] = useState(
    editInvoice ? editInvoice.totalOverride != null : false,
  )
  const [totalOverride, setTotalOverride] = useState<number>(
    editInvoice?.totalOverride ?? 0,
  )

  const [initialStatus, setInitialStatus] = useState<CreateStatus>("SENT")
  const [markPaid, setMarkPaid] = useState(false)
  const [paidAt, setPaidAt] = useState(() => todayIso())
  const [showSplit, setShowSplit] = useState(false)
  const [status, setStatus] = useState<EditStatus>(
    editInvoice?.status ?? "DRAFT",
  )

  const dueDateEditedRef = useRef(false)
  const defaultDueDateAppliedRef = useRef(false)

  const setDueDateValue = useCallback((value: string) => {
    dueDateEditedRef.current = true
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
    setGroups((current) => [...current, { id: group.id, name: group.name }])
    setLines((current) => [...current, ...groupLines])
  }
  function removeTaskGroup(groupId: string) {
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
    setLines((cur) => cur.map((l) => (l.id === id ? { ...l, ...patch } : l)))
  }
  function removeLine(id: string) {
    const line = lines.find((candidate) => candidate.id === id)
    if (line?.taskGroupId) {
      removeTaskGroup(line.taskGroupId)
      return
    }
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
