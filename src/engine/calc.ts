import { categoryForStage, effectiveLimits, isClassTeacherStage, stageOf } from './rules'
import type { Category, DemandRow, RuleSet, SchoolData, Section, Stage, Staff } from './types'
import { HSS_STANDARDS, STANDARDS, isTeachingCategory } from './types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

export const sectionsFor = (count: number, cap: number) => (count > 0 && cap > 0 ? Math.ceil(count / cap) : 0)

/** Split n students into k near-equal sections */
function split(n: number, k: number): number[] {
  const base = Math.floor(n / k)
  const rem = n % k
  return Array.from({ length: k }, (_, i) => base + (i < rem ? 1 : 0))
}

const norm = (x: string) => x.trim().toLowerCase()

export function buildSections(rules: RuleSet, data: SchoolData): Section[] {
  const out: Section[] = []
  const push = (std: string, stage: Stage, subjects: Section['subjects'], counts: { boys: number; girls: number }, groupId?: string, groupName?: string) => {
    const cap = rules.sectionCap[stage]
    const genderSplit = data.genderSeparate && Number(std) >= 6
    const parts: { g: Section['gender']; n: number }[] = genderSplit
      ? [{ g: 'B', n: counts.boys }, { g: 'G', n: counts.girls }]
      : [{ g: 'C', n: counts.boys + counts.girls }]
    let letter = 0
    for (const p of parts) {
      const k = sectionsFor(p.n, cap)
      split(p.n, k || 1).forEach((size, i) => {
        if (k === 0) return
        const L = LETTERS[letter++] ?? String(letter)
        const gTxt = p.g === 'B' ? ' (Boys)' : p.g === 'G' ? ' (Girls)' : ''
        out.push({
          id: `${std}-${groupId ?? 'X'}-${L}`,
          standard: std,
          stage,
          groupId,
          gender: p.g,
          label: `${std}${groupName ? ' ' + groupName : ''} ${L}${gTxt}`,
          strength: size,
          subjects: subjects,
        })
        void i
      })
    }
  }
  for (const std of STANDARDS) {
    const stage = stageOf(std)
    if (stage === 'HSS') continue
    const c = data.strength[std] ?? { boys: 0, girls: 0 }
    push(std, stage, rules.subjectsByStandard[std] ?? [], c)
  }
  for (const std of HSS_STANDARDS) {
    for (const g of rules.hssGroups) {
      const c = data.hss[std]?.[g.id] ?? { boys: 0, girls: 0 }
      push(std, 'HSS', g.subjects, c, g.id, g.name)
    }
  }
  return out
}

export function teacherCategoryFor(section: Section, subject: { specialist?: boolean }): Category {
  return subject.specialist ? 'SPECIALIST' : categoryForStage(section.stage)
}

/** First-fit decreasing: teachers needed when each section's subject is taught by one teacher */
export function ffdBins(items: number[], cap: number): number {
  const bins: number[] = []
  for (const it of [...items].sort((a, b) => b - a)) {
    const i = bins.findIndex((b) => b + it <= cap)
    if (i >= 0) bins[i] += it
    else bins.push(it)
  }
  return bins.length
}

export const CLASS_TEACHER = 'Class Teacher (all core subjects)'

/** Subject-wise teacher demand vs. availability */
export function computeDemand(rules: RuleSet, sections: Section[], staff: Staff[]): DemandRow[] {
  const map = new Map<string, { category: Category; subject: string; periods: number; sections: number; items: number[] }>()
  const flex = new Map<Category, number>()
  const add = (category: Category, subject: string, periods: number) => {
    const key = `${category}|${subject}`
    const r = map.get(key) ?? { category, subject, periods: 0, sections: 0, items: [] }
    r.periods += periods
    r.sections += 1
    r.items.push(periods)
    map.set(key, r)
  }
  for (const sec of sections) {
    let classPeriods = 0
    for (const sub of sec.subjects) {
      if (sub.noTeacher) continue
      if (isClassTeacherStage(sec.stage) && !sub.specialist) {
        classPeriods += sub.periods
        continue
      }
      if (sub.flex) {
        // flex subjects are absorbed by spare capacity of the section's subject teachers
        const c = teacherCategoryFor(sec, sub)
        flex.set(c, (flex.get(c) ?? 0) + sub.periods)
        continue
      }
      add(teacherCategoryFor(sec, sub), sub.subject, sub.periods)
    }
    if (classPeriods > 0) add(categoryForStage(sec.stage), CLASS_TEACHER, classPeriods)
  }

  const rows: DemandRow[] = []
  for (const [key, r] of map) {
    const target = effectiveLimits(rules, rules.workload[r.category]).target
    const needed = r.subject === CLASS_TEACHER ? r.sections : ffdBins(r.items, target)
    const available = staff.filter((st) => {
      if (st.category !== r.category) return false
      if (r.subject === CLASS_TEACHER) return true
      return st.subjects.length > 0 && norm(st.subjects[0]) === norm(r.subject)
    }).length
    rows.push({ key, category: r.category, subject: r.subject, periods: r.periods, target, needed, available, gap: available - needed })
  }
  for (const [category, periods] of flex) {
    const target = effectiveLimits(rules, rules.workload[category]).target
    const catRows = rows.filter((r) => r.category === category)
    const total = catRows.reduce((a, r) => a + r.periods, 0) + periods
    const extra = Math.max(0, Math.ceil(total / target) - catRows.reduce((a, r) => a + r.needed, 0))
    const known = new Set(catRows.map((r) => norm(r.subject)))
    const spare = staff.filter((st) => st.category === category && !known.has(norm(st.subjects[0] ?? ''))).length
    rows.push({ key: `${category}|SHARED`, category, subject: 'Shared periods (Club / Library)', periods, target, needed: extra, available: spare, gap: spare - extra })
  }
  const order: Category[] = ['MONTESSORI', 'SGT', 'TGT', 'PGT', 'SPECIALIST', 'ACAD_HEAD', 'PRINCIPAL']
  rows.sort((a, b) => order.indexOf(a.category) - order.indexOf(b.category) || a.subject.localeCompare(b.subject))
  return rows
}

export interface SchoolSummary {
  students: number
  boys6to12: number
  girls6to12: number
  sections: number
  needed: number
  available: number
  shortage: number
  ptr: number | null
  checks: { ok: boolean; text: string }[]
  perStandard: { standard: string; students: number; boys: number; girls: number; sections: number }[]
}

export function summarize(rules: RuleSet, data: SchoolData, sections: Section[], demand: DemandRow[]): SchoolSummary {
  const students = sections.reduce((a, s) => a + s.strength, 0)
  let boys = 0
  let girls = 0
  const per = new Map<string, { students: number; boys: number; girls: number; sections: number }>()
  for (const std of STANDARDS) per.set(std, { students: 0, boys: 0, girls: 0, sections: 0 })
  for (const std of STANDARDS) {
    if (stageOf(std) === 'HSS') {
      for (const g of rules.hssGroups) {
        const c = data.hss[std]?.[g.id]
        if (!c) continue
        const p = per.get(std)!
        p.boys += c.boys; p.girls += c.girls; p.students += c.boys + c.girls
      }
    } else {
      const c = data.strength[std]
      if (!c) continue
      const p = per.get(std)!
      p.boys += c.boys; p.girls += c.girls; p.students += c.boys + c.girls
    }
  }
  for (const s of sections) per.get(s.standard)!.sections += 1
  for (const [std, p] of per) if (Number(std) >= 6) { boys += p.boys; girls += p.girls }

  const needed = demand.reduce((a, d) => a + d.needed, 0)
  const teaching = data.staff.filter((s) => s.category !== 'PRINCIPAL' && isTeachingCategory(s.category))
  const available = teaching.length
  const shortage = demand.reduce((a, d) => a + Math.max(0, -d.gap), 0)
  const ptr = available > 0 ? Math.round((students / available) * 10) / 10 : null

  const checks: SchoolSummary['checks'] = []
  for (const s of sections) {
    const cap = rules.sectionCap[s.stage]
    if (s.strength > cap) checks.push({ ok: false, text: `${s.label}: ${s.strength} students exceeds cap ${cap}` })
  }
  if (rules.minTeachersPerSection && sections.length > 0) {
    const ratio = teaching.filter((t) => !/(^|\W)PE(\W|$)|physical/i.test(t.subjects[0] ?? '')).length / sections.length
    checks.push({
      ok: ratio >= rules.minTeachersPerSection,
      text: `Teachers per section: ${ratio.toFixed(2)} (CBSE minimum ${rules.minTeachersPerSection})`,
    })
  }
  if (ptr !== null) {
    const worst = Math.max(...Object.values(rules.ptr))
    checks.push({ ok: ptr <= worst, text: `Overall pupil–teacher ratio 1:${ptr}` })
  }
  if (shortage > 0) checks.push({ ok: false, text: `Shortage of ${shortage} teacher(s) — see subject table` })
  else if (sections.length > 0) checks.push({ ok: true, text: 'No subject-wise shortage' })

  return {
    students, boys6to12: boys, girls6to12: girls, sections: sections.length, needed, available, shortage, ptr, checks,
    perStandard: [...per].map(([standard, p]) => ({ standard, ...p })),
  }
}
