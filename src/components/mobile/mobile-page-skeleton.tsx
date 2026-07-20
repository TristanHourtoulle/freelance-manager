"use client"

import { MobileTopbar } from "@/components/mobile/mobile-topbar"
import { Skeleton } from "@/components/ui/skeleton"

export type MobilePageSkeletonVariant = "tiles" | "list" | "builder"

interface MobilePageSkeletonProps {
  title: string
  heading?: string
  subtitle?: string
  variant?: MobilePageSkeletonVariant
  rows?: number
  back?: string
}

/**
 * Full mobile page placeholder that mirrors the mobile frame:
 * `.m-screen` > `.m-topbar` + `.m-content` > optional `.big-header` + `.m-stack`.
 *
 * The topbar title and the big header are statically known per page, so they
 * are painted for real; only the data below is skeletonised. Rows reuse the
 * real `.card.card-tight` geometry used by the mobile list twins.
 *
 * @param title - Real topbar title, lifted verbatim from the mobile twin.
 * @param heading - Real `.big-title` text; omit when the twin has no big header.
 * @param subtitle - Real `.big-sub` text.
 * @param variant - `tiles` for KPI-led pages, `list` for list-led pages,
 * `builder` for the invoice builder flow.
 * @param rows - Number of row placeholders.
 * @param back - Forwarded to `MobileTopbar` to render the back button.
 */
export function MobilePageSkeleton({
  title,
  heading,
  subtitle,
  variant = "list",
  rows = 6,
  back,
}: MobilePageSkeletonProps) {
  const hasHeader = Boolean(heading ?? subtitle)

  return (
    <div className="m-screen" role="status" aria-live="polite">
      <span className="sr-only">Chargement en cours…</span>
      <MobileTopbar title={title} back={back} />

      <div className="m-content">
        {hasHeader && (
          <div className="big-header">
            {heading && <div className="big-title">{heading}</div>}
            {subtitle && <div className="big-sub">{subtitle}</div>}
          </div>
        )}

        <div
          className="m-stack"
          style={hasHeader ? undefined : { paddingTop: 8 }}
        >
          {variant === "tiles" && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 10,
              }}
            >
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="kpi-tile">
                  <div className="kpi-label">
                    <Skeleton width="55%" height={9} />
                  </div>
                  <div className="kpi-value">
                    <Skeleton width="70%" height={18} />
                  </div>
                  <div className="kpi-sub">
                    <Skeleton width="45%" height={10} />
                  </div>
                </div>
              ))}
            </div>
          )}

          {variant === "builder" && (
            <>
              <Skeleton height={64} radius={14} />
              <Skeleton height={180} radius={14} />
              <Skeleton height={120} radius={14} />
            </>
          )}

          {variant !== "builder" && (
            <div className="chip-row">
              {Array.from({ length: 3 }, (_, i) => (
                <Skeleton key={i} width={78} height={30} radius={99} />
              ))}
            </div>
          )}

          <div className="col gap-8">
            {Array.from({ length: rows }, (_, i) => (
              <div key={i} className="card card-tight">
                <div className="row gap-12">
                  <Skeleton width={34} height={34} radius={10} />
                  <div className="grow" style={{ minWidth: 0 }}>
                    <Skeleton width="60%" height={12} />
                    <div style={{ marginTop: 6 }}>
                      <Skeleton width="38%" height={10} />
                    </div>
                  </div>
                  <Skeleton width={56} height={13} radius={99} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
