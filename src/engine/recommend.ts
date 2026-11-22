import { CLASS_TEACHER, type SchoolSummary } from './calc'
import { CATEGORY_LABEL, effectiveLimits, stageOf } from './rules'
import { SOURCES, type Source } from './sources'
import { allocationChecks } from './allocationChecks'
import type { Board, Category, DemandRow, RuleSet, SchoolData, Section, Staff } from './types'
import { isTeachingCategory } from './types'

export type Severity = 'critical' | 'high' | 'medium' | 'low'
export type Area =
  | 'Teacher strength'
  | 'Qualifications'
  | 'Class size & ratios'
  | 'Student support'
  | 'Curriculum'
  | 'Professional development'
  | 'Timetable & workload'
  | 'Compliance & records'
  | 'Data quality'

export interface Recommendation {
  id: string
  status: 'fail' | 'pass'
  severity: Severity
  area: Area
  title: string
  finding: string
  action: string
  people?: string[]
  source: Source
}

export interface ChecklistItem {
  id: string
  area: string
  title: string
  frequency: 'Monthly' | 'Every term' | 'Annually' | 'Before expiry' | 'Ongoing'
  source: Source
}

const ord: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3 }
const n = (x: string) => x.trim().toLowerCase()
const isPE = (s: Staff) => /(^|\W)pe(\W|$)|physical/i.test(s.subjects[0] ?? '')
const LANGUAGES = ['english', 'tamil', 'hindi', 'sanskrit', 'malayalam', 'telugu', 'kannada', 'urdu', 'french', 'german', 'arabic']
const isLanguage = (subj: string) => LANGUAGES.some((l) => n(subj).includes(l))
const hasValue = (v: unknown) => v !== undefined && v !== null && v !== ''

interface Ctx {
  board: Board
  rules: RuleSet
  data: SchoolData
  sections: Section[]
  demand: DemandRow[]
  summary: SchoolSummary
}

export function recommend(ctx: Ctx): Recommendation[] {
  const { board, rules, data, sections, demand, summary } = ctx
  const out: Recommendation[] = []
  const add = (r: Recommendation) => out.push(r)
  const staff = data.staff
  const teaching = staff.filter((s) => isTeachingCategory(s.category) && s.category !== 'PRINCIPAL')
  const byCat = (c: Category) => staff.filter((s) => s.category === c)
  const studentsIn = (pred: (std: string) => boolean) => summary.perStandard.filter((p) => pred(p.standard)).reduce((a, p) => a + p.students, 0)
  const num = (s: string) => (/^\d+$/.test(s) ? Number(s) : 0)
  const primary = studentsIn((s) => num(s) >= 1 && num(s) <= 5)
  const upperPrimary = studentsIn((s) => num(s) >= 6 && num(s) <= 8)
  const secondary = studentsIn((s) => num(s) >= 9 && num(s) <= 10)
  const srSec = studentsIn((s) => num(s) >= 11)
  const total = summary.students
  const names = (list: Staff[]) => list.map((s) => s.name || s.employeeId || '(unnamed)')
  const isCBSE = board === 'CBSE'
  const hasAlloc = !!data.allocations?.length

  if (staff.length === 0) {
    add({
      id: 'data-staff-empty', status: 'fail', severity: 'high', area: 'Data quality',
      title: 'Faculty list not uploaded',
      finding: 'No faculty records exist for this school, so staffing and qualification checks cannot run.',
      action: 'Management should upload the faculty Excel file (Faculty tab → Upload Excel).',
      source: SOURCES.PLANNING,
    })
  }

  // ------------------------------------------------------------ teacher strength (subject-wise demand)
  const short = hasAlloc ? [] : demand.filter((d) => d.gap < 0)
  for (const d of short) {
    add({
      id: `short-${d.key}`, status: 'fail', severity: d.subject === CLASS_TEACHER ? 'critical' : 'critical', area: 'Teacher strength',
      title: `Shortage: ${-d.gap} ${d.subject === CLASS_TEACHER ? 'class teacher(s)' : d.subject + ' teacher(s)'} — ${CATEGORY_LABEL[d.category]}`,
      finding: `${d.periods} periods/week need ${d.needed} teacher(s) at ${d.target} periods each; ${d.available} available.`,
      action: `Recruit ${-d.gap} ${CATEGORY_LABEL[d.category]}${d.subject === CLASS_TEACHER ? '' : ` for ${d.subject}`}, or redeploy surplus staff qualified in this subject.`,
      source: SOURCES.TMHNU_POLICY,
    })
  }
  if (!hasAlloc && staff.length > 0 && short.length === 0 && demand.length > 0)
    add({ id: 'short-none', status: 'pass', severity: 'critical', area: 'Teacher strength', title: 'Subject-wise teacher strength is sufficient', finding: 'Every subject has enough teachers for the current sections.', action: 'Re-check after admissions close each year.', source: SOURCES.TMHNU_POLICY })
  const surplus = hasAlloc ? [] : demand.filter((d) => d.gap > 0 && d.subject !== CLASS_TEACHER)
  if (surplus.length)
    add({
      id: 'surplus', status: 'fail', severity: 'low', area: 'Teacher strength',
      title: 'Surplus teachers in some subjects',
      finding: surplus.map((d) => `${d.subject} (${CATEGORY_LABEL[d.category]}): +${d.gap}`).join('; '),
      action: 'Use surplus periods for remedial classes and substitution, or redeploy to a sister school with a shortage in the same subject.',
      source: SOURCES.TMHNU_POLICY,
    })
  const single = hasAlloc ? [] : demand.filter((d) => d.subject !== CLASS_TEACHER && !d.subject.startsWith('Shared') && d.available === 1 && d.needed >= 1)
  if (single.length)
    add({
      id: 'single-point', status: 'fail', severity: 'medium', area: 'Teacher strength',
      title: 'Subjects depending on a single teacher',
      finding: `Only one teacher handles: ${single.map((d) => d.subject).join(', ')}.`,
      action: 'Identify a trained substitute for each of these subjects (another teacher with the subject as a second subject) to cover leave and exam duty.',
      source: SOURCES.PLANNING,
    })

  // ------------------------------------------------------------ class size & ratios
  const over45 = sections.filter((s) => s.strength > 45)
  const over40 = sections.filter((s) => s.strength > 40 && s.strength <= 45)
  const overCap = sections.filter((s) => s.strength > rules.sectionCap[s.stage])
  if (isCBSE) {
    add({
      id: 'cbse-45', status: over45.length ? 'fail' : 'pass', severity: 'critical', area: 'Class size & ratios',
      title: 'No section above 45 students',
      finding: over45.length ? `${over45.length} section(s) above 45: ${over45.map((s) => `${s.label} (${s.strength})`).join(', ')}` : 'All sections are within 45.',
      action: 'Open an additional section immediately; CBSE permits no admission beyond 45 per section under any circumstances.',
      source: SOURCES.CBSE_CIRC_11_2025,
    })
    add({
      id: 'cbse-40', status: over40.length ? 'fail' : 'pass', severity: 'high', area: 'Class size & ratios',
      title: 'Sections within the optimum of 40',
      finding: over40.length ? `${over40.length} section(s) between 41 and 45: ${over40.map((s) => `${s.label} (${s.strength})`).join(', ')}` : 'All sections have 40 or fewer students.',
      action: 'Admissions above 40 must be exceptional and documented in the Admission & Withdrawal Register and on OASIS; otherwise add a section.',
      source: SOURCES.CBSE_BYELAWS_48,
    })
    const ptr = teaching.length ? total / teaching.length : Infinity
    add({
      id: 'cbse-ptr', status: ptr <= 30 ? 'pass' : 'fail', severity: 'critical', area: 'Class size & ratios',
      title: 'Pupil–teacher ratio not above 30:1',
      finding: teaching.length ? `${total} students / ${teaching.length} teachers = ${ptr.toFixed(1)}:1` : 'No teachers recorded.',
      action: `Appoint at least ${Math.max(0, Math.ceil(total / 30) - teaching.length)} more teacher(s) to reach 30:1.`,
      source: SOURCES.CBSE_54,
    })
    const eligible = teaching.filter((s) => !isPE(s)).length
    const need = Math.ceil(sections.length * 1.5)
    add({
      id: 'cbse-15', status: eligible >= need ? 'pass' : 'fail', severity: 'critical', area: 'Class size & ratios',
      title: '1.5 teachers per section',
      finding: `${sections.length} sections need ${need} teachers (excluding Principal, PE teachers, counsellors); ${eligible} recorded.`,
      action: eligible >= need ? 'Maintain.' : `Appoint ${need - eligible} more subject teacher(s).`,
      source: SOURCES.CBSE_54,
    })
  } else if (overCap.length) {
    add({
      id: 'matric-cap', status: 'fail', severity: 'high', area: 'Class size & ratios',
      title: 'Sections above the institution cap',
      finding: overCap.map((s) => `${s.label}: ${s.strength} (cap ${rules.sectionCap[s.stage]})`).join('; '),
      action: 'Split into an additional section; staff strength under Rule 28(1)/32(A)(1) is fixed from pupil strength, so update staffing accordingly.',
      source: SOURCES.TN_PTR,
    })
  }
  // RTE (both boards, Classes 1–8)
  // With the school's allocation, count every teacher's share of Classes 1–5 periods (full-time equivalents)
  const primPeriods = (data.allocations ?? []).filter((a) => a.mode === 'named' && /^[1-5]$/.test(a.standard)).reduce((s, a) => s + a.periods, 0)
  const fteTarget = effectiveLimits(rules, rules.workload.SGT).target || 30
  const sgt = hasAlloc ? Math.round((primPeriods / fteTarget) * 10) / 10 : byCat('SGT').length
  if (primary > 0) {
    const ratio = sgt ? primary / sgt : Infinity
    add({
      id: 'rte-ptr-primary', status: ratio <= 30 ? 'pass' : 'fail', severity: 'critical', area: 'Class size & ratios',
      title: 'RTE: Classes 1–5 pupil–teacher ratio not above 30:1',
      finding: sgt ? `${primary} students / ${sgt} ${hasAlloc ? `full-time-equivalent teachers (${primPeriods} allocated periods ÷ ${fteTarget})` : 'primary teachers'} = ${ratio.toFixed(1)}:1` : 'No primary teachers recorded.',
      action: `Appoint ${Math.max(0, Math.ceil(primary / 30 - sgt))} more primary teacher(s).`,
      source: SOURCES.RTE_SCHEDULE,
    })
  }
  if (upperPrimary > 0) {
    const has = (re: RegExp) => teaching.some((s) => s.subjects.some((x) => re.test(x)))
    const missing = [
      !has(/math|science/i) && 'Science & Mathematics',
      !has(/social/i) && 'Social Studies',
      !teaching.some((s) => s.subjects.some(isLanguage)) && 'Languages',
    ].filter(Boolean)
    add({
      id: 'rte-subject-teachers', status: missing.length ? 'fail' : 'pass', severity: 'critical', area: 'Teacher strength',
      title: 'RTE: subject teachers for Classes 6–8',
      finding: missing.length ? `No teacher recorded for: ${missing.join(', ')}.` : 'Science & Mathematics, Social Studies and Language teachers are present.',
      action: 'Appoint at least one teacher for each of Science & Mathematics, Social Studies and Languages.',
      source: SOURCES.RTE_SCHEDULE,
    })
    if (upperPrimary > 100) {
      const art = teaching.some((s) => s.subjects.some((x) => /art|craft|music|dance/i.test(x)))
      const pe = teaching.some(isPE)
      const work = teaching.some((s) => s.subjects.some((x) => /work education|vocational|skill/i.test(x)))
      const gaps = [!art && 'Art Education', !pe && 'Health & Physical Education', !work && 'Work Education'].filter(Boolean)
      add({
        id: 'rte-instructors', status: gaps.length ? 'fail' : 'pass', severity: 'high', area: 'Teacher strength',
        title: 'RTE: instructors for Art, Health & PE and Work Education (upper primary > 100)',
        finding: gaps.length ? `${upperPrimary} students in Classes 6–8; no instructor recorded for ${gaps.join(', ')}.` : 'All three instructor areas covered.',
        action: 'Appoint (at least part-time) instructors for the missing areas.',
        source: SOURCES.RTE_SCHEDULE,
      })
    }
  }
  if (total > 0)
    add({
      id: 'head', status: byCat('PRINCIPAL').length ? 'pass' : 'fail', severity: 'high', area: 'Teacher strength',
      title: 'Full-time head of institution',
      finding: byCat('PRINCIPAL').length ? 'Principal recorded.' : 'No Principal in the faculty list.',
      action: 'Record the Principal in the faculty list (RTE requires a full-time head teacher above 150 primary / 100 upper-primary children).',
      source: SOURCES.RTE_SCHEDULE,
    })

  // ------------------------------------------------------------ student support
  const hasSecondary = secondary + srSec > 0
  if (isCBSE && hasSecondary) {
    add({
      id: 'cbse-special-educator', status: byCat('SPECIAL_EDUCATOR').length ? 'pass' : 'fail', severity: 'critical', area: 'Student support',
      title: 'Full-time Special Educator',
      finding: byCat('SPECIAL_EDUCATOR').length ? `${byCat('SPECIAL_EDUCATOR').length} recorded.` : 'None recorded.',
      action: 'Appoint a full-time Special Educator qualified per RCI norms.',
      source: SOURCES.CBSE_2411,
    })
    const needC = Math.max(1, Math.ceil(total / 500))
    const haveC = byCat('COUNSELLOR').filter((s) => s.appointment !== 'PART_TIME' && s.appointment !== 'CONTRACT').length
    add({
      id: 'cbse-counsellor', status: haveC >= needC ? 'pass' : 'fail', severity: 'critical', area: 'Student support',
      title: `Counselling & Wellness Teacher — 1 per 500 students (${needC} needed)`,
      finding: `${total} students; ${byCat('COUNSELLOR').length} counsellor(s) recorded, ${haveC} on regular appointment.`,
      action: `Appoint ${Math.max(0, needC - haveC)} regular counsellor(s) with a Psychology degree (or PG Social Work with counselling focus) and the 50-hour CBSE capacity-building programme.`,
      source: SOURCES.CBSE_2412_2026,
    })
    const needCC = Math.max(1, Math.ceil((secondary + srSec) / 500))
    add({
      id: 'cbse-career', status: byCat('CAREER_COUNSELLOR').length >= needCC ? 'pass' : 'fail', severity: 'high', area: 'Student support',
      title: `Career Counsellor for Classes 9–12 (${needCC} needed)`,
      finding: `${secondary + srSec} students in Classes 9–12; ${byCat('CAREER_COUNSELLOR').length} career counsellor(s) recorded.`,
      action: 'Appoint a Career Counsellor (graduate / postgraduate in Humanities, Science, Social Sciences, Management, Education or Technology).',
      source: SOURCES.CBSE_2412_2026,
    })
  }
  if (isCBSE && total > 0) {
    const stages = [
      { name: 'primary (1–5)', s: primary },
      { name: 'secondary (6–10)', s: upperPrimary + secondary },
      { name: 'senior secondary (11–12)', s: srSec },
    ].filter((x) => x.s > 0)
    const needPE = stages.reduce((a, x) => a + Math.ceil(x.s / 500), 0)
    const havePE = teaching.filter(isPE).length
    add({
      id: 'cbse-pe', status: havePE >= needPE ? 'pass' : 'fail', severity: 'high', area: 'Student support',
      title: `Physical Education teachers at each stage (${needPE} needed at 1:500)`,
      finding: `${havePE} PE teacher(s) recorded for ${stages.map((x) => `${x.name}: ${x.s}`).join(', ')}.`,
      action: 'Appoint PE teachers designated PRT/TGT/PGT (Physical Education) for each stage.',
      source: SOURCES.CBSE_PE,
    })
  }
  if (!isCBSE && total > 0)
    add({
      id: 'matric-counsellor', status: byCat('COUNSELLOR').length ? 'pass' : 'fail', severity: 'high', area: 'Student support',
      title: 'Counsellor for the Anti-bullying Committee',
      finding: byCat('COUNSELLOR').length ? 'Counsellor recorded.' : 'No counsellor recorded; Rule 41(B)(1)(d) requires one on the Anti-bullying Committee.',
      action: 'Appoint or designate a qualified counsellor and constitute the Anti-bullying Committee.',
      source: SOURCES.TN_RULES_2023,
    })

  // ------------------------------------------------------------ qualifications
  const rt = (r: Omit<Recommendation, 'status'>, list: Staff[]) => add({ ...r, status: list.length ? 'fail' : 'pass', people: list.length ? names(list) : undefined })
  const prim = byCat('SGT')
  const noDeled = prim.filter((s) => hasValue(s.professionalQualification) && !['DELED', 'BELED'].includes(s.professionalQualification!))
  if (prim.length)
    rt({
      id: 'qual-primary', severity: 'high', area: 'Qualifications',
      title: 'Primary teachers hold D.El.Ed. / B.El.Ed.',
      finding: noDeled.length ? `${noDeled.length} of ${prim.length} primary teacher(s) do not hold D.El.Ed./B.El.Ed.` : 'All primary teachers with recorded qualification hold D.El.Ed./B.El.Ed.',
      action: 'For new appointments to Classes 1–5, recruit D.El.Ed./B.El.Ed. holders; B.Ed.-only candidates are not eligible after the 2023 Supreme Court ruling.',
      source: SOURCES.SC_DELED,
    }, noDeled)
  const tgt = byCat('TGT')
  const tgtBad = tgt.filter((s) => (hasValue(s.highestQualification) && ['HSC', 'DIPLOMA'].includes(s.highestQualification!)) || (hasValue(s.professionalQualification) && !['BED', 'MED', 'BELED'].includes(s.professionalQualification!)))
  if (tgt.length)
    rt({
      id: 'qual-tgt', severity: 'high', area: 'Qualifications',
      title: 'Graduate teachers hold a degree + B.Ed.',
      finding: tgtBad.length ? `${tgtBad.length} of ${tgt.length} graduate teacher(s) lack a degree or B.Ed.` : 'All graduate teachers with recorded qualification meet degree + B.Ed.',
      action: 'Deploy unqualified staff only where permitted and plan their B.Ed. completion; recruit qualified teachers for new posts.',
      source: isCBSE ? SOURCES.CBSE_51 : SOURCES.TN_RULES_2023,
    }, tgtBad)
  const pgt = byCat('PGT')
  const pgtBad = pgt.filter((s) => (hasValue(s.highestQualification) && !['PG', 'MPHIL', 'PHD'].includes(s.highestQualification!)) || (hasValue(s.professionalQualification) && !['BED', 'MED'].includes(s.professionalQualification!)))
  if (pgt.length)
    rt({
      id: 'qual-pgt', severity: 'high', area: 'Qualifications',
      title: 'Post-graduate teachers hold a PG degree + B.Ed.',
      finding: pgtBad.length ? `${pgtBad.length} of ${pgt.length} PG teacher(s) lack a PG degree or B.Ed.` : 'All PG teachers with recorded qualification meet PG + B.Ed.',
      action: 'Classes 11–12 subjects must be taught by PG + B.Ed. teachers in the subject; reassign or recruit.',
      source: isCBSE ? SOURCES.CBSE_51 : SOURCES.TN_RULES_2023,
    }, pgtBad)
  const tetI = (t?: string) => ['TNTET1', 'TNTET_BOTH', 'CTET1', 'CTET_BOTH', 'PASSED'].includes(t ?? '')
  const tetII = (t?: string) => ['TNTET2', 'TNTET_BOTH', 'CTET2', 'CTET_BOTH', 'PASSED'].includes(t ?? '')
  const primNoTet = prim.filter((s) => hasValue(s.tet) && !tetI(s.tet))
  const hasUpper = sections.some((s) => stageOf(s.standard) === 'MIDDLE')
  const tgtNoTet = hasUpper ? tgt.filter((s) => hasValue(s.tet) && !tetII(s.tet)) : []
  const noTet = [...primNoTet, ...tgtNoTet]
  if (prim.length || (hasUpper && tgt.length))
    rt({
      id: 'qual-tet', severity: 'high', area: 'Qualifications',
      title: `TET for teachers of Classes 1–8 (${isCBSE ? 'CTET / TNTET' : 'TNTET / CTET'})`,
      finding: noTet.length ? `${primNoTet.length} primary teacher(s) without Paper I and ${tgtNoTet.length} graduate teacher(s) without Paper II.` : 'All teachers of Classes 1–8 with recorded TET status have passed the relevant paper.',
      action: 'Assign Classes 1–8 only to TET-qualified teachers where possible and support others to clear TET. Track the Supreme Court review on in-service teachers.',
      source: SOURCES.RTE_TET,
    }, noTet)
  if (isCBSE) {
    const nonRegular = teaching.filter((s) => s.appointment === 'CONTRACT' || s.appointment === 'PART_TIME')
    if (teaching.length)
      rt({
        id: 'cbse-regular', severity: 'medium', area: 'Qualifications',
        title: 'Teachers appointed on a regular basis',
        finding: nonRegular.length ? `${nonRegular.length} teacher(s) on contract / part-time.` : 'All recorded teachers are regular / probation.',
        action: 'Convert sanctioned teaching posts to regular appointments with salary per State norms.',
        source: SOURCES.CBSE_EXPECT,
      }, nonRegular)
  }
  const novice = demand
    .filter((d) => d.subject !== CLASS_TEACHER && !d.subject.startsWith('Shared'))
    .map((d) => ({ d, list: teaching.filter((s) => s.category === d.category && n(s.subjects[0] ?? '') === n(d.subject)) }))
    .filter((x) => x.list.length > 0 && x.list.every((s) => hasValue(s.experienceYears) && (s.experienceYears ?? 0) < 2))
  if (novice.length)
    add({
      id: 'mentoring', status: 'fail', severity: 'medium', area: 'Professional development',
      title: 'Subjects taught only by teachers with under 2 years’ experience',
      finding: novice.map((x) => `${x.d.subject} (${CATEGORY_LABEL[x.d.category]})`).join('; '),
      action: 'Pair these teachers with a senior mentor (Academic Head or senior teacher of the subject) and review lesson plans monthly.',
      source: SOURCES.PLANNING,
    })

  // ------------------------------------------------------------ professional development
  const withCpd = teaching.filter((s) => hasValue(s.cpdHours))
  const lowCpd = withCpd.filter((s) => (s.cpdHours ?? 0) < 50)
  if (teaching.length)
    add({
      id: 'cpd', status: lowCpd.length ? 'fail' : 'pass', severity: isCBSE ? 'high' : 'medium', area: 'Professional development',
      title: '50 hours of training per teacher per year',
      finding: withCpd.length ? `${lowCpd.length} of ${withCpd.length} teacher(s) below 50 hours.` : 'CPD hours not recorded.',
      action: isCBSE ? 'Plan the remaining hours (at least 25 through CBSE / Government institutes; the rest in-house) and keep certificates.' : 'Adopt a 50-hour annual training plan per teacher and record hours.',
      people: lowCpd.length ? lowCpd.map((s) => `${s.name} (${s.cpdHours} h)`) : undefined,
      source: isCBSE ? SOURCES.CBSE_CPD : SOURCES.NEP_CPD,
    })

  // ------------------------------------------------------------ curriculum
  const tamilMissing = Object.entries(rules.subjectsByStandard)
    .filter(([std]) => num(std) >= 1 && num(std) <= 10 && sections.some((s) => s.standard === std))
    .filter(([, subs]) => !subs.some((x) => /tamil/i.test(x.subject)))
    .map(([std]) => std)
  if (sections.length)
    add({
      id: 'tamil', status: tamilMissing.length ? 'fail' : 'pass', severity: 'critical', area: 'Curriculum',
      title: 'Tamil taught in Classes 1–10',
      finding: tamilMissing.length ? `No Tamil period in Class ${tamilMissing.join(', ')}.` : 'Tamil is in the timetable for every class from 1 to 10.',
      action: 'Add Tamil periods in Board Rules → Subject periods for the listed classes.',
      source: SOURCES.TN_TAMIL_ACT,
    })
  if (isCBSE && sections.some((s) => s.standard === '6')) {
    const langs = (rules.subjectsByStandard['6'] ?? []).filter((x) => isLanguage(x.subject))
    add({
      id: 'cbse-r3', status: langs.length >= 3 ? 'pass' : 'fail', severity: 'high', area: 'Curriculum',
      title: 'Three languages (R1, R2, R3) from Class 6',
      finding: `Class 6 has ${langs.length} language subject(s): ${langs.map((x) => x.subject).join(', ') || 'none'}.`,
      action: 'Offer three languages in Class 6, at least two of them Indian languages (e.g., Tamil + Hindi/Sanskrit + English).',
      source: SOURCES.CBSE_R3,
    })
  }
  const slots = rules.daysPerWeek * rules.periodsPerDay
  const badAlloc = [...Object.entries(rules.subjectsByStandard), ...rules.hssGroups.map((g) => [g.name, g.subjects] as const)]
    .filter(([, subs]) => !hasAlloc && subs.reduce((a, x) => a + x.periods, 0) !== slots)
    .map(([k]) => k)
  if (badAlloc.length)
    add({
      id: 'alloc', status: 'fail', severity: 'medium', area: 'Curriculum',
      title: 'Subject periods do not fill the week',
      finding: `Totals differ from ${slots} weekly slots for: ${badAlloc.join(', ')}.`,
      action: 'Correct the allocation in Board Rules so every class has a full week.',
      source: SOURCES.PLANNING,
    })

  // ------------------------------------------------------------ timetable & workload
  const tt = data.timetable
  const capped = (['SGT', 'TGT', 'PGT', 'SPECIALIST'] as Category[]).filter((c) => effectiveLimits(rules, rules.workload[c]).perWeek < rules.workload[c].max)
  if (capped.length)
    add({
      id: 'rule-conflict', status: 'fail', severity: 'medium', area: 'Timetable & workload',
      title: 'Workload policy exceeds what the day structure allows',
      finding: `With ${rules.periodsPerDay} periods/day, lunch after period ${rules.lunchAfterPeriod} and max ${rules.maxConsecutive} continuous periods, a teacher can take at most ${effectiveLimits(rules, rules.workload.TGT).perDay}/day. Affected: ${capped.map((c) => CATEGORY_LABEL[c]).join(', ')}.`,
      action: 'Decide whether short intervals break continuity (Board Rules) or lower the policy maximum; staffing is calculated on the schedulable limit.',
      source: SOURCES.TMHNU_POLICY,
    })
  if (sections.length && staff.length) {
    if (!tt)
      add({ id: 'tt-missing', status: 'fail', severity: 'medium', area: 'Timetable & workload', title: 'Timetable not generated', finding: 'No timetable exists for the current data.', action: 'Generate the timetable (Timetable tab) after confirming strength and faculty.', source: SOURCES.PLANNING })
    else {
      const vac = tt.teachers.filter((t) => t.vacancy)
      const missing = tt.unplaced.reduce((a, u) => a + u.remaining, 0)
      add({
        id: 'tt-vacancy', status: vac.length ? 'fail' : 'pass', severity: 'high', area: 'Timetable & workload',
        title: 'Every timetable slot has a real teacher',
        finding: vac.length ? `${vac.length} vacancy placeholder(s): ${vac.map((v) => v.name).join(', ')}.` : 'No vacancy placeholders.',
        action: 'Fill these posts; until then assign substitution from teachers with free periods.',
        source: SOURCES.PLANNING,
      })
      if (missing)
        add({ id: 'tt-unplaced', status: 'fail', severity: 'high', area: 'Timetable & workload', title: 'Periods could not be scheduled', finding: `${missing} period(s) are unscheduled.`, action: 'Add staff for the affected subjects or relax the day structure, then re-generate.', source: SOURCES.PLANNING })
      const load = new Map<string, number>()
      for (const sec of tt.sections) for (const day of tt.grid[sec.id] ?? []) for (const c of day) if (c?.teacherId) load.set(c.teacherId, (load.get(c.teacherId) ?? 0) + 1)
      const tight = tt.teachers.filter((t) => !t.vacancy && t.maxPerWeek - (load.get(t.id) ?? 0) < 5 && (load.get(t.id) ?? 0) > 0)
      if (tight.length)
        add({
          id: 'buffer', status: 'fail', severity: 'low', area: 'Timetable & workload',
          title: 'Teachers with less than 5 periods of buffer',
          finding: `${tight.length} teacher(s) are within 5 periods of their maximum.`,
          action: 'Keep 5–8 periods per teacher for substitution and remedial work, as the TMHNU policy recommends; rebalance or add staff.',
          people: tight.map((t) => `${t.name} (${load.get(t.id)}/${t.maxPerWeek})`),
          source: SOURCES.TMHNU_POLICY,
        })
    }
  }
  const tiny = sections.filter((s) => s.gender !== 'C' && s.strength > 0 && s.strength < 15)
  if (tiny.length)
    add({
      id: 'tiny-sections', status: 'fail', severity: 'low', area: 'Class size & ratios',
      title: 'Very small single-gender sections',
      finding: tiny.map((s) => `${s.label}: ${s.strength}`).join('; '),
      action: 'Separate boys/girls sections at these sizes need full subject staffing each; review whether the separation is required for these classes.',
      source: SOURCES.PLANNING,
    })

  // ------------------------------------------------------------ profile-based checks
  const prof = data.profile ?? {}
  const today = new Date(new Date().toISOString().slice(0, 10) + 'T00:00:00Z')
  const daysTo = (iso: string) => Math.round((new Date(iso + 'T00:00:00Z').getTime() - today.getTime()) / 86400000)
  const fmt = (iso: string) => new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' })
  if (prof.recognitionValidUntil) {
    const left = daysTo(prof.recognitionValidUntil)
    add({
      id: 'recognition', status: left > 90 ? 'pass' : 'fail', severity: left < 0 ? 'critical' : 'high', area: 'Compliance & records',
      title: isCBSE ? 'Affiliation valid' : 'Recognition valid and renewal applied in time',
      finding: left < 0 ? `Expired on ${fmt(prof.recognitionValidUntil)}.` : `Valid until ${fmt(prof.recognitionValidUntil)} (${left} days left).`,
      action: isCBSE ? 'Apply for extension of affiliation well before expiry and keep the State recognition current.' : 'Apply for renewal at least 3 months before expiry, with valid structural stability certificate, building licence and Fire NOC.',
      source: isCBSE ? SOURCES.PLANNING : SOURCES.TN_RULES_2023,
    })
  }
  if (prof.workingDaysYear) {
    const hours = prof.periodMinutes ? Math.round((prof.workingDaysYear * rules.periodsPerDay * prof.periodMinutes) / 60) : null
    const checks: string[] = []
    let ok = true
    if (primary > 0) {
      const dOk = prof.workingDaysYear >= 200
      const hOk = hours === null || hours >= 800
      ok = ok && dOk && hOk
      checks.push(`Classes 1–5: ${prof.workingDaysYear} days (min 200)${hours !== null ? `, ${hours} teaching hours (min 800)` : ''}`)
    }
    if (upperPrimary > 0) {
      const dOk = prof.workingDaysYear >= 220
      const hOk = hours === null || hours >= 1000
      ok = ok && dOk && hOk
      checks.push(`Classes 6–8: ${prof.workingDaysYear} days (min 220)${hours !== null ? `, ${hours} teaching hours (min 1000)` : ''}`)
    }
    if (checks.length)
      add({
        id: 'rte-days', status: ok ? 'pass' : 'fail', severity: 'high', area: 'Curriculum',
        title: 'RTE minimum working days and instructional hours',
        finding: checks.join('; ') + (hours === null ? '. Period duration not given, so hours were not checked.' : '.'),
        action: 'Extend the academic calendar or the teaching day so both minimums are met.',
        source: SOURCES.RTE_DAYS,
      })
  }
  const cwsnTotal = Object.values(data.cwsn ?? {}).reduce((a, b) => a + b, 0)
  if (cwsnTotal > 0 && !isCBSE)
    add({
      id: 'cwsn', status: byCat('SPECIAL_EDUCATOR').length ? 'pass' : 'fail', severity: 'medium', area: 'Student support',
      title: 'Support for children with special needs',
      finding: `${cwsnTotal} child(ren) with special needs recorded; ${byCat('SPECIAL_EDUCATOR').length} special educator(s).`,
      action: 'Appoint or share a qualified (RCI-registered) special educator and keep an individual support plan for each child.',
      source: SOURCES.PLANNING,
    })

  // ------------------------------------------------------------ compliance statuses (from the workbook / checklist)
  for (const item of checklist(board)) {
    const e = data.compliance?.[item.id]
    if (!e) continue
    if (e.status === 'NO')
      add({ id: `cmp-${item.id}`, status: 'fail', severity: /safety|recognition/i.test(item.area) ? 'critical' : 'high', area: 'Compliance & records', title: item.title, finding: `Marked "No" by the school${e.note ? ` — ${e.note}` : ''}.`, action: 'Put this in place and update the Compliance sheet.', source: item.source })
    else if (e.validUntil && e.status !== 'NA') {
      const left = daysTo(e.validUntil)
      if (left <= 60)
        add({ id: `cmp-${item.id}`, status: 'fail', severity: left < 0 ? 'critical' : 'high', area: 'Compliance & records', title: item.title, finding: left < 0 ? `Expired on ${fmt(e.validUntil)}.` : `Expires on ${fmt(e.validUntil)} (${left} days).`, action: 'Renew before expiry and record the new validity date.', source: item.source })
    }
  }

  out.push(...allocationChecks(rules, data, sections))

  // ------------------------------------------------------------ data quality
  const missingProfile = [
    !prof.recognitionValidUntil && 'recognition validity',
    !prof.workingDaysYear && 'working days in the year',
    !prof.periodMinutes && 'period duration',
  ].filter(Boolean)
  if (missingProfile.length && data.source !== 'sample')
    add({ id: 'data-profile', status: 'fail', severity: 'low', area: 'Data quality', title: 'School profile incomplete', finding: `Not provided: ${missingProfile.join(', ')}.`, action: 'Fill these in the School Profile sheet and re-import; they enable recognition and RTE hour checks.', source: SOURCES.PLANNING })
  const blank = teaching.filter((s) => !hasValue(s.professionalQualification) || !hasValue(s.highestQualification) || (['SGT', 'TGT'].includes(s.category) && !hasValue(s.tet)))
  if (blank.length)
    add({
      id: 'data-blank', status: 'fail', severity: 'medium', area: 'Data quality',
      title: 'Faculty records with missing qualification / TET details',
      finding: `${blank.length} record(s) incomplete; qualification checks skip these teachers.`,
      action: 'Complete the Qualification, Professional Qualification and TET columns in the faculty Excel and re-upload.',
      people: names(blank),
      source: SOURCES.PLANNING,
    })

  return out.sort((a, b) => (a.status === b.status ? 0 : a.status === 'fail' ? -1 : 1) || ord[a.severity] - ord[b.severity])
}

export function score(recs: Recommendation[]) {
  const verifiable = recs.filter((r) => r.area !== 'Data quality')
  const pass = verifiable.filter((r) => r.status === 'pass').length
  const fails = recs.filter((r) => r.status === 'fail')
  return {
    pct: verifiable.length ? Math.round((pass / verifiable.length) * 100) : 0,
    pass,
    total: verifiable.length,
    critical: fails.filter((r) => r.severity === 'critical').length,
    high: fails.filter((r) => r.severity === 'high').length,
    medium: fails.filter((r) => r.severity === 'medium').length,
    low: fails.filter((r) => r.severity === 'low').length,
  }
}

/** Items the system cannot verify from data — the school confirms them */
export function checklist(board: Board): ChecklistItem[] {
  const S = SOURCES
  const common: ChecklistItem[] = [
    { id: 'rte-days', area: 'Academic calendar', title: 'Classes 1–5: at least 200 working days / 800 instructional hours; Classes 6–8: 220 days / 1000 hours', frequency: 'Annually', source: S.RTE_DAYS },
    { id: 'rte-25', area: 'Admissions', title: 'Entry-class seats reserved for disadvantaged groups and weaker sections under RTE (non-minority schools)', frequency: 'Annually', source: S.RTE_DAYS },
    { id: 'tamil-taught', area: 'Curriculum', title: 'Tamil taught as a subject to every student in Classes 1–10', frequency: 'Annually', source: S.TN_TAMIL_ACT },
    { id: 'staff-certs', area: 'Staff records', title: 'Copies of degree, B.Ed./D.El.Ed. and TET certificates verified and on file for every teacher', frequency: 'Ongoing', source: board === 'CBSE' ? S.CBSE_51 : S.TN_RULES_2023 },
  ]
  if (board === 'CBSE')
    return [
      ...common,
      { id: 'cbse-ecs', area: 'Staff pay', title: 'Salary paid to all staff through ECS only (cl. 2.4.4), at State Government norms', frequency: 'Monthly', source: S.CBSE_POST_AFF },
      { id: 'cbse-website', area: 'Disclosure', title: 'School website with Mandatory Public Disclosure: affiliation status, infrastructure, teacher qualifications, student numbers, fees, TCs issued (cl. 2.4.9)', frequency: 'Annually', source: S.CBSE_POST_AFF },
      { id: 'cbse-books', area: 'Disclosure', title: 'List of prescribed books on the website with declaration signed by Manager and Principal (cl. 2.4.7)', frequency: 'Annually', source: S.CBSE_POST_AFF },
      { id: 'cbse-oasis', area: 'Disclosure', title: 'Any section above 40 documented in the Admission & Withdrawal Register and on OASIS with the reason', frequency: 'Every term', source: S.CBSE_CIRC_11_2025 },
      { id: 'cbse-safety', area: 'Safety', title: 'Compliance with NDMA School Safety Policy 2016, NCPCR safety manual, National Building Code; fire, building, drinking-water and transport rules of State / Municipality', frequency: 'Annually', source: S.CBSE_POST_AFF },
      { id: 'cbse-drill', area: 'Safety', title: 'Disaster management plan in place and mock drills conducted', frequency: 'Every term', source: S.CBSE_POST_AFF },
      { id: 'cbse-nodal', area: 'Training', title: 'School Training Nodal Coordinator designated and annual capacity-building budget allocated', frequency: 'Annually', source: S.CBSE_POST_AFF },
      { id: 'cbse-cpd-records', area: 'Training', title: 'CPD certificates for 50 hours per teacher (25 h CBSE / Government) collected and recorded', frequency: 'Annually', source: S.CBSE_CPD },
      { id: 'cbse-r3', area: 'Curriculum', title: 'R3 (third language) running in Class 6 with at least two Indian languages', frequency: 'Annually', source: S.CBSE_R3 },
    ]
  return [
    ...common,
    { id: 'tn-ecs', area: 'Staff pay', title: 'Salary disbursed on the 1st of every month through ECS (Rule 28(12)(a))', frequency: 'Monthly', source: S.TN_RULES_2023 },
    { id: 'tn-reserve', area: 'Finance', title: 'Cash reserve equal to one month’s staff salary maintained (Rule 8(6)(g))', frequency: 'Ongoing', source: S.TN_RULES_2023 },
    { id: 'tn-recognition', area: 'Recognition', title: 'Recognition renewal applied at least 3 months before expiry (Rule 9(2))', frequency: 'Before expiry', source: S.TN_RULES_2023 },
    { id: 'tn-building', area: 'Recognition', title: 'Structural stability certificate, building licence and Fire NOC valid (Rule 8(6)(e))', frequency: 'Before expiry', source: S.TN_RULES_2023 },
    { id: 'tn-committee', area: 'Governance', title: 'School Committee constituted (HM, 2 senior teachers, 1 non-teaching, 1 PTA, 5 agency members) and meeting at least once every 3 months (Rules 24, 26)', frequency: 'Every term', source: S.TN_RULES_2023 },
    { id: 'tn-antibully', area: 'Student support', title: 'Anti-bullying Committee constituted, including a counsellor (Rule 41(B)(1)(d))', frequency: 'Annually', source: S.TN_RULES_2023 },
    { id: 'tn-fire-training', area: 'Safety', title: 'Fire-fighting training for all teachers and students of Classes 10–12; fire alarm on every floor (Rule 38(1)(F))', frequency: 'Annually', source: S.TN_RULES_2023 },
    { id: 'tn-bus', area: 'Safety', title: 'School buses: rear emergency exit, two 2 kg ABC fire extinguishers, Transport Department registration, licensed drivers (Rule 38(1)(L), (B))', frequency: 'Every term', source: S.TN_RULES_2023 },
    { id: 'tn-registers', area: 'Records', title: 'Registers and records maintained as per Annexure VII; accounts, ledgers, stock registers, cash books (Rules 42, 34)', frequency: 'Ongoing', source: S.TN_RULES_2023 },
    { id: 'tn-1aug', area: 'Staffing', title: 'Staff strength reviewed against pupil strength as on 1 August (Rule 32(A)(1))', frequency: 'Annually', source: S.TN_RULES_2023 },
    { id: 'tn-rte-seats', area: 'Admissions', title: 'RTE seats for disadvantaged groups published (Rule 17(3))', frequency: 'Annually', source: S.TN_RULES_2023 },
  ]
}
