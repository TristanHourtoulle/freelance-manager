import { fmtRelative } from "@/lib/format"
import type { ActivityItemDTO, ActivityKind } from "@/hooks/use-client-detail"

interface ClientActivityTimelineProps {
  items: ActivityItemDTO[]
}

const DOT_VARIANT: Record<
  ActivityKind,
  "accent" | "info" | "warn" | "danger" | "default"
> = {
  CLIENT_CREATED: "info",
  CLIENT_UPDATED: "default",
  CLIENT_ARCHIVED: "warn",
  CLIENT_DUPLICATED: "info",
  INVOICE_CREATED: "info",
  INVOICE_SENT: "warn",
  INVOICE_CANCELLED: "danger",
  PAYMENT_RECORDED: "accent",
  PAYMENT_DELETED: "danger",
  TASKS_PENDING: "info",
  LINEAR_SYNCED: "info",
}

/**
 * Vertical timeline of ActivityLog rows for a client. Mirrors the design's
 * "Activité" tab — accent dot for paid invoices, warn for sent, info for
 * neutral updates.
 */
export function ClientActivityTimeline({ items }: ClientActivityTimelineProps) {
  if (items.length === 0) {
    return (
      <div className="empty">
        <div className="empty-title">Aucune activité</div>
        Les actions sur ce client apparaîtront ici.
      </div>
    )
  }
  return (
    <div className="timeline">
      {items.map((a) => {
        const variant = DOT_VARIANT[a.kind] ?? "default"
        return (
          <div key={a.id} className="timeline-item">
            <div
              className={
                "timeline-dot" + (variant !== "default" ? ` ${variant}` : "")
              }
            />
            <div className="timeline-title">{a.title}</div>
            <div className="timeline-meta">
              {a.meta ? `${a.meta} · ` : ""}
              {fmtRelative(a.createdAt)}
            </div>
          </div>
        )
      })}
    </div>
  )
}
