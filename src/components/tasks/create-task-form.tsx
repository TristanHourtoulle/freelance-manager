"use client"

import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select } from "@/components/ui/select"
import { createLinearIssueSchema } from "@/lib/schemas/linear"
import { useState, useMemo } from "react"

import type { Resolver } from "react-hook-form"
import type { CreateLinearIssueInput } from "@/lib/schemas/linear"

/** A Linear project associated with a client via a mapping. */
export interface MappedProject {
  projectId: string
  projectName: string
  teamId: string
  clientName: string
}

interface CreateTaskFormProps {
  mappedProjects: MappedProject[]
}

/**
 * Form for creating a new Linear issue from within the app.
 * Validates input with Zod and posts to the Linear issues API.
 * Used on the /tasks/new page.
 */
export function CreateTaskForm({ mappedProjects }: CreateTaskFormProps) {
  const router = useRouter()
  const [apiError, setApiError] = useState("")

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
    },
  })

  function handleProjectChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    const parts = value.split("::")
    setValue("projectId", parts[0] ?? "")
    setValue("teamId", parts[1] ?? "")
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

  return (
    <form
      onSubmit={handleSubmit(handleFormSubmit)}
      className="space-y-6"
      noValidate
    >
      <Input
        label="Title"
        placeholder="Issue title"
        {...register("title")}
        error={errors.title?.message}
      />

      <Select
        label="Project"
        options={projectOptions}
        placeholder="Select a project"
        onChange={handleProjectChange}
        error={errors.projectId?.message || errors.teamId?.message}
      />

      <Input
        label="Estimate (points)"
        type="number"
        min="1"
        placeholder="e.g. 3"
        {...register("estimate", {
          setValueAs: (v) => (v === "" || v === null ? undefined : Number(v)),
        })}
        error={errors.estimate?.message}
      />

      <div className="space-y-2">
        <label htmlFor="description">Description</label>
        <textarea
          id="description"
          rows={4}
          placeholder="Describe the task..."
          {...register("description")}
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
          variant="secondary"
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
