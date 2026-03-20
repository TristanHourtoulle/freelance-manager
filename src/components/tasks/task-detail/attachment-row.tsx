import { PaperClipIcon } from "@heroicons/react/20/solid"
import type { AttachmentDTO } from "@/components/tasks/types"
import { formatDate } from "./utils"

export function AttachmentRow({ attachment }: { attachment: AttachmentDTO }) {
  return (
    <a
      href={attachment.url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-3 rounded-lg border border-border/50 p-3 transition-colors hover:bg-surface-muted/50"
    >
      <PaperClipIcon className="h-4 w-4 shrink-0 text-text-muted" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-text-primary">
          {attachment.title}
        </p>
        {attachment.subtitle && (
          <p className="truncate text-xs text-text-muted">
            {attachment.subtitle}
          </p>
        )}
      </div>
      <span className="text-xs text-text-muted">
        {formatDate(attachment.createdAt)}
      </span>
    </a>
  )
}
