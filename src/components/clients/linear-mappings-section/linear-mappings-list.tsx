import { Button } from "@/components/ui/button"

import type { LinearMappingDTO } from "@/components/clients/types"

interface LinearMappingsListProps {
  mappings: LinearMappingDTO[]
  teamLookup: Map<string, string>
  projectLookup: Map<string, string>
  onDelete: (mappingId: string) => void
}

export function LinearMappingsList({
  mappings,
  teamLookup,
  projectLookup,
  onDelete,
}: LinearMappingsListProps) {
  if (mappings.length === 0) {
    return (
      <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
        No Linear projects mapped to this client yet.
      </p>
    )
  }

  return (
    <div className="mb-4 space-y-2">
      {mappings.map((mapping) => (
        <div
          key={mapping.id}
          className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-700"
        >
          <div className="text-sm">
            {mapping.linearTeamId && (
              <span className="text-zinc-600 dark:text-zinc-400">
                {teamLookup.get(mapping.linearTeamId) ?? mapping.linearTeamId}
              </span>
            )}
            {mapping.linearTeamId && mapping.linearProjectId && (
              <span className="mx-1.5 text-zinc-400 dark:text-zinc-600">/</span>
            )}
            {mapping.linearProjectId && (
              <span className="font-medium text-zinc-900 dark:text-zinc-100">
                {projectLookup.get(mapping.linearProjectId) ??
                  mapping.linearProjectId}
              </span>
            )}
          </div>
          <Button
            variant="ghost"
            className="text-xs text-red-600 hover:text-red-700 dark:text-red-400 dark:hover:text-red-300"
            onClick={() => onDelete(mapping.id)}
          >
            Remove
          </Button>
        </div>
      ))}
    </div>
  )
}
