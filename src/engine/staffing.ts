import { normSections } from './calc'
import { effectiveLimits, stageOf } from './rules'
import type { Category, RuleSet, SchoolData, Section, Staff } from './types'

/**
 * Staffing from the school's own allocation.
 *
 * Pre-KG–5: one class teacher per section (Montessori / SGT).
 * Classes 6–10 (TGT) and 11–12 (PGT): teachers are a subject pool shared across classes, so the need is
 * periods ÷ teaching load, per subject and level. Coordinators count as part-time (their max ÷ load).
 */

export type Level = '1-5' | '6-10' | '11-12'
export const LEVEL_LABEL: Record<Level, string> = { '1-5': 'Classes 1–5', '6-10': 'Classes 6–10 (TGT)', '11-12': 'Classes 11–12 (PGT)' }

const FAMILIES: [string, string, RegExp][] = [
  ['tamil', 'Tamil', /tamil/],
  ['english', 'English', /english/],
  ['hindi', 'Hindi', /hindi/],
  ['maths', 'Mathematics', /math/],
  ['physics', 'Physics', /physics/],
  ['chemistry', 'Chemistry', /chemistry/],
  ['biology', 'Biology / Botany / Zoology', /biology|botany|zoology/],
  ['science', 'Science (6–10)', /^science$|general science/],
  ['social', 'Social Science', /social|history|geography|civics/],
  ['commerce', 'Commerce / Accountancy / Economics', /commerce|accountancy|economics|business studies/],
  ['computer', 'Computer Science / Application', /computer|informatics|\bict\b/],
  ['pe', 'Physical Education', /\bpet\b|\bpe\b|physical|games|sports/],
]
const n = (s: string) => s.trim().toLowerCase().replace(/\s+/g, ' ')
export function familyOf(subject: string): string | null {
  const s = n(subject)
  return FAMILIES.find(([, , re]) => re.test(s))?.[0] ?? null
}
/** Teacher's family; Science (6–10) is taught by Physics / Chemistry / Biology graduates too */
function teacherFamilies(st: Staff): string[] {
  const fam = st.subjects.map(familyOf).filter((x): x is string => !!x)
  if (fam.some((f) => f === 'physics' || f === 'chemistry' || f === 'biology')) fam.push('science')
  if (st.category === 'SPECIALIST' && /pe|physical|games|sport/i.test(st.subjects.join(' '))) fam.push('pe')
  return [...new Set(fam)]
}
const levelOf = (std: string): Level | 'PRE' => {
  const s = stageOf(std)
  return s === 'PRE' ? 'PRE' : s === 'PRIMARY' ? '1-5' : s === 'HSS' ? '11-12' : '6-10'
}

export interface FamilyRow {
  family: string
  label: string
  periods: Record<Level, number>
  required: number
  available: number
  gap: number
  status: 'deficit' | 'excess' | 'ok'
  teachers: { name: string; category: Category; fte: number }[]
  coveredBy: string[]
  notes: string[]
}
export interface ClassTeacherRow { level: 'Pre-primary' | 'Classes 1–5'; sections: number; atCap: number; required: number; available: number; names: string[]; gap: number }
export interface Staffing { load: number; pgtLoad: number; classTeachers: ClassTeacherRow[]; families: FamilyRow[]; other: { subject: string; periods: number }[]; deficitPosts: number; excessPosts: number; requiredPosts: number }

export function subjectStaffing(rules: RuleSet, data: SchoolData, sections: Section[]): Staffing | null {
  const allocs = data.allocations
  if (!allocs?.length) return null
  const byId = new Map(data.staff.map((s) => [s.id, s]))
  // Planning load = policy target, never above what the week structure allows
  const tgtLoad = effectiveLimits(rules, rules.workload.TGT).target || 30
  const pgtLoad = effectiveLimits(rules, rules.workload.PGT).target || 30
  const load = tgtLoad
  const headFte = Math.min(1, (rules.workload.ACAD_HEAD.max || 20) / tgtLoad)

  // ---- class teachers
  const secCount = (lv: 'PRE' | '1-5') => sections.filter((s) => levelOf(s.standard) === lv).length
  const capCount = (lv: 'PRE' | '1-5') => normSections(rules, data).filter((s) => levelOf(s.standard) === lv).length
  const pool = (cat: Category) => data.staff.filter((s) => s.category === cat)
  const ct = (level: ClassTeacherRow['level'], lv: 'PRE' | '1-5', cat: Category): ClassTeacherRow => {
    const sections = secCount(lv)
    const atCap = capCount(lv)
    const required = sections
    const names = pool(cat).map((s) => s.name)
    return { level, sections, atCap, required, available: names.length, names, gap: names.length - required }
  }
  const classTeachers = [ct('Pre-primary', 'PRE', 'MONTESSORI'), ct('Classes 1–5', '1-5', 'SGT')]

  // ---- subject periods by family and level (class-teacher periods and supervision excluded)
  const fam = new Map<string, FamilyRow>()
  const row = (f: string) => {
    let r = fam.get(f)
    if (!r) {
      const def = FAMILIES.find(([k]) => k === f)!
      r = { family: f, label: def[1], periods: { '1-5': 0, '6-10': 0, '11-12': 0 }, required: 0, available: 0, gap: 0, status: 'ok', teachers: [], coveredBy: [], notes: [] }
      fam.set(f, r)
    }
    return r
  }
  const other = new Map<string, number>()
  const coverSeen = new Set<string>()
  for (const a of allocs) {
    if (a.care) continue
    const lv = levelOf(a.standard)
    const tchs = a.teachers.map((id) => byId.get(id)).filter((x): x is Staff => !!x)
    if (lv === 'PRE' && (!tchs.length || tchs.every((t) => t.category === 'MONTESSORI'))) continue
    if (lv === '1-5' && (!tchs.length || tchs.every((t) => t.category === 'SGT' || t.category === 'MONTESSORI'))) continue
    const f = familyOf(a.subject)
    if (!f || a.mode !== 'named') { other.set(a.subject.trim(), (other.get(a.subject.trim()) ?? 0) + a.periods); continue }
    const level: Level = lv === 'PRE' ? '1-5' : lv
    const r = row(f)
    r.periods[level] += a.periods
    for (const t of tchs)
      if (!teacherFamilies(t).includes(f) && !coverSeen.has(`${f}|${t.id}`)) { coverSeen.add(`${f}|${t.id}`); r.coveredBy.push(`${t.name} (${t.subjects[0] ?? '—'})`) }
  }

  // ---- supply: subject teachers by main subject (first listed); coordinators part-time
  for (const st of data.staff) {
    if (!['TGT', 'PGT', 'ACAD_HEAD', 'SPECIALIST'].includes(st.category)) continue
    const main = st.subjects.map(familyOf).find(Boolean)
    const f = st.category === 'SPECIALIST' && teacherFamilies(st).includes('pe') ? 'pe' : main
    if (!f) continue
    const fte = st.category === 'ACAD_HEAD' ? headFte : 1
    const r = row(f === 'physics' || f === 'chemistry' || f === 'biology' ? f : f)
    r.teachers.push({ name: st.name, category: st.category, fte })
    r.available += fte
  }
  // TGT Science: Physics/Chemistry/Biology TGTs belong to the Science pool in 6–10
  for (const f of ['physics', 'chemistry', 'biology']) {
    const r = fam.get(f)
    const sci = fam.get('science')
    if (!r || !sci) continue
    for (const t of [...r.teachers]) if (t.category === 'TGT') { r.teachers.splice(r.teachers.indexOf(t), 1); r.available -= t.fte; sci.teachers.push(t); sci.available += t.fte }
  }

  let deficitPosts = 0, excessPosts = 0, requiredPosts = 0
  for (const r of fam.values()) {
    const p = r.periods['1-5'] + r.periods['6-10'] + r.periods['11-12']
    r.required = Math.round(((r.periods['1-5'] + r.periods['6-10']) / tgtLoad + r.periods['11-12'] / pgtLoad) * 10) / 10
    r.available = Math.round(r.available * 10) / 10
    r.gap = Math.round((r.available - r.required) * 10) / 10
    r.status = r.gap <= -0.5 ? 'deficit' : r.gap >= 1 ? 'excess' : 'ok'
    if (r.status === 'deficit') deficitPosts += Math.round(-r.gap)
    if (r.status === 'excess') excessPosts += Math.floor(r.gap)
    requiredPosts += Math.ceil(r.required - 0.2)
    const tgt = r.teachers.filter((t) => t.category === 'TGT').length
    const pgt = r.teachers.filter((t) => t.category === 'PGT').length
    if (r.periods['6-10'] > 0 && tgt === 0 && pgt > 0) r.notes.push(`No TGT for ${r.label} — PG teachers take the ${r.periods['6-10']} periods in Classes 6–10. A TGT post is recommended (PGT time is costlier and needed for 11–12).`)
    if (r.periods['11-12'] > 0 && pgt === 0 && r.family !== 'pe') r.notes.push(`No PG teacher of this subject for Classes 11–12 (${r.periods['11-12']} periods).`)
    if (r.coveredBy.length) r.notes.push(`Taught by teachers of another subject: ${r.coveredBy.join(', ')}.`)
    if (p === 0 && r.available > 0) r.notes.push('No periods allocated to this subject.')
  }
  for (const c of classTeachers) { if (c.gap < 0) deficitPosts += -c.gap; if (c.gap > 0) excessPosts += c.gap; requiredPosts += c.required }

  const families = [...fam.values()].sort((a, b) => a.gap - b.gap || a.label.localeCompare(b.label))
  return { load, pgtLoad, classTeachers, families, other: [...other].map(([subject, periods]) => ({ subject, periods })).sort((a, b) => b.periods - a.periods), deficitPosts, excessPosts, requiredPosts }
}
