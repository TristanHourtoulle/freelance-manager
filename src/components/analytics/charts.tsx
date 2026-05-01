"use client"

interface SparklineProps {
  data: number[]
  width?: number
  height?: number
}

/** Smooth-curve sparkline with area fill, used in the analytics hero. */
export function Sparkline({ data, width = 220, height = 64 }: SparklineProps) {
  if (data.length < 2) {
    return (
      <svg className="ana-spark" width={width} height={height}>
        <text
          x={width / 2}
          y={height / 2}
          textAnchor="middle"
          fill="oklch(0.58 0.01 240)"
          fontSize="11"
        >
          —
        </text>
      </svg>
    )
  }
  const max = Math.max(...data, 1)
  const min = Math.min(...data, 0)
  const span = max - min || 1
  const stepX = width / (data.length - 1)
  const points = data.map((v, i): [number, number] => [
    i * stepX,
    height - ((v - min) / span) * (height - 8) - 4,
  ])
  const path = points
    .map(
      (p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1),
    )
    .join(" ")
  const area = path + ` L ${width} ${height} L 0 ${height} Z`
  const last = points[points.length - 1]!
  return (
    <svg
      className="ana-spark"
      viewBox={`0 0 ${width} ${height}`}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="sparkfill" x1="0" y1="0" x2="0" y2="1">
          <stop
            offset="0%"
            stopColor="oklch(0.86 0.19 128)"
            stopOpacity="0.4"
          />
          <stop
            offset="100%"
            stopColor="oklch(0.86 0.19 128)"
            stopOpacity="0"
          />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#sparkfill)" />
      <path
        d={path}
        fill="none"
        stroke="oklch(0.86 0.19 128)"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <g>
        <circle
          cx={last[0]}
          cy={last[1]}
          r="6"
          fill="oklch(0.86 0.19 128)"
          opacity="0.2"
        />
        <circle cx={last[0]} cy={last[1]} r="3.5" fill="oklch(0.86 0.19 128)" />
      </g>
    </svg>
  )
}

interface DualChartProps {
  months: { label: string; paid: number; issued: number; isCurrent: boolean }[]
}

/** Stacked dual chart: bars for "paid" + smooth line for "issued". */
export function DualChart({ months }: DualChartProps) {
  if (!months.length) return null
  const max = Math.max(...months.flatMap((m) => [m.paid, m.issued]), 1)
  const W = 900,
    H = 280,
    padL = 50,
    padR = 16,
    padT = 16,
    padB = 30
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const stepX = innerW / months.length
  const barW = stepX * 0.32
  const ticks = 5
  const tickVals = Array.from({ length: ticks + 1 }, (_, i) =>
    Math.round((max * i) / ticks),
  )
  const linePts = months.map((m, i): [number, number] => [
    padL + i * stepX + stepX / 2,
    padT + innerH - (m.issued / max) * innerH,
  ])
  const linePath = linePts
    .map(
      (p, i) => (i === 0 ? "M" : "L") + p[0].toFixed(1) + " " + p[1].toFixed(1),
    )
    .join(" ")

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 280 }}>
      <defs>
        <linearGradient id="barpaid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="oklch(0.86 0.19 128)" stopOpacity="1" />
          <stop
            offset="100%"
            stopColor="oklch(0.86 0.19 128)"
            stopOpacity="0.55"
          />
        </linearGradient>
      </defs>
      {tickVals.map((t, i) => {
        const y = padT + innerH - (innerH * i) / ticks
        return (
          <g key={i}>
            <line
              x1={padL}
              y1={y}
              x2={W - padR}
              y2={y}
              stroke="oklch(0.32 0.010 240 / 0.4)"
              strokeDasharray={i === 0 ? "" : "2 4"}
            />
            <text
              x={padL - 8}
              y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="oklch(0.58 0.010 240)"
              fontFamily="JetBrains Mono"
            >
              {t >= 1000 ? (t / 1000).toFixed(0) + "k" : t}
            </text>
          </g>
        )
      })}
      {months.map((m, i) => {
        const x = padL + i * stepX + (stepX - barW) / 2
        const h = (m.paid / max) * innerH
        const y = padT + innerH - h
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="3"
              fill="url(#barpaid)"
            />
            <text
              x={padL + i * stepX + stepX / 2}
              y={H - padB + 18}
              textAnchor="middle"
              fontSize="11"
              fill={m.isCurrent ? "var(--text-0)" : "oklch(0.58 0.010 240)"}
              fontWeight={m.isCurrent ? 600 : 400}
            >
              {m.label}
            </text>
          </g>
        )
      })}
      <path
        d={linePath}
        fill="none"
        stroke="oklch(0.78 0.13 240)"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {linePts.map((p, i) => (
        <circle
          key={i}
          cx={p[0]}
          cy={p[1]}
          r="3.5"
          fill="oklch(0.20 0.01 240)"
          stroke="oklch(0.78 0.13 240)"
          strokeWidth="2"
        />
      ))}
    </svg>
  )
}

interface DonutSegment {
  label: string
  value: number
  color: string
}

interface DonutProps {
  segments: DonutSegment[]
  total: number
  format: (n: number) => string
}

/** Multi-segment donut with side legend rows. */
export function Donut({ segments, total, format }: DonutProps) {
  if (!segments.length) {
    return <div className="muted small">Pas encore de données</div>
  }
  const size = 160
  const stroke = 22
  const r = (size - stroke) / 2
  const C = 2 * Math.PI * r
  const ringSegments = segments.reduce<
    {
      label: string
      value: number
      color: string
      dash: number
      offset: number
    }[]
  >((rows, s) => {
    const previousAcc = rows.reduce((sum, r) => sum + r.value / total, 0)
    const frac = s.value / total
    rows.push({ ...s, dash: frac * C, offset: -previousAcc * C })
    return rows
  }, [])
  return (
    <div className="donut-wrap">
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        style={{ transform: "rotate(-90deg)" }}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--bg-3)"
          strokeWidth={stroke}
        />
        {ringSegments.map((s, i) => (
          <circle
            key={i}
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={stroke}
            strokeDasharray={`${s.dash} ${C - s.dash}`}
            strokeDashoffset={s.offset}
            strokeLinecap="butt"
          />
        ))}
        <g transform={`rotate(90 ${size / 2} ${size / 2})`}>
          <text
            x={size / 2}
            y={size / 2 - 2}
            textAnchor="middle"
            fontSize="11"
            fill="oklch(0.58 0.010 240)"
          >
            Total
          </text>
          <text
            x={size / 2}
            y={size / 2 + 16}
            textAnchor="middle"
            fontSize="16"
            fontWeight="700"
            fontFamily="JetBrains Mono"
            fill="oklch(0.97 0.004 240)"
          >
            {format(total).replace(/ /g, " ")}
          </text>
        </g>
      </svg>
      <div className="donut-rows">
        {segments.map((s, i) => (
          <div key={i} className="donut-row">
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="lbl">
              {s.label}
              <span className="pct">
                {Math.round((s.value / total) * 100)}%
              </span>
            </span>
            <span className="val">{format(s.value)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

interface ThroughputChartProps {
  weeks: { label: string; done: number; invoiced: number }[]
}

/** Side-by-side bars for "done" and "invoiced" tasks per week. */
export function ThroughputChart({ weeks }: ThroughputChartProps) {
  if (!weeks.length) return null
  const max = Math.max(...weeks.flatMap((w) => [w.done, w.invoiced]), 1)
  const W = 600,
    H = 220,
    padL = 30,
    padR = 16,
    padT = 16,
    padB = 28
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const stepX = innerW / weeks.length
  const barW = stepX * 0.36
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: "100%", height: 220 }}>
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const y = padT + innerH - innerH * t
        return (
          <line
            key={i}
            x1={padL}
            y1={y}
            x2={W - padR}
            y2={y}
            stroke="oklch(0.32 0.010 240 / 0.3)"
            strokeDasharray={t === 0 ? "" : "2 4"}
          />
        )
      })}
      {weeks.map((w, i) => {
        const xBase = padL + i * stepX + stepX / 2
        const hd = (w.done / max) * innerH
        const hi = (w.invoiced / max) * innerH
        return (
          <g key={i}>
            <rect
              x={xBase - barW - 1}
              y={padT + innerH - hd}
              width={barW}
              height={hd}
              rx="2"
              fill="oklch(0.86 0.19 128)"
            />
            <rect
              x={xBase + 1}
              y={padT + innerH - hi}
              width={barW}
              height={hi}
              rx="2"
              fill="oklch(0.75 0.15 300)"
            />
          </g>
        )
      })}
    </svg>
  )
}

interface ActivityHeatmapProps {
  rows: number[][]
  weekLabels?: string[]
}

const HEAT_COLORS = [
  "var(--bg-3)",
  "oklch(0.86 0.19 128 / 0.25)",
  "oklch(0.86 0.19 128 / 0.5)",
  "oklch(0.86 0.19 128 / 0.75)",
  "oklch(0.86 0.19 128)",
]
const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"]

/**
 * Day-of-week × week heatmap. `rows` is 7 arrays of N week counts.
 * Buckets values into 5 intensity levels by max in dataset.
 */
export function ActivityHeatmap({ rows, weekLabels }: ActivityHeatmapProps) {
  const flat = rows.flat()
  const max = Math.max(...flat, 1)
  const intensity = (n: number) =>
    n === 0 ? 0 : Math.min(4, Math.max(1, Math.ceil((n / max) * 4)))
  const weeksCount = rows[0]?.length ?? 12
  const labels =
    weekLabels ??
    Array.from({ length: weeksCount }, (_, i) =>
      i % 3 === 0 ? `S${i + 1}` : "",
    )
  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "40px 1fr", gap: 6 }}>
        <div />
        <div
          style={{
            display: "grid",
            gridTemplateColumns: `repeat(${weeksCount}, 1fr)`,
            gap: 4,
          }}
        >
          {labels.map((l, i) => (
            <div key={i} className="xs muted" style={{ textAlign: "center" }}>
              {l}
            </div>
          ))}
        </div>
      </div>
      {DAYS.map((d, di) => (
        <div
          key={d}
          style={{
            display: "grid",
            gridTemplateColumns: "40px 1fr",
            gap: 6,
            marginTop: 4,
          }}
        >
          <div className="xs muted" style={{ alignSelf: "center" }}>
            {d}
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: `repeat(${weeksCount}, 1fr)`,
              gap: 4,
            }}
          >
            {(rows[di] ?? []).map((v, wi) => (
              <div
                key={wi}
                className="heat-cell"
                style={{ background: HEAT_COLORS[intensity(v)] }}
                title={`${v} task${v > 1 ? "s" : ""}`}
              />
            ))}
          </div>
        </div>
      ))}
      <div
        className="row gap-8"
        style={{
          marginTop: 14,
          justifyContent: "flex-end",
          fontSize: 11,
          color: "var(--text-2)",
        }}
      >
        <span>Moins</span>
        {HEAT_COLORS.map((c, i) => (
          <div
            key={i}
            style={{ width: 12, height: 12, background: c, borderRadius: 3 }}
          />
        ))}
        <span>Plus</span>
      </div>
    </div>
  )
}
