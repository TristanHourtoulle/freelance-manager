"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

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
      if (!cancelled && res.ok) {
        const data = await res.json()
        setMappings(data)
      }
      if (!cancelled) setIsLoadingMappings(false)
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
      if (!cancelled && res.ok) {
        const data = await res.json()
        setTeams(data)
      }
      if (!cancelled) setIsLoadingTeams(false)
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
      if (!cancelled && res.ok) {
        const data = await res.json()
        setProjects(data)
      }
      if (!cancelled) setIsLoadingProjects(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedTeamId])

  async function handleAdd() {
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
  }

  async function handleDelete(mappingId: string) {
    const res = await fetch(
      `/api/clients/${clientId}/linear-mappings/${mappingId}`,
      { method: "DELETE" },
    )

    if (res.ok) {
      setMappings((prev) => prev.filter((m) => m.id !== mappingId))
    }
  }

  const teamLookup = new Map(teams.map((t) => [t.id, t.name]))
  const projectLookup = new Map(projects.map((p) => [p.id, p.name]))

  const allProjectNames = new Map<string, string>()
  for (const p of projects) {
    allProjectNames.set(p.id, p.name)
  }

  const mappedProjectIds = new Set(
    mappings.map((m) => m.linearProjectId).filter(Boolean),
  )
  const availableProjects = projects.filter((p) => !mappedProjectIds.has(p.id))

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

      {mappings.length > 0 && (
        <div className="mb-4 space-y-2">
          {mappings.map((mapping) => (
            <div
              key={mapping.id}
              className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700"
            >
              <div className="text-sm">
                {mapping.linearTeamId && (
                  <span className="text-zinc-600 dark:text-zinc-400">
                    {teamLookup.get(mapping.linearTeamId) ??
                      mapping.linearTeamId}
                  </span>
                )}
                {mapping.linearTeamId && mapping.linearProjectId && (
                  <span className="mx-1.5 text-zinc-400 dark:text-zinc-600">
                    /
                  </span>
                )}
                {mapping.linearProjectId && (
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">
                    {projectLookup.get(mapping.linearProjectId) ??
                      allProjectNames.get(mapping.linearProjectId) ??
                      mapping.linearProjectId}
                  </span>
                )}
              </div>
              <Button
                variant="ghost"
                className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
                onClick={() => handleDelete(mapping.id)}
              >
                Remove
              </Button>
            </div>
          ))}
        </div>
      )}

      {mappings.length === 0 && (
        <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
          No Linear projects mapped to this client yet.
        </p>
      )}

      <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Add a mapping
        </p>

        <Select
          label="Team"
          placeholder="Select a team"
          value={selectedTeamId}
          onChange={(e) => setSelectedTeamId(e.target.value)}
          options={teams.map((t) => ({ value: t.id, label: t.name }))}
        />

        {selectedTeamId && (
          <Select
            label="Project"
            placeholder={
              isLoadingProjects ? "Loading projects..." : "Select a project"
            }
            value={selectedProjectId}
            onChange={(e) => setSelectedProjectId(e.target.value)}
            disabled={isLoadingProjects}
            options={availableProjects.map((p) => ({
              value: p.id,
              label: p.name,
            }))}
          />
        )}

        {error && (
          <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        )}

        <Button
          onClick={handleAdd}
          isLoading={isSaving}
          disabled={!selectedTeamId && !selectedProjectId}
          variant="secondary"
        >
          Add Mapping
        </Button>
      </div>
    </div>
  )
}
