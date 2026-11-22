import { CATEGORY_LABEL } from '../engine/rules'
import type { Appointment, Category, HighestQualification, ProfessionalQualification, Staff, TetStatus } from '../engine/types'

export type Cell = string | number | boolean | Date | null

export const TEMPLATE_HEADERS = [
  'Employee ID', 'Full Name', 'Designation', 'Main Subject', 'Other Subjects (separate with ;)', 'Highest Qualification',
  'Professional Qualification', 'TET Status', 'Appointment Type', 'Date of Joining', 'Total Experience (years)',
  'CPD Training Hours (this year)', 'Max Periods per Week (optional)',
] as const

const key = (s: string) => s.toLowerCase().replace(/\*/g, '').replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

const HIGHEST: Record<string, HighestQualification> = {
  'higher secondary': 'HSC', hsc: 'HSC', diploma: 'DIPLOMA', 'ug degree': 'UG', ug: 'UG', 'pg degree': 'PG', pg: 'PG', 'm phil': 'MPHIL', mphil: 'MPHIL', 'ph d': 'PHD', phd: 'PHD',
}
const PROF: Record<string, ProfessionalQualification> = {
  'd el ed d t ed': 'DELED', 'd el ed': 'DELED', deled: 'DELED', 'd t ed': 'DELED', dted: 'DELED', 'b el ed': 'BELED', 'b ed': 'BED', bed: 'BED', 'm ed': 'MED', med: 'MED',
  'ntt montessori': 'NTT', ntt: 'NTT', montessori: 'NTT', 'b p ed m p ed': 'BPED', 'b p ed': 'BPED', 'm p ed': 'BPED', 'b ed special education rci': 'SPLED', 'b ed special education': 'SPLED', none: 'NONE',
}
const TET: Record<string, TetStatus> = {
  'tntet paper i': 'TNTET1', 'tntet paper ii': 'TNTET2', 'tntet both papers': 'TNTET_BOTH', 'ctet paper i': 'CTET1', 'ctet paper ii': 'CTET2', 'ctet both papers': 'CTET_BOTH',
  'not passed': 'NOT_PASSED', no: 'NOT_PASSED', 'not applicable': 'NA', na: 'NA',
  pass: 'PASSED', passed: 'PASSED', yes: 'PASSED', 'passed paper not stated': 'PASSED', 'tntet passed': 'PASSED', 'ctet passed': 'PASSED',
}
const APPT: Record<string, Appointment> = { regular: 'REGULAR', probation: 'PROBATION', contract: 'CONTRACT', 'part time': 'PART_TIME', parttime: 'PART_TIME' }
const SHORT: Record<string, Category> = {
  principal: 'PRINCIPAL', 'vice principal': 'ACAD_HEAD', 'academic head': 'ACAD_HEAD', hod: 'ACAD_HEAD', pgt: 'PGT', 'pg assistant': 'PGT', 'pg asst': 'PGT',
  tgt: 'TGT', 'bt assistant': 'TGT', 'bt asst': 'TGT', prt: 'SGT', sgt: 'SGT', 'pre primary teacher': 'MONTESSORI', montessori: 'MONTESSORI', pet: 'SPECIALIST',
  coordinator: 'ACAD_HEAD', 'academic coordinator': 'ACAD_HEAD', 'upper primary': 'TGT', 'middle school': 'TGT', primary: 'SGT', 'primary teacher': 'SGT',
  nursery: 'MONTESSORI', 'nursery teacher': 'MONTESSORI', nt: 'MONTESSORI', kg: 'MONTESSORI', 'kg teacher': 'MONTESSORI', pt: 'SPECIALIST', 'pe teacher': 'SPECIALIST',
  'physical education teacher': 'SPECIALIST', 'art teacher': 'SPECIALIST', 'music teacher': 'SPECIALIST', 'computer teacher': 'SPECIALIST',
  'special educator': 'SPECIAL_EDUCATOR', counsellor: 'COUNSELLOR', 'counsellor wellness teacher': 'COUNSELLOR', 'career counsellor': 'CAREER_COUNSELLOR', librarian: 'LIBRARIAN', 'lab assistant': 'LAB_ASSISTANT',
}
const DESIGNATION = new Map<string, Category>([
  ...(Object.entries(CATEGORY_LABEL) as [Category, string][]).map(([c, l]) => [key(l), c] as [string, Category]),
  ...Object.entries(SHORT),
])

export function categoryFromDesignation(v: string): Category | null {
  const k = key(v)
  if (DESIGNATION.has(k)) return DESIGNATION.get(k)!
  if (k.startsWith('specialist')) return 'SPECIALIST'
  return null
}

export interface ParseIssue {
  row: number
  column?: string
  message: string
}

export interface ParseResult {
  staff: Staff[]
  errors: ParseIssue[]
  warnings: ParseIssue[]
}

const text = (c: Cell | undefined) => (c === null || c === undefined ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim())

function toDate(c: Cell | undefined): string | null | undefined {
  if (c === null || c === undefined || c === '') return undefined
  if (c instanceof Date) return isNaN(c.getTime()) ? null : c.toISOString().slice(0, 10)
  if (typeof c === 'number') {
    // Excel serial date
    const d = new Date(Date.UTC(1899, 11, 30) + c * 86400000)
    return d.toISOString().slice(0, 10)
  }
  const m = String(c).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) {
    const d = new Date(Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])))
    if (d.getUTCDate() === Number(m[1])) return d.toISOString().slice(0, 10)
  }
  const iso = String(c).trim().match(/^\d{4}-\d{2}-\d{2}$/)
  return iso ? iso[0] : null
}

function toNum(c: Cell | undefined, max: number): number | null | undefined {
  if (c === null || c === undefined || c === '') return undefined
  const v = typeof c === 'number' ? c : Number(String(c).trim())
  return Number.isFinite(v) && v >= 0 && v <= max ? v : null
}

const MAX_ROWS = 500

/** Converts the rows of the "Faculty" sheet into staff records with row-level errors and warnings. */
export function parseFacultyRows(rows: Cell[][], idPrefix = 'st'): ParseResult {
  const errors: ParseIssue[] = []
  const warnings: ParseIssue[] = []
  const staff: Staff[] = []
  const hIdx = rows.findIndex((r) => r.some((c) => key(text(c)) === 'full name'))
  if (hIdx < 0) return { staff, errors: [{ row: 1, message: 'Header row not found. Use the official template (sheet "Faculty", column "Full Name").' }], warnings }
  const header = rows[hIdx].map((c) => key(text(c)))
  const col = (name: string) => header.indexOf(key(name))
  const required = ['Full Name', 'Designation']
  for (const r of required) if (col(r) < 0) errors.push({ row: hIdx + 1, column: r, message: `Missing column "${r}".` })
  if (errors.length) return { staff, errors, warnings }
  const get = (r: Cell[], name: string) => (col(name) >= 0 ? r[col(name)] : undefined)

  const ids = new Map<string, number>()
  const body = rows.slice(hIdx + 1)
  const apptDesigRows: number[] = []
  if (body.length > MAX_ROWS) errors.push({ row: hIdx + 2 + MAX_ROWS, message: `More than ${MAX_ROWS} rows; only the first ${MAX_ROWS} are read.` })
  body.slice(0, MAX_ROWS).forEach((r, i) => {
    const rowNo = hIdx + 2 + i
    if (r.every((c) => text(c) === '')) return
    const err = (column: string, message: string) => errors.push({ row: rowNo, column, message })
    const warn = (column: string, message: string) => warnings.push({ row: rowNo, column, message })

    const name = text(get(r, 'Full Name')).slice(0, 80)
    if (!name) { err('Full Name', 'Full Name is required.'); return }
    const apptRaw = text(get(r, 'Appointment Type'))
    const apptIsDesig = !!apptRaw && !(key(apptRaw) in APPT) && !!categoryFromDesignation(apptRaw)
    const desig = text(get(r, 'Designation')) || (apptIsDesig ? apptRaw : '')
    if (!text(get(r, 'Designation')) && apptIsDesig) warn('Designation', `Designation taken from Appointment Type ("${apptRaw}").`)
    const category = categoryFromDesignation(desig)
    if (!category) { err('Designation', desig ? `Unknown designation "${desig}". Choose from the list.` : 'Designation is required.'); return }

    const employeeId = text(get(r, 'Employee ID')).slice(0, 30)
    if (employeeId) {
      if (ids.has(employeeId)) { err('Employee ID', `Duplicate Employee ID "${employeeId}" (also on row ${ids.get(employeeId)}).`); return }
      ids.set(employeeId, rowNo)
    }

    const main = text(get(r, 'Main Subject')).slice(0, 60)
    const others = text(get(r, 'Other Subjects (separate with ;)')).split(/[;|]/).map((x) => x.trim().slice(0, 60)).filter(Boolean)
    const subjects = [main, ...others].filter(Boolean).filter((x, j, a) => a.indexOf(x) === j)
    if (!subjects.length && !['PRINCIPAL', 'COUNSELLOR', 'CAREER_COUNSELLOR', 'LIBRARIAN', 'LAB_ASSISTANT', 'SPECIAL_EDUCATOR'].includes(category))
      warn('Main Subject', 'No subject given; this teacher will not be assigned periods.')

    const pick = <T extends string>(column: string, map: Record<string, T>): T | '' => {
      const v = text(get(r, column))
      if (!v) return ''
      const k = key(v)
      if (k in map) return map[k]
      warn(column, `Unrecognised value "${v}" — left blank.`)
      return ''
    }
    const highestQualification = pick('Highest Qualification', HIGHEST)
    const professionalQualification = pick('Professional Qualification', PROF)
    const tet = pick('TET Status', TET)
    let appointment: Appointment | '' = ''
    if (apptIsDesig) apptDesigRows.push(rowNo)
    else appointment = pick('Appointment Type', APPT)

    const doj = toDate(get(r, 'Date of Joining'))
    if (doj === null) warn('Date of Joining', 'Invalid date — use DD-MM-YYYY.')
    const exp = toNum(get(r, 'Total Experience (years)'), 50)
    if (exp === null) warn('Total Experience (years)', 'Must be a number between 0 and 50.')
    const cpd = toNum(get(r, 'CPD Training Hours (this year)'), 500)
    if (cpd === null) warn('CPD Training Hours (this year)', 'Must be a number between 0 and 500.')
    const maxW = toNum(get(r, 'Max Periods per Week (optional)'), 48)
    if (maxW === null) warn('Max Periods per Week (optional)', 'Must be a number between 0 and 48.')

    staff.push({
      id: `${idPrefix}-${employeeId || rowNo}`,
      name,
      category,
      subjects,
      employeeId: employeeId || undefined,
      highestQualification,
      professionalQualification,
      tet,
      appointment,
      dateOfJoining: doj ?? undefined,
      experienceYears: exp ?? undefined,
      cpdHours: cpd ?? undefined,
      maxPerWeek: maxW ?? undefined,
    })
  })
  if (apptDesigRows.length)
    warnings.push({ row: apptDesigRows[0], column: 'Appointment Type', message: `${apptDesigRows.length} row(s) have a designation in Appointment Type (rows ${apptDesigRows.slice(0, 8).join(', ')}${apptDesigRows.length > 8 ? '…' : ''}). Use Regular, Probation, Contract or Part-time; left blank.` })
  if (!staff.length && !errors.length) errors.push({ row: hIdx + 2, message: 'No faculty rows found below the header.' })
  return { staff, errors, warnings }
}

// -------- display labels for the faculty table
export const LABEL = {
  highest: { HSC: 'Higher Secondary', DIPLOMA: 'Diploma', UG: 'UG Degree', PG: 'PG Degree', MPHIL: 'M.Phil', PHD: 'Ph.D', '': '—' } as Record<string, string>,
  prof: { DELED: 'D.El.Ed / D.T.Ed', BELED: 'B.El.Ed', BED: 'B.Ed', MED: 'M.Ed', NTT: 'NTT / Montessori', BPED: 'B.P.Ed / M.P.Ed', SPLED: 'B.Ed (Spl. Ed.) / RCI', NONE: 'None', '': '—' } as Record<string, string>,
  tet: { TNTET1: 'TNTET I', TNTET2: 'TNTET II', TNTET_BOTH: 'TNTET I & II', CTET1: 'CTET I', CTET2: 'CTET II', CTET_BOTH: 'CTET I & II', PASSED: 'Passed (paper not stated)', NOT_PASSED: 'Not passed', NA: 'N/A', '': '—' } as Record<string, string>,
  appt: { REGULAR: 'Regular', PROBATION: 'Probation', CONTRACT: 'Contract', PART_TIME: 'Part-time', '': '—' } as Record<string, string>,
}
