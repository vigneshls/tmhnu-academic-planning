import { describe, expect, it } from 'vitest'
import { buildSections, computeDemand, sectionsFor, summarize } from './calc'
import { defaultRuleSet, effectiveLimits } from './rules'
import { generateTimetable, validateTimetable } from './timetable'
import { sampleSchoolData, staffFromDemand } from './sample'
import type { SchoolData } from './types'

describe('sections', () => {
  it('rounds up by cap', () => {
    expect(sectionsFor(0, 40)).toBe(0)
    expect(sectionsFor(40, 40)).toBe(1)
    expect(sectionsFor(41, 40)).toBe(2)
  })

  it('splits boys and girls from class 6 when genderSeparate', () => {
    const rules = defaultRuleSet('STATE')
    const data: SchoolData = { strength: { '6': { boys: 50, girls: 20 }, '5': { boys: 31, girls: 0 } }, hss: {}, staff: [], genderSeparate: true }
    const secs = buildSections(rules, data)
    const six = secs.filter((s) => s.standard === '6')
    // cap 35 middle: boys 50 -> 2, girls 20 -> 1
    expect(six.map((s) => s.gender)).toEqual(['B', 'B', 'G'])
    expect(six.map((s) => s.strength)).toEqual([25, 25, 20])
    // class 5 is never split; 31 > 30 -> 2 sections
    expect(secs.filter((s) => s.standard === '5')).toHaveLength(2)
  })

  it('co-ed when genderSeparate is false', () => {
    const rules = defaultRuleSet('STATE')
    const data: SchoolData = { strength: { '6': { boys: 20, girls: 10 } }, hss: {}, staff: [], genderSeparate: false }
    expect(buildSections(rules, data).filter((s) => s.standard === '6')).toHaveLength(1)
  })

  it('every default allocation fills the weekly grid exactly', () => {
    for (const b of ['CBSE', 'MATRIC', 'STATE'] as const) {
      const r = defaultRuleSet(b)
      const slots = r.daysPerWeek * r.periodsPerDay
      for (const [std, subs] of Object.entries(r.subjectsByStandard)) expect([b, std, subs.reduce((a, s) => a + s.periods, 0)]).toEqual([b, std, slots])
      for (const g of r.hssGroups) expect([b, g.id, g.subjects.reduce((a, s) => a + s.periods, 0)]).toEqual([b, g.id, slots])
    }
  })
})

describe('limits', () => {
  it('caps TGT load at what the continuous-period rule allows', () => {
    const r = defaultRuleSet('STATE')
    const lim = effectiveLimits(r, r.workload.TGT)
    expect(lim.perDay).toBe(6) // lunch after P4, max 3 continuous -> 3 + 3
    expect(lim.perWeek).toBe(30)
    r.resetAtIntervals = true
    expect(effectiveLimits(r, r.workload.TGT).perWeek).toBe(35) // 7/day
  })
})

describe('demand', () => {
  it('computes subject-wise teachers', () => {
    const rules = defaultRuleSet('STATE')
    const data: SchoolData = { strength: { '6': { boys: 35, girls: 35 }, '7': { boys: 35, girls: 35 } }, hss: {}, staff: [], genderSeparate: true }
    const secs = buildSections(rules, data) // 4 sections
    const d = computeDemand(rules, secs, [])
    const maths = d.find((x) => x.subject === 'Maths')!
    expect(maths.periods).toBe(28)
    expect(maths.needed).toBe(1)
    const sum = summarize(rules, data, secs, d)
    expect(sum.sections).toBe(4)
    expect(sum.boys6to12).toBe(70)
  })
})

describe('timetable', () => {
  for (const board of ['STATE', 'CBSE'] as const) {
    it(`generates a valid timetable for a sample ${board} school`, () => {
      const rules = defaultRuleSet(board)
      const data = sampleSchoolData(rules)
      const secs = buildSections(rules, data)
      const staff = staffFromDemand(rules, computeDemand(rules, secs, []))
      const tt = generateTimetable(rules, secs, staff, { attempts: 6 })
      expect(validateTimetable(rules, tt)).toEqual([])
      const missing = tt.unplaced.reduce((a, u) => a + u.remaining, 0)
      expect(missing).toBe(0)
      expect(tt.teachers.filter((t) => t.vacancy)).toHaveLength(0)
    }, 60000)
  }
})
