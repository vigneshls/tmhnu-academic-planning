import type { Staff } from '../../engine/types'

/** "R.Vasantha Ashok" → "rvasanthaashok" */
export const nameKey = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '')

function lev(a: string, b: string) {
  const m = a.length
  const n = b.length
  const d = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)])
  for (let j = 1; j <= n; j++) d[0][j] = j
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[m][n]
}

/** Words meaning "no single named teacher" */
export const SHARED_WORDS = ['subject wise', 'subjectwise', 'any', 'shared', 'all teachers', 'class wise', 'rotation', 'all']
export const isSharedWord = (s: string) => SHARED_WORDS.includes(s.trim().toLowerCase().replace(/\s+/g, ' '))

/** Split a cell that may hold several names: ";", ",", "/", "&", " and ", new lines, or runs of 2+ spaces */
export function splitNames(cell: string): string[] {
  return cell
    .split(/\s*[;,/&\n]\s*|\s+and\s+|\s{2,}/i)
    .map((x) => x.trim())
    .filter((x) => x.length > 1)
}

export interface NameMatch {
  id: string
  name: string
  exact: boolean
}

/** Matches a written name to the faculty list: exact, then unique close spelling (≤ 2 letters different) */
export function makeMatcher(staff: Staff[]) {
  const keys = staff.map((s) => ({ s, k: nameKey(s.name) }))
  return (written: string): NameMatch | null => {
    const k = nameKey(written)
    if (!k) return null
    const exact = keys.find((x) => x.k === k)
    if (exact) return { id: exact.s.id, name: exact.s.name, exact: true }
    const limit = k.length >= 8 ? 2 : 1
    const close = keys.map((x) => ({ ...x, d: lev(k, x.k) })).filter((x) => x.d <= limit).sort((a, b) => a.d - b.d)
    if (close.length && (close.length === 1 || close[0].d < close[1].d)) return { id: close[0].s.id, name: close[0].s.name, exact: false }
    return null
  }
}
