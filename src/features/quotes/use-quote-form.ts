"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import {
  useCreateQuote,
  useUpdateQuote,
  type QuoteDetail,
  type QuoteStatus,
} from "@/hooks/use-quotes"
import { useClients, type ClientDTO } from "@/hooks/use-clients"
import { useProjects, type ProjectDTO } from "@/hooks/use-projects"
import { useTasks, type TaskDTO } from "@/hooks/use-tasks"
import { filterEligibleTasks } from "@/domain/billing/builder"
import {
  buildQuoteCreatePayload,
  buildQuoteUpdatePayload,
  canSubmitQuoteForm,
  lineFromTaskForQuote,
  quoteFormTotals,
  type QuoteFormState,
  type QuoteLineDraft,
} from "@/features/quotes/quote-form-logic"

interface CreateArgs {
  mode: "create"
  quote?: undefined
  initialClientId?: string
  preselectedTaskIds?: string[]
}

interface EditArgs {
  mode: "edit"
  quote: QuoteDetail
  initialClientId?: undefined
  preselectedTaskIds?: undefined
}

export type UseQuoteFormArgs = CreateArgs | EditArgs

export type QuoteForm = ReturnType<typeof useQuoteForm>

function newKey(): string {
  return "L" + Math.random().toString(36).slice(2, 8)
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10)
}

/**
 * Form state + actions for creating or editing a quote (devis).
 *
 * Track-only: the mutation stores the tracked metadata; the document itself is
 * emitted from Abby.fr. In edit mode the client is fixed; in create mode it is
 * user-picked and can be pre-selected via `initialClientId`.
 *
 * @param args - Create args (`initialClientId`, `preselectedTaskIds`) or edit
 * args (the `quote` to seed from).
 * @returns The form values, setters, line actions, totals and submit/save.
 */
export function useQuoteForm(args: UseQuoteFormArgs) {
  const router = useRouter()
  const isEdit = args.mode === "edit"
  const quote = args.mode === "edit" ? args.quote : undefined

  const { data: clients = [] } = useClients()
  const { data: projects = [] } = useProjects()
  const { data: tasks = [] } = useTasks()

  const createQuote = useCreateQuote()
  const updateQuote = useUpdateQuote(quote?.id ?? "")

  const [clientId, setClientId] = useState<string>(
    isEdit ? quote!.clientId : (args.initialClientId ?? ""),
  )
  const [projectId, setProjectId] = useState<string | null>(
    quote?.projectId ?? null,
  )
  const [number, setNumber] = useState<string>(quote?.number ?? "")
  const [status, setStatus] = useState<QuoteStatus>(quote?.status ?? "DRAFT")
  const [issueDate, setIssueDate] = useState<string>(
    quote ? quote.issueDate.slice(0, 10) : todayIso(),
  )
  const [validUntil, setValidUntil] = useState<string>(
    quote?.validUntil ? quote.validUntil.slice(0, 10) : "",
  )
  const [externalUrl, setExternalUrl] = useState<string>(
    quote?.externalUrl ?? "",
  )
  const [notes, setNotes] = useState<string>(quote?.notes ?? "")
  const [lines, setLines] = useState<QuoteLineDraft[]>(() =>
    quote
      ? quote.lines.map((l) => ({
          key: l.id,
          taskId: l.taskId,
          label: l.label,
          qty: l.qty,
          rate: l.rate,
        }))
      : [],
  )

  const client = useMemo<ClientDTO | undefined>(
    () => clients.find((c) => c.id === clientId),
    [clients, clientId],
  )

  const clientProjects = useMemo<ProjectDTO[]>(
    () => projects.filter((p) => p.clientId === clientId),
    [projects, clientId],
  )

  const preselectedTaskIds =
    args.mode === "create" ? args.preselectedTaskIds : undefined
  const preselectedKey = useMemo(
    () => (preselectedTaskIds ? [...preselectedTaskIds].sort().join(",") : ""),
    [preselectedTaskIds],
  )

  useEffect(() => {
    if (isEdit) return
    if (!client || !preselectedTaskIds || preselectedTaskIds.length === 0)
      return
    const seeded: QuoteLineDraft[] = []
    for (const tid of preselectedTaskIds) {
      const t = tasks.find((x) => x.id === tid)
      if (!t) continue
      seeded.push({ key: newKey(), ...lineFromTaskForQuote(t, client) })
    }
    setLines(seeded)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, client, preselectedKey, tasks])

  const selectClient = useCallback((id: string) => {
    setClientId(id)
    setProjectId(null)
    setLines([])
  }, [])

  const addLine = useCallback(() => {
    setLines((cur) => [
      ...cur,
      { key: newKey(), taskId: null, label: "", qty: 1, rate: 0 },
    ])
  }, [])

  const addLineFromTask = useCallback(
    (task: TaskDTO) => {
      if (!client) return
      setLines((cur) => [
        ...cur,
        { key: newKey(), ...lineFromTaskForQuote(task, client) },
      ])
    },
    [client],
  )

  const importEligibleTasks = useCallback(() => {
    if (!client) return
    setLines((cur) => {
      const eligible = filterEligibleTasks(tasks, {
        clientId,
        lines: cur,
        projectId: "all",
        search: "",
      })
      if (eligible.length === 0) return cur
      return [
        ...cur,
        ...eligible.map((t) => ({
          key: newKey(),
          ...lineFromTaskForQuote(t, client),
        })),
      ]
    })
  }, [client, tasks, clientId])

  const removeLine = useCallback((key: string) => {
    setLines((cur) => cur.filter((l) => l.key !== key))
  }, [])

  const updateLine = useCallback(
    (key: string, patch: Partial<Omit<QuoteLineDraft, "key">>) => {
      setLines((cur) =>
        cur.map((l) => (l.key === key ? { ...l, ...patch } : l)),
      )
    },
    [],
  )

  const state = useMemo<QuoteFormState>(
    () => ({
      clientId,
      projectId,
      number,
      status,
      issueDate,
      validUntil,
      externalUrl,
      notes,
      lines,
    }),
    [
      clientId,
      projectId,
      number,
      status,
      issueDate,
      validUntil,
      externalUrl,
      notes,
      lines,
    ],
  )

  const { subtotal, total } = quoteFormTotals(lines)
  const canSubmit = canSubmitQuoteForm(state)
  const isPending = isEdit ? updateQuote.isPending : createQuote.isPending

  const submit = useCallback(() => {
    if (!canSubmitQuoteForm(state)) return
    const payload = buildQuoteCreatePayload(state)
    createQuote.mutate(payload, {
      onSuccess: (created) => {
        router.push(`/quotes?openId=${created.id}`)
      },
    })
  }, [state, createQuote, router])

  const save = useCallback(() => {
    if (!quote || !canSubmitQuoteForm(state)) return
    const payload = buildQuoteUpdatePayload(state)
    updateQuote.mutate(payload, {
      onSuccess: () => {
        router.push(`/quotes?openId=${quote.id}`)
      },
    })
  }, [state, quote, updateQuote, router])

  return {
    mode: args.mode,
    isEdit,
    clients,
    client,
    clientProjects,
    clientId,
    setClientId,
    selectClient,
    projectId,
    setProjectId,
    number,
    setNumber,
    status,
    setStatus,
    issueDate,
    setIssueDate,
    validUntil,
    setValidUntil,
    externalUrl,
    setExternalUrl,
    notes,
    setNotes,
    lines,
    addLine,
    addLineFromTask,
    importEligibleTasks,
    removeLine,
    updateLine,
    subtotal,
    total,
    canSubmit,
    isPending,
    submit,
    save,
  }
}
