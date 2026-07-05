interface DurationField {
  formatted?: string
  minutes?: number
  seconds?: number
  total_seconds?: number
}

interface RawSplit {
  split: number
  distance_km: number
  pace: { minutes: number; seconds: number }
  duration: DurationField
  fastest?: boolean
}

interface RawWorkout {
  activity: { type: string; distance_km: number; date: string; time?: string }
  summary: {
    time: DurationField
    calories_kcal?: number
    average_pace?: { minutes_per_km: number; seconds_per_km: number }
    steps?: number
    average_cadence_bpm?: number
  }
  splits: RawSplit[]
  pace?: { average?: { minutes: number; seconds: number }; fastest?: { minutes: number; seconds: number } }
  speed?: { average_kmh?: number; maximum_kmh?: number }
  heart_rate?: { average_bpm?: number; maximum_bpm?: number }
  training_effect?: {
    vo2_max?: string
    anaerobic?: string
    aerobic?: string
    intensive?: string
    light?: string
  }
}

export interface WorkoutInsert {
  activity_type: string
  workout_date: string
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
  vo2_max_seconds: number | null
  anaerobic_seconds: number | null
  aerobic_seconds: number | null
  intensive_seconds: number | null
  light_seconds: number | null
}

export interface SplitInsert {
  split_number: number
  distance_km: number
  pace_sec_per_km: number
  duration_seconds: number
  is_fastest: boolean
}

function hmsToSeconds(hms: string | undefined): number | null {
  if (!hms) return null
  const parts = hms.split(':').map(Number)
  if (parts.some(Number.isNaN)) return null
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2]
  if (parts.length === 2) return parts[0] * 60 + parts[1]
  return null
}

export function parseWorkoutJson(
  raw: string,
): { workout: WorkoutInsert; splits: SplitInsert[] }[] {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    throw new Error('Invalid JSON — could not parse.')
  }

  const entries: RawWorkout[] = Array.isArray(parsed) ? parsed : [parsed as RawWorkout]
  if (!entries.length) throw new Error('No workouts found in JSON.')

  return entries.map((data, i) => {
    try {
      return parseSingleWorkout(data)
    } catch (err) {
      throw new Error(
        entries.length > 1
          ? `Workout ${i + 1}: ${err instanceof Error ? err.message : String(err)}`
          : err instanceof Error
            ? err.message
            : String(err),
      )
    }
  })
}

function parseSingleWorkout(data: RawWorkout): { workout: WorkoutInsert; splits: SplitInsert[] } {
  if (!data.activity) throw new Error('Missing "activity" field.')
  if (!data.summary) throw new Error('Missing "summary" field.')
  if (!Array.isArray(data.splits)) throw new Error('Missing "splits" array.')

  const { activity, summary, pace, speed, heart_rate, training_effect } = data

  if (!activity.type) throw new Error('Missing "activity.type".')
  if (!activity.date) throw new Error('Missing "activity.date".')
  if (typeof activity.distance_km !== 'number') throw new Error('Missing "activity.distance_km".')
  if (typeof summary.time?.total_seconds !== 'number')
    throw new Error('Missing "summary.time.total_seconds".')

  const avgPace = summary.average_pace ?? pace?.average
  const avgPaceSec =
    avgPace && 'minutes_per_km' in avgPace
      ? avgPace.minutes_per_km * 60 + avgPace.seconds_per_km
      : avgPace
        ? avgPace.minutes * 60 + avgPace.seconds
        : null

  const workout: WorkoutInsert = {
    activity_type: activity.type,
    workout_date: activity.date,
    workout_time: activity.time ?? null,
    distance_km: activity.distance_km,
    duration_seconds: summary.time.total_seconds,
    calories_kcal: summary.calories_kcal ?? null,
    steps: summary.steps ?? null,
    avg_cadence_bpm: summary.average_cadence_bpm ?? null,
    avg_pace_sec_per_km: avgPaceSec,
    fastest_pace_sec_per_km: pace?.fastest ? pace.fastest.minutes * 60 + pace.fastest.seconds : null,
    avg_speed_kmh: speed?.average_kmh ?? null,
    max_speed_kmh: speed?.maximum_kmh ?? null,
    avg_hr_bpm: heart_rate?.average_bpm ?? null,
    max_hr_bpm: heart_rate?.maximum_bpm ?? null,
    vo2_max_seconds: hmsToSeconds(training_effect?.vo2_max),
    anaerobic_seconds: hmsToSeconds(training_effect?.anaerobic),
    aerobic_seconds: hmsToSeconds(training_effect?.aerobic),
    intensive_seconds: hmsToSeconds(training_effect?.intensive),
    light_seconds: hmsToSeconds(training_effect?.light),
  }

  const splits: SplitInsert[] = data.splits.map(s => {
    if (typeof s.split !== 'number' || typeof s.distance_km !== 'number' || !s.pace || !s.duration)
      throw new Error(`Malformed split entry: ${JSON.stringify(s)}`)
    if (typeof s.duration.total_seconds !== 'number')
      throw new Error(`Split ${s.split} is missing "duration.total_seconds".`)
    return {
      split_number: s.split,
      distance_km: s.distance_km,
      pace_sec_per_km: s.pace.minutes * 60 + s.pace.seconds,
      duration_seconds: s.duration.total_seconds,
      is_fastest: Boolean(s.fastest),
    }
  })

  return { workout, splits }
}
