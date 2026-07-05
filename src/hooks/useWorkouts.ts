import { useCallback, useEffect, useState } from 'react'
import { supabase, configured } from '../lib/supabase'
import type { Run, Workout } from '../lib/types'

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

/** "2026-07-05" -> "July 05" */
function formatDateLabel(isoDate: string): string {
  const [, month, day] = isoDate.split('-')
  return `${MONTHS[Number(month) - 1]} ${day}`
}

interface State {
  runs: Run[]
  loading: boolean
  error: string | null
}

export function useWorkouts() {
  const [state, setState] = useState<State>({ runs: [], loading: configured, error: null })
  const [nonce, setNonce] = useState(0)
  const refresh = useCallback(() => setNonce(n => n + 1), [])

  useEffect(() => {
    if (!configured || !supabase) return
    let cancelled = false
    setState(s => ({ ...s, loading: true, error: null }))
    supabase
      .from('workouts')
      .select('*, workout_splits(*)')
      .order('workout_date', { ascending: true })
      .order('workout_time', { ascending: true, nullsFirst: true })
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          setState({ runs: [], loading: false, error: error.message })
          return
        }
        const workouts = (data ?? []) as Workout[]
        // multi-session days get a "#N" suffix so every run is uniquely keyed
        const countByDate = new Map<string, number>()
        for (const w of workouts)
          countByDate.set(w.workout_date, (countByDate.get(w.workout_date) ?? 0) + 1)
        const seen = new Map<string, number>()
        const runs: Run[] = workouts.map(w => {
          const idx = (seen.get(w.workout_date) ?? 0) + 1
          seen.set(w.workout_date, idx)
          const multi = (countByDate.get(w.workout_date) ?? 1) > 1
          const suffix = multi ? ` #${idx}` : ''
          return {
            ...w,
            distance_km: Number(w.distance_km),
            workout_splits: [...(w.workout_splits ?? [])]
              .map(s => ({ ...s, distance_km: Number(s.distance_km) }))
              .sort((a, b) => a.split_number - b.split_number),
            runKey: w.workout_date + suffix,
            label: formatDateLabel(w.workout_date) + suffix,
          }
        })
        setState({ runs, loading: false, error: null })
      })
    return () => {
      cancelled = true
    }
  }, [nonce])

  return { ...state, configured, refresh }
}
