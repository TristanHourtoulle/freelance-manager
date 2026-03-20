"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useTranslations } from "next-intl"
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createLinearIssueSchema } from "@/lib/schemas/linear"
import { useToast } from "@/components/providers/toast-provider"
import { Skeleton } from "@/components/ui/skeleton"
import {
  useState,
  useMemo,
  useEffect,
  useCallback,
  lazy,
  Suspense,
} from "react"

const RichTextEditor = lazy(() =>
  import("@/components/ui/rich-text-editor").then((m) => ({
    default: m.RichTextEditor,
  })),
)

import type { Resolver } from "react-hook-form"
import type { CreateLinearIssueInput } from "@/lib/schemas/linear"
import type {
  LinearMemberDTO,
  LinearWorkflowStateDTO,
  LinearIssueLabelDTO,
} from "@/lib/linear-service"

/** A Linear project associated with a client via a mapping. */
export interface MappedProject {
  projectId: string
  projectName: string
  teamId: string
  clientName: string
}

interface TeamMetadata {
  members: LinearMemberDTO[]
  states: LinearWorkflowStateDTO[]
  labels: LinearIssueLabelDTO[]
}

interface CreateTaskFormProps {
  mappedProjects: MappedProject[]
}

const TITLE_MAX_LENGTH = 200

/**
 * Form for creating a new Linear issue from within the app.
 * Validates input with Zod and posts to the Linear issues API.
 * Supports assignee, status, and label selection synced to Linear.
 */
export function CreateTaskForm({ mappedProjects }: CreateTaskFormProps) {
  const router = useRouter()
  const { toast } = useToast()
  const t = useTranslations("newTask")
  const tc = useTranslations("common")
  const [apiError, setApiError] = useState("")
  const [metadata, setMetadata] = useState<TeamMetadata | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
    new Set(),
  )

  const projectOptions = useMemo(() => {
    const seen = new Set<string>()
    const options: Array<{
      value: string
      label: string
      projectName: string
      clientName: string
    }> = []
    for (const p of mappedProjects) {
      const key = `${p.projectId}::${p.teamId}`
      if (seen.has(key)) continue
      seen.add(key)
      options.push({
        value: key,
        label: `${p.clientName} — ${p.projectName}`,
        projectName: p.projectName,
        clientName: p.clientName,
      })
    }
    return options
  }, [mappedProjects])

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting, dirtyFields, isValid },
    setValue,
    watch,
  } = useForm<CreateLinearIssueInput>({
    mode: "onChange",
    resolver: zodResolver(
      createLinearIssueSchema,
    ) as Resolver<CreateLinearIssueInput>,
    defaultValues: {
      title: "",
      description: undefined,
      estimate: undefined,
      teamId: "",
      projectId: "",
      assigneeId: undefined,
      stateId: undefined,
      labelIds: undefined,
    },
  })

  const watchedTitle = watch("title")
  const watchedEstimate = watch("estimate")
  const watchedDescription = watch("description")
  const watchedProjectId = watch("projectId")

  const selectedProjectName = useMemo(() => {
    if (!watchedProjectId) return ""
    const found = projectOptions.find((opt) =>
      opt.value.startsWith(watchedProjectId),
    )
    return found ? found.label : ""
  }, [watchedProjectId, projectOptions])

  const titleLength = watchedTitle?.length ?? 0

  const fetchMetadata = useCallback(
    async (teamId: string) => {
      setIsLoadingMetadata(true)
      try {
        const res = await fetch(`/api/linear/teams/${teamId}/metadata`)
        if (!res.ok) {
          toast({
            variant: "error",
            title: t("failedToLoadTeamOptions"),
          })
          return
        }
        const data: TeamMetadata = await res.json()
        setMetadata(data)
      } finally {
        setIsLoadingMetadata(false)
      }
    },
    [toast, t],
  )

  useEffect(() => {
    if (selectedTeamId) {
      fetchMetadata(selectedTeamId)
    } else {
      setMetadata(null)
    }
  }, [selectedTeamId, fetchMetadata])

  function handleProjectChange(value: string) {
    const parts = value.split("::")
    const projectId = parts[0] ?? ""
    const teamId = parts[1] ?? ""
    setValue("projectId", projectId, { shouldValidate: true })
    setValue("teamId", teamId, { shouldValidate: true })

    if (teamId !== selectedTeamId) {
      setSelectedTeamId(teamId)
      setValue("assigneeId", undefined)
      setValue("stateId", undefined)
      setValue("labelIds", undefined)
      setSelectedLabelIds(new Set())
    }
  }

  function handleLabelToggle(labelId: string) {
    setSelectedLabelIds((prev) => {
      const next = new Set(prev)
      if (next.has(labelId)) {
        next.delete(labelId)
      } else {
        next.add(labelId)
      }
      const ids = [...next]
      setValue("labelIds", ids.length > 0 ? ids : undefined)
      return next
    })
  }

  async function handleFormSubmit(data: CreateLinearIssueInput) {
    setApiError("")
    try {
      const res = await fetch("/api/linear/issues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      })

      if (!res.ok) {
        const body = await res.json()
        throw new Error(body.error?.message ?? t("failedToCreate"))
      }

      router.push("/tasks")
    } catch (error) {
      if (error instanceof Error) {
        setApiError(error.message)
      }
    }
  }

  const memberOptions = useMemo(
    () =>
      metadata?.members.map((m) => ({
        value: m.id,
        label: m.name,
      })) ?? [],
    [metadata],
  )

  const stateOptions = useMemo(
    () =>
      metadata?.states.map((s) => ({
        value: s.id,
        label: s.name,
      })) ?? [],
    [metadata],
  )

  return {
    form: (
      <form
        onSubmit={handleSubmit(handleFormSubmit)}
        className="space-y-6"
        noValidate
      >
        {/* Title with character count and validation indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <FormField
              label={t("titleLabel")}
              placeholder={t("titlePlaceholder")}
              maxLength={TITLE_MAX_LENGTH}
              {...register("title")}
              error={errors.title?.message}
              className="flex-1"
            />
            {dirtyFields.title &&
              (errors.title ? (
                <XCircleIcon className="mt-6 size-5 shrink-0 text-red-500" />
              ) : (
                <CheckCircleIcon className="mt-6 size-5 shrink-0 text-green-500" />
              ))}
          </div>
          <p
            className={`text-xs ${
              titleLength > TITLE_MAX_LENGTH
                ? "text-destructive"
                : "text-muted-foreground"
            }`}
          >
            {titleLength}/{TITLE_MAX_LENGTH}
          </p>
        </div>

        <input type="hidden" {...register("projectId")} />
        <input type="hidden" {...register("teamId")} />

        {/* Project select with validation indicator */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex-1 space-y-1.5">
              <label className="text-sm font-medium text-muted-foreground">
                {t("projectLabel")}
              </label>
              <Select
                onValueChange={(val: string | null) => {
                  if (val) handleProjectChange(val)
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("selectProject")} />
                </SelectTrigger>
                <SelectContent>
                  {projectOptions.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {dirtyFields.projectId &&
              (errors.projectId || errors.teamId ? (
                <XCircleIcon className="mt-6 size-5 shrink-0 text-red-500" />
              ) : (
                <CheckCircleIcon className="mt-6 size-5 shrink-0 text-green-500" />
              ))}
          </div>
          {(errors.projectId?.message || errors.teamId?.message) && (
            <p className="text-sm text-destructive">
              {errors.projectId?.message || errors.teamId?.message}
            </p>
          )}
        </div>

        {/* Estimate with validation indicator */}
        <div className="flex items-center gap-2">
          <FormField
            label={t("estimateLabel")}
            type="number"
            min="1"
            placeholder={t("estimatePlaceholder")}
            {...register("estimate", {
              setValueAs: (v) =>
                v === "" || v === null ? undefined : Number(v),
            })}
            error={errors.estimate?.message}
            className="flex-1"
          />
          {dirtyFields.estimate &&
            (errors.estimate ? (
              <XCircleIcon className="mt-6 size-5 shrink-0 text-red-500" />
            ) : (
              <CheckCircleIcon className="mt-6 size-5 shrink-0 text-green-500" />
            ))}
        </div>

        {selectedTeamId && (
          <div className="space-y-6 rounded-lg border border-border-light bg-surface-secondary/30 p-4">
            <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
              {t("linearOptions")}
            </p>

            {isLoadingMetadata ? (
              <p className="text-sm text-text-secondary">
                {t("loadingTeamOptions")}
              </p>
            ) : metadata ? (
              <>
                {memberOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("assigneeLabel")}
                    </label>
                    <Select
                      onValueChange={(val: string | null) =>
                        setValue("assigneeId", val ?? undefined)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("unassigned")} />
                      </SelectTrigger>
                      <SelectContent>
                        {memberOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {stateOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-sm font-medium text-muted-foreground">
                      {t("statusLabel")}
                    </label>
                    <Select
                      onValueChange={(val: string | null) =>
                        setValue("stateId", val ?? undefined)
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={t("defaultStatus")} />
                      </SelectTrigger>
                      <SelectContent>
                        {stateOptions.map((opt) => (
                          <SelectItem key={opt.value} value={opt.value}>
                            {opt.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {metadata.labels.length > 0 && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-text-secondary">
                      {t("labelsLabel")}
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {metadata.labels.map((label) => {
                        const isSelected = selectedLabelIds.has(label.id)
                        return (
                          <button
                            key={label.id}
                            type="button"
                            onClick={() => handleLabelToggle(label.id)}
                            className={`cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              isSelected
                                ? "border-transparent text-white"
                                : "border-border bg-surface text-text-secondary hover:border-primary hover:text-primary"
                            }`}
                            style={
                              isSelected
                                ? { backgroundColor: label.color }
                                : undefined
                            }
                          >
                            {label.name}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="space-y-2">
          <label>{t("descriptionLabel")}</label>
          <Suspense fallback={<Skeleton className="h-32 w-full rounded-xl" />}>
            <RichTextEditor
              placeholder={t("descriptionPlaceholder")}
              onChange={(md) => setValue("description", md || undefined)}
            />
          </Suspense>
          {errors.description?.message && (
            <p className="text-sm text-destructive">
              {errors.description.message}
            </p>
          )}
        </div>

        {apiError && <p className="text-sm text-destructive">{apiError}</p>}

        <div className="flex justify-end gap-2.5">
          <Button
            type="button"
            variant="outline"
            size="lg"
            shape="pill-left"
            onClick={() => router.push("/tasks")}
          >
            {tc("cancel")}
          </Button>
          <Button
            type="submit"
            variant="gradient"
            size="lg"
            shape="pill-right"
            isLoading={isSubmitting}
          >
            {t("createButton")}
          </Button>
        </div>
      </form>
    ),
    watchedValues: {
      title: watchedTitle,
      projectName: selectedProjectName,
      estimate: watchedEstimate,
      description: watchedDescription,
    },
  }
}
