import { stageOf } from '../../engine/rules'
import type { Allocation, Board, ComplianceEntry, GenderCount, HssGroup, RuleSet, SchoolProfile, Staff, SubjectAlloc } from '../../engine/types'
import { isSharedWord, makeMatcher, splitNames } from './names'
import { ACTIVITY_RE, CARE_RE, applyStreams, scanStudentGroups, weekPeriodsOf } from './streams'
import { parseFacultyRows, type Cell } from '../facultyExcel'
import { CLASS_LABELS, COMPLIANCE_HEADERS, HANDLED_BY, PREF_TIME, PROFILE_FIELDS, SHEETS, STUDENT_HEADERS, classKey, classLabel, slug } from './spec'

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
  allocations?: Allocation[]
  /** Written names matched to a faculty member with a different spelling */
  nameFixes: { written: string; matched: string }[]
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
  const out: WorkbookData = { profile: {}, strength: {}, hss: {}, cwsn: {}, staff: null, compliance: {}, nameFixes: [], issues, sheetsFound: sheets.map((s) => s.sheet) }
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

  // ---------------- Faculty
  const fac = get(SHEETS.faculty)
  if (!fac) err(SHEETS.faculty, 'Sheet "Faculty" not found.')
  else {
    const r = parseFacultyRows(fac, `st-${Date.now().toString(36)}`)
    r.errors.forEach((e) => issues.push({ sheet: SHEETS.faculty, row: e.row, column: e.column, level: /^No faculty rows/.test(e.message) ? 'warning' : 'error', message: e.message }))
    r.warnings.forEach((e) => issues.push({ sheet: SHEETS.faculty, row: e.row, column: e.column, level: 'warning', message: e.message }))
    out.staff = r.staff

  }

  // ---------------- Subject Periods — the school's actual allocation (optional; board defaults used when absent)
  const subj = get(SHEETS.subjects)
  const groupIdByName = new Map<string, string>(base.hssGroups.map((g) => [k(g.name), g.id]))
  if (subj) {
    const hi = subj.findIndex((r) => r.some((c) => k(text(c)) === 'subject'))
    if (hi < 0) err(SHEETS.subjects, 'Header row not found (Class, Group, Section, Subject, Periods per Week, Teacher Name(s), Preferred Time).')
    else {
      const head = subj[hi].map((c) => k(text(c)))
      const col = (...names: string[]) => head.findIndex((h) => names.map(k).includes(h))
      const body = subj.slice(hi + 1)
      const cClass = col('Class')
      const cGroup = head.findIndex((h) => h.startsWith('group'))
      const cSection = col('Section')
      const cSubject = col('Subject')
      const cPeriods = head.findIndex((h) => h.startsWith('periods'))
      const cPref = col('Preferred Time')
      // Teacher column: "Teacher Name(s)", or — older layout — the "Handled By" column that holds names (the type column is ignored)
      let cTeacher = head.findIndex((h) => h.startsWith('teacher'))
      if (cTeacher < 0) {
        const handled = head.map((h, i) => (h === 'handled by' ? i : -1)).filter((i) => i >= 0)
        const typeWords = new Set(HANDLED_BY.map(k))
        const score = (i: number) => body.filter((r) => { const v = k(text(r[i])); return v && !typeWords.has(v) }).length
        cTeacher = handled.sort((a, b) => score(b) - score(a))[0] ?? -1
        if (handled.length > 1) warn(SHEETS.subjects, `Two "Handled By" columns found — teacher names taken from column ${String.fromCharCode(65 + cTeacher)}; the other column is ignored.`)
      }
      if (cClass < 0 || cSubject < 0 || cPeriods < 0) err(SHEETS.subjects, 'Columns Class, Subject and Periods per Week are required.')
      else {
        const match = makeMatcher(out.staff ?? [])
        const fixes = new Map<string, string>()
        const unknown = new Map<string, number[]>()
        const allocs: Allocation[] = []
        let lastClass = ''
        let lastGroup = ''
        const seen = new Map<string, { letter: number; subjects: Set<string> }>()
        body.forEach((r, i) => {
          const row = hi + 2 + i
          if (r.every((c) => text(c) === '')) return
          const rawClass = text(r[cClass])
          const rawGroup = cGroup >= 0 ? text(r[cGroup]) : ''
          const std = rawClass ? classKey(rawClass) : classKey(lastClass)
          if (!rawClass && !lastClass) { err(SHEETS.subjects, 'Class is missing.', row, 'Class'); return }
          if (!std) { err(SHEETS.subjects, `Unknown class "${rawClass}".`, row, 'Class'); return }
          if (rawClass && rawClass !== lastClass) lastGroup = ''
          lastClass = rawClass || lastClass
          const subject = text(r[cSubject]).replace(/\s+/g, ' ').slice(0, 60)
          if (!subject) { err(SHEETS.subjects, 'Subject is required.', row, 'Subject'); return }
          const periods = toInt(r[cPeriods], 0, 20)
          if (periods === null || periods === undefined) { err(SHEETS.subjects, 'Periods per Week must be a number 0–20.', row, 'Periods per Week'); return }
          if (periods === 0) return
          let groupId: string | undefined
          let groupName: string | undefined
          if (stageOf(std) === 'HSS') {
            groupName = (rawGroup || lastGroup).slice(0, 40)
            if (!groupName) { err(SHEETS.subjects, 'Group is required for Class 11 and 12.', row, 'Group'); return }
            lastGroup = groupName
            groupId = groupIdByName.get(k(groupName)) ?? slug(groupName)
            groupIdByName.set(k(groupName), groupId)
          }
          // Section: explicit column, else a repeated subject within the class starts the next section
          const key = `${std}|${groupId ?? ''}`
          const st = seen.get(key) ?? { letter: 0, subjects: new Set<string>() }
          let section: string
          const explicit = cSection >= 0 ? text(r[cSection]).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2) : ''
          if (explicit) section = explicit
          else {
            const sk = k(subject)
            if (st.subjects.has(sk)) { st.letter++; st.subjects = new Set() }
            st.subjects.add(sk)
            section = String.fromCharCode(65 + st.letter)
          }
          seen.set(key, st)
          const pt = cPref >= 0 ? k(text(r[cPref])) : ''
          const model = (groupId ? base.hssGroups.find((g) => g.id === groupId)?.subjects : base.subjectsByStandard[std])?.find((x) => k(x.subject) === k(subject))
          const pref = ({ [k(PREF_TIME[0])]: 'morning', [k(PREF_TIME[1])]: 'afternoon', [k(PREF_TIME[2])]: 'last' } as Record<string, SubjectAlloc['pref']>)[pt] ?? model?.pref ?? 'any'
          const cell = cTeacher >= 0 ? text(r[cTeacher]) : ''
          const a: Allocation = { standard: std, groupId, groupName, section, subject, periods, pref, teachers: [], mode: 'unassigned' }
          if (CARE_RE.test(subject)) a.care = true
          if (cell && isSharedWord(cell)) a.mode = 'shared'
          else if (cell) {
            for (const nm of splitNames(cell)) {
              const m = match(nm)
              if (m) { if (!a.teachers.includes(m.id)) a.teachers.push(m.id); if (!m.exact) fixes.set(nm, m.name) }
              else { (a.unmatched ??= []).push(nm); unknown.set(nm, [...(unknown.get(nm) ?? []), row]) }
            }
            a.mode = a.teachers.length ? 'named' : 'unassigned'
          } else if (ACTIVITY_RE.test(subject)) { a.mode = 'shared'; a.autoShared = true }
          allocs.push(a)
        })
        for (const [written, matched] of fixes) { out.nameFixes.push({ written, matched }); warn(SHEETS.subjects, `"${written}" matched to faculty "${matched}" (spelling differs).`, undefined, 'Teacher Name(s)') }
        for (const [nm, rows] of unknown) warn(SHEETS.subjects, `"${nm}" is not in the Faculty sheet (rows ${rows.slice(0, 6).join(', ')}${rows.length > 6 ? '…' : ''}). Add the teacher or correct the spelling.`, rows[0], 'Teacher Name(s)')
        // Class 11–12 streams and parallel electives
        const stuRows = get(SHEETS.students)
        for (const n of applyStreams(allocs, stuRows ? scanStudentGroups(stuRows, classKey) : new Map(), groupIdByName)) warn(SHEETS.subjects, n.message)
        const auto = allocs.filter((a) => a.autoShared)
        if (auto.length) warn(SHEETS.subjects, `${auto.length} activity row(s) with no teacher (${[...new Set(auto.map((a) => a.subject))].join(', ')}) are given to a teacher of the same section automatically. Name a teacher if a specific person must take them.`)
        const care = allocs.filter((a) => a.care)
        if (care.length) warn(SHEETS.subjects, `${[...new Set(care.map((a) => a.subject))].join(', ')} (${care.reduce((s, a) => s + a.periods, 0)} periods) treated as supervision: kept in the timetable, not counted as teaching load.`)
        if (allocs.length) {
          // Only a sheet that names teachers is a real allocation; a blank model sheet just sets subject periods
          if (allocs.some((a) => a.mode === 'named')) out.allocations = allocs
          // Board-style allocation (section A of each class) for norm-based calculations
          const byStd: Record<string, SubjectAlloc[]> = {}
          const groups = new Map<string, HssGroup>()
          for (const a of allocs.filter((x) => x.section === 'A')) {
            const model = (a.groupId ? base.hssGroups.find((g) => g.id === a.groupId)?.subjects : base.subjectsByStandard[a.standard])?.find((x) => k(x.subject) === k(a.subject))
            const sa: SubjectAlloc = { subject: a.subject, periods: a.periods, pref: a.pref }
            if (model?.specialist) sa.specialist = true
            if (model?.noTeacher) sa.noTeacher = true
            if (a.mode === 'shared' || (model?.flex && a.mode !== 'named')) sa.flex = true
            if (a.groupId) {
              const g = groups.get(a.groupId) ?? { id: a.groupId, name: a.groupName ?? a.groupId, subjects: [] }
              if (a.standard === '11' || !groups.has(a.groupId)) g.subjects.push(sa)
              groups.set(a.groupId, g)
            } else (byStd[a.standard] ??= []).push(sa)
          }
          if (Object.keys(byStd).length) out.subjectsByStandard = byStd
          if (groups.size) out.hssGroups = [...groups.values()]
          // Weekly totals per section
          const slots = (out.daysPerWeek ?? base.daysPerWeek) * (out.periodsPerDay ?? base.periodsPerDay)
          const bySec = new Map<string, Allocation[]>()
          for (const a of allocs) { const kk = `${classLabel(a.standard)}${a.groupName ? ' ' + a.groupName : ''} ${a.section}`; bySec.set(kk, [...(bySec.get(kk) ?? []), a]) }
          const tot = new Map([...bySec].map(([kk, list]) => [kk, weekPeriodsOf(list)]))
          const over = [...tot].filter(([, v]) => v > slots)
          if (over.length) warn(SHEETS.subjects, `${over.length} section(s) have more periods than the week allows (${slots} = ${out.daysPerWeek ?? base.daysPerWeek} days × ${out.periodsPerDay ?? base.periodsPerDay} periods), e.g. ${over.slice(0, 3).map(([kk, v]) => `${kk}: ${v}`).join('; ')}. Check Working Days per Week in School Profile.`)
        }
      }
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
      let lastStd = ''
      st.slice(h.index + 1).forEach((r, i) => {
        const row = h.index + 2 + i
        if (r.every((c) => text(c) === '')) return
        const rawClass = text(r[h.col('Class')])
        const rawGroup = text(r[h.col('Group (Class 11–12 only)')])
        if (!rawClass && !rawGroup) return // totals row
        const std = rawClass ? classKey(rawClass) : stageOf(lastStd || '1') === 'HSS' ? lastStd : null
        if (!std) { err(SHEETS.students, rawClass ? `Unknown class "${rawClass}".` : 'Class is missing.', row, 'Class'); return }
        lastStd = std
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
