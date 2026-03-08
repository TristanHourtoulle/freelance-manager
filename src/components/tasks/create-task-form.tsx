"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { FormField } from "@/components/ui/form-field"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { RichTextEditor } from "@/components/ui/rich-text-editor"
import { createLinearIssueSchema } from "@/lib/schemas/linear"
import { useState, useMemo, useEffect, useCallback } from "react"

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

/**
 * Form for creating a new Linear issue from within the app.
 * Validates input with Zod and posts to the Linear issues API.
 * Supports assignee, status, and label selection synced to Linear.
 */
export function CreateTaskForm({ mappedProjects }: CreateTaskFormProps) {
  const router = useRouter()
  const [apiError, setApiError] = useState("")
  const [metadata, setMetadata] = useState<TeamMetadata | null>(null)
  const [isLoadingMetadata, setIsLoadingMetadata] = useState(false)
  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [selectedLabelIds, setSelectedLabelIds] = useState<Set<string>>(
    new Set(),
  )

  const projectOptions = useMemo(
    () =>
      mappedProjects.map((p) => ({
        value: `${p.projectId}::${p.teamId}`,
        label: `${p.clientName} — ${p.projectName}`,
      })),
    [mappedProjects],
  )

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    setValue,
  } = useForm<CreateLinearIssueInput>({
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

  const fetchMetadata = useCallback(async (teamId: string) => {
    setIsLoadingMetadata(true)
    try {
      const res = await fetch(`/api/linear/teams/${teamId}/metadata`)
      if (res.ok) {
        const data: TeamMetadata = await res.json()
        setMetadata(data)
      }
    } finally {
      setIsLoadingMetadata(false)
    }
  }, [])

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
        throw new Error(body.error?.message ?? "Failed to create task")
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

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
      noValidate
    >
      <FormField
        label="Title"
        placeholder="Issue title"
        {...register("title")}
        error={errors.title?.message}
      />

      <input type="hidden" {...register("projectId")} />
      <input type="hidden" {...register("teamId")} />

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          Project
        </label>
        <Select
          onValueChange={(val: string | null) => {
            if (val) handleProjectChange(val)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a project" />
          </SelectTrigger>
          <SelectContent>
            {projectOptions.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(errors.projectId?.message || errors.teamId?.message) && (
          <p className="text-sm text-destructive">
            {errors.projectId?.message || errors.teamId?.message}
          </p>
        )}
      </div>

      <FormField
        label="Estimate (points)"
        type="number"
        min="1"
        placeholder="e.g. 3"
        {...register("estimate", {
          setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
        })}
        error={errors.estimate?.message}
      />

      {selectedTeamId && (
        <div className="space-y-6 rounded-lg border border-border-light bg-surface-secondary/30 p-4">
          <p className="text-xs font-medium uppercase tracking-wider text-text-secondary">
            Linear Options
          </p>

          {isLoadingMetadata ? (
            <p className="text-sm text-text-secondary">
              Loading team options...
            </p>
          ) : metadata ? (
            <>
              {memberOptions.length > 0 && (
                <div className="space-y-1.5">
                  <label className="text-sm font-medium text-muted-foreground">
                    Assignee
                  </label>
                  <Select
                    onValueChange={(val: string | null) =>
                      setValue("assigneeId", val ?? undefined)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Unassigned" />
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
                    Status
                  </label>
                  <Select
                    onValueChange={(val: string | null) =>
                      setValue("stateId", val ?? undefined)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Default status" />
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
                    Labels
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
        <label>Description</label>
        <RichTextEditor
          placeholder="Describe the task..."
          onChange={(md) => setValue("description", md || undefined)}
        />
        {errors.description?.message && (
          <p className="text-sm text-destructive">
            {errors.description.message}
          </p>
        )}
      </div>

      {apiError && <p className="text-sm text-destructive">{apiError}</p>}

      <div className="flex justify-end gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/tasks")}
        >
          Cancel
        </Button>
        <Button type="submit" isLoading={isSubmitting}>
          Create Task
        </Button>
      </div>
    </form>
  )
}
