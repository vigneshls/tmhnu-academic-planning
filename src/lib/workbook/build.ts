import type ExcelJSNS from 'exceljs'
import type { ChecklistItem } from '../../engine/recommend'
import { CATEGORY_LABEL, stageOf } from '../../engine/rules'
import type { RuleSet, School, SchoolData, Staff } from '../../engine/types'
import { STANDARDS } from '../../engine/types'
import { LABEL, TEMPLATE_HEADERS } from '../facultyExcel'
import {
  BOARD_OPTIONS, COMPLIANCE_STATUS, PREF_TIME, PROFILE_FIELDS, SHEETS,
  STUDENT_HEADERS, SUBJECT_HEADERS, YES_NO, classLabel,
} from './spec'

type ExcelJS = typeof ExcelJSNS

const NAVY = 'FF1F3A5F'
const INPUT = 'FFFFFBEA'

const HIGHEST = ['Higher Secondary', 'Diploma', 'UG Degree', 'PG Degree', 'M.Phil', 'Ph.D']
const PROF = ['D.El.Ed / D.T.Ed', 'B.El.Ed', 'B.Ed', 'M.Ed', 'NTT / Montessori', 'B.P.Ed / M.P.Ed', 'B.Ed (Special Education) / RCI', 'None']
const TET = ['TNTET Paper I', 'TNTET Paper II', 'TNTET Both Papers', 'CTET Paper I', 'CTET Paper II', 'CTET Both Papers', 'Passed (paper not stated)', 'Not passed', 'Not applicable']
const APPT = ['Regular', 'Probation', 'Contract', 'Part-time']
const SUBJECT_SUGGESTIONS = ['All subjects', 'Tamil', 'English', 'Hindi', 'Maths', 'Science', 'Social Science', 'EVS', 'Physics', 'Chemistry', 'Biology', 'Computer Science', 'Computer Applications', 'Accountancy', 'Commerce', 'Business Studies', 'Economics', 'Applied Maths', 'PE / Art', 'Library / Value Ed', 'Counselling', 'Special Education']

const PROF_OUT: Record<string, string> = { DELED: PROF[0], BELED: PROF[1], BED: PROF[2], MED: PROF[3], NTT: PROF[4], BPED: PROF[5], SPLED: PROF[6], NONE: PROF[7] }
const TET_OUT: Record<string, string> = { TNTET1: TET[0], TNTET2: TET[1], TNTET_BOTH: TET[2], CTET1: TET[3], CTET2: TET[4], CTET_BOTH: TET[5], PASSED: TET[6], NOT_PASSED: TET[7], NA: TET[8] }
const date = (iso?: string) => (iso ? new Date(`${iso}T00:00:00Z`) : null)

export interface BuildOptions {
  school: School
  rules: RuleSet
  data?: SchoolData
  /** Kept for API compatibility; the workbook no longer carries a compliance sheet */
  checklist?: ChecklistItem[]
  /** include current values (export) or leave student / faculty blank (fresh template) */
  prefill: boolean
}

export async function buildWorkbook(Excel: ExcelJS, o: BuildOptions): Promise<ArrayBuffer> {
  const wb = new Excel.Workbook()
  wb.creator = 'TMHNU Academic Planning'
  wb.created = new Date()
  const d = o.prefill ? o.data : undefined

  // ---- Instructions
  const ins = wb.addWorksheet(SHEETS.instructions)
  ins.getColumn(1).width = 30
  ins.getColumn(2).width = 95
  const lines: [string, string][] = [
    ['School Data Workbook', ''],
    ['For', `${o.school.name} — ${o.rules.label}`],
    ['', ''],
    ['How to fill', 'Fill the yellow cells. Use the drop-down lists where shown. Do not rename sheets or change header rows.'],
    ['1. School Profile', 'Basic details and the daily timetable structure. Required: School Name and Board.'],
    ['2. Students', 'Boys, girls and children with special needs (CWSN) for every class. For Class 11–12 enter one row per group.'],
    ['3. Faculty', 'One row per staff member, including Principal, counsellor, special educator and librarian.'],
    ['4. Subject Periods', 'The actual teacher allocation: one row per section and subject. Section = A, B, C… Teacher Name(s) = pick from the drop-down (names come from the Faculty sheet, so fill Faculty first). Two teachers sharing a subject: "Name1; Name2". Activities taken by any subject teacher (ECA, Club): "Subject Wise". Pre-filled with the board model — change to the school’s actual timetable.'],
    ['   Electives (11–12)', 'List the full group first (e.g. Maths-Biology with all its subjects). An elective option is a group with only its own subjects, named after them (e.g. "Maths-Computer Science": Computer Science; "Pure Science": Botany, Zoology) — it is timetabled at the same time as the full group’s subjects it replaces. Alternatives inside one group (Commerce: Computer Application or Business Maths) are recognised when the Students sheet lists them as groups, or write "(Elective)" after the subject.'],
    ['   Supervision', 'Sleeping / Nap / Snack time rows are kept in the timetable but not counted as teaching load. Blank teacher on Club / Library / Games rows = any teacher of the section.'],
    ['', ''],
    ['After filling', 'Send the file to management. On upload, the system checks every row, then calculates sections, teacher requirement, timetable and recommendations.'],
    ['Privacy', 'Do not enter phone numbers, Aadhaar, bank, salary or student names. They are not needed.'],
  ]
  lines.forEach(([a, b], i) => {
    const r = ins.addRow([a, b])
    r.getCell(2).alignment = { wrapText: true, vertical: 'top' }
    r.getCell(1).font = { bold: true, color: { argb: i === 0 ? NAVY : 'FF334155' }, size: i === 0 ? 16 : 11 }
  })

  // ---- Lists (hidden)
  const lists = wb.addWorksheet(SHEETS.lists, { state: 'veryHidden' })
  const LISTS: [string, readonly string[]][] = [
    ['A', Object.values(CATEGORY_LABEL)], ['B', HIGHEST], ['C', PROF], ['D', TET], ['E', APPT], ['F', SUBJECT_SUGGESTIONS],
    ['G', BOARD_OPTIONS], ['H', YES_NO], ['J', PREF_TIME], ['K', COMPLIANCE_STATUS],
    ['L', ['Pre-KG', 'LKG', 'UKG', ...Array.from({ length: 12 }, (_, i) => `Class ${i + 1}`)]],
  ]
  LISTS.forEach(([col, values]) => values.forEach((v, i) => (lists.getCell(`${col}${i + 1}`).value = v)))
  const ref = (col: string) => `${SHEETS.lists}!$${col}$1:$${col}$${LISTS.find(([c]) => c === col)![1].length}`
  const listDV = (ws: ExcelJSNS.Worksheet, range: string, col: string, strict = true) => {
    const [a, b] = range.split(':')
    const colL = a.replace(/\d+/g, '')
    const from = Number(a.replace(/\D+/g, ''))
    const to = Number(b.replace(/\D+/g, ''))
    for (let r = from; r <= to; r++)
      ws.getCell(`${colL}${r}`).dataValidation = {
        type: 'list', allowBlank: true, formulae: [ref(col)], showErrorMessage: true,
        errorStyle: strict ? 'stop' : 'warning', errorTitle: 'Invalid value', error: 'Choose a value from the list.',
      }
  }
  const headerRow = (ws: ExcelJSNS.Worksheet, headers: readonly string[], widths: number[]) => {
    ws.addRow([...headers])
    const r = ws.getRow(1)
    r.height = 32
    r.eachCell((c) => {
      c.font = { bold: true, color: { argb: 'FFFFFFFF' } }
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: NAVY } }
      c.alignment = { vertical: 'middle', wrapText: true }
    })
    widths.forEach((w, i) => (ws.getColumn(i + 1).width = w))
    ws.views = [{ state: 'frozen', ySplit: 1 }]
  }

  // ---- School Profile
  const pf = wb.addWorksheet(SHEETS.profile)
  headerRow(pf, ['Field', 'Value', 'Notes'], [44, 40, 52])
  const pv: Record<string, unknown> = {
    schoolName: o.school.name,
    board: o.school.board === 'CBSE' ? 'CBSE' : 'Matriculation',
    academicYear: d?.profile?.academicYear ?? '',
    udise: d?.profile?.udise ?? '',
    recognitionNo: d?.profile?.recognitionNo ?? '',
    recognitionValidUntil: date(d?.profile?.recognitionValidUntil),
    minority: d?.profile?.minority === undefined ? '' : d.profile.minority ? 'Yes' : 'No',
    genderSeparate: (o.data?.genderSeparate ?? true) ? 'Yes' : 'No',
    daysPerWeek: o.rules.daysPerWeek,
    periodsPerDay: o.rules.periodsPerDay,
    periodMinutes: d?.profile?.periodMinutes ?? '',
    lunchAfterPeriod: o.rules.lunchAfterPeriod,
    workingDaysYear: d?.profile?.workingDaysYear ?? '',
    startTime: d?.profile?.startTime ?? '',
    endTime: d?.profile?.endTime ?? '',
  }
  PROFILE_FIELDS.forEach((f) => {
    const r = pf.addRow([f.label + (f.required ? ' *' : ''), pv[f.key] ?? '', f.note])
    r.getCell(1).font = { bold: true }
    r.getCell(2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }
    r.getCell(3).font = { color: { argb: 'FF64748B' } }
    const n = r.number
    if (f.type === 'board') listDV(pf, `B${n}:B${n}`, 'G')
    if (f.type === 'yesno') listDV(pf, `B${n}:B${n}`, 'H')
    if (f.type === 'date') { r.getCell(2).numFmt = 'dd-mm-yyyy'; r.getCell(2).dataValidation = { type: 'date', operator: 'greaterThan', formulae: [new Date(Date.UTC(2000, 0, 1))], allowBlank: true, showErrorMessage: true, error: 'Enter a date (DD-MM-YYYY).' } }
    if (f.type === 'number') r.getCell(2).dataValidation = { type: 'whole', operator: 'between', formulae: [f.min ?? 0, f.max ?? 10000], allowBlank: true, showErrorMessage: true, error: `Enter a whole number from ${f.min} to ${f.max}.` }
  })

  // ---- Students
  const sw = wb.addWorksheet(SHEETS.students)
  headerRow(sw, STUDENT_HEADERS, [14, 30, 12, 12, 22])
  const groups = o.rules.hssGroups
  for (const std of STANDARDS) {
    if (stageOf(std) === 'HSS') continue
    const c = d?.strength[std]
    sw.addRow([classLabel(std), '', c ? c.boys : '', c ? c.girls : '', d?.cwsn?.[std] ?? ''])
  }
  for (const std of ['11', '12'])
    for (const g of groups) {
      const c = d?.hss[std]?.[g.id]
      sw.addRow([classLabel(std), g.name, c ? c.boys : '', c ? c.girls : '', ''])
    }
  for (let i = 0; i < 6; i++) sw.addRow(['', '', '', '', ''])
  sw.eachRow((r, n) => {
    if (n === 1) return
    ;[3, 4, 5].forEach((ci) => {
      r.getCell(ci).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }
      r.getCell(ci).dataValidation = { type: 'whole', operator: 'between', formulae: [0, 3000], allowBlank: true, showErrorMessage: true, error: 'Enter a whole number.' }
    })
  })
  listDV(sw, `A2:A${sw.rowCount}`, 'L')

  // ---- Faculty
  const fw = wb.addWorksheet(SHEETS.faculty)
  headerRow(fw, TEMPLATE_HEADERS.map((h) => (h === 'Full Name' || h === 'Designation' ? `${h} *` : h)), [14, 28, 40, 20, 28, 20, 28, 20, 17, 16, 14, 16, 16])
  const staff: Staff[] = d?.staff ?? []
  for (const s of staff)
    fw.addRow([
      s.employeeId ?? '', s.name, CATEGORY_LABEL[s.category], s.subjects[0] ?? '', s.subjects.slice(1).join('; '),
      LABEL.highest[s.highestQualification ?? ''] === '—' ? '' : LABEL.highest[s.highestQualification ?? ''],
      PROF_OUT[s.professionalQualification ?? ''] ?? '', TET_OUT[s.tet ?? ''] ?? '',
      LABEL.appt[s.appointment ?? ''] === '—' ? '' : LABEL.appt[s.appointment ?? ''],
      date(s.dateOfJoining), s.experienceYears ?? '', s.cpdHours ?? '', s.maxPerWeek ?? '',
    ])
  const facLast = Math.max(300, staff.length + 100)
  listDV(fw, `C2:C${facLast}`, 'A'); listDV(fw, `F2:F${facLast}`, 'B'); listDV(fw, `G2:G${facLast}`, 'C')
  listDV(fw, `H2:H${facLast}`, 'D'); listDV(fw, `I2:I${facLast}`, 'E'); listDV(fw, `D2:D${facLast}`, 'F', false)
  for (let r = 2; r <= facLast; r++) {
    fw.getCell(`J${r}`).numFmt = 'dd-mm-yyyy'
    fw.getCell(`K${r}`).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 50], allowBlank: true, showErrorMessage: true, error: '0 to 50 years.' }
    fw.getCell(`L${r}`).dataValidation = { type: 'decimal', operator: 'between', formulae: [0, 500], allowBlank: true, showErrorMessage: true, error: '0 to 500 hours.' }
    fw.getCell(`M${r}`).dataValidation = { type: 'whole', operator: 'between', formulae: [0, 48], allowBlank: true, showErrorMessage: true, error: '0 to 48 periods.' }
  }

  // ---- Subject Periods (actual allocation: one row per section × subject, with the teacher's name)
  const pw = wb.addWorksheet(SHEETS.subjects)
  headerRow(pw, SUBJECT_HEADERS, [12, 26, 10, 26, 14, 34, 18])
  const pref = (p: string) => ({ morning: PREF_TIME[0], afternoon: PREF_TIME[1], last: PREF_TIME[2] } as Record<string, string>)[p] ?? ''
  const nameOf = new Map((o.data?.staff ?? []).map((s) => [s.id, s.name]))
  const allocs = o.prefill ? o.data?.allocations : undefined
  if (allocs?.length) {
    for (const a of allocs) {
      const who = a.mode === 'shared' ? 'Subject Wise' : [...a.teachers.map((id) => nameOf.get(id) ?? ''), ...(a.unmatched ?? [])].filter(Boolean).join('; ')
      pw.addRow([classLabel(a.standard), a.groupName ?? '', a.section, a.subject, a.periods, who, pref(a.pref)])
    }
  } else {
    for (const std of STANDARDS) {
      if (stageOf(std) === 'HSS') continue
      for (const s of o.rules.subjectsByStandard[std] ?? []) pw.addRow([classLabel(std), '', 'A', s.subject, s.periods, s.noTeacher ? '' : '', pref(s.pref)])
    }
    for (const g of groups) for (const s of g.subjects) pw.addRow(['Class 11', g.name, 'A', s.subject, s.periods, '', pref(s.pref)])
  }
  const subjLast = pw.rowCount + 150
  listDV(pw, `A2:A${subjLast}`, 'L'); listDV(pw, `G2:G${subjLast}`, 'J')
  for (let r = 2; r <= subjLast; r++) {
    pw.getCell(`E${r}`).dataValidation = { type: 'whole', operator: 'between', formulae: [0, 20], allowBlank: true, showErrorMessage: true, error: '0 to 20 periods.' }
    pw.getCell(`F${r}`).dataValidation = {
      type: 'list', allowBlank: true, formulae: [`'${SHEETS.faculty}'!$B$2:$B$${facLast}`], showErrorMessage: true, errorStyle: 'warning',
      errorTitle: 'Name not in Faculty sheet', error: 'Pick a name from the Faculty sheet. For two teachers type both names separated by ";". For activities taught by any subject teacher type "Subject Wise".',
    }
    ;['C', 'E', 'F'].forEach((c) => (pw.getCell(`${c}${r}`).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: INPUT } }))
  }

  wb.views = [{ x: 0, y: 0, width: 20000, height: 12000, firstSheet: 0, activeTab: 0, visibility: 'visible' }]
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer
}
