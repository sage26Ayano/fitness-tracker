/** 322 -> "5:22" (pace, sec/km) */
export function fmtPace(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec <= 0) return '—'
  const s = Math.round(sec)
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}

/** 3725 -> "1:02:05", 1505 -> "25:05" */
export function fmtDuration(sec: number | null | undefined): string {
  if (sec == null || !isFinite(sec) || sec < 0) return '—'
  const s = Math.round(sec)
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const r = s % 60
  return h > 0
    ? `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`
    : `${m}:${String(r).padStart(2, '0')}`
}

export function fmtInt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return '—'
  return Math.round(n).toLocaleString()
}

export function fmtKm(n: number | null | undefined, dp = 2): string {
  if (n == null || !isFinite(n)) return '—'
  return n.toFixed(dp)
}

/** pace-zone class: easy (>390s), moderate (330–390s), hard (<330s) */
export function paceZone(sec: number | null | undefined): 'easy' | 'moderate' | 'hard' | 'none' {
  if (sec == null || sec <= 0) return 'none'
  if (sec > 390) return 'easy'
  if (sec > 330) return 'moderate'
  return 'hard'
}

export function hrZone(bpm: number | null | undefined): 'easy' | 'moderate' | 'hard' | 'none' {
  if (bpm == null) return 'none'
  if (bpm < 140) return 'easy'
  if (bpm < 160) return 'moderate'
  return 'hard'
}

export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (!rows.length) return
  const cols = Object.keys(rows[0])
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = [cols.join(','), ...rows.map(r => cols.map(c => esc(r[c])).join(','))].join('\n')
  const blob = new Blob([csv], { type: 'text/csv' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}
