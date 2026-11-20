import { isClassTeacherStage, stageOf } from '../../engine/rules'
import type { Board, ComplianceEntry, GenderCount, HssGroup, RuleSet, SchoolProfile, Staff, SubjectAlloc } from '../../engine/types'
import { parseFacultyRows, type Cell } from '../facultyExcel'
import { CLASS_LABELS, COMPLIANCE_HEADERS, HANDLED_BY, PREF_TIME, PROFILE_FIELDS, SHEETS, STUDENT_HEADERS, SUBJECT_HEADERS, classKey, classLabel, slug } from './spec'

export interface Issue {
  sheet: string
  row?: number
  column?: string
  level: 'error' | 'warning'
  message: string
}

export interface WorkbookData {
  schoolName?: string
  board?: Board
  profile: SchoolProfile
  genderSeparate?: boolean
  daysPerWeek?: number
  periodsPerDay?: number
  lunchAfterPeriod?: number
  strength: Record<string, GenderCount>
  hss: Record<string, Record<string, GenderCount>>
  cwsn: Record<string, number>
  staff: Staff[] | null
  subjectsByStandard?: Record<string, SubjectAlloc[]>
  hssGroups?: HssGroup[]
  compliance: Record<string, ComplianceEntry>
  issues: Issue[]
  sheetsFound: string[]
}

const text = (c: Cell | undefined) => (c === null || c === undefined ? '' : c instanceof Date ? c.toISOString().slice(0, 10) : String(c).trim())
const k = (s: string) => s.toLowerCase().replace(/\(.*?\)/g, '').replace(/[^a-z0-9]+/g, ' ').trim()

function toDate(c: Cell | undefined): string | null | undefined {
  if (c === null || c === undefined || c === '') return undefined
  if (c instanceof Date) return isNaN(c.getTime()) ? null : c.toISOString().slice(0, 10)
  if (typeof c === 'number') return new Date(Date.UTC(1899, 11, 30) + c * 86400000).toISOString().slice(0, 10)
  const m = String(c).trim().match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/)
  if (m) {
    const d = new Date(Date.UTC(+m[3], +m[2] - 1, +m[1]))
    return d.getUTCDate() === +m[1] ? d.toISOString().slice(0, 10) : null
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(String(c).trim()) ? String(c).trim() : null
}
function toInt(c: Cell | undefined, min: number, max: number): number | null | undefined {
  if (c === null || c === undefined || c === '') return undefined
  const v = typeof c === 'number' ? c : Number(String(c).trim())
  return Number.isFinite(v) && v >= min && v <= max ? Math.round(v) : null
}
const yesNo = (c: Cell | undefined): boolean | null | undefined => {
  const v = text(c).toLowerCase()
  if (!v) return undefined
  if (['yes', 'y', 'true'].includes(v)) return true
  if (['no', 'n', 'false'].includes(v)) return false
  return null
}

function header(rows: Cell[][], first: string) {
  const i = rows.findIndex((r) => r.some((c) => k(text(c)) === k(first)))
  if (i < 0) return null
  const h = rows[i].map((c) => k(text(c)))
  return { index: i, col: (name: string) => h.indexOf(k(name)) }
}

/**
 * Parses the school data workbook. `sheets` comes from read-excel-file (all sheets).
 * `defaults(board)` supplies board rules for mapping groups when the Subject Periods sheet is absent.
 */
export function parseWorkbook(sheets: { sheet: string; data: Cell[][] }[], defaults: (b: Board) => RuleSet): WorkbookData {
  const issues: Issue[] = []
  const by = new Map(sheets.map((s) => [k(s.sheet), s.data]))
  const get = (name: string) => by.get(k(name))
  const out: WorkbookData = { profile: {}, strength: {}, hss: {}, cwsn: {}, staff: null, compliance: {}, issues, sheetsFound: sheets.map((s) => s.sheet) }
  const err = (sheet: string, message: string, row?: number, column?: string) => issues.push({ sheet, row, column, level: 'error', message })
  const warn = (sheet: string, message: string, row?: number, column?: string) => issues.push({ sheet, row, column, level: 'warning', message })

  // ---------------- School Profile
  const prof = get(SHEETS.profile)
  if (!prof) err(SHEETS.profile, 'Sheet "School Profile" not found. Use the official template.')
  else {
    const byLabel = new Map<string, { value: Cell; row: number }>()
    prof.forEach((r, i) => { if (text(r[0])) byLabel.set(k(text(r[0]).replace(/\*/g, '')), { value: r[1] ?? null, row: i + 1 }) })
    for (const f of PROFILE_FIELDS) {
      const e = byLabel.get(k(f.label))
      const v = e?.value ?? null
      const row = e?.row
      if (f.required && !text(v)) { err(SHEETS.profile, `${f.label} is required.`, row, f.label); continue }
      if (!text(v)) continue
      switch (f.type) {
        case 'board': {
          const b = text(v).toLowerCase()
          out.board = b.startsWith('cbse') ? 'CBSE' : b.startsWith('matric') ? 'MATRIC' : undefined
          if (!out.board) err(SHEETS.profile, `Board must be "Matriculation" or "CBSE" (found "${text(v)}").`, row, f.label)
          break
        }
        case 'date': {
          const d = toDate(v)
          if (d === null) warn(SHEETS.profile, `${f.label}: invalid date — use DD-MM-YYYY.`, row, f.label)
          else if (f.key === 'recognitionValidUntil') out.profile.recognitionValidUntil = d
          break
        }
        case 'yesno': {
          const b = yesNo(v)
          if (b === null) warn(SHEETS.profile, `${f.label}: enter Yes or No.`, row, f.label)
          else if (f.key === 'minority') out.profile.minority = b
          else if (f.key === 'genderSeparate') out.genderSeparate = b
          break
        }
        case 'number': {
          const n = toInt(v, f.min ?? 0, f.max ?? 10000)
          if (n === null) { warn(SHEETS.profile, `${f.label}: must be between ${f.min} and ${f.max}.`, row, f.label); break }
          if (f.key === 'daysPerWeek') out.daysPerWeek = n
          if (f.key === 'periodsPerDay') out.periodsPerDay = n
          if (f.key === 'lunchAfterPeriod') out.lunchAfterPeriod = n
          if (f.key === 'periodMinutes') out.profile.periodMinutes = n
          if (f.key === 'workingDaysYear') out.profile.workingDaysYear = n
          break
        }
        default: {
          const s = text(v).slice(0, 160)
          if (f.key === 'schoolName') out.schoolName = s
          else if (f.key === 'academicYear') out.profile.academicYear = s.slice(0, 20)
          else if (f.key === 'udise') {
            out.profile.udise = s.replace(/\s/g, '')
            if (!/^\d{11}$/.test(out.profile.udise)) warn(SHEETS.profile, 'UDISE+ code is usually 11 digits.', row, f.label)
          } else if (f.key === 'recognitionNo') out.profile.recognitionNo = s.slice(0, 60)
          else if (f.key === 'startTime') out.profile.startTime = s.slice(0, 10)
          else if (f.key === 'endTime') out.profile.endTime = s.slice(0, 10)
        }
      }
    }
    if (out.lunchAfterPeriod && out.periodsPerDay && out.lunchAfterPeriod >= out.periodsPerDay)
      warn(SHEETS.profile, 'Lunch break must come before the last period.', undefined, 'Lunch Break After Period')
  }
  const board: Board = out.board ?? 'MATRIC'
  const base = defaults(board)

  // ---------------- Subject Periods (optional — board defaults used when absent)
  const subj = get(SHEETS.subjects)
  const groupIdByName = new Map<string, string>(base.hssGroups.map((g) => [k(g.name), g.id]))
  if (subj) {
    const h = header(subj, SUBJECT_HEADERS[0])
    if (!h || h.col('Subject') < 0) err(SHEETS.subjects, 'Header row not found (Class, Group, Subject, Periods per Week, Handled By, Preferred Time).')
    else {
      const byStd: Record<string, SubjectAlloc[]> = {}
      const groups = new Map<string, HssGroup>()
      const groupSource = new Map<string, string>()
      subj.slice(h.index + 1).forEach((r, i) => {
        const row = h.index + 2 + i
        if (r.every((c) => text(c) === '')) return
        const std = classKey(text(r[h.col('Class')]))
        if (!std) { err(SHEETS.subjects, `Unknown class "${text(r[h.col('Class')])}".`, row, 'Class'); return }
        const subject = text(r[h.col('Subject')]).slice(0, 60)
        if (!subject) { err(SHEETS.subjects, 'Subject is required.', row, 'Subject'); return }
        const periods = toInt(r[h.col('Periods per Week')], 0, 20)
        if (periods === null || periods === undefined) { err(SHEETS.subjects, 'Periods per Week must be a number 0–20.', row, 'Periods per Week'); return }
        const hb = k(text(r[h.col('Handled By')]))
        const pt = k(text(r[h.col('Preferred Time')]))
        const handled = HANDLED_BY.find((x) => k(x) === hb) ?? (hb ? null : 'Subject Teacher')
        if (!handled) warn(SHEETS.subjects, `Unknown "Handled By" value; treated as Subject Teacher.`, row, 'Handled By')
        const pref = ({ [k(PREF_TIME[0])]: 'morning', [k(PREF_TIME[1])]: 'afternoon', [k(PREF_TIME[2])]: 'last' } as Record<string, SubjectAlloc['pref']>)[pt] ?? 'any'
        const alloc: SubjectAlloc = { subject, periods, pref }
        if (handled === 'Specialist') alloc.specialist = true
        if (handled === 'Shared (any section teacher)') alloc.flex = true
        if (handled === 'No Teacher (supervised)') alloc.noTeacher = true
        if (handled === 'Class Teacher' && !isClassTeacherStage(stageOf(std))) warn(SHEETS.subjects, `"Class Teacher" applies only up to Class 5; ${classLabel(std)} treated as Subject Teacher.`, row, 'Handled By')
        if (periods === 0) return
        if (stageOf(std) === 'HSS') {
          const gname = text(r[h.col('Group (Class 11–12 only)')])
          if (!gname) { err(SHEETS.subjects, 'Group is required for Class 11 and 12.', row, 'Group'); return }
          const id = groupIdByName.get(k(gname)) ?? slug(gname)
          groupIdByName.set(k(gname), id)
          // Class 11 and 12 share one allocation per group; the first class listed for a group defines it
          const g = groups.get(id) ?? { id, name: gname.slice(0, 40), subjects: [] }
          if (!groupSource.has(id)) groupSource.set(id, std)
          if (groupSource.get(id) === std) g.subjects.push(alloc)
          groups.set(id, g)
        } else {
          ;(byStd[std] ??= []).push(alloc)
        }
      })
      const slots = (out.daysPerWeek ?? base.daysPerWeek) * (out.periodsPerDay ?? base.periodsPerDay)
      for (const [std, list] of Object.entries(byStd)) {
        const total = list.reduce((a, s) => a + s.periods, 0)
        if (total !== slots) warn(SHEETS.subjects, `${classLabel(std)}: periods add up to ${total}, but the week has ${slots} slots.`)
      }
      for (const g of groups.values()) {
        const total = g.subjects.reduce((a, s) => a + s.periods, 0)
        if (total !== slots) warn(SHEETS.subjects, `Group ${g.name}: periods add up to ${total}, but the week has ${slots} slots.`)
      }
      if (Object.keys(byStd).length) out.subjectsByStandard = byStd
      if (groups.size) out.hssGroups = [...groups.values()]
    }
  }

  // ---------------- Students
  const st = get(SHEETS.students)
  if (!st) err(SHEETS.students, 'Sheet "Students" not found.')
  else {
    const h = header(st, STUDENT_HEADERS[0])
    if (!h || h.col('Boys') < 0 || h.col('Girls') < 0) err(SHEETS.students, 'Header row not found (Class, Group, Boys, Girls, CWSN).')
    else {
      const knownGroups = new Set((out.hssGroups ?? base.hssGroups).map((g) => g.id))
      st.slice(h.index + 1).forEach((r, i) => {
        const row = h.index + 2 + i
        if (r.every((c) => text(c) === '')) return
        const std = classKey(text(r[h.col('Class')]))
        if (!std) { err(SHEETS.students, `Unknown class "${text(r[h.col('Class')])}".`, row, 'Class'); return }
        const boys = toInt(r[h.col('Boys')], 0, 3000)
        const girls = toInt(r[h.col('Girls')], 0, 3000)
        const cw = toInt(r[h.col('Children with Special Needs (CWSN)')], 0, 3000)
        if (boys === null) err(SHEETS.students, 'Boys must be a whole number.', row, 'Boys')
        if (girls === null) err(SHEETS.students, 'Girls must be a whole number.', row, 'Girls')
        if (cw === null) warn(SHEETS.students, 'CWSN must be a whole number.', row, 'CWSN')
        if (boys === null || girls === null) return
        const c = { boys: boys ?? 0, girls: girls ?? 0 }
        if (cw && cw > c.boys + c.girls) warn(SHEETS.students, 'CWSN is more than the class strength.', row, 'CWSN')
        if (cw) out.cwsn[std] = (out.cwsn[std] ?? 0) + cw
        if (stageOf(std) === 'HSS') {
          const gname = text(r[h.col('Group (Class 11–12 only)')])
          if (!gname) { if (c.boys + c.girls > 0) err(SHEETS.students, 'Group is required for Class 11 and 12.', row, 'Group'); return }
          const id = groupIdByName.get(k(gname)) ?? slug(gname)
          if (!knownGroups.has(id) && c.boys + c.girls > 0) warn(SHEETS.students, `Group "${gname}" has no subject periods; its students will form sections but no teacher demand.`, row, 'Group')
          const cur = out.hss[std]?.[id] ?? { boys: 0, girls: 0 }
          out.hss[std] = { ...(out.hss[std] ?? {}), [id]: { boys: cur.boys + c.boys, girls: cur.girls + c.girls } }
          if (!knownGroups.has(id) && c.boys + c.girls > 0 && !out.hssGroups) out.hssGroups = [...base.hssGroups]
          if (!knownGroups.has(id) && c.boys + c.girls > 0) { out.hssGroups!.push({ id, name: gname.slice(0, 40), subjects: [] }); knownGroups.add(id) }
        } else {
          const cur = out.strength[std] ?? { boys: 0, girls: 0 }
          out.strength[std] = { boys: cur.boys + c.boys, girls: cur.girls + c.girls }
        }
      })
      if (!Object.keys(out.strength).length && !Object.keys(out.hss).length) warn(SHEETS.students, 'No student numbers entered.')
    }
  }

  // ---------------- Faculty
  const fac = get(SHEETS.faculty)
  if (!fac) err(SHEETS.faculty, 'Sheet "Faculty" not found.')
  else {
    const r = parseFacultyRows(fac, `st-${Date.now().toString(36)}`)
    r.errors.forEach((e) => issues.push({ sheet: SHEETS.faculty, row: e.row, column: e.column, level: /^No faculty rows/.test(e.message) ? 'warning' : 'error', message: e.message }))
    r.warnings.forEach((e) => issues.push({ sheet: SHEETS.faculty, row: e.row, column: e.column, level: 'warning', message: e.message }))
    out.staff = r.staff

  }

  // ---------------- Compliance (optional)
  const comp = get(SHEETS.compliance)
  if (comp) {
    const h = header(comp, COMPLIANCE_HEADERS[0])
    if (h) {
      comp.slice(h.index + 1).forEach((r, i) => {
        const row = h.index + 2 + i
        const id = text(r[h.col('ID')])
        if (!id) return
        const s = k(text(r[h.col('Status')]))
        const status = s === 'yes' ? 'YES' : s === 'no' ? 'NO' : s === 'not applicable' || s === 'na' ? 'NA' : s ? null : undefined
        if (status === null) warn(SHEETS.compliance, 'Status must be Yes, No or Not applicable.', row, 'Status')
        const vu = toDate(r[h.col('Valid Until (if any)')])
        if (vu === null) warn(SHEETS.compliance, 'Invalid date — use DD-MM-YYYY.', row, 'Valid Until')
        const note = text(r[h.col('Remarks')]).slice(0, 200)
        if (!status && !vu && !note) return
        out.compliance[id] = { done: status === 'YES', status: status ?? undefined, validUntil: vu ?? undefined, note: note || undefined }
      })
    }
  }
  void CLASS_LABELS
  return out
}
