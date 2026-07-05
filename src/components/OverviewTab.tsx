import { useMemo } from 'react'
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
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
import { fmtDuration, fmtInt, fmtKm, fmtPace } from '../lib/format'
import { AXIS, Card, EmptyNote, GRID, makeTooltip } from './ChartBits'
import { useCountUp } from '../hooks/useCountUp'

function Tile({
  label,
  value,
  count,
  format,
  delta,
  deltaGood,
}: {
  label: string
  value: string
  count?: number
  format?: (n: number) => string
  delta?: string
  deltaGood?: boolean | null
}) {
  const animated = useCountUp(count ?? 0)
  return (
    <div className="tile">
      <div className="label">{label}</div>
      <div className="value">{count != null && format ? format(animated) : value}</div>
      {delta && (
        <div className={`delta ${deltaGood == null ? '' : deltaGood ? 'up' : 'down'}`}>{delta}</div>
      )}
    </div>
  )
}

export function OverviewTab({ runs }: { runs: Run[] }) {
  const stats = useMemo(() => {
    const n = runs.length
    const totalKm = runs.reduce((s, r) => s + r.distance_km, 0)
    const totalCal = runs.reduce((s, r) => s + (r.calories_kcal ?? 0), 0)
    const totalSec = runs.reduce((s, r) => s + r.duration_seconds, 0)
    const paces = runs.map(r => r.avg_pace_sec_per_km).filter((p): p is number => p != null)
    const avgPace = paces.length ? paces.reduce((a, b) => a + b, 0) / paces.length : null
    const fastest = runs
      .map(r => r.fastest_pace_sec_per_km)
      .filter((p): p is number => p != null)
    const bestPace = fastest.length ? Math.min(...fastest) : null

    // first-half vs second-half deltas
    const mid = Math.floor(n / 2)
    let distDelta: number | null = null
    let paceDelta: number | null = null
    let calDelta: number | null = null
    if (mid >= 1) {
      const avg = (arr: Run[], f: (r: Run) => number | null) => {
        const v = arr.map(f).filter((x): x is number => x != null)
        return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
      }
      const fh = runs.slice(0, mid)
      const sh = runs.slice(mid)
      const d1 = avg(fh, r => r.distance_km)
      const d2 = avg(sh, r => r.distance_km)
      if (d1 != null && d2 != null) distDelta = d2 - d1
      const p1 = avg(fh, r => r.avg_pace_sec_per_km)
      const p2 = avg(sh, r => r.avg_pace_sec_per_km)
      if (p1 != null && p2 != null) paceDelta = p2 - p1
      const c1 = avg(fh, r => r.calories_kcal)
      const c2 = avg(sh, r => r.calories_kcal)
      if (c1 != null && c2 != null) calDelta = c2 - c1
    }

    // streak of consecutive days ending at the most recent run
    const dates = [...new Set(runs.map(r => r.workout_date))].sort().reverse()
    let streak = dates.length ? 1 : 0
    for (let i = 1; i < dates.length; i++) {
      const diff =
        (Date.parse(dates[i - 1] + 'T00:00:00Z') - Date.parse(dates[i] + 'T00:00:00Z')) / 86400000
      if (diff === 1) streak++
      else break
    }

    return { n, totalKm, totalCal, totalSec, avgPace, bestPace, distDelta, paceDelta, calDelta, streak }
  }, [runs])

  const data = useMemo(() => {
    let cum = 0
    return runs.map(r => {
      cum += r.distance_km
      return {
        label: r.label,
        dist: r.distance_km,
        cum: Math.round(cum * 100) / 100,
        pace: r.avg_pace_sec_per_km,
        cal: r.calories_kcal,
        avgHr: r.avg_hr_bpm,
        maxHr: r.max_hr_bpm,
        // training effect in minutes
        teLight: r.te_light_seconds != null ? r.te_light_seconds / 60 : null,
        teAerobic: r.te_aerobic_seconds != null ? r.te_aerobic_seconds / 60 : null,
        teIntensive: r.te_intensive_seconds != null ? r.te_intensive_seconds / 60 : null,
        teAnaerobic: r.te_anaerobic_seconds != null ? r.te_anaerobic_seconds / 60 : null,
        teVo2: r.te_vo2_max_seconds != null ? r.te_vo2_max_seconds / 60 : null,
      }
    })
  }, [runs])

  const paceDomain = useMemo(() => {
    const p = data.map(d => d.pace).filter((x): x is number => x != null)
    if (!p.length) return [0, 1] as [number, number]
    return [Math.floor(Math.min(...p) / 15) * 15 - 15, Math.ceil(Math.max(...p) / 15) * 15 + 15] as [
      number,
      number,
    ]
  }, [data])

  if (!runs.length) return <EmptyNote />

  const hasTE = data.some(d => d.teAerobic != null || d.teLight != null)

  return (
    <>
      <div className="tiles">
        <Tile
          label="Streak"
          value={`${stats.streak} day${stats.streak === 1 ? '' : 's'}`}
          count={stats.streak}
          format={n => `${Math.round(n)} day${Math.round(n) === 1 ? '' : 's'}`}
        />
        <Tile label="Runs" value={String(stats.n)} count={stats.n} format={n => String(Math.round(n))} />
        <Tile
          label="Distance"
          value={`${stats.totalKm.toFixed(1)} km`}
          count={stats.totalKm}
          format={n => `${n.toFixed(1)} km`}
          delta={
            stats.distDelta != null
              ? `${stats.distDelta >= 0 ? '+' : ''}${stats.distDelta.toFixed(2)} km/run`
              : undefined
          }
          deltaGood={stats.distDelta != null ? stats.distDelta >= 0 : null}
        />
        <Tile label="Time on feet" value={fmtDuration(stats.totalSec)} />
        <Tile
          label="Calories"
          value={`${fmtInt(stats.totalCal)} kcal`}
          count={stats.totalCal}
          format={n => `${fmtInt(n)} kcal`}
          delta={
            stats.calDelta != null
              ? `${stats.calDelta >= 0 ? '+' : ''}${Math.round(stats.calDelta)} kcal/run`
              : undefined
          }
          deltaGood={stats.calDelta != null ? stats.calDelta >= 0 : null}
        />
        <Tile
          label="Avg pace"
          value={`${fmtPace(stats.avgPace)} /km`}
          delta={
            stats.paceDelta != null
              ? `${fmtPace(Math.abs(stats.paceDelta))} ${stats.paceDelta < 0 ? 'faster' : 'slower'}`
              : undefined
          }
          deltaGood={stats.paceDelta != null ? stats.paceDelta < 0 : null}
        />
        <Tile label="Best pace" value={`${fmtPace(stats.bestPace)} /km`} />
      </div>

      <div className="grid-2">
        <Card title="Daily distance">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} unit=" km" />
              <Tooltip
                cursor={{ fill: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                content={makeTooltip((_k, v) => ({ label: 'Distance', value: `${fmtKm(v)} km`, color: 'var(--series-1)' }))}
              />
              <Bar dataKey="dist" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Avg pace" hint="↑ faster (axis reversed)">
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis
                {...AXIS}
                reversed
                domain={paceDomain}
                tickFormatter={v => fmtPace(v as number)}
              />
              <Tooltip
                content={makeTooltip((_k, v) => ({ label: 'Avg pace', value: `${fmtPace(v)} /km`, color: 'var(--series-2)' }))}
              />
              <Line
                dataKey="pace"
                stroke="var(--series-2)"
                strokeWidth={2}
                dot={{ r: 3, fill: 'var(--series-2)', strokeWidth: 0 }}
                activeDot={{ r: 5 }}
                connectNulls
              />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Calories burned">
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} />
              <Tooltip
                cursor={{ fill: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                content={makeTooltip((_k, v) => ({ label: 'Calories', value: `${fmtInt(v)} kcal`, color: 'var(--series-8)' }))}
              />
              <Bar dataKey="cal" fill="var(--series-8)" radius={[4, 4, 0, 0]} maxBarSize={26} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card title="Heart rate">
          {data.some(d => d.avgHr != null) ? (
            <ResponsiveContainer width="100%" height={230}>
              <LineChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
                <CartesianGrid {...GRID} />
                <XAxis dataKey="label" {...AXIS} />
                <YAxis {...AXIS} domain={['dataMin - 10', 'dataMax + 10']} unit=" bpm" />
                <Tooltip
                  content={makeTooltip((k, v) => ({
                    label: k === 'maxHr' ? 'Max HR' : 'Avg HR',
                    value: `${Math.round(v)} bpm`,
                    color: k === 'maxHr' ? 'var(--series-6)' : 'var(--series-1)',
                  }))}
                />
                <Legend />
                <Line
                  dataKey="maxHr"
                  name="Max HR"
                  stroke="var(--series-6)"
                  strokeWidth={1.5}
                  strokeDasharray="4 3"
                  dot={{ r: 2.5, fill: 'var(--series-6)', strokeWidth: 0 }}
                  connectNulls
                />
                <Line
                  dataKey="avgHr"
                  name="Avg HR"
                  stroke="var(--series-1)"
                  strokeWidth={2}
                  dot={{ r: 3, fill: 'var(--series-1)', strokeWidth: 0 }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <EmptyNote text="No heart-rate data in the selected range." />
          )}
        </Card>
      </div>

      <Card title="Cumulative distance">
        <ResponsiveContainer width="100%" height={190}>
          <AreaChart data={data} margin={{ top: 4, right: 8, left: -12, bottom: 0 }}>
            <CartesianGrid {...GRID} />
            <XAxis dataKey="label" {...AXIS} />
            <YAxis {...AXIS} unit=" km" />
            <Tooltip
              content={makeTooltip((_k, v) => ({ label: 'Total', value: `${fmtKm(v)} km`, color: 'var(--series-5)' }))}
            />
            <Area
              dataKey="cum"
              stroke="var(--series-5)"
              strokeWidth={2}
              fill="var(--series-5)"
              fillOpacity={0.1}
              dot={{ r: 2.5, fill: 'var(--series-5)', strokeWidth: 0 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      {hasTE && (
        <Card
          title="Training effect"
          hint="Minutes per intensity zone, per run (from FitShow's training-effect bars)"
        >
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={data} margin={{ top: 4, right: 8, left: -8, bottom: 0 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...AXIS} />
              <YAxis {...AXIS} unit=" min" />
              <Tooltip
                cursor={{ fill: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                content={makeTooltip((k, v) => {
                  const names: Record<string, [string, string]> = {
                    teLight: ['Light', 'var(--series-1)'],
                    teAerobic: ['Aerobic', 'var(--series-2)'],
                    teIntensive: ['Intensive', 'var(--series-3)'],
                    teAnaerobic: ['Anaerobic', 'var(--series-6)'],
                    teVo2: ['VO₂ max', 'var(--series-5)'],
                  }
                  const [label, color] = names[k] ?? [k, undefined]
                  return { label, value: fmtDuration(v * 60), color }
                })}
              />
              <Legend />
              <Bar dataKey="teLight" name="Light" stackId="te" fill="var(--series-1)" maxBarSize={26} />
              <Bar dataKey="teAerobic" name="Aerobic" stackId="te" fill="var(--series-2)" maxBarSize={26} />
              <Bar dataKey="teIntensive" name="Intensive" stackId="te" fill="var(--series-3)" maxBarSize={26} />
              <Bar dataKey="teAnaerobic" name="Anaerobic" stackId="te" fill="var(--series-6)" maxBarSize={26} />
              <Bar
                dataKey="teVo2"
                name="VO₂ max"
                stackId="te"
                fill="var(--series-5)"
                radius={[4, 4, 0, 0]}
                maxBarSize={26}
              />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      )}
    </>
  )
}
