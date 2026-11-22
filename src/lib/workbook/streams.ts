import type { Allocation } from '../../engine/types'

/** Supervised non-teaching periods in pre-primary: scheduled with the teacher, but not teaching load */
export const CARE_RE = /sleep|\bnap\b|nap time|rest time|snack|lunch|\bmeal|toilet|potty/i
/** Activity periods that any teacher of the section may take when no name is given */
export const ACTIVITY_RE = /\bclub|library|\beca\b|co-?curricular|activit|games|assembly|yoga/i

const k = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

/** Same subject, allowing short forms (Maths / Mathematics, Bio / Biology) */
export function sameSubject(a: string, b: string) {
  const x = k(a), y = k(b)
  if (!x || !y) return false
  if (x === y) return true
  const [s, l] = x.length <= y.length ? [x, y] : [y, x]
  return s.length >= 4 && l.startsWith(s)
}

/** Subjects named in a group title: "Maths-Biology" → [maths, biology]; "Purescience" → [purescience] */
const tokens = (name: string) => name.split(/\s*(?:[-–/&,+]|\band\b|\bwith\b)\s*/i).map(k).filter(Boolean)

export interface StreamNote { message: string }

/**
 * Class 11–12 streams.
 *
 * 1. A group that lists only a few subjects (e.g. "Maths-Computer Science": Computer Science only;
 *    "Pure Science": Botany, Zoology) is an elective option of the full group before it ("Maths-Biology").
 *    Its students sit with the full group for common subjects and split for the subjects named in the
 *    full group's title that the option's title does not keep (Maths-CS keeps Maths, replaces Biology).
 * 2. Inside a full group, subjects that match a Students-sheet group name (Commerce: "Computer Application",
 *    "Business Maths") or are marked "(Elective)" are alternatives taught at the same time.
 *
 * Rows are changed in place; aliases (option name → main group id) are added so Students rows map to the stream.
 */
export function applyStreams(
  allocs: Allocation[],
  studentGroups: Map<string, string[]>,
  alias: Map<string, string>,
): StreamNote[] {
  const notes: StreamNote[] = []
  const hss = allocs.filter((a) => a.groupId && (a.standard === '11' || a.standard === '12'))
  const classSecs = new Map<string, Allocation[]>()
  for (const a of hss) classSecs.set(`${a.standard}|${a.section}`, [...(classSecs.get(`${a.standard}|${a.section}`) ?? []), a])

  for (const [key, rows] of classSecs) {
    const std = key.split('|')[0]
    // groups in order of first appearance
    const order: string[] = []
    const total = new Map<string, number>()
    const name = new Map<string, string>()
    for (const a of rows) {
      if (!total.has(a.groupId!)) order.push(a.groupId!)
      total.set(a.groupId!, (total.get(a.groupId!) ?? 0) + a.periods)
      name.set(a.groupId!, a.groupName ?? a.groupId!)
    }
    const max = Math.max(...total.values())
    const full = order.filter((g) => total.get(g)! >= 0.6 * max)

    // 1. partial groups → options of a full group
    for (const g of order) {
      if (full.includes(g)) continue
      const before = full.filter((f) => order.indexOf(f) < order.indexOf(g))
      const main = before[before.length - 1] ?? full[0]
      if (!main) continue
      const mainRows = rows.filter((a) => a.groupId === main && !a.option)
      const named = mainRows.filter((a) => tokens(name.get(main)!).some((t) => sameSubject(t, a.subject)))
      const keep = tokens(name.get(g)!)
      const replaced = [...new Set(named.filter((a) => !keep.some((t) => sameSubject(t, a.subject))).map((a) => a.subject))]
      if (!replaced.length) {
        notes.push({ message: `Class ${std}: "${name.get(g)}" lists only ${total.get(g)} periods but could not be matched to the subjects of "${name.get(main)}"; it is treated as a separate group. Name the group after its subjects (e.g. "Maths-Computer Science") so the shared subjects can be found.` })
        continue
      }
      for (const a of rows.filter((x) => x.groupId === g)) {
        a.option = name.get(g)
        a.replaces = replaced
        a.groupId = main
        a.groupName = name.get(main)
      }
      alias.set(k(name.get(g)!), main)
      notes.push({ message: `Class ${std}: "${name.get(g)}" is an elective option of "${name.get(main)}" — taught at the same time as ${replaced.join(' + ')}; other subjects are shared.` })
    }

    // 2. alternatives inside a group
    const sg = (studentGroups.get(std) ?? []).map(k)
    for (const g of full) {
      const own = rows.filter((a) => a.groupId === g && !a.option)
      const alts = own.filter((a) => /elective/i.test(a.subject) || sg.some((s) => sameSubject(s, a.subject)))
      const subjects = [...new Set(alts.map((a) => k(a.subject)))]
      if (subjects.length < 2) continue
      const first = alts.find((a) => k(a.subject) === subjects[0])!
      for (const a of alts) if (k(a.subject) !== subjects[0]) { a.option = a.subject.replace(/\s*\(elective\)\s*/i, ''); a.replaces = [first.subject] }
      for (const s of studentGroups.get(std) ?? []) if (alts.some((a) => sameSubject(s, a.subject))) alias.set(k(s), g)
      notes.push({ message: `Class ${std} ${name.get(g)}: ${[...new Set(alts.map((a) => a.subject))].join(', ')} are electives taught at the same time.` })
    }
  }
  return notes
}

/** Week periods of one section's allocation, with parallel electives counted once */
export function weekPeriodsOf(list: Allocation[]) {
  const main = list.filter((a) => !a.option)
  let n = main.reduce((s, a) => s + a.periods, 0)
  const opts = new Map<string, Allocation[]>()
  for (const a of list.filter((x) => x.option)) opts.set(a.option!, [...(opts.get(a.option!) ?? []), a])
  for (const rows of opts.values()) {
    const slots = main.filter((a) => rows[0].replaces?.some((r) => k(r) === k(a.subject))).reduce((s, a) => s + a.periods, 0)
    n += Math.max(0, rows.reduce((s, a) => s + a.periods, 0) - slots)
  }
  return n
}

/** Class + group names on the Students sheet (blank Class cells carry down) */
export function scanStudentGroups(rows: unknown[][], classKey: (s: string) => string | null): Map<string, string[]> {
  const out = new Map<string, string[]>()
  const hi = rows.findIndex((r) => r.some((c) => k(String(c ?? '')).startsWith('group')))
  if (hi < 0) return out
  const head = rows[hi].map((c) => k(String(c ?? '')))
  const cc = head.findIndex((h) => h === 'class')
  const cg = head.findIndex((h) => h.startsWith('group'))
  let last = ''
  for (const r of rows.slice(hi + 1)) {
    const c = String(r[cc] ?? '').trim()
    const g = String(r[cg] ?? '').trim()
    const std = c ? classKey(c) : last
    if (c) last = std ?? ''
    if (!std || !g || (std !== '11' && std !== '12')) continue
    out.set(std, [...(out.get(std) ?? []), g])
  }
  return out
}
