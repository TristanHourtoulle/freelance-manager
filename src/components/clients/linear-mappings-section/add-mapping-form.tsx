import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

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

/** Inline form for adding a new Linear team/project mapping. Used inside LinearMappingsSection. */
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
    <div className="space-y-3 rounded-lg border border-dashed border-border-input p-4">
      <p className="text-sm font-medium text-text-secondary">Add a mapping</p>

      <div className="space-y-1.5">
        <label className="text-sm font-medium text-muted-foreground">
          Team
        </label>
        <Select
          value={selectedTeamId || undefined}
          onValueChange={(val) => {
            if (val) onTeamChange(val)
          }}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a team" />
          </SelectTrigger>
          <SelectContent>
            {teams.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedTeamId && (
        <div className="space-y-1.5">
          <label className="text-sm font-medium text-muted-foreground">
            Project
          </label>
          <Select
            value={selectedProjectId || undefined}
            onValueChange={(val) => {
              if (val) onProjectChange(val)
            }}
            disabled={isLoadingProjects}
          >
            <SelectTrigger>
              <SelectValue
                placeholder={
                  isLoadingProjects ? "Loading projects..." : "Select a project"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {availableProjects.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <Button
        onClick={onAdd}
        isLoading={isSaving}
        disabled={!selectedTeamId && !selectedProjectId}
        variant="outline"
      >
        Add Mapping
      </Button>
    </div>
  )
}
