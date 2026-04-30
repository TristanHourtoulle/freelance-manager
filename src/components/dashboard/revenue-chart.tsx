"use client"

interface MonthData {
  month: string
  total: number
  isCurrent: boolean
}

export function RevenueChart({ months }: { months: MonthData[] }) {
  const max = Math.max(...months.map((m) => m.total), 1000)
  const W = 600
  const H = 240
  const padL = 50
  const padR = 16
  const padT = 16
  const padB = 32
  const innerW = W - padL - padR
  const innerH = H - padT - padB
  const barW = (innerW / months.length) * 0.6
  const stepX = innerW / months.length

  const yTicks = 4
  const ticks = Array.from({ length: yTicks + 1 }, (_, i) =>
    Math.round((max * i) / yTicks),
  )

  return (
    <svg
      className="chart-svg"
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="none"
    >
      {ticks.map((t, i) => {
        const y = padT + innerH - (innerH * i) / yTicks
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
        const h = (m.total / max) * innerH
        const x = padL + i * stepX + (stepX - barW) / 2
        const y = padT + innerH - h
        return (
          <g key={i}>
            <rect
              x={x}
              y={y}
              width={barW}
              height={h}
              rx="3"
              fill={
                m.isCurrent
                  ? "oklch(0.86 0.19 128)"
                  : "oklch(0.86 0.19 128 / 0.45)"
              }
            />
            <text
              x={x + barW / 2}
              y={H - padB + 16}
              textAnchor="middle"
              fontSize="11"
              fill="oklch(0.58 0.010 240)"
            >
              {m.month}
            </text>
            {m.total > 0 && (
              <text
                x={x + barW / 2}
                y={y - 6}
                textAnchor="middle"
                fontSize="10"
                fill="oklch(0.78 0.008 240)"
                fontFamily="JetBrains Mono"
                fontWeight="500"
              >
                {(m.total / 1000).toFixed(1)}k
              </text>
            )}
          </g>
        )
      })}
    </svg>
  )
}
