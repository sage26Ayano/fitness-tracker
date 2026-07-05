import type { ReactNode } from 'react'

export const AXIS = {
  stroke: 'var(--axis)',
  tickLine: false as const,
  axisLine: { stroke: 'var(--axis)' },
}

/** X-axis props that keep labels readable once there are many data points. */
export function xAxisProps(pointCount: number) {
  const crowded = pointCount > 8
  return {
    ...AXIS,
    interval: crowded ? ('preserveStartEnd' as const) : 0,
    angle: crowded ? -35 : 0,
    textAnchor: crowded ? ('end' as const) : ('middle' as const),
    height: crowded ? 52 : 30,
    tick: { fontSize: crowded ? 11 : 12 },
    dy: crowded ? 4 : 8,
  }
}

export const GRID = { stroke: 'var(--grid)', vertical: false }

interface TTRow {
  color?: string
  label: string
  value: string
}

export function TooltipCard({ title, rows }: { title: string; rows: TTRow[] }) {
  return (
    <div className="chart-tooltip">
      <div className="tt-title">{title}</div>
      {rows.map((r, i) => (
        <div className="tt-row" key={i}>
          {r.color && <span className="tt-dot" style={{ background: r.color }} />}
          <span>
            {r.label}: <strong>{r.value}</strong>
          </span>
        </div>
      ))}
    </div>
  )
}

interface TTEntry {
  dataKey?: unknown
  value?: unknown
  color?: string
  payload?: Record<string, unknown>
}
interface TP {
  active?: boolean
  payload?: readonly TTEntry[]
  label?: unknown
}

/** Generic recharts tooltip: formats each visible series with a formatter. */
export function makeTooltip(
  format: (key: string, value: number, payload: Record<string, unknown>) => TTRow | null,
) {
  return function ChartTooltip({ active, payload, label }: TP): ReactNode {
    if (!active || !payload?.length) return null
    const rows = payload
      .map(p =>
        p.value == null ? null : format(String(p.dataKey), Number(p.value), p.payload ?? {}),
      )
      .filter((r): r is TTRow => r != null)
      .map((r, i) => ({ ...r, color: r.color ?? payload[i]?.color ?? undefined }))
    if (!rows.length) return null
    return <TooltipCard title={String(label)} rows={rows} />
  }
}

export function Card({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: ReactNode
}) {
  return (
    <div className="card">
      <h3>{title}</h3>
      {hint ? <p className="hint">{hint}</p> : <div style={{ height: 8 }} />}
      {children}
    </div>
  )
}

export function EmptyNote({ text = 'No data in the selected range.' }: { text?: string }) {
  return <div className="empty-note">{text}</div>
}
