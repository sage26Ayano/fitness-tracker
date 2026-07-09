import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { parseWorkoutJson } from '../lib/parseWorkoutJson'

interface Props {
  onClose: () => void
  onAdded: () => void
}

export function AddWorkoutModal({ onClose, onAdded }: Props) {
  const [json, setJson] = useState('')
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!supabase) return
    setSubmitError(null)
    setSuccess(null)

    let parsedList
    try {
      parsedList = parseWorkoutJson(json)
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : 'Failed to parse JSON.')
      return
    }

    setSubmitting(true)

    for (let i = 0; i < parsedList.length; i++) {
      const parsed = parsedList[i]
      const { data: inserted, error: workoutError } = await supabase
        .from('workouts')
        .insert(parsed.workout)
        .select('id')
        .single()

      if (workoutError || !inserted) {
        setSubmitting(false)
        setSubmitError(
          `Workout ${i + 1}/${parsedList.length} failed: ${workoutError?.message ?? 'Failed to insert workout.'}`,
        )
        return
      }

      if (parsed.splits.length) {
        const { error: splitsError } = await supabase
          .from('workout_splits')
          .insert(parsed.splits.map(s => ({ ...s, workout_id: inserted.id })))

        if (splitsError) {
          setSubmitting(false)
          setSubmitError(`Workout ${i + 1}/${parsedList.length} saved, but splits failed: ${splitsError.message}`)
          return
        }
      }
    }

    setSubmitting(false)
    setSuccess(
      parsedList.length === 1
        ? `Added ${parsedList[0].workout.workout_date} (${parsedList[0].workout.activity_type}).`
        : `Added ${parsedList.length} workouts.`,
    )
    setJson('')
    onAdded()
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal modal-lg" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add workout</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="modal-form" onSubmit={handleSubmit}>
            <p className="hint">
              Paste the workout JSON (same format as your export files). A single workout object
              or an array of them is accepted.
            </p>
            <textarea
              className="json-input"
              value={json}
              onChange={e => setJson(e.target.value)}
              placeholder='{"activity": {...}, "summary": {...}, "splits": [...]}
or
[{"activity": {...}, ...}, {"activity": {...}, ...}]'
              rows={20}
              required
              autoFocus
            />
            {submitError && <div className="modal-error">⚠️ {submitError}</div>}
            {success && <div className="modal-success">✅ {success}</div>}
            <button type="submit" className="modal-submit" disabled={submitting}>
              {submitting ? 'Saving…' : 'Save workout'}
            </button>
          </form>
      </div>
    </div>
  )
}
