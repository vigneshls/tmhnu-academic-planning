import { describe, expect, it } from 'vitest'
import { analyse } from '../../data/analyse'
import { defaultRuleSet } from '../../engine/rules'
import { generateTimetable } from '../../engine/timetable'
import type { SchoolData } from '../../engine/types'
import type { Cell } from '../facultyExcel'
import { parseWorkbook } from './parse'
import { splitNames } from './names'

const F = ['Employee ID', 'Full Name *', 'Designation *', 'Main Subject']
const sheets = (subjects: Cell[][]) => [
  { sheet: 'School Profile', data: [['Field', 'Value'], ['School Name *', 'Test School'], ['Board *', 'Matriculation'], ['Working Days per Week', 6], ['Teaching Periods per Day', 8]] as Cell[][] },
  { sheet: 'Students', data: [['Class', 'Group (Class 11–12 only)', 'Boys', 'Girls', 'Total', 'Children with Special Needs (CWSN)'], ['Class 6', '', 10, 50, 60, ''], ['Class 11', 'Science', 0, 20, 20, ''], [null, 'Arts', null, 8, 8, null], ['', '', 10, 78, 88, '']] as Cell[][] },
  { sheet: 'Faculty', data: [F, ['', 'A.Kumar', 'TGT (6-10)', 'Maths'], ['', 'B.Devi', 'Upper Primary(6-8)', 'Tamil'], ['', 'C.Ravi', 'PGT (11-12)', 'Physics'], ['', 'D.Mala', 'PGT (11-12)', 'Chemistry'], ['', 'E.Rani', 'Nursery(NT)', 'English']] as Cell[][] },
  { sheet: 'Subject Periods', data: subjects },
]

describe('named allocation', () => {
  it('splits multi-name cells', () => {
    expect(splitNames('V.Jeevarani         V.Priyanka')).toEqual(['V.Jeevarani', 'V.Priyanka'])
    expect(splitNames('R.Anu; S.Bala / T.Chitra & U.Deva')).toEqual(['R.Anu', 'S.Bala', 'T.Chitra', 'U.Deva'])
  })

  it('reads the school layout: two Handled By columns, sections, carry-down, fuzzy names', () => {
    const p = parseWorkbook(sheets([
      ['Class', 'Group (Class 11–12 only)', 'Subject', 'Handled By', 'Periods per Week', 'Handled By', 'Preferred Time'],
      ['Class 6', '', 'Maths', 'A.Kumaar', 7, 'Subject Teacher', null],
      ['Class 6', '', 'Tamil', 'B.Devi', 6, 'Class Teacher', null],
      ['Class 6', '', 'ECA', 'Subject Wise', 2, 'Subject Teacher', null],
      ['Class 6', '', 'Club', null, 2, 'Subject Teacher', null],
      ['Class 6', null, 'Maths', 'A.Kumar', 7, 'Subject Teacher', null],
      ['Class 6', null, 'Tamil', 'B.Devi', 6, 'Subject Teacher', null],
      ['Class 11', 'Science', 'Physics', 'C.Ravi      D.Mala', 9, 'Subject Teacher', null],
      [null, null, 'Chemistry', 'D.Mala', 9, 'Subject Teacher', null],
      ['Class 11', 'Science', 'Biology', 'Z.Unknown', 8, 'Subject Teacher', null],
    ]), defaultRuleSet)
    expect(p.issues.filter((i) => i.level === 'error')).toEqual([])
    const a = p.allocations!
    expect(a.map((x) => x.section)).toEqual(['A', 'A', 'A', 'A', 'B', 'B', 'A', 'A', 'A'])
    expect(a[0]).toMatchObject({ subject: 'Maths', mode: 'named' })
    expect(p.nameFixes).toEqual([{ written: 'A.Kumaar', matched: 'A.Kumar' }])
    expect(a[2].mode).toBe('shared')
    expect(a[3].mode).toBe('unassigned')
    expect(a[6].teachers).toHaveLength(2)
    expect(a[7]).toMatchObject({ standard: '11', groupName: 'Science' })
    expect(a[8]).toMatchObject({ mode: 'unassigned', unmatched: ['Z.Unknown'] })
    expect(p.issues.some((i) => /Z\.Unknown/.test(i.message))).toBe(true)
    expect(p.hss['11']).toMatchObject({ arts: { girls: 8 } }) // carried-down class on group row
    expect(p.strength['6']).toEqual({ boys: 10, girls: 50 }) // totals row ignored
    expect(p.staff!.map((s) => s.category)).toEqual(['TGT', 'TGT', 'PGT', 'PGT', 'MONTESSORI'])

    const data: SchoolData = { strength: p.strength, hss: p.hss, staff: p.staff!, genderSeparate: true, allocations: a, overrides: { daysPerWeek: 6, periodsPerDay: 8, subjectsByStandard: p.subjectsByStandard, hssGroups: p.hssGroups } }
    const r = analyse({ id: 't', name: 'Test School', board: 'MATRIC' }, defaultRuleSet('MATRIC'), data)
    expect(r.sections.filter((s) => s.standard === '6').map((s) => s.label)).toEqual(['6 A', '6 B'])
    const ids = new Set(r.recs.filter((x) => x.status === 'fail').map((x) => x.id))
    expect(ids.has('alloc-unassigned')).toBe(true)
    expect(ids.has('alloc-unused')).toBe(true) // E.Rani has no periods
    expect(ids.has('alloc-groups')).toBe(true) // Arts students, no Arts subjects
    expect([...ids].some((x) => x.startsWith('short-'))).toBe(false)
    const tt = generateTimetable(r.rules, r.sections, data.staff, { attempts: 3 })
    expect(tt.violations).toEqual([])
    const kumar = p.staff!.find((s) => s.name === 'A.Kumar')!.id
    expect(tt.lessons.filter((l) => l.teacherId === kumar && l.subject === 'Maths').reduce((s, l) => s + l.count, 0)).toBe(14)
  })
})
