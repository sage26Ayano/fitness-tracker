import { useMemo, useState } from 'react'
import { useWorkouts } from './hooks/useWorkouts'
import { useAuth } from './hooks/useAuth'
import { OverviewTab } from './components/OverviewTab'
import { LogTab } from './components/LogTab'
import { SplitsTab } from './components/SplitsTab'
import { AddWorkoutModal } from './components/AddWorkoutModal'
import { LoginPage } from './components/LoginPage'
import { supabase } from './lib/supabase'

type Preset = '7d' | '30d' | '90d' | 'all' | 'custom'
type Tab = 'overview' | 'log' | 'splits'

function shiftDays(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00Z')
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}

export default function App() {
  const { session, checking } = useAuth()
  const { runs, loading, error, configured, refresh } = useWorkouts()
  const [tab, setTab] = useState<Tab>('overview')
  const [preset, setPreset] = useState<Preset>('all')
  const [customStart, setCustomStart] = useState('')
  const [customEnd, setCustomEnd] = useState('')
  const [showAddModal, setShowAddModal] = useState(false)

  const [minDate, maxDate] = useMemo(() => {
    if (!runs.length) return ['', '']
    return [runs[0].workout_date, runs[runs.length - 1].workout_date]
  }, [runs])

  const [start, end] = useMemo(() => {
    if (!runs.length) return ['', '']
    switch (preset) {
      case '7d':
        return [shiftDays(maxDate, -6), maxDate]
      case '30d':
        return [shiftDays(maxDate, -29), maxDate]
      case '90d':
        return [shiftDays(maxDate, -89), maxDate]
      case 'custom':
        return [customStart || minDate, customEnd || maxDate]
      default:
        return [minDate, maxDate]
    }
  }, [runs.length, preset, customStart, customEnd, minDate, maxDate])

  const filtered = useMemo(
    () => runs.filter(r => r.workout_date >= start && r.workout_date <= end),
    [runs, start, end],
  )

  if (checking) {
    return (
      <div className="empty-note" style={{ marginTop: '25vh' }}>
        <div className="spinner" />
        Loading…
      </div>
    )
  }

  if (!session) {
    return <LoginPage />
  }

  if (!configured) {
    return (
      <div className="setup-card">
        <h2>🏃 Almost there</h2>
        <p>
          Add your Supabase credentials to <code>web/.env</code>, then restart the dev server:
        </p>
        <pre>{`VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key`}</pre>
        <p>
          Both values are on the Supabase dashboard under{' '}
          <strong>Project Settings → API</strong>.
        </p>
      </div>
    )
  }

  return (
    <>
      <header className="app-header">
        <h1>
          <span className="logo-emoji">🏃</span> Aaris <span>· Running Log</span>
        </h1>
        <div className="header-actions">
          <button className="add-btn" onClick={() => setShowAddModal(true)}>
            + Add workout
          </button>
          <button className="refresh-btn" onClick={refresh}>
            <span className={`icon${loading ? ' spinning' : ''}`}>↺</span> Refresh
          </button>
          {session && (
            <button className="refresh-btn" onClick={() => supabase?.auth.signOut()}>
              Sign out
            </button>
          )}
        </div>
      </header>

      {showAddModal && (
        <AddWorkoutModal
          onClose={() => setShowAddModal(false)}
          onAdded={() => {
            refresh()
            setShowAddModal(false)
          }}
        />
      )}

      <div className="filter-bar">
        <div className="preset-group">
          {(['7d', '30d', '90d', 'all'] as const).map(p => (
            <button
              key={p}
              className={preset === p ? 'active' : ''}
              onClick={() => setPreset(p)}
            >
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>
        <label>
          From
          <input
            type="date"
            value={preset === 'custom' ? customStart || minDate : start}
            min={minDate}
            max={maxDate}
            onChange={e => {
              setCustomStart(e.target.value)
              if (preset !== 'custom') setCustomEnd(end)
              setPreset('custom')
            }}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={preset === 'custom' ? customEnd || maxDate : end}
            min={minDate}
            max={maxDate}
            onChange={e => {
              setCustomEnd(e.target.value)
              if (preset !== 'custom') setCustomStart(start)
              setPreset('custom')
            }}
          />
        </label>
        <span className="filter-count">
          {filtered.length} of {runs.length} runs
        </span>
      </div>

      <nav className="tabs">
        {(
          [
            ['overview', 'Overview'],
            ['log', 'Log'],
            ['splits', 'Split analysis'],
          ] as const
        ).map(([key, name]) => (
          <button key={key} className={tab === key ? 'active' : ''} onClick={() => setTab(key)}>
            {name}
          </button>
        ))}
      </nav>

      {loading ? (
        <div className="empty-note">
          <div className="spinner" />
          Loading workouts…
        </div>
      ) : error ? (
        <div className="empty-note">⚠️ Failed to load workouts: {error}</div>
      ) : !runs.length ? (
        <div className="empty-note">
          No workouts yet — insert some rows into the <code>workouts</code> table.
        </div>
      ) : tab === 'overview' ? (
        <OverviewTab runs={filtered} />
      ) : tab === 'log' ? (
        <LogTab runs={filtered} />
      ) : (
        <SplitsTab runs={filtered} />
      )}
    </>
  )
}
