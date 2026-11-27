import { stageOf } from './rules'
import type { Allocation, GenderCount, RuleSet, SchoolData, SectionPlan } from './types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export type PartGender = 'B' | 'G' | 'C'
export interface PlannedSection { letter: string; gender: PartGender; size: number; manual: boolean }

export const planKey = (std: string, groupId?: string) => `${std}|${groupId ?? ''}`

/** Even split: 35 with a limit of 30 → 18 + 17 (never 30 + 5) */
export function evenSizes(n: number, cap: number): number[] {
  if (n <= 0) return []
  const k = Math.max(1, Math.ceil(n / Math.max(1, cap)))
  const base = Math.floor(n / k)
  const rem = n % k
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0))
}

/** Parts of a class: from Class 6 boys and girls separately when the school asks for it; otherwise one mixed part */
export function partsOf(std: string, c: GenderCount, genderSeparate: boolean): { gender: PartGender; n: number }[] {
  if (genderSeparate && Number(std) >= 6) return [{ gender: 'B' as const, n: c.boys }, { gender: 'G' as const, n: c.girls }].filter((p) => p.n > 0)
  return [{ gender: 'C', n: c.boys + c.girls }]
}

const manualOf = (plan: SectionPlan | undefined, g: PartGender) => (plan ? (g === 'B' ? plan.boys : g === 'G' ? plan.girls : plan.mixed) : undefined)

/**
 * Sections of one class (or one Class 11–12 group) from its student count.
 * Auto: fewest sections within the limit, students shared evenly. Manual: the sizes the user typed.
 * Letters run A, B, C… — boys' sections first, then girls'.
 */
export function planClass(std: string, c: GenderCount, cap: number, genderSeparate: boolean, plan?: SectionPlan, order?: PartGender[]): PlannedSection[] {
  const out: PlannedSection[] = []
  let i = 0
  const parts = partsOf(std, c, genderSeparate)
  // the school's own lettering wins: if its sheet starts with "A (Girls)", girls' sections come first
  if (order?.length) parts.sort((a, b) => (order.indexOf(a.gender) + 99) % 99 - (order.indexOf(b.gender) + 99) % 99)
  for (const p of parts) {
    const manual = manualOf(plan, p.gender)?.filter((x) => x > 0)
    const sizes = manual?.length ? manual : evenSizes(p.n, cap)
    for (const size of sizes) out.push({ letter: LETTERS[i++] ?? String(i), gender: p.gender, size, manual: !!manual?.length })
  }
  return out
}

/** Typed sizes that do not add up to the count (shown as a warning) */
export function planMismatch(std: string, c: GenderCount, genderSeparate: boolean, plan?: SectionPlan) {
  const out: { gender: PartGender; typed: number; students: number }[] = []
  for (const p of partsOf(std, c, genderSeparate)) {
    const m = manualOf(plan, p.gender)?.filter((x) => x > 0)
    if (m?.length) { const typed = m.reduce((a, b) => a + b, 0); if (typed !== p.n) out.push({ gender: p.gender, typed, students: p.n }) }
  }
  return out
}

export interface PlanNote { cls: string; sheet: string[]; planned: string[] }

/**
 * Sections follow the student counts, also when the school's Subject Periods sheet is loaded.
 * Each planned section takes the subjects and teachers of the sheet's section with the same letter
 * (same gender preferred); a section the sheet does not have copies the class's first section.
 */
export function applySectionPlan(rules: RuleSet, data: SchoolData): { data: SchoolData; notes: PlanNote[] } {
  const allocs = data.allocations
  if (!allocs?.length) return { data, notes: [] }
  const byClass = new Map<string, Allocation[]>()
  for (const a of allocs) {
    const k = planKey(a.standard, a.groupId)
    byClass.set(k, [...(byClass.get(k) ?? []), a])
  }
  const out: Allocation[] = []
  const notes: PlanNote[] = []
  for (const [k, rows] of byClass) {
    const std = rows[0].standard
    const gid = rows[0].groupId
    const c = (gid ? data.hss[std]?.[gid] : data.strength[std]) ?? { boys: 0, girls: 0 }
    const sheetSecs = [...new Set(rows.map((a) => a.section))].sort()
    if (c.boys + c.girls === 0) { out.push(...rows); continue } // no student count: keep the sheet as it is
    const order = [...new Set(sheetSecs.map((x) => rows.find((a) => a.section === x && a.gender)?.gender).filter((g): g is 'B' | 'G' => !!g))]
    const planned = planClass(std, c, rules.sectionCap[stageOf(std)], data.genderSeparate, data.sectionPlan?.[k], order)
    for (const p of planned) {
      const want = p.gender === 'C' ? undefined : p.gender
      const sameLetter = rows.filter((a) => a.section === p.letter)
      const sameGender = sheetSecs.map((s) => rows.filter((a) => a.section === s)).find((list) => list.some((a) => a.gender === want))
      const tpl = sameLetter.length && (!sameLetter.some((a) => a.gender) || sameLetter.some((a) => a.gender === want)) ? sameLetter : sameGender ?? rows.filter((a) => a.section === sheetSecs[0])
      const from = tpl[0].section
      for (const a of tpl) {
        const { gender: _g, autoSplit: _x, ...rest } = a
        void _g; void _x
        out.push({ ...rest, section: p.letter, size: p.size, ...(want ? { gender: want } : {}), ...(from !== p.letter || tpl !== sameLetter ? { copiedFrom: from } : {}) })
      }
    }
    const gTxt = (g: PartGender) => (g === 'B' ? ' (Boys)' : g === 'G' ? ' (Girls)' : '')
    const sheetLabel = sheetSecs.map((s) => s + gTxt((rows.find((a) => a.section === s && a.gender)?.gender as PartGender) ?? 'C'))
    const planLabel = planned.map((p) => p.letter + gTxt(p.gender))
    if (sheetSecs.join() !== planned.map((p) => p.letter).join()) notes.push({ cls: `${std}${rows[0].groupName ? ' ' + rows[0].groupName : ''}`, sheet: sheetLabel, planned: planned.map((p, i) => `${planLabel[i]} ${p.size}`) })
  }
  // A copied section keeps a teacher only while that teacher stays within the policy limit;
  // otherwise the period is left "to be assigned" so the vacancy shows instead of an impossible timetable.
  const slots = (rules.daysPerWeek || 6) * (rules.periodsPerDay || 8)
  const byId = new Map(data.staff.map((s) => [s.id, s]))
  const limit = (id: string) => { const st = byId.get(id); return Math.min(slots, st?.maxPerWeek ?? (st ? rules.workload[st.category]?.max : undefined) ?? slots) }
  const load = new Map<string, number>()
  const share = (a: Allocation, i: number) => Math.floor(a.periods / a.teachers.length) + (i < a.periods % a.teachers.length ? 1 : 0)
  for (const a of out) if (!a.copiedFrom && a.mode === 'named') a.teachers.forEach((id, i) => load.set(id, (load.get(id) ?? 0) + share(a, i)))
  const final = out.map((a) => {
    if (!a.copiedFrom || a.mode !== 'named') return a
    const fits = a.teachers.every((id, i) => (load.get(id) ?? 0) + share(a, i) <= limit(id))
    if (fits) { a.teachers.forEach((id, i) => load.set(id, (load.get(id) ?? 0) + share(a, i))); return a }
    return { ...a, teachers: [], mode: 'unassigned' as const, unmatched: undefined }
  })
  return { data: { ...data, allocations: final }, notes }
}
