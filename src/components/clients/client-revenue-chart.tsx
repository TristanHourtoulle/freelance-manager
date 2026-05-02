interface ClientRevenueChartProps {
  data: { month: string; total: number }[]
}

/**
 * Compact 12-month revenue line chart with accent fill, used in the
 * "Évolution du revenu" overview card. Pure SVG so it stays light and
 * matches the green accent everywhere else in the app.
 */
export function ClientRevenueChart({ data }: ClientRevenueChartProps) {
  const W = 500
  const H = 90
  const pad = 6
  const safe = data.length > 0 ? data : [{ month: "—", total: 0 }]
  const max = Math.max(1, ...safe.map((d) => d.total))
  const innerW = W - pad * 2
  const stepX = safe.length > 1 ? innerW / (safe.length - 1) : 0
  const pts = safe.map((d, i) => {
    const x = pad + i * stepX
    const y = H - pad - (d.total / max) * (H - pad * 2)
    return [x, y] as const
  })
  const path = pts
    .map(
      (p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1),
    )
    .join(" ")
  const last = pts[pts.length - 1]
  const first = pts[0]
  const area =
    last && first
      ? `${path} L${last[0].toFixed(1)} ${H - pad} L${first[0].toFixed(1)} ${H - pad} Z`
      : path

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      style={{ width: "100%", height: H, display: "block" }}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="rev-grad" x1="0" x2="0" y1="0" y2="1">
          <stop
            offset="0%"
            stopColor="oklch(0.86 0.19 128)"
            stopOpacity="0.30"
          />
          <stop
            offset="100%"
            stopColor="oklch(0.86 0.19 128)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#rev-grad)" />
      <path
        d={path}
        fill="none"
        stroke="oklch(0.86 0.19 128)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {last && (
        <g>
          <circle cx={last[0]} cy={last[1]} r="4" fill="oklch(0.86 0.19 128)" />
          <circle
            cx={last[0]}
            cy={last[1]}
            r="8"
            fill="oklch(0.86 0.19 128)"
            opacity="0.2"
          />
        </g>
      )}
    </svg>
  )
}
