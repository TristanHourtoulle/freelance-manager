"use client"

import { useTranslations } from "next-intl"

interface TaskPreviewCardProps {
  title: string
  projectName: string
  estimate: number | undefined
  description: string | undefined
}

/**
 * Read-only preview card showing what a task will look like once created.
 * Mirrors the KanbanTaskCard styling and updates in real-time from form values.
 */
export function TaskPreviewCard({
  title,
  projectName,
  estimate,
  description,
}: TaskPreviewCardProps) {
  const t = useTranslations("newTask")

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <p className="mb-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {t("previewTitle")}
      </p>

      <div className="bg-card rounded-lg border border-border p-3">
        {/* Identifier placeholder */}
        <p className="text-xs font-mono text-muted-foreground">NEW-XXX</p>

        {/* Title */}
        <p className="mt-1 text-sm font-medium line-clamp-2">
          {title || (
            <span className="text-muted-foreground/50 italic">
              {t("titlePlaceholder")}
            </span>
          )}
        </p>

        {/* Project name */}
        {projectName ? (
          <p className="mt-1 text-xs text-muted-foreground">{projectName}</p>
        ) : (
          <p className="mt-1 text-xs text-muted-foreground/50 italic">
            {t("selectProject")}
          </p>
        )}

        {/* Estimate */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            {estimate !== undefined && estimate > 0 ? (
              <span className="text-xs text-muted-foreground">{estimate}h</span>
            ) : (
              <span className="text-xs text-muted-foreground/50 italic">
                {t("estimatePlaceholder")}
              </span>
            )}
          </div>
        </div>

        {/* Description preview */}
        {description && (
          <div className="mt-3 border-t border-border pt-2">
            <p className="text-xs text-muted-foreground line-clamp-3">
              {description.replace(/[#*_`~>\-\[\]()]/g, "").slice(0, 200)}
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
