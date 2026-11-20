import { readFileSync } from 'node:fs'
import { readSheet } from 'read-excel-file/node'
import { describe, expect, it } from 'vitest'
import { CATEGORY_LABEL } from '../engine/rules'
import { categoryFromDesignation, parseFacultyRows, type Cell } from './facultyExcel'

describe('faculty Excel', () => {
  it('template dropdown designations all map to a category', async () => {
    const lists = (await readSheet(readFileSync('src/assets/faculty-template.xlsx'), 'Lists')) as Cell[][]
    const designations = lists.map((r) => r[0]).filter(Boolean) as string[]
    expect(designations.length).toBe(Object.keys(CATEGORY_LABEL).length)
    for (const d of designations) expect([d, categoryFromDesignation(d)]).not.toEqual([d, null])
  })

  it('parses the filled sample with errors and warnings', async () => {
    const rows = (await readSheet(readFileSync('src/lib/__fixtures__/sample-faculty.xlsx'), 'Faculty')) as Cell[][]
    const res = parseFacultyRows(rows)
    expect(res.staff.map((s) => s.name)).toEqual(['R. Meenakshi', 'K. Arun', 'S. Priya', 'A. Devi', 'M. Kavitha'])
    const priya = res.staff[2]
    expect(priya).toMatchObject({ category: 'TGT', subjects: ['Maths', 'Science', 'Computer Science'], tet: 'TNTET2', appointment: 'CONTRACT', dateOfJoining: '2024-06-03', experienceYears: 1.5, cpdHours: 12, maxPerWeek: 30 })
    expect(res.staff[3].dateOfJoining).toBe('2021-06-15') // typed as text DD-MM-YYYY
    expect(res.staff[4].category).toBe('COUNSELLOR')
    expect(res.errors.map((e) => e.column)).toEqual(['Designation', 'Employee ID'])
  })

  it('rejects files without the header', () => {
    expect(parseFacultyRows([['a', 'b'], ['c', 'd']]).errors[0].message).toMatch(/Header row not found/)
  })

  it('warns on out-of-range numbers and unknown values', () => {
    const res = parseFacultyRows([
      ['Full Name', 'Designation', 'TET Status', 'Total Experience (years)'],
      ['X', 'TGT', 'Maybe', 77],
    ])
    expect(res.staff).toHaveLength(1)
    expect(res.warnings.map((w) => w.column)).toEqual(['Main Subject', 'TET Status', 'Total Experience (years)'])
  })
})
