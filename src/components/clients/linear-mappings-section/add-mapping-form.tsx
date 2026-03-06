import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"

interface SelectOption {
  id: string
  name: string
}

interface AddMappingFormProps {
  teams: SelectOption[]
  selectedTeamId: string
  onTeamChange: (teamId: string) => void
  selectedProjectId: string
  onProjectChange: (projectId: string) => void
  availableProjects: SelectOption[]
  isLoadingProjects: boolean
  isSaving: boolean
  onAdd: () => void
}

export function AddMappingForm({
  teams,
  selectedTeamId,
  onTeamChange,
  selectedProjectId,
  onProjectChange,
  availableProjects,
  isLoadingProjects,
  isSaving,
  onAdd,
}: AddMappingFormProps) {
  return (
    <div className="space-y-3 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Add a mapping
      </p>

      <Select
        label="Team"
        placeholder="Select a team"
        value={selectedTeamId}
        onChange={(e) => onTeamChange(e.target.value)}
        options={teams.map((t) => ({ value: t.id, label: t.name }))}
      />

      {selectedTeamId && (
        <Select
          label="Project"
          placeholder={
            isLoadingProjects ? "Loading projects..." : "Select a project"
          }
          value={selectedProjectId}
          onChange={(e) => onProjectChange(e.target.value)}
          disabled={isLoadingProjects}
          options={availableProjects.map((p) => ({
            value: p.id,
            label: p.name,
          }))}
        />
      )}

      <Button
        onClick={onAdd}
        isLoading={isSaving}
        disabled={!selectedTeamId && !selectedProjectId}
        variant="secondary"
      >
        Add Mapping
      </Button>
    </div>
  )
}
