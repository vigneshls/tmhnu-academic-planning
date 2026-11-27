import { buildSections, computeDemand, summarize } from '../engine/calc'
import { effectiveRules } from '../engine/effective'
import { applySectionPlan } from '../engine/sectionPlan'
import { recommend, score, type Recommendation } from '../engine/recommend'
import { SOURCES } from '../engine/sources'
import { subjectStaffing } from '../engine/staffing'
import type { RuleSet, School, SchoolData } from '../engine/types'

/** One place that turns stored data into everything the screens show */
export function analyse(school: School, boardRules: RuleSet, stored: SchoolData) {
  // Sections follow the student counts (Auto: even split within the limit; Manual: typed sizes), boys and girls apart from Class 6
  const base = effectiveRules(boardRules, stored)
  const { data, notes } = applySectionPlan(base, stored)
  const rules = effectiveRules(boardRules, data)
  const sections = buildSections(rules, data)
  const demand = computeDemand(rules, sections, data.staff)
  const summary = summarize(rules, data, sections, demand)
  const staffing = subjectStaffing(rules, data, sections)
  if (staffing) {
    // With the school's own allocation, need is judged subject-wise, not as one total
    summary.needed = staffing.requiredPosts
    summary.shortage = staffing.deficitPosts
    summary.excess = staffing.excessPosts
    summary.checks = summary.checks.filter((c) => !/shortage|No subject-wise/i.test(c.text))
    summary.checks.push(staffing.deficitPosts ? { ok: false, text: `Shortage of ${staffing.deficitPosts} teacher(s) in specific subjects — see Staffing` } : { ok: true, text: 'No subject-wise shortage' })
    if (staffing.excessPosts) summary.checks.push({ ok: false, text: `${staffing.excessPosts} teacher(s) in excess in specific subjects — see Staffing` })
  }
  const recs = recommend({ board: school.board, rules, data, sections, demand, summary })
  if (staffing) recs.push(...staffingRecs(staffing))
  if (notes.length)
    recs.push({
      id: 'section-plan', status: 'fail', severity: 'medium', area: 'Class size & ratios',
      title: 'Sections follow the student count',
      finding: `In ${notes.length} class(es) the sections needed for the present strength differ from the sections in the school’s sheet. New sections take the subjects and teachers of the class’s existing section.`,
      action: 'Check Teacher Allocation for teachers now over the limit and assign others, then re-generate the timetable. To keep the sheet’s sections, set the class to Manual on the Students tab and type the section strengths.',
      people: notes.map((n) => `Class ${n.cls}: sheet ${n.sheet.join(', ')} → now ${n.planned.join(', ')}`),
      source: SOURCES.PLANNING,
    })
  return { data, rules, sections, demand, summary, staffing, recs, score: score(recs) }
}
export type Analysis = ReturnType<typeof analyse>

function staffingRecs(s: NonNullable<ReturnType<typeof subjectStaffing>>): Recommendation[] {
  const def = s.families.filter((f) => f.status === 'deficit')
  const exc = s.families.filter((f) => f.status === 'excess')
  const ctDef = s.classTeachers.filter((c) => c.gap < 0)
  const out: Recommendation[] = [{
    id: 'staff-deficit', status: def.length || ctDef.length ? 'fail' : 'pass', severity: 'high', area: 'Teacher strength',
    title: 'Enough teachers in every subject',
    finding: def.length || ctDef.length ? `Short in ${[...ctDef.map((c) => `${c.level} class teachers`), ...def.map((f) => f.label)].join(', ')} (planning load ${s.load} periods/week for TGT, ${s.pgtLoad} for PGT).` : 'Every subject has enough teachers for its periods.',
    action: 'Recruit for these subjects, or move teachers from subjects in excess where they are qualified.',
    people: def.length || ctDef.length ? [...ctDef.map((c) => `${c.level}: need ${c.required}, have ${c.available}`), ...def.map((f) => `${f.label}: need ${f.required}, have ${f.available} (${f.gap})`)] : undefined,
    source: SOURCES.PLANNING,
  }]
  if (exc.length)
    out.push({
      id: 'staff-excess', status: 'fail', severity: 'medium', area: 'Teacher strength',
      title: 'Subjects with more teachers than periods',
      finding: `Excess in ${exc.map((f) => `${f.label} (+${f.gap})`).join(', ')}.`,
      action: def.length ? `Check whether these teachers are qualified for ${def.map((f) => f.label).join(', ')}; if so, add the subject under "Other Subjects" in Faculty and reallocate.` : 'Use the spare time for remedial classes, or do not refill the post when it falls vacant.',
      people: exc.map((f) => `${f.label}: ${f.teachers.map((t) => t.name).join(', ')}`),
      source: SOURCES.PLANNING,
    })
  return out
}
