import ExcelJS from 'exceljs'
import readXlsxFile from 'read-excel-file/node'
import { describe, expect, it } from 'vitest'
import { checklist } from '../../engine/recommend'
import { defaultRuleSet } from '../../engine/rules'
import { sampleSchoolData, staffFromDemand } from '../../engine/sample'
import { buildSections, computeDemand } from '../../engine/calc'
import type { School } from '../../engine/types'
import type { Cell } from '../facultyExcel'
import { buildWorkbook } from './build'
import { parseWorkbook } from './parse'
import { categoryFromDesignation } from '../facultyExcel'

const school: School = { id: 'x', name: 'NS Matriculation Higher Secondary School, Vadapudupatti', board: 'MATRIC' }

async function roundTrip(prefill: boolean, mutate?: (wb: ExcelJS.Workbook) => void) {
  const rules = defaultRuleSet('MATRIC')
  const data = sampleSchoolData(rules)
  data.staff = staffFromDemand(rules, computeDemand(rules, buildSections(rules, data), [])).map((s, i) => ({ ...s, employeeId: `E${i}`, tet: 'TNTET2' as const, dateOfJoining: '2020-06-01' }))
  data.compliance = { 'tn-ecs': { done: true, status: 'YES' }, 'tn-building': { done: false, status: 'YES', validUntil: '2027-03-31' } }
  data.profile = { recognitionValidUntil: '2027-05-31', workingDaysYear: 220, periodMinutes: 40 }
  let buf = await buildWorkbook(ExcelJS, { school, rules, data, checklist: checklist('MATRIC'), prefill })
  if (mutate) {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(buf)
    mutate(wb)
    buf = (await wb.xlsx.writeBuffer()) as ArrayBuffer
  }
  const sheets = (await readXlsxFile(Buffer.from(buf))) as { sheet: string; data: Cell[][] }[]
  return { data, parsed: parseWorkbook(sheets, defaultRuleSet) }
}

describe('school data workbook', () => {
  it('round-trips a pre-filled workbook without errors', async () => {
    const { data, parsed } = await roundTrip(true)
    expect(parsed.issues.filter((i) => i.level === 'error')).toEqual([])
    expect(parsed.schoolName).toBe(school.name)
    expect(parsed.board).toBe('MATRIC')
    expect(parsed.strength['6']).toEqual(data.strength['6'])
    expect(parsed.hss['11']).toEqual(data.hss['11'])
    expect(parsed.staff?.length).toBe(data.staff.length)
    expect(parsed.staff?.[0].dateOfJoining).toBe('2020-06-01')
    expect(parsed.subjectsByStandard?.['6']).toEqual(defaultRuleSet('MATRIC').subjectsByStandard['6'])
    expect(parsed.hssGroups?.map((g) => g.id)).toEqual(defaultRuleSet('MATRIC').hssGroups.map((g) => g.id))
    expect(parsed.hssGroups?.[0].subjects).toEqual(defaultRuleSet('MATRIC').hssGroups[0].subjects)
    expect(parsed.sheetsFound).not.toContain('Compliance')
    expect(parsed.profile).toMatchObject({ recognitionValidUntil: '2027-05-31', workingDaysYear: 220, periodMinutes: 40 })
    expect(parsed.periodsPerDay).toBe(8)
  })

  it('blank template parses with only "missing data" warnings', async () => {
    const { parsed } = await roundTrip(false)
    expect(parsed.issues.filter((i) => i.level === 'error')).toEqual([])
    expect(parsed.staff).toEqual([])
  })

  it('reports bad cells with sheet, row and column', async () => {
    const { parsed } = await roundTrip(true, (wb) => {
      wb.getWorksheet('Students')!.getCell('C2').value = 'many'
      wb.getWorksheet('Subject Periods')!.getCell('A2').value = 'Class 13'
      wb.getWorksheet('School Profile')!.getCell('B3').value = 'IGCSE'
    })
    const errs = parsed.issues.filter((i) => i.level === 'error').map((i) => `${i.sheet}|${i.row}|${i.column}`)
    expect(errs).toContain('Students|2|Boys')
    expect(errs).toContain('Subject Periods|2|Class')
    expect(errs).toContain('School Profile|3|Board')
  })

  it('every designation in the drop-down maps to a category', async () => {
    const buf = await buildWorkbook(ExcelJS, { school, rules: defaultRuleSet('MATRIC'), checklist: [], prefill: false })
    const sheets = (await readXlsxFile(Buffer.from(buf))) as { sheet: string; data: Cell[][] }[]
    const lists = sheets.find((s) => s.sheet === 'Lists')!.data
    const designations = lists.map((r) => r[0]).filter(Boolean) as string[]
    expect(designations.length).toBe(12)
    for (const d of designations) expect([d, categoryFromDesignation(d)]).not.toEqual([d, null])
  })
})
