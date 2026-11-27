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
    expect(a[3]).toMatchObject({ mode: 'shared', autoShared: true }) // blank Club → any teacher of the section
    expect(a[6].teachers).toHaveLength(2)
    expect(a[7]).toMatchObject({ standard: '11', groupName: 'Science' })
    expect(a[8]).toMatchObject({ mode: 'unassigned', unmatched: ['Z.Unknown'] })
    expect(p.issues.some((i) => /Z\.Unknown/.test(i.message))).toBe(true)
    expect(p.hss['11']).toMatchObject({ arts: { girls: 8 } }) // carried-down class on group row
    expect(p.strength['6']).toEqual({ boys: 10, girls: 50 }) // totals row ignored
    expect(p.staff!.map((s) => s.category)).toEqual(['TGT', 'TGT', 'PGT', 'PGT', 'MONTESSORI'])

    const data: SchoolData = { strength: p.strength, hss: p.hss, staff: p.staff!, genderSeparate: true, allocations: a, overrides: { daysPerWeek: 6, periodsPerDay: 8, subjectsByStandard: p.subjectsByStandard, hssGroups: p.hssGroups } }
    const r = analyse({ id: 't', name: 'Test School', board: 'MATRIC' }, defaultRuleSet('MATRIC'), data)
    expect(r.sections.filter((s) => s.standard === '6').map((s) => s.label)).toEqual(['6 A (Boys)', '6 B (Girls)', '6 C (Girls)']) // sections follow the count: 10 boys → 1, 50 girls → 25 + 25 (limit 35)
    const ids = new Set(r.recs.filter((x) => x.status === 'fail').map((x) => x.id))
    expect(ids.has('alloc-unassigned')).toBe(true)
    expect(ids.has('alloc-unused')).toBe(true) // E.Rani has no periods
    expect(ids.has('alloc-groups')).toBe(true) // Arts students, no Arts subjects
    expect([...ids].some((x) => x.startsWith('short-'))).toBe(false)
    const maths = r.staffing!.families.find((f) => f.family === 'maths')!
    expect(maths).toMatchObject({ periods: { '1-5': 0, '6-10': 21, '11-12': 0 }, available: 1, status: 'ok' }) // 7 periods × 3 sections
    expect(r.staffing!.families.find((f) => f.family === 'physics')).toMatchObject({ available: 1, status: 'ok' }) // C.Ravi only; D.Mala is Chemistry
    const tt = generateTimetable(r.rules, r.sections, data.staff, { attempts: 3 })
    expect(tt.violations).toEqual([])
    const kumar = p.staff!.find((s) => s.name === 'A.Kumar')!.id
    expect(tt.lessons.filter((l) => l.teacherId === kumar && l.subject === 'Maths').reduce((s, l) => s + l.count, 0)).toBe(21) // Maths 7 periods in each of the 3 sections
  })

  it('treats partial groups and Students-sheet alternatives as parallel electives', () => {
    const T = (n: string, sub: string, d = 'PGT (11-12)') => ['', n, d, sub]
    const staff = [T('T.Tamil', 'Tamil'), T('T.Eng', 'English'), T('T.Maths', 'Maths'), T('T.Phy', 'Physics'), T('T.Chem', 'Chemistry'), T('T.Bio', 'Biology'),
      T('T.Cs', 'Computer Science'), T('T.Bot', 'Botany'), T('T.Zoo', 'Zoology'), T('T.Com', 'Commerce'), T('T.Acc', 'Accountancy'), T('T.Eco', 'Economics'), T('T.Bm', 'Maths'), T('T.Pe', 'PET', 'PET')]
    const H = ['Class', 'Group (Class 11–12 only)', 'Subject', 'Handled By', 'Periods per Week']
    const p = parseWorkbook([
      { sheet: 'School Profile', data: [['Field', 'Value'], ['School Name *', 'Test'], ['Board *', 'Matriculation'], ['Working Days per Week', 6], ['Teaching Periods per Day', 8]] as Cell[][] },
      { sheet: 'Students', data: [['Class', 'Group (Class 11–12 only)', 'Boys', 'Girls'], ['Class 11', 'Maths-Biology', 0, 10], [null, 'Maths-Computer Science', 0, 5], [null, 'Pure Science', 0, 4], ['Class 11', 'Computer Application', 0, 3], [null, 'Business Maths', 0, 2]] as Cell[][] },
      { sheet: 'Faculty', data: [F, ...staff] as Cell[][] },
      { sheet: 'Subject Periods', data: [H,
        ['Class 11', 'Maths-Biology', 'Tamil', 'T.Tamil', 6], [null, null, 'English', 'T.Eng', 6], [null, null, 'Maths', 'T.Maths', 8], [null, null, 'Physics', 'T.Phy', 8],
        [null, null, 'Chemistry', 'T.Chem', 8], [null, null, 'Biology', 'T.Bio', 8], [null, null, 'PET', 'T.Pe', 4],
        ['Class 11', 'Maths-Computer Science', 'Computer Science', 'T.Cs', 8],
        ['Class 11', 'Pure Science', 'Botany', 'T.Bot', 8], [null, null, 'Zoology', 'T.Zoo', 8],
        ['Class 11', 'Commerce', 'Tamil', 'T.Tamil', 6], [null, null, 'English', 'T.Eng', 6], [null, null, 'Commerce', 'T.Com', 8], [null, null, 'Accountancy', 'T.Acc', 8],
        [null, null, 'Economics', 'T.Eco', 8], [null, null, 'Computer Application', 'T.Cs', 6], [null, null, 'Business Maths', 'T.Bm', 6], [null, null, 'PET', 'T.Pe', 6],
      ] as Cell[][] },
    ], defaultRuleSet)
    expect(p.issues.filter((i) => i.level === 'error')).toEqual([])
    const a = p.allocations!
    const cs = a.find((x) => x.subject === 'Computer Science')!
    expect(cs).toMatchObject({ groupName: 'Maths-Biology', option: 'Maths-Computer Science', replaces: ['Biology'] })
    expect(a.find((x) => x.subject === 'Zoology')).toMatchObject({ option: 'Pure Science', replaces: ['Maths', 'Biology'] })
    expect(a.find((x) => x.subject === 'Business Maths')).toMatchObject({ option: 'Business Maths', replaces: ['Computer Application'] })
    expect(Object.values(p.hss['11']).map((c) => c.girls).sort()).toEqual([19, 5].sort())

    const data: SchoolData = { strength: p.strength, hss: p.hss, staff: p.staff!, genderSeparate: true, allocations: a, overrides: { daysPerWeek: 6, periodsPerDay: 8, subjectsByStandard: p.subjectsByStandard, hssGroups: p.hssGroups } }
    const r = analyse({ id: 't', name: 'Test', board: 'MATRIC' }, defaultRuleSet('MATRIC'), data)
    const secs = r.sections.filter((s) => s.standard === '11')
    expect(secs.map((s) => [s.label, s.strength, s.weekPeriods])).toEqual([['11 Commerce A (Girls)', 5, 48], ['11 Maths-Biology A (Girls)', 19, 48]])
    const ids = new Set(r.recs.filter((x) => x.status === 'fail').map((x) => x.id))
    expect(ids.has('alloc-capacity')).toBe(false)
    expect(ids.has('alloc-groups')).toBe(false)
    const tt = generateTimetable(r.rules, r.sections, data.staff, { attempts: 4 })
    expect(tt.violations).toEqual([])
    expect(tt.unplaced).toEqual([])
    const mb = secs.find((s) => s.label.includes('Maths-Biology'))!
    const cells = tt.grid[mb.id].flat().filter((c) => c?.subject.includes('Computer Science'))
    expect(cells).toHaveLength(8)
    expect(cells.every((c) => c!.coTeacherIds?.length === 2)).toBe(true) // Biology + CS + Botany/Zoology at once
  })

  it('reads Boys / Girls from the Section cell and flags mixed sections', () => {
    const H = ['Class', 'Section', 'Subject', 'Teacher Name(s)', 'Periods per Week']
    const p = parseWorkbook([
      { sheet: 'School Profile', data: [['Field', 'Value'], ['School Name *', 'Test'], ['Board *', 'Matriculation'], ['Separate Boys / Girls Sections from Class 6', 'Yes']] as Cell[][] },
      { sheet: 'Students', data: [['Class', 'Group (Class 11–12 only)', 'Boys', 'Girls'], ['Class 6', '', 30, 28], ['Class 7', '', 12, 15]] as Cell[][] },
      { sheet: 'Faculty', data: [F, ['', 'A.Kumar', 'TGT', 'Maths']] as Cell[][] },
      { sheet: 'Subject Periods', data: [H, ['Class 6', 'A (Girls)', 'Maths', 'A.Kumar', 6], ['Class 6', 'B (Boys)', 'Maths', 'A.Kumar', 6], ['Class 7', 'A', 'Maths', 'A.Kumar', 6]] as Cell[][] },
    ], defaultRuleSet)
    expect(p.allocations!.map((a) => [a.section, a.gender])).toEqual([['A', 'G'], ['B', 'B'], ['A', undefined]])
    const data: SchoolData = { strength: p.strength, hss: p.hss, staff: p.staff!, genderSeparate: true, allocations: p.allocations }
    const r = analyse({ id: 't', name: 'T', board: 'MATRIC' }, defaultRuleSet('MATRIC'), data)
    expect(r.sections.filter((s) => s.standard !== '7').map((s) => [s.label, s.strength])).toEqual([['6 A (Girls)', 28], ['6 B (Boys)', 30]])
    // Class 7 had boys and girls in one section: split into 7 A (Boys) and 7 B (Girls) with the same subjects and teacher
    expect(r.sections.filter((s) => s.standard === '7').map((s) => [s.label, s.strength, s.subjects.map((x) => x.subject).join()])).toEqual([['7 A (Boys)', 12, 'Maths'], ['7 B (Girls)', 15, 'Maths']])
    expect(r.recs.find((x) => x.id === 'section-plan')).toMatchObject({ people: ['Class 7: sheet A → now A (Boys) 12, B (Girls) 15'] })
    expect(r.recs.find((x) => x.id === 'alloc-gender')).toMatchObject({ status: 'pass' })
    expect(r.data.allocations!.filter((a) => a.standard === '7').map((a) => [a.section, a.gender, a.teachers.length, a.copiedFrom])).toEqual([['A', 'B', 1, undefined], ['B', 'G', 1, 'A']])
    // with separate sections switched off, the class stays one mixed section
    const mixed = analyse({ id: 't', name: 'T', board: 'MATRIC' }, defaultRuleSet('MATRIC'), { ...data, genderSeparate: false })
    expect(mixed.sections.filter((s) => s.standard === '7').map((s) => s.label)).toEqual(['7 A'])
  })
})
