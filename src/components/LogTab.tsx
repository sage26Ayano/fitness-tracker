import { useMemo, useState } from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { Run } from '../lib/types'
import {
  downloadCsv,
  fmtDuration,
  fmtInt,
  fmtKm,
  fmtPace,
  hrZone,
  paceZone,
} from '../lib/format'
import { AXIS, Card, EmptyNote, GRID, makeTooltip, xAxisProps } from './ChartBits'

/** ISO week start (Monday) for a YYYY-MM-DD date */
function weekStart(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  const dow = (d.getUTCDay() + 6) % 7
  d.setUTCDate(d.getUTCDate() - dow)
  return d.toISOString().slice(0, 10)
}

function fmtShort(iso: string) {
  return new Date(iso + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function LogTab({ runs }: { runs: Run[] }) {
  const maxDist = useMemo(
    () => Math.max(1, ...runs.map(r => r.distance_km)),
    [runs],
  )
  const types = useMemo(
    () => [...new Set(runs.map(r => r.activity_type))].sort(),
    [runs],
  )
  const [minDist, setMinDist] = useState(0)
  const [typeFilter, setTypeFilter] = useState<string>('all')

  const filtered = useMemo(
    () =>
      runs.filter(
        r => r.distance_km >= minDist && (typeFilter === 'all' || r.activity_type === typeFilter),
      ),
    [runs, minDist, typeFilter],
  )

  // ── personal records ──
  const prs = useMemo(() => {
    if (!filtered.length) return null
    const by = <T,>(f: (r: Run) => T | null, cmp: (a: T, b: T) => boolean) => {
      let best: Run | null = null
      for (const r of filtered) {
        const v = f(r)
        if (v == null) continue
        const bv = best ? f(best) : null
        if (bv == null || cmp(v, bv)) best = r
      }
      return best
    }
    return {
      longest: by(r => r.distance_km, (a, b) => a > b),
      calories: by(r => r.calories_kcal, (a, b) => a > b),
      pace: by(r => r.avg_pace_sec_per_km, (a, b) => a < b),
      steps: by(r => r.steps, (a, b) => a > b),
    }
  }, [filtered])

  // ── weekly volume + grouped rows ──
  const weeks = useMemo(() => {
    const map = new Map<string, Run[]>()
    for (const r of filtered) {
      const w = weekStart(r.workout_date)
      const arr = map.get(w) ?? []
      arr.push(r)
      map.set(w, arr)
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1)) // newest week first
  }, [filtered])

  const weeklyChart = useMemo(
    () =>
      [...weeks]
        .reverse()
        .map(([w, rs]) => ({
          label: fmtShort(w),
          km: Math.round(rs.reduce((s, r) => s + r.distance_km, 0) * 100) / 100,
        })),
    [weeks],
  )

  const hrRows = filtered
    .filter(r => r.avg_hr_bpm != null)
    .slice()
    .reverse()
  const stepRows = filtered
    .filter(r => (r.steps ?? 0) > 0)
    .slice()
    .reverse()

  if (!runs.length) return <EmptyNote />

  return (
    <>
      {prs && (
        <div className="tiles">
          <div className="tile">
            <div className="label">Longest run</div>
            <div className="value">{fmtKm(prs.longest?.distance_km)} km</div>
            <div className="delta">on {prs.longest?.label}</div>
          </div>
          <div className="tile">
            <div className="label">Most calories</div>
            <div className="value">{fmtInt(prs.calories?.calories_kcal)} kcal</div>
            <div className="delta">on {prs.calories?.label}</div>
          </div>
          <div className="tile">
            <div className="label">Fastest avg pace</div>
            <div className="value">{fmtPace(prs.pace?.avg_pace_sec_per_km)} /km</div>
            <div className="delta">on {prs.pace?.label}</div>
          </div>
          <div className="tile">
            <div className="label">Most steps</div>
            <div className="value">{prs.steps ? fmtInt(prs.steps.steps) : '—'}</div>
            {prs.steps && <div className="delta">on {prs.steps.label}</div>}
          </div>
        </div>
      )}

      <Card title="Weekly volume" hint="Total distance per week (Mon–Sun)">
        {weeklyChart.length ? (
          <ResponsiveContainer width="100%" height={190}>
            <BarChart data={weeklyChart} margin={{ top: 4, right: 8, left: -12, bottom: 12 }}>
              <CartesianGrid {...GRID} />
              <XAxis dataKey="label" {...xAxisProps(weeklyChart.length)} />
              <YAxis {...AXIS} unit=" km" />
              <Tooltip
                cursor={{ fill: 'color-mix(in srgb, var(--ink) 5%, transparent)' }}
                content={makeTooltip((_k, v) => ({ label: 'Distance', value: `${fmtKm(v)} km`, color: 'var(--series-1)' }))}
              />
              <Bar dataKey="km" fill="var(--series-1)" radius={[4, 4, 0, 0]} maxBarSize={40} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyNote />
        )}
      </Card>

      <Card
        title="Workout log"
        hint="Pace zones · green = easy (>6:30) · amber = moderate (5:30–6:30) · red = hard (<5:30)"
      >
        <div className="mini-filters">
          <label>
            Min distance
            <input
              type="range"
              min={0}
              max={Math.ceil(maxDist)}
              step={0.1}
              value={minDist}
              onChange={e => setMinDist(Number(e.target.value))}
            />
            {minDist.toFixed(1)} km
          </label>
          {types.length > 1 && (
            <label>
              Type
              <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}>
                <option value="all">All</option>
                {types.map(t => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        {filtered.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Dist (km)</th>
                    <th>Duration</th>
                    <th>Avg pace</th>
                    <th>Best pace</th>
                    <th>Avg km/h</th>
                    <th>Max km/h</th>
                    <th>Calories</th>
                  </tr>
                </thead>
                <tbody>
                  {weeks.map(([w, rs]) => {
                    const wkKm = rs.reduce((s, r) => s + r.distance_km, 0)
                    const wkCal = rs.reduce((s, r) => s + (r.calories_kcal ?? 0), 0)
                    const paces = rs
                      .map(r => r.avg_pace_sec_per_km)
                      .filter((p): p is number => p != null)
                    const wkPace = paces.length
                      ? paces.reduce((a, b) => a + b, 0) / paces.length
                      : null
                    const end = new Date(w + 'T00:00:00Z')
                    end.setUTCDate(end.getUTCDate() + 6)
                    return [
                      <tr className="week-row" key={w}>
                        <td>
                          Week {fmtShort(w)} – {fmtShort(end.toISOString().slice(0, 10))}
                        </td>
                        <td>
                          {rs.length} run{rs.length === 1 ? '' : 's'}
                        </td>
                        <td>{fmtKm(wkKm)}</td>
                        <td>—</td>
                        <td>{fmtPace(wkPace)}</td>
                        <td>—</td>
                        <td>—</td>
                        <td>—</td>
                        <td>{fmtInt(wkCal)}</td>
                      </tr>,
                      ...[...rs].reverse().map(r => (
                        <tr key={r.id}>
                          <td>{r.runKey}</td>
                          <td>{r.activity_type}</td>
                          <td>{fmtKm(r.distance_km)}</td>
                          <td>{fmtDuration(r.duration_seconds)}</td>
                          <td className={`zone-${paceZone(r.avg_pace_sec_per_km)}`}>
                            {fmtPace(r.avg_pace_sec_per_km)}
                          </td>
                          <td>{fmtPace(r.fastest_pace_sec_per_km)}</td>
                          <td>{r.avg_speed_kmh != null ? Number(r.avg_speed_kmh).toFixed(1) : '—'}</td>
                          <td>{r.max_speed_kmh != null ? Number(r.max_speed_kmh).toFixed(1) : '—'}</td>
                          <td>{fmtInt(r.calories_kcal)}</td>
                        </tr>
                      )),
                    ]
                  })}
                </tbody>
              </table>
            </div>
            <button
              className="csv-btn"
              onClick={() =>
                downloadCsv(
                  'workout_log.csv',
                  [...filtered].reverse().map(r => ({
                    date: r.runKey,
                    type: r.activity_type,
                    distance_km: r.distance_km,
                    duration: fmtDuration(r.duration_seconds),
                    avg_pace: fmtPace(r.avg_pace_sec_per_km),
                    best_pace: fmtPace(r.fastest_pace_sec_per_km),
                    avg_kmh: r.avg_speed_kmh ?? '',
                    max_kmh: r.max_speed_kmh ?? '',
                    calories: r.calories_kcal ?? '',
                  })),
                )
              }
            >
              ⬇ Export workout CSV
            </button>
          </>
        ) : (
          <EmptyNote text="No workouts match the selected filters." />
        )}
      </Card>

      <Card title="Heart rate" hint="Colour zones · green < 140 bpm · amber 140–160 · red > 160">
        {hrRows.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Avg HR (bpm)</th>
                    <th>Max HR (bpm)</th>
                  </tr>
                </thead>
                <tbody>
                  {hrRows.map(r => (
                    <tr key={r.id}>
                      <td>{r.runKey}</td>
                      <td className={`zone-${hrZone(r.avg_hr_bpm)}`}>{fmtInt(r.avg_hr_bpm)}</td>
                      <td className={`zone-${hrZone(r.max_hr_bpm)}`}>{fmtInt(r.max_hr_bpm)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="csv-btn"
              onClick={() =>
                downloadCsv(
                  'heart_rate.csv',
                  hrRows.map(r => ({ date: r.runKey, avg_hr: r.avg_hr_bpm, max_hr: r.max_hr_bpm })),
                )
              }
            >
              ⬇ Export HR CSV
            </button>
          </>
        ) : (
          <EmptyNote text="No heart-rate data in the selected range." />
        )}
      </Card>

      <Card title="Steps & cadence">
        {stepRows.length ? (
          <>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Steps</th>
                    <th>Avg cadence (spm)</th>
                    <th>Distance (km)</th>
                    <th>Steps / km</th>
                  </tr>
                </thead>
                <tbody>
                  {stepRows.map(r => (
                    <tr key={r.id}>
                      <td>{r.runKey}</td>
                      <td>{fmtInt(r.steps)}</td>
                      <td>{fmtInt(r.avg_cadence_bpm)}</td>
                      <td>{fmtKm(r.distance_km)}</td>
                      <td>{fmtInt((r.steps ?? 0) / r.distance_km)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <button
              className="csv-btn"
              onClick={() =>
                downloadCsv(
                  'steps_log.csv',
                  stepRows.map(r => ({
                    date: r.runKey,
                    steps: r.steps,
                    cadence: r.avg_cadence_bpm ?? '',
                    distance_km: r.distance_km,
                    steps_per_km: Math.round((r.steps ?? 0) / r.distance_km),
                  })),
                )
              }
            >
              ⬇ Export steps CSV
            </button>
          </>
        ) : (
          <EmptyNote text="No steps data in the selected range." />
        )}
      </Card>
    </>
  )
}
