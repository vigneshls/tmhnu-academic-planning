import type { Allocation, ParallelBlock } from './types'

const k = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

interface Unit { a: Allocation; teacherId: string | null }

/** Periods of one allocation row as single units, split between its named teachers */
function units(a: Allocation): Unit[] {
  if (a.mode !== 'named' || !a.teachers.length) return Array.from({ length: a.periods }, () => ({ a, teacherId: null }))
  return a.teachers.flatMap((id, i) => {
    const n = Math.floor(a.periods / a.teachers.length) + (i < a.periods % a.teachers.length ? 1 : 0)
    return Array.from({ length: n }, () => ({ a, teacherId: id }))
  })
}

/** Turn units back into allocation rows (one per subject + teacher) */
function regroup(list: Unit[]): Allocation[] {
  const m = new Map<string, Allocation>()
  for (const u of list) {
    const key = `${u.a.subject}|${u.a.option ?? ''}|${u.teacherId ?? u.a.mode}`
    const cur = m.get(key)
    if (cur) cur.periods++
    else m.set(key, { ...u.a, periods: 1, teachers: u.teacherId ? [u.teacherId] : [], mode: u.teacherId ? 'named' : u.a.mode === 'named' ? 'unassigned' : u.a.mode })
  }
  return [...m.values()]
}

/**
 * Split a section's allocation into parallel elective blocks (several teachers in the same period)
 * and ordinary rows. Each option is laid over the periods of the main-stream subjects it replaces;
 * option periods that do not fit stay as ordinary rows.
 */
export function splitParallel(list: Allocation[]): { blocks: ParallelBlock[]; rest: Allocation[]; weekPeriods: number } {
  const opts = new Map<string, Allocation[]>()
  for (const a of list) if (a.option) opts.set(a.option, [...(opts.get(a.option) ?? []), a])
  const main = list.filter((a) => !a.option)
  if (!opts.size) return { blocks: [], rest: list, weekPeriods: main.reduce((s, a) => s + a.periods, 0) }

  const R = new Set([...opts.values()].flatMap((rows) => rows.flatMap((a) => (a.replaces ?? []).map(k))))
  const rest: Allocation[] = main.filter((a) => !R.has(k(a.subject)))
  const slots: Unit[][] = main.filter((a) => R.has(k(a.subject))).flatMap(units).map((u) => [u])
  const leftover: Unit[] = []
  for (const rows of opts.values()) {
    const rep = new Set((rows[0].replaces ?? []).map(k))
    const free = slots.filter((s) => rep.has(k(s[0].a.subject)))
    const us = rows.flatMap(units)
    us.forEach((u, i) => (i < free.length ? free[i].push(u) : leftover.push(u)))
  }
  const single: Unit[] = []
  const m = new Map<string, ParallelBlock>()
  for (const s of slots) {
    if (s.length === 1) { single.push(s[0]); continue }
    const lanes = s.map((u) => ({ subject: u.a.subject, teacherId: u.teacherId }))
    const key = lanes.map((l) => `${l.subject}|${l.teacherId}`).join('#')
    const b = m.get(key)
    if (b) b.count++
    else m.set(key, { count: 1, lanes })
  }
  rest.push(...regroup(single), ...regroup(leftover))
  const blocks = [...m.values()]
  return { blocks, rest, weekPeriods: blocks.reduce((s, b) => s + b.count, 0) + rest.reduce((s, a) => s + a.periods, 0) }
}
