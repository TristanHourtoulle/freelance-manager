"use client"

import { useCallback, useEffect, useMemo, useState } from "react"

import { AddMappingForm } from "@/components/clients/linear-mappings-section/add-mapping-form"
import { LinearMappingsList } from "@/components/clients/linear-mappings-section/linear-mappings-list"
import { useToast } from "@/components/providers/toast-provider"

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

/**
 * Section for managing Linear team/project mappings on the client edit page.
 * Loads existing mappings and Linear teams/projects, and allows adding or removing mappings.
 */
export function LinearMappingsSection({
  clientId,
}: LinearMappingsSectionProps) {
  const [mappings, setMappings] = useState<LinearMappingDTO[]>([])
  const [teams, setTeams] = useState<LinearTeam[]>([])
  const [projects, setProjects] = useState<LinearProject[]>([])
  const [allProjects, setAllProjects] = useState<LinearProject[]>([])

  const [selectedTeamId, setSelectedTeamId] = useState("")
  const [selectedProjectId, setSelectedProjectId] = useState("")

  const [isLoadingMappings, setIsLoadingMappings] = useState(true)
  const [isLoadingTeams, setIsLoadingTeams] = useState(true)
  const [isLoadingProjects, setIsLoadingProjects] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const { toast } = useToast()

  useEffect(() => {
    let cancelled = false
    async function load() {
      const res = await fetch(`/api/clients/${clientId}/linear-mappings`)
      if (cancelled) return
      if (res.ok) {
        setMappings(await res.json())
      } else {
        toast({ variant: "error", title: "Failed to load mappings" })
      }
      setIsLoadingMappings(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [clientId, toast])

  useEffect(() => {
    let cancelled = false
    async function load() {
      const [teamsRes, projectsRes] = await Promise.all([
        fetch("/api/linear/teams"),
        fetch("/api/linear/projects"),
      ])
      if (cancelled) return
      if (teamsRes.ok) {
        setTeams(await teamsRes.json())
      } else {
        toast({ variant: "error", title: "Failed to load Linear teams" })
      }
      if (projectsRes.ok) {
        setAllProjects(await projectsRes.json())
      }
      setIsLoadingTeams(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [toast])

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
        toast({ variant: "error", title: "Failed to load projects" })
      }
      setIsLoadingProjects(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [selectedTeamId, toast])

  const handleAdd = useCallback(async () => {
    if (!selectedTeamId && !selectedProjectId) return

    setIsSaving(true)

    const res = await fetch(`/api/clients/${clientId}/linear-mappings`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        linearTeamId: selectedTeamId || undefined,
        linearProjectId: selectedProjectId || undefined,
      }),
    })

    if (res.ok) {
      toast({ variant: "success", title: "Mapping added" })
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
      toast({
        variant: "error",
        title: body.error?.message ?? "Failed to add mapping",
      })
    }

    setIsSaving(false)
  }, [clientId, selectedTeamId, selectedProjectId, toast])

  const handleDelete = useCallback(
    async (mappingId: string) => {
      const res = await fetch(
        `/api/clients/${clientId}/linear-mappings/${mappingId}`,
        { method: "DELETE" },
      )

      if (res.ok) {
        toast({ variant: "success", title: "Mapping removed" })
        setMappings((prev) => prev.filter((m) => m.id !== mappingId))
      } else {
        toast({ variant: "error", title: "Failed to remove mapping" })
      }
    },
    [clientId, toast],
  )

  const teamLookup = useMemo(
    () => new Map(teams.map((t) => [t.id, t.name])),
    [teams],
  )

  const projectLookup = useMemo(
    () => new Map(allProjects.map((p) => [p.id, p.name])),
    [allProjects],
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
        <p className="text-sm text-text-secondary">Loading Linear data...</p>
      </div>
    )
  }

  return (
    <div>
      <h2 className="mb-4">Linear Mappings</h2>

      <LinearMappingsList
        mappings={mappings}
        teamLookup={teamLookup}
        projectLookup={projectLookup}
        onDelete={handleDelete}
      />

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
