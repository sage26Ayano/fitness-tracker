import { useEffect, useMemo, useState } from 'react'
import {
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Run } from '../lib/types'
import { fmtKm, fmtPace } from '../lib/format'
import { AXIS, Card, EmptyNote, GRID, TooltipCard } from './ChartBits'

const SEQ = [
  'var(--seq-100)',
  'var(--seq-200)',
  'var(--seq-300)',
  'var(--seq-400)',
  'var(--seq-500)',
  'var(--seq-600)',
  'var(--seq-700)',
]
// ink that clears each sequential step
const SEQ_INK = ['#0b0b0b', '#0b0b0b', '#0b0b0b', '#ffffff', '#ffffff', '#ffffff', '#ffffff']

const SERIES = Array.from({ length: 8 }, (_, i) => `var(--series-${i + 1})`)

/** full-km splits only (excludes the partial trailing split) */
function fullSplits(r: Run) {
  return r.workout_splits.filter(s => s.distance_km >= 0.95 && s.distance_km <= 1.05)
}

export function SplitsTab({ runs }: { runs: Run[] }) {
  const withSplits = useMemo(() => runs.filter(r => r.workout_splits.length), [runs])

  const maxN = useMemo(
    () => Math.max(0, ...withSplits.flatMap(r => fullSplits(r).map(s => s.split_number))),
    [withSplits],
  )

  const [paceMin, paceMax] = useMemo(() => {
    const p = withSplits.flatMap(r => fullSplits(r).map(s => s.pace_sec_per_km))
    return p.length ? [Math.min(...p), Math.max(...p)] : [0, 1]
  }, [withSplits])

  // faster pace → darker step
  const stepFor = (pace: number) => {
    if (paceMax === paceMin) return 3
    const t = (paceMax - pace) / (paceMax - paceMin) // 1 = fastest
    return Math.min(6, Math.max(0, Math.round(t * 6)))
  }

  // ── compare-runs selection (default: 5 most recent) ──
  const [selected, setSelected] = useState<string[]>([])
  useEffect(() => {
    setSelected(withSplits.slice(-5).map(r => r.runKey))
  }, [withSplits])

  const colorFor = useMemo(() => {
    const map = new Map<string, string>()
    withSplits.forEach((r, i) => map.set(r.runKey, SERIES[i % 8]))
    return (key: string) => map.get(key) ?? SERIES[0]
  }, [withSplits])

  const compareData = useMemo(() => {
    const rows: Record<string, number | string>[] = []
    for (let n = 1; n <= maxN; n++) {
      const row: Record<string, number | string> = { km: `km ${n}` }
      for (const r of withSplits) {
        if (!selected.includes(r.runKey)) continue
        const s = fullSplits(r).find(x => x.split_number === n)
        if (s) row[r.runKey] = s.pace_sec_per_km
      }
      rows.push(row)
    }
    return rows
  }, [withSplits, selected, maxN])

  const compareDomain = useMemo(() => {
    const vals = compareData.flatMap(row =>
      Object.entries(row)
        .filter(([k]) => k !== 'km')
        .map(([, v]) => Number(v)),
    )
    if (!vals.length) return [0, 1] as [number, number]
    return [
      Math.floor(Math.min(...vals) / 15) * 15 - 15,
      Math.ceil(Math.max(...vals) / 15) * 15 + 15,
    ] as [number, number]
  }, [compareData])

  if (!withSplits.length) return <EmptyNote text="No splits in the selected range." />

  return (
    <>
      <Card
        title="Split pace heatmap"
        hint="Each row = one run · each column = 1 km split · darker = faster"
      >
        <div className="table-scroll">
          <div
            className="heatmap"
            style={{ gridTemplateColumns: `auto repeat(${maxN}, minmax(52px, 1fr))` }}
          >
            <div className="hm-head" />
            {Array.from({ length: maxN }, (_, i) => (
              <div className="hm-head" key={i}>
                km {i + 1}
              </div>
            ))}
            {withSplits.map(r => {
              const splits = fullSplits(r)
              return [
                <div className="hm-run" key={r.runKey}>
                  {r.label}
                </div>,
                ...Array.from({ length: maxN }, (_, i) => {
                  const s = splits.find(x => x.split_number === i + 1)
                  if (!s) return <div className="cell empty" key={`${r.runKey}-${i}`} />
                  const step = stepFor(s.pace_sec_per_km)
                  return (
                    <div
                      className="cell"
                      key={`${r.runKey}-${i}`}
                      style={{ background: SEQ[step], color: SEQ_INK[step] }}
                      title={`${r.runKey} · km ${i + 1} · ${fmtPace(s.pace_sec_per_km)} /km`}
                    >
                      {fmtPace(s.pace_sec_per_km)}
                    </div>
                  )
                }),
              ]
            })}
          </div>
        </div>
      </Card>

      <Card
        title="All splits (raw)"
        hint="One row per run · includes the partial trailing split the heatmap excludes"
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Run</th>
                <th>Total (km)</th>
                {Array.from(
                  { length: Math.max(...withSplits.map(r => r.workout_splits.length)) },
                  (_, i) => (
                    <th key={i}>km {i + 1}</th>
                  ),
                )}
              </tr>
            </thead>
            <tbody>
              {[...withSplits].reverse().map(r => (
                <tr key={r.runKey}>
                  <td>{r.runKey}</td>
                  <td>{fmtKm(r.distance_km)}</td>
                  {Array.from(
                    { length: Math.max(...withSplits.map(x => x.workout_splits.length)) },
                    (_, i) => {
                      const s = r.workout_splits[i]
                      if (!s) return <td key={i}>—</td>
                      const partial = s.distance_km < 0.95
                      return (
                        <td key={i}>
                          {fmtPace(s.pace_sec_per_km)}
                          {partial && ` (${fmtKm(s.distance_km)}km)`}
                          {s.is_fastest && ' ⚡'}
                        </td>
                      )
                    },
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      <Card title="Compare runs" hint="Overlay split paces · ↑ faster · up to 8 runs">
        <div className="run-picker">
          {withSplits.map(r => {
            const on = selected.includes(r.runKey)
            return (
              <button
                key={r.runKey}
                className={on ? 'on' : ''}
                style={{ ['--chip' as string]: colorFor(r.runKey) }}
                onClick={() =>
                  setSelected(sel =>
                    on
                      ? sel.filter(k => k !== r.runKey)
                      : sel.length >= 8
                        ? sel
                        : [...sel, r.runKey],
                  )
                }
              >
                {r.label}
              </button>
            )
          })}
        </div>
        {selected.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={compareData} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="km" {...AXIS} />
              <YAxis
                {...AXIS}
                reversed
                domain={compareDomain}
                tickFormatter={v => fmtPace(v as number)}
              />
              <Tooltip
                content={({ active, payload, label }) =>
                  active && payload?.length ? (
                    <TooltipCard
                      title={String(label)}
                      rows={payload
                        .filter(p => p.value != null)
                        .map(p => ({
                          color: String(p.stroke ?? p.color ?? ''),
                          label: String(p.name),
                          value: `${fmtPace(Number(p.value))} /km`,
                        }))}
                    />
                  ) : null
                }
              />
              <Legend />
              {withSplits
                .filter(r => selected.includes(r.runKey))
                .map(r => {
                  const latest = r.runKey === withSplits[withSplits.length - 1].runKey
                  return (
                    <Line
                      key={r.runKey}
                      dataKey={r.runKey}
                      name={r.label}
                      stroke={colorFor(r.runKey)}
                      strokeWidth={latest ? 2.5 : 1.5}
                      dot={{ r: latest ? 4 : 3, fill: colorFor(r.runKey), strokeWidth: 0 }}
                      connectNulls
                    />
                  )
                })}
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <EmptyNote text="Select at least one run to compare." />
        )}
      </Card>
    </>
  )
}
