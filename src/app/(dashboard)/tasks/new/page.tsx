"use client"

import { useEffect, useState } from "react"
import { useTranslations } from "next-intl"
import {
  CreateTaskForm,
  type MappedProject,
} from "@/components/tasks/create-task-form"

import type { LinearProjectDTO } from "@/lib/linear-service"

interface ClientWithMappings {
  id: string
  name: string
  linearMappings: Array<{
    linearProjectId: string | null
    linearTeamId: string | null
  }>
}

export default function NewTaskPage() {
  const [mappedProjects, setMappedProjects] = useState<MappedProject[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const t = useTranslations("newTask")

  useEffect(() => {
    async function load() {
      const [clientsRes, projectsRes] = await Promise.all([
        fetch("/api/clients?limit=100"),
        fetch("/api/linear/projects"),
      ])

      if (!clientsRes.ok || !projectsRes.ok) {
        setIsLoading(false)
        return
      }

      const clientsData = await clientsRes.json()
      const clients: ClientWithMappings[] = clientsData.items ?? []
      const projects: LinearProjectDTO[] = await projectsRes.json()

      const projectMap = new Map(projects.map((p) => [p.id, p]))

      const mapped: MappedProject[] = []
      for (const client of clients) {
        for (const mapping of client.linearMappings) {
          if (!mapping.linearProjectId || !mapping.linearTeamId) continue
          const project = projectMap.get(mapping.linearProjectId)
          if (!project) continue
          mapped.push({
            projectId: mapping.linearProjectId,
            projectName: project.name,
            teamId: mapping.linearTeamId,
            clientName: client.name,
          })
        }
      }

      setMappedProjects(mapped)
      setIsLoading(false)
    }

    load()
  }, [])

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6">{t("title")}</h1>
        <div className="flex items-center justify-center py-16">
          <p className="text-sm text-text-secondary">{t("loadingProjects")}</p>
        </div>
      </div>
    )
  }

  if (mappedProjects.length === 0) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="mb-6">{t("title")}</h1>
        <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
          <p className="text-sm text-text-secondary">{t("noProjects")}</p>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6">{t("title")}</h1>
      <div className="rounded-xl border border-border bg-surface p-6 shadow-sm">
        <CreateTaskForm mappedProjects={mappedProjects} />
      </div>
    </div>
  )
}
