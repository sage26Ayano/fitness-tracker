export interface Split {
  id: string
  workout_id: string
  split_number: number
  distance_km: number
  pace_sec_per_km: number
  duration_seconds: number
  is_fastest: boolean
}

export interface Workout {
  id: string
  activity_type: string
  workout_date: string // YYYY-MM-DD
  workout_time: string | null
  distance_km: number
  duration_seconds: number
  calories_kcal: number | null
  steps: number | null
  avg_cadence_bpm: number | null
  avg_pace_sec_per_km: number | null
  fastest_pace_sec_per_km: number | null
  avg_speed_kmh: number | null
  max_speed_kmh: number | null
  avg_hr_bpm: number | null
  max_hr_bpm: number | null
  te_vo2_max_seconds: number | null
  te_anaerobic_seconds: number | null
  te_aerobic_seconds: number | null
  te_intensive_seconds: number | null
  te_light_seconds: number | null
  workout_splits: Split[]
}

/** A workout enriched with display metadata (multi-session-day aware). */
export interface Run extends Workout {
  /** unique label, e.g. "07-01" or "07-01 #2" */
  label: string
  /** full unique id label, e.g. "2026-07-01 #2" */
  runKey: string
}
