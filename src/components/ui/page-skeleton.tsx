import { Skeleton, SkeletonKpi, SkeletonRow } from "@/components/ui/skeleton"

interface PageSkeletonProps {
  kpis?: number
  rows?: number
  showChart?: boolean
  label?: string
}

/**
 * Full desktop page placeholder that mirrors the real `.page` skeleton:
 * header, KPI grid, optional chart card and a table card.
 *
 * Reuses the real container classes (`.page`, `.page-header`, `.page-actions`,
 * `.kpi-grid`, `.card`) so spacing, borders and radii come from the same rules
 * as the content it stands in for and nothing shifts on handover.
 *
 * @param kpis - Number of KPI tiles; `0` omits the grid entirely.
 * @param rows - Number of table-row placeholders in the trailing card.
 * @param showChart - Render a chart card between the KPI grid and the table.
 * @param label - Screen-reader announcement for the live region.
 */
export function PageSkeleton({
  kpis = 4,
  rows = 8,
  showChart = false,
  label = "Chargement en cours…",
}: PageSkeletonProps) {
  return (
    <div className="page" role="status" aria-live="polite">
      <span className="sr-only">{label}</span>

      <div className="page-header">
        <div>
          <Skeleton width={220} height={28} radius={8} />
          <div style={{ marginTop: 10 }}>
            <Skeleton width={300} height={14} />
          </div>
        </div>
        <div className="page-actions">
          <Skeleton width={126} height={34} radius="var(--radius-sm)" />
          <Skeleton width={162} height={34} radius="var(--radius-sm)" />
        </div>
      </div>

      {kpis > 0 && (
        <div className="kpi-grid">
          {Array.from({ length: kpis }, (_, i) => (
            <SkeletonKpi key={i} />
          ))}
        </div>
      )}

      {showChart && (
        <div className="card" style={{ marginBottom: 28 }}>
          <Skeleton width="34%" height={16} />
          <div style={{ marginTop: 16 }}>
            <Skeleton height={220} radius="var(--radius-sm)" />
          </div>
        </div>
      )}

      <div className="card">
        <Skeleton width="28%" height={16} />
        <div style={{ marginTop: 12 }}>
          {Array.from({ length: rows }, (_, i) => (
            <SkeletonRow key={i} />
          ))}
        </div>
      </div>
    </div>
  )
}
