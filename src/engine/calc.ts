import { categoryForStage, effectiveLimits, isClassTeacherStage, stageOf } from './rules'
import type { Allocation, Category, DemandRow, RuleSet, SchoolData, Section, Stage, Staff } from './types'
import { HSS_STANDARDS, STANDARDS, isTeachingCategory } from './types'
import { splitParallel } from './parallel'

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
  if (data.allocations?.length) return sectionsFromAllocations(rules, data)
  return normSections(rules, data)
}

/** Sections as the board norms would form them (section cap) */
export function normSections(rules: RuleSet, data: SchoolData): Section[] {
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
  /** Teachers beyond the need in specific subjects (allocation-based) */
  excess?: number
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

  const teaching = data.staff.filter((s) => s.category !== 'PRINCIPAL' && isTeachingCategory(s.category))
  let needed = demand.reduce((a, d) => a + d.needed, 0)
  if (data.allocations?.length) {
    // With the school's own allocation: teachers needed = weekly periods ÷ planning load
    const periods = sections.reduce((a, s) => a + s.subjects.filter((x) => !x.noTeacher).reduce((b, x) => b + x.periods, 0), 0)
    const target = effectiveLimits(rules, rules.workload.TGT).target || 30
    needed = Math.ceil(periods / target)
  }
  const available = teaching.length
  const shortage = data.allocations?.length ? Math.max(0, needed - teaching.length) : demand.reduce((a, d) => a + Math.max(0, -d.gap), 0)
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

/** Sections exactly as the school runs them (from the Subject Periods allocation) */
function sectionsFromAllocations(rules: RuleSet, data: SchoolData): Section[] {
  const allocs = data.allocations!
  const covered = new Set(allocs.map((a) => `${a.standard}|${a.groupId ?? ''}`))
  // classes with students but no allocation rows still get norm-based sections
  // HSS student groups without allocation rows are reported as a data issue, not turned into empty sections
  const fallback = normSections(rules, data).filter((s) => !covered.has(`${s.standard}|${s.groupId ?? ''}`) && s.stage !== 'HSS')
  const bySec = new Map<string, Allocation[]>()
  for (const a of allocs) {
    const key = `${a.standard}|${a.groupId ?? ''}|${a.section}`
    bySec.set(key, [...(bySec.get(key) ?? []), a])
  }
  const out: Section[] = []
  const classSecs = new Map<string, string[]>()
  for (const key of bySec.keys()) {
    const ck = key.split('|').slice(0, 2).join('|')
    classSecs.set(ck, [...(classSecs.get(ck) ?? []), key])
  }
  for (const [ck, keys] of classSecs) {
    const [std, gid] = ck.split('|')
    const c = (gid ? data.hss[std]?.[gid] : data.strength[std]) ?? { boys: 0, girls: 0 }
    keys.sort()
    // Gender of each section: written by the school ("A (Boys)"), else worked out from the counts
    const split6 = data.genderSeparate && Number(std) >= 6
    const g = new Map<string, Section['gender']>()
    let inferred = false
    for (const key of keys) { const w = bySec.get(key)!.find((a) => a.gender)?.gender; if (w) g.set(key, w) }
    const open = keys.filter((k) => !g.has(k))
    if (open.length) {
      if (c.boys > 0 && c.girls === 0) open.forEach((k) => g.set(k, 'B'))
      else if (c.girls > 0 && c.boys === 0) open.forEach((k) => g.set(k, 'G'))
      else if (split6 && open.length >= 2 && c.boys + c.girls > 0) {
        // both genders, several sections, nothing written: give boys / girls sections in proportion (boys first)
        const nb = Math.min(open.length - 1, Math.max(1, Math.round((open.length * c.boys) / (c.boys + c.girls))))
        open.forEach((k, i) => g.set(k, i < nb ? 'B' : 'G'))
        inferred = true
      } else open.forEach((k) => g.set(k, 'C'))
      if (c.boys === 0 || c.girls === 0) inferred = false
    }
    // strength: each gender's count shared by its sections; mixed sections share the rest
    const nOf = (x: Section['gender']) => keys.filter((k) => g.get(k) === x).length
    const nb = nOf('B'), ng = nOf('G'), nc = nOf('C')
    const boysLeft = nb ? 0 : c.boys, girlsLeft = ng ? 0 : c.girls
    const bSizes = split(c.boys, nb || 1), gSizes = split(c.girls, ng || 1)
    const cSizes = split(boysLeft + girlsLeft, nc || 1)
    const cb = split(boysLeft, nc || 1), cg = split(girlsLeft, nc || 1)
    const idx = { B: 0, G: 0, C: 0 }
    for (const key of keys) {
      const list = bySec.get(key)!
      const a0 = list[0]
      const sp = splitParallel(list)
      const gender = g.get(key)!
      const i = idx[gender]++
      const strength = gender === 'B' ? bSizes[i] : gender === 'G' ? gSizes[i] : cSizes[i]
      const gTxt = gender === 'B' ? ' (Boys)' : gender === 'G' ? ' (Girls)' : split6 && Number(std) >= 6 ? ' (Mixed)' : ''
      out.push({
        id: `${std}-${gid || 'X'}-${a0.section}`,
        standard: std,
        stage: stageOf(std),
        groupId: gid || undefined,
        gender,
        ...(inferred && open.includes(key) ? { genderInferred: true } : {}),
        boys: gender === 'B' ? strength : gender === 'G' ? 0 : cb[i] ?? 0,
        girls: gender === 'G' ? strength : gender === 'B' ? 0 : cg[i] ?? 0,
        label: `${std}${a0.groupName ? ' ' + a0.groupName : ''} ${a0.section}${gTxt}`,
        strength: strength ?? 0,
        subjects: list.map((a) => ({ subject: a.subject, periods: a.periods, pref: a.pref, ...(a.mode === 'shared' ? { flex: true } : {}) })),
        allocs: list,
        ...(sp.blocks.length ? { parallel: sp.blocks } : {}),
        weekPeriods: sp.weekPeriods,
      })
    }
  }
  const order = (s: Section) => STANDARDS.indexOf(s.standard as (typeof STANDARDS)[number]) * 1000 + (s.groupId ? s.groupId.charCodeAt(0) : 0)
  return [...out, ...fallback].sort((a, b) => order(a) - order(b) || a.label.localeCompare(b.label))
}
