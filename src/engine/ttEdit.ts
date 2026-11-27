import type { Cell, Lesson, TimetableResult } from './types'

/** Manual changes to a generated timetable. Every function returns a new timetable; the input is not changed. */

const teachersOf = (c: Cell | null | undefined) => (c?.teacherId ? [c.teacherId, ...(c.coTeacherIds ?? [])] : [])

function clone(tt: TimetableResult, sectionIds: string[]): TimetableResult {
  const grid = { ...tt.grid }
  for (const id of new Set(sectionIds)) grid[id] = tt.grid[id].map((row) => row.slice())
  return { ...tt, grid }
}

/** Lessons not fully placed, worked out from the grid (typed lessons count exactly what is placed) */
export function recomputeUnplaced(tt: TimetableResult): TimetableResult {
  const placed = new Map<string, number>()
  for (const s of tt.sections) for (const row of tt.grid[s.id]) for (const c of row) if (c) placed.set(c.lessonId, (placed.get(c.lessonId) ?? 0) + 1)
  const lessons = tt.lessons.flatMap((l) => (l.custom ? ((placed.get(l.id) ?? 0) > 0 ? [{ ...l, count: placed.get(l.id)! }] : []) : [l]))
  const unplaced = lessons.map((l) => ({ lessonId: l.id, remaining: l.count - (placed.get(l.id) ?? 0) })).filter((u) => u.remaining > 0)
  return { ...tt, lessons, unplaced }
}

const k = (x: string) => x.trim().toLowerCase().replace(/\s+/g, ' ')

/**
 * Type a subject and teacher into a period. It joins the section's lesson of that subject (and teacher, if one matches);
 * a subject the section does not have becomes a typed lesson.
 */
export function typeCell(tt: TimetableResult, sectionId: string, d: number, p: number, subject: string, teacherId: string | null): TimetableResult {
  const sub = subject.trim()
  if (!sub) return tt
  const mine = tt.lessons.filter((l) => l.sectionId === sectionId && k(l.subject) === k(sub))
  const match = mine.find((l) => l.teacherId === teacherId) ?? mine[0]
  let lessons = tt.lessons
  let lesson = match
  if (!lesson) {
    lesson = { id: `${sectionId}|typed|${sub}|${teacherId ?? '-'}`, sectionId, subject: sub, teacherId, count: 0, pref: 'any', custom: true }
    if (!lessons.some((l) => l.id === lesson!.id)) lessons = [...lessons, lesson]
  }
  const n = clone({ ...tt, lessons }, [sectionId])
  n.grid[sectionId][d][p] = { lessonId: lesson.id, subject: lesson.subject, teacherId, ...(match?.coTeacherIds && teacherId === match.teacherId ? { coTeacherIds: match.coTeacherIds } : {}), edited: true }
  return recomputeUnplaced(n)
}

/** Sections in which these teachers already teach at day d, period p (other than `except`) */
export function busyAt(tt: TimetableResult, teacherIds: string[], d: number, p: number, except?: string): { teacherId: string; section: string }[] {
  const out: { teacherId: string; section: string }[] = []
  if (!teacherIds.length) return out
  for (const s of tt.sections) {
    if (s.id === except) continue
    const c = tt.grid[s.id]?.[d]?.[p]
    for (const t of teachersOf(c)) if (teacherIds.includes(t)) out.push({ teacherId: t, section: s.label })
  }
  return out
}

/** Would swapping two periods of one section double-book a teacher elsewhere? */
export function swapClashes(tt: TimetableResult, sectionId: string, a: [number, number], b: [number, number]) {
  const g = tt.grid[sectionId]
  const ca = g[a[0]][a[1]]
  const cb = g[b[0]][b[1]]
  return [...busyAt(tt, teachersOf(ca), b[0], b[1], sectionId), ...busyAt(tt, teachersOf(cb), a[0], a[1], sectionId)]
}

/** Swap two periods of a section (either may be empty, so this also moves a period) */
export function swapCells(tt: TimetableResult, sectionId: string, a: [number, number], b: [number, number]): TimetableResult {
  const n = clone(tt, [sectionId])
  const g = n.grid[sectionId]
  const ca = g[a[0]][a[1]]
  const cb = g[b[0]][b[1]]
  g[a[0]][a[1]] = cb ? { ...cb, edited: true } : null
  g[b[0]][b[1]] = ca ? { ...ca, edited: true } : null
  return n
}

/** Give one period to another teacher (parallel-elective co-teachers stay) */
export function setTeacher(tt: TimetableResult, sectionId: string, d: number, p: number, teacherId: string | null): TimetableResult {
  const c = tt.grid[sectionId][d][p]
  if (!c) return tt
  const n = clone(tt, [sectionId])
  n.grid[sectionId][d][p] = { ...c, teacherId, edited: true }
  return n
}

/** Remove a period; its lesson shows as unplaced again */
export function clearCell(tt: TimetableResult, sectionId: string, d: number, p: number): TimetableResult {
  const n = clone(tt, [sectionId])
  n.grid[sectionId][d][p] = null
  return recomputeUnplaced(n)
}

/** Put a lesson of this section into an empty period */
export function placeLesson(tt: TimetableResult, sectionId: string, d: number, p: number, lesson: Lesson): TimetableResult {
  const n = clone(tt, [sectionId])
  n.grid[sectionId][d][p] = { lessonId: lesson.id, subject: lesson.subject, teacherId: lesson.teacherId, ...(lesson.coTeacherIds ? { coTeacherIds: lesson.coTeacherIds } : {}), edited: true }
  return recomputeUnplaced(n)
}

/** Lessons of a section, unplaced ones first, with how many periods are still missing */
export function lessonsFor(tt: TimetableResult, sectionId: string) {
  const rem = new Map(tt.unplaced.map((u) => [u.lessonId, u.remaining]))
  return tt.lessons
    .filter((l) => l.sectionId === sectionId)
    .map((l) => ({ lesson: l, missing: rem.get(l.id) ?? 0 }))
    .sort((a, b) => b.missing - a.missing || a.lesson.subject.localeCompare(b.lesson.subject))
}
