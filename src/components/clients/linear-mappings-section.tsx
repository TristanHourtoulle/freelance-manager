"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { AddMappingForm } from "@/components/clients/linear-mappings-section/add-mapping-form"
import { LinearMappingsList } from "@/components/clients/linear-mappings-section/linear-mappings-list"

import type { LinearMappingDTO } from "@/components/clients/types"

interface LinearTeam {
  id: string
  name: string
  key: string
}

interface LinearProject {
  id: string
  name: string
  state: string
}

interface LinearMappingsSectionProps {
  clientId: string
}

export function LinearMappingsSection({
  clientId,
}: LinearMappingsSectionProps) {
  const [mappings, setMappings] = useState<LinearMappingDTO[]>([])
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [projects, setProjects] = useState<LinearProject[]>([])

  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("")

  const [isLoadingMappings, setIsLoadingMappings] = useState(true)
  const [isLoadingTeams, setIsLoadingTeams] = useState(true)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState("")

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/clients/${clientId}/linear-mappings`)
      if (cancelled) return
      if (res.ok) {
        setMappings(await res.json())
      } else {
        setError("Failed to load mappings")
      }
      setIsLoadingMappings(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clientId])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch("/api/linear/teams")
      if (cancelled) return
      if (res.ok) {
        setTeams(await res.json())
      } else {
        setError("Failed to load Linear teams")
      }
      setIsLoadingTeams(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false

    async function load() {
      if (!selectedTeamId) {
        setProjects([])
        setSelectedProjectId("")
        return
      }

      setIsLoadingProjects(true)
      setSelectedProjectId("")

      const res = await fetch(`/api/linear/projects?teamId=${selectedTeamId}`)
      if (cancelled) return
      if (res.ok) {
        setProjects(await res.json())
      } else {
        setError("Failed to load projects")
      }
      setIsLoadingProjects(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedTeamId])

  const handleAdd = useCallback(async () => {
    if (!selectedTeamId && !selectedProjectId) return

    setIsSaving(true)
    setError("")

    const res = await fetch(`/api/clients/${clientId}/linear-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linearTeamId: selectedTeamId || undefined,
        linearProjectId: selectedProjectId || undefined,
      }),
    })

    if (res.ok) {
      setSelectedTeamId("")
      setSelectedProjectId("")
      const mappingsRes = await fetch(
        `/api/clients/${clientId}/linear-mappings`,
      )
      if (mappingsRes.ok) {
        setMappings(await mappingsRes.json())
      }
    } else {
      const body = await res.json()
      setError(body.error?.message ?? "Failed to add mapping")
    }

    setIsSaving(false)
  }, [clientId, selectedTeamId, selectedProjectId])

  const handleDelete = useCallback(
    async (mappingId: string) => {
      setError("")

      const res = await fetch(
        `/api/clients/${clientId}/linear-mappings/${mappingId}`,
        { method: "DELETE" },
      )

      if (res.ok) {
        setMappings((prev) => prev.filter((m) => m.id !== mappingId))
      } else {
        setError("Failed to remove mapping")
      }
    },
    [clientId],
  )

  const teamLookup = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams],
  )

  const projectLookup = useMemo(
    () => new Map(projects.map((p) => [p.id, p.name])),
    [projects],
  )

  const availableProjects = useMemo(() => {
    const mappedProjectIds = new Set(
      mappings.map((m) => m.linearProjectId).filter(Boolean),
    )
    return projects.filter((p) => !mappedProjectIds.has(p.id))
  }, [mappings, projects])

  if (isLoadingMappings || isLoadingTeams) {
    return (
      <div className="py-4">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Loading Linear data...
        </p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-zinc-50">
        Linear Mappings
      </h2>

      <LinearMappingsList
        mappings={mappings}
        teamLookup={teamLookup}
        projectLookup={projectLookup}
        onDelete={handleDelete}
      />

      {error && (
        <p className="mb-4 text-sm text-red-600 dark:text-red-400">{error}</p>
      )}

      <AddMappingForm
        teams={teams}
        selectedTeamId={selectedTeamId}
        onTeamChange={setSelectedTeamId}
        selectedProjectId={selectedProjectId}
        onProjectChange={setSelectedProjectId}
        availableProjects={availableProjects}
        isLoadingProjects={isLoadingProjects}
        isSaving={isSaving}
        onAdd={handleAdd}
      />
    </div>
  )
}
