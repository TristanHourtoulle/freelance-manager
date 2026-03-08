import { TrashIcon } from "@heroicons/react/24/outline"

import type { LinearMappingDTO } from "@/components/clients/types"

interface LinearMappingsListProps {
  mappings: LinearMappingDTO[]
  teamLookup: Map<string, string>
  projectLookup: Map<string, string>
  onDelete: (mappingId: string) => void
}

/** List of existing Linear mappings with delete buttons. Used inside LinearMappingsSection. */
export function LinearMappingsList({
  mappings,
  teamLookup,
  projectLookup,
  onDelete,
}: LinearMappingsListProps) {
  if (mappings.length === 0) {
    return (
      <p className="mb-4 text-sm text-text-secondary">
        No Linear projects mapped to this client yet.
      </p>
    )
  }

  return (
    <div className="mb-4 space-y-2">
      {mappings.map((mapping) => (
        <div
          key={mapping.id}
          className="flex items-center justify-between rounded-lg border border-border px-4 py-3"
        >
          <div className="text-sm">
            {mapping.linearTeamId && (
              <span className="text-text-secondary">
                {teamLookup.get(mapping.linearTeamId) ?? mapping.linearTeamId}
              </span>
            )}
            {mapping.linearTeamId && mapping.linearProjectId && (
              <span className="mx-1.5 text-text-muted">/</span>
            )}
            {mapping.linearProjectId && (
              <span className="font-medium text-text-primary">
                {projectLookup.get(mapping.linearProjectId) ??
                  mapping.linearProjectId}
              </span>
            )}
          </div>
          <button
            className="rounded-lg p-1.5 text-destructive transition-colors hover:bg-red-50 hover:text-destructive-hover"
            onClick={() => onDelete(mapping.id)}
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
