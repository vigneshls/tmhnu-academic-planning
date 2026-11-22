import { CATEGORY_LABEL, effectiveLimits, stageOf } from './rules'
import { SOURCES } from './sources'
import type { Allocation, RuleSet, SchoolData, Section } from './types'
import { isTeachingCategory } from './types'
import type { Recommendation } from './recommend'

const n = (s: string) => s.trim().toLowerCase()
const classLabel = (std: string) => (std === 'PREKG' ? 'Pre-KG' : /^\d+$/.test(std) ? `Class ${std}` : std)
const where = (a: Allocation) => `${classLabel(a.standard)}${a.groupName ? ' ' + a.groupName : ''} ${a.section}`

/** Subject families used to judge whether a teacher is teaching in their own field */
const FAMILIES: [string, RegExp][] = [
  ['tamil', /tamil/], ['english', /english/], ['hindi', /hindi/], ['sanskrit', /sanskrit/], ['french', /french/],
  ['maths', /math/],
  ['science', /science(?!.*social)|physics|chemistry|biology|botany|zoology|evs|environmental/],
  ['social', /social|history|geography|civics|evs/],
  ['commerce', /commerce|accountancy|business studies|economics/],
  ['computer', /computer|informatics|\bict\b/],
]
const families = (subject: string) => FAMILIES.filter(([, re]) => re.test(n(subject).replace(/computer science/, 'computer'))).map(([f]) => f)
/** Academic subjects where teaching outside one's field matters (activities like Spoken, Skill, VE, Library are excluded) */
const CORE = /tamil|english|hindi|sanskrit|french|math|science|physics|chemistry|biology|botany|zoology|evs|social|history|geography|economics|commerce|accountancy|business|computer/

export function teacherLoads(allocs: Allocation[]) {
  /** periods = teaching load; care = supervised non-teaching periods (Sleeping / Snack time) */
  const m = new Map<string, { periods: number; care: number; items: string[] }>()
  for (const a of allocs) {
    if (a.mode !== 'named') continue
    a.teachers.forEach((id, i) => {
      const p = Math.floor(a.periods / a.teachers.length) + (i < a.periods % a.teachers.length ? 1 : 0)
      const cur = m.get(id) ?? { periods: 0, care: 0, items: [] }
      if (a.care) cur.care += p
      else cur.periods += p
      cur.items.push(`${a.subject}${a.option && a.option !== a.subject ? ` (${a.option})` : ''} — ${where(a)} (${p}${a.care ? ', supervision' : ''})`)
      m.set(id, cur)
    })
  }
  return m
}

export function allocationChecks(rules: RuleSet, data: SchoolData, sections: Section[]): Recommendation[] {
  const allocs = data.allocations ?? []
  if (!allocs.length) return []
  const out: Recommendation[] = []
  const staff = data.staff
  const byId = new Map(staff.map((s) => [s.id, s]))
  const loads = teacherLoads(allocs)

  // 1. week capacity
  const slots = rules.daysPerWeek * rules.periodsPerDay
  const week = (s: Section) => s.weekPeriods ?? s.subjects.reduce((a, x) => a + x.periods, 0)
  const over = sections.filter((s) => s.allocs && week(s) > slots)
  if (over.length) {
    const maxP = Math.max(...over.map(week))
    const fitDays = Math.ceil(maxP / rules.periodsPerDay)
    out.push({
      id: 'alloc-capacity', status: 'fail', severity: 'critical', area: 'Timetable & workload',
      title: 'Allocated periods do not fit the school week',
      finding: `${over.length} section(s) carry up to ${maxP} periods a week, but the School Profile gives ${rules.daysPerWeek} days × ${rules.periodsPerDay} periods = ${slots}. The timetable cannot place the extra periods.`,
      action: `If the school works ${fitDays} days a week, set "Working Days per Week" to ${fitDays} in the School Profile and re-import. Otherwise reduce the subject periods to ${slots} per section.`,
      people: over.slice(0, 12).map((s) => `${s.label}: ${week(s)}`),
      source: SOURCES.PLANNING,
    })
  }

  // parallel electives (Class 11–12)
  const par = sections.filter((s) => s.parallel?.length)
  if (par.length)
    out.push({
      id: 'alloc-electives', status: 'pass', severity: 'low', area: 'Timetable & workload',
      title: 'Class 11–12 electives are timetabled in parallel',
      finding: `${par.length} section(s) have elective options taught at the same time by different teachers; the timetable books all of them in the same period.`,
      action: 'Check the class timetable: each elective period shows every subject and teacher running then.',
      people: par.map((s) => `${s.label}: ${[...new Set(s.allocs!.filter((a) => a.option).map((a) => a.option))].join(', ')}`),
      source: SOURCES.PLANNING,
    })

  // 2. periods without a teacher
  const noTeacher = allocs.filter((a) => a.mode !== 'named')
  const shared = noTeacher.filter((a) => a.mode === 'shared')
  const blank = noTeacher.filter((a) => a.mode === 'unassigned')
  if (blank.length)
    out.push({
      id: 'alloc-unassigned', status: 'fail', severity: 'high', area: 'Teacher strength',
      title: `${blank.reduce((a, x) => a + x.periods, 0)} periods a week have no teacher named`,
      finding: `${blank.length} allocation row(s) have an empty or unrecognised teacher name.`,
      action: 'Name the teacher for each of these rows (or "Subject Wise" if any subject teacher of the section takes it) and re-import.',
      people: blank.map((a) => `${a.subject} — ${where(a)}${a.unmatched?.length ? ` (written: ${a.unmatched.join(', ')})` : ''}`),
      source: SOURCES.PLANNING,
    })
  if (shared.length)
    out.push({
      id: 'alloc-shared', status: 'fail', severity: 'low', area: 'Timetable & workload',
      title: `${shared.reduce((a, x) => a + x.periods, 0)} "Subject Wise" periods are assigned automatically`,
      finding: `These periods (${[...new Set(shared.map((a) => a.subject))].slice(0, 6).join(', ')}) go to a teacher of the same section with spare capacity when the timetable is generated.${shared.some((a) => a.autoShared) ? ' Activity periods with a blank teacher are included.' : ''}`,
      action: 'Check the generated timetable; name a teacher in the workbook if a specific person must take them.',
      source: SOURCES.PLANNING,
    })

  // 3. teacher load vs policy
  const teaching = staff.filter((s) => isTeachingCategory(s.category))
  const overloaded: string[] = []
  const overSched: string[] = []
  const under: string[] = []
  const unused: string[] = []
  for (const s of teaching) {
    const w = rules.workload[s.category]
    const lim = effectiveLimits(rules, w)
    const p = loads.get(s.id)?.periods ?? 0
    if (p === 0 && !['PRINCIPAL'].includes(s.category)) unused.push(`${s.name} (${CATEGORY_LABEL[s.category]})`)
    else if (p > w.max) overloaded.push(`${s.name}: ${p} (policy max ${w.max})`)
    else if (p > lim.perWeek) overSched.push(`${s.name}: ${p} (schedulable ${lim.perWeek})`)
    else if (p > 0 && p < w.min && !['PRINCIPAL', 'ACAD_HEAD'].includes(s.category)) under.push(`${s.name}: ${p} (policy min ${w.min})`)
  }
  out.push({
    id: 'alloc-overload', status: overloaded.length ? 'fail' : 'pass', severity: 'high', area: 'Timetable & workload',
    title: 'No teacher above the workload policy maximum',
    finding: overloaded.length ? `${overloaded.length} teacher(s) are allocated more than their category maximum.` : 'Every teacher is within the policy maximum.',
    action: 'Move some of their periods to teachers with spare capacity in the same subject.',
    people: overloaded.length ? overloaded : undefined,
    source: SOURCES.TMHNU_POLICY,
  })
  if (overSched.length)
    out.push({
      id: 'alloc-oversched', status: 'fail', severity: 'medium', area: 'Timetable & workload',
      title: 'Teachers above what the day structure allows',
      finding: `${overSched.length} teacher(s) are within policy but above the periods possible under the continuous-period rule.`,
      action: 'Either allow short intervals to break continuity (Board Rules) or rebalance these teachers.',
      people: overSched, source: SOURCES.TMHNU_POLICY,
    })
  if (under.length)
    out.push({
      id: 'alloc-under', status: 'fail', severity: 'low', area: 'Timetable & workload',
      title: 'Teachers below the workload policy minimum',
      finding: `${under.length} teacher(s) have spare capacity.`,
      action: 'Use them for remedial periods, substitution, or to relieve overloaded colleagues.',
      people: under, source: SOURCES.TMHNU_POLICY,
    })
  if (unused.length)
    out.push({
      id: 'alloc-unused', status: 'fail', severity: 'medium', area: 'Teacher strength',
      title: 'Teachers on the faculty list with no periods allocated',
      finding: `${unused.length} teacher(s) appear in Faculty but not in Subject Periods.`,
      action: 'Allocate periods to them, or confirm they are on leave / non-teaching and update their designation.',
      people: unused, source: SOURCES.PLANNING,
    })

  const careRows = allocs.filter((a) => a.care)
  if (careRows.length)
    out.push({
      id: 'alloc-care', status: 'pass', severity: 'low', area: 'Timetable & workload',
      title: 'Supervision periods kept apart from teaching load',
      finding: `${[...new Set(careRows.map((a) => a.subject))].join(', ')} (${careRows.reduce((s, a) => s + a.periods, 0)} periods a week) are scheduled with the named teacher but not counted against the teaching-period limits.`,
      action: 'Arrange an ayah / helper for these periods where possible, so the teacher can prepare or take other duties.',
      source: SOURCES.PLANNING,
    })

  // 4. out-of-field teaching (academic subjects only)
  const oof: string[] = []
  for (const a of allocs) {
    if (a.mode !== 'named' || !CORE.test(n(a.subject))) continue
    const fam = families(a.subject)
    if (!fam.length) continue
    for (const id of a.teachers) {
      const s = byId.get(id)
      if (!s) continue
      if ((s.category === 'SGT' || s.category === 'MONTESSORI') && (stageOf(a.standard) === 'PRE' || stageOf(a.standard) === 'PRIMARY')) continue
      const own = new Set(s.subjects.flatMap(families))
      if (!fam.some((f) => own.has(f))) oof.push(`${s.name} (${s.subjects[0] ?? 'no subject'}) → ${a.subject}, ${where(a)}`)
    }
  }
  out.push({
    id: 'alloc-outoffield', status: oof.length ? 'fail' : 'pass', severity: 'medium', area: 'Qualifications',
    title: 'Academic subjects taught by teachers of that subject',
    finding: oof.length ? `${oof.length} allocation(s) give an academic subject to a teacher whose listed subject is different.` : 'Every academic subject is taught by a teacher of that subject.',
    action: 'Reassign to a qualified teacher, or add the subject under "Other Subjects" in Faculty if the teacher is qualified for it.',
    people: oof.length ? oof : undefined, source: SOURCES.PLANNING,
  })

  // 5. teacher level vs class level
  const level: string[] = []
  for (const a of allocs) {
    if (a.mode !== 'named' || !CORE.test(n(a.subject))) continue
    const st = stageOf(a.standard)
    for (const id of a.teachers) {
      const s = byId.get(id)
      if (!s) continue
      if (st === 'HSS' && !['PGT', 'ACAD_HEAD', 'PRINCIPAL'].includes(s.category)) level.push(`${s.name} (${CATEGORY_LABEL[s.category]}) → ${a.subject}, ${where(a)}`)
      if ((st === 'HIGH' || st === 'MIDDLE') && ['SGT', 'MONTESSORI'].includes(s.category)) level.push(`${s.name} (${CATEGORY_LABEL[s.category]}) → ${a.subject}, ${where(a)}`)
    }
  }
  out.push({
    id: 'alloc-level', status: level.length ? 'fail' : 'pass', severity: 'high', area: 'Qualifications',
    title: 'Teacher level matches the class level',
    finding: level.length ? `${level.length} allocation(s): Classes 11–12 need PG teachers; Classes 6–10 need graduate (B.Ed) teachers.` : 'Classes 11–12 are taught by PG teachers and Classes 6–10 by graduate teachers.',
    action: 'Reassign these periods to a teacher of the right level.',
    people: level.length ? level : undefined, source: SOURCES.TN_RULES_2023,
  })

  // 6. student groups vs teaching groups (Class 11–12)
  const taught = new Set(allocs.filter((a) => a.groupId).map((a) => a.groupId))
  const orphan: string[] = []
  for (const std of ['11', '12']) for (const [gid, c] of Object.entries(data.hss[std] ?? {})) if (c.boys + c.girls > 0 && !taught.has(gid)) orphan.push(`Class ${std} ${gid}: ${c.boys + c.girls} students`)
  const empty = sections.filter((s) => s.allocs && s.stage === 'HSS' && s.strength === 0).map((s) => s.label)
  if (orphan.length || empty.length)
    out.push({
      id: 'alloc-groups', status: 'fail', severity: 'medium', area: 'Data quality',
      title: 'Class 11–12 group names differ between Students and Subject Periods',
      finding: `${orphan.length ? `Student groups with no subject rows: ${orphan.join('; ')}. ` : ''}${empty.length ? `Teaching groups with no students: ${empty.join(', ')}.` : ''}`,
      action: 'Use exactly the same group names in both sheets (e.g. list Commerce students under "Commerce", or add Subject Periods rows for each student group) and re-import.',
      source: SOURCES.PLANNING,
    })
  return out
}
