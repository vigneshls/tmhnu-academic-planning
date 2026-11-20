import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { analyse } from '../../data/analyse'
import { store } from '../../data/store'
import { effectiveRules } from '../../engine/effective'
import { checklist } from '../../engine/recommend'
import { BOARD_LABEL, defaultRuleSet } from '../../engine/rules'
import type { Board, RuleSet, School, SchoolData } from '../../engine/types'
import type { Cell } from '../../lib/facultyExcel'
import { parseWorkbook, type WorkbookData } from '../../lib/workbook/parse'
import { SHEETS } from '../../lib/workbook/spec'
import { Badge, Button, Card, Icon, Kpi, PageHeader, cx } from '../../ui/kit'

const MAX_BYTES = 8 * 1024 * 1024

async function download(school: School, rules: RuleSet, data: SchoolData, prefill: boolean) {
  const [{ default: ExcelJS }, { buildWorkbook }] = await Promise.all([import('exceljs'), import('../../lib/workbook/build')])
  const buf = await buildWorkbook(ExcelJS, { school, rules: effectiveRules(rules, data), data, checklist: checklist(school.board), prefill })
  const url = URL.createObjectURL(new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }))
  const a = document.createElement('a')
  a.href = url
  a.download = `${school.name.replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${prefill ? 'Current-Data' : 'Data-Workbook'}.xlsx`
  a.click()
  URL.revokeObjectURL(url)
}

function buildNext(cur: SchoolData, p: WorkbookData): SchoolData {
  return {
    ...cur,
    strength: p.strength,
    hss: p.hss,
    cwsn: p.cwsn,
    staff: p.staff ?? cur.staff,
    genderSeparate: p.genderSeparate ?? cur.genderSeparate,
    profile: p.profile,
    overrides: { daysPerWeek: p.daysPerWeek, periodsPerDay: p.periodsPerDay, lunchAfterPeriod: p.lunchAfterPeriod, subjectsByStandard: p.subjectsByStandard, hssGroups: p.hssGroups },
    compliance: { ...(cur.compliance ?? {}), ...p.compliance },
    timetable: undefined,
    source: 'import',
  }
}

export default function AdminImport() {
  const [params, setParams] = useSearchParams()
  const [schools, setSchools] = useState<School[]>([])
  const [rules, setRules] = useState<Record<Board, RuleSet> | null>(null)
  const [current, setCurrent] = useState<SchoolData | null>(null)
  const [parsed, setParsed] = useState<(WorkbookData & { file: string }) | null>(null)
  const [busy, setBusy] = useState('')
  const [msg, setMsg] = useState('')
  const [done, setDone] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const schoolId = params.get('school') ?? schools[0]?.id ?? ''
  const school = schools.find((s) => s.id === schoolId)

  useEffect(() => { void Promise.all([store.listSchools(), store.getRules('MATRIC'), store.getRules('CBSE')]).then(([s, m, c]) => { setSchools(s); setRules({ MATRIC: m, CBSE: c, STATE: m }) }) }, [])
  useEffect(() => { setParsed(null); setDone(false); setMsg(''); if (schoolId) void store.getSchoolData(schoolId).then(setCurrent) }, [schoolId])

  const onFile = async (f?: File) => {
    setMsg(''); setParsed(null); setDone(false)
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) return setMsg('Choose the .xlsx workbook downloaded from this page.')
    if (f.size > MAX_BYTES) return setMsg('File is larger than 8 MB.')
    setBusy('Reading workbook…')
    try {
      const { default: readXlsxFile } = await import('read-excel-file/browser')
      const sheets = (await readXlsxFile(f)) as { sheet: string; data: Cell[][] }[]
      setParsed({ ...parseWorkbook(sheets, (b) => rules?.[b] ?? defaultRuleSet(b)), file: f.name })
    } catch (e) {
      setMsg(`Could not read the file: ${(e as Error).message}`)
    } finally {
      setBusy('')
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const preview = useMemo(() => {
    if (!parsed || !school || !current || !rules) return null
    const nextSchool: School = { ...school, name: parsed.schoolName ?? school.name, board: parsed.board ?? school.board }
    const next = buildNext(current, parsed)
    return { nextSchool, next, before: analyse(school, rules[school.board], current), after: analyse(nextSchool, rules[nextSchool.board], next) }
  }, [parsed, school, current, rules])

  const errors = parsed?.issues.filter((i) => i.level === 'error') ?? []
  const warnings = parsed?.issues.filter((i) => i.level === 'warning') ?? []

  return (
    <>
      <PageHeader eyebrow="Administration" title="Data Import" subtitle="Load a school's complete data from its workbook. Recommendations update automatically." />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <label className="text-sm font-medium text-slate-700" htmlFor="imp-school">School</label>
        <select id="imp-school" className="min-w-80 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" value={schoolId} onChange={(e) => setParams({ school: e.target.value })}>
          {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        {school && <Badge tone="info">{BOARD_LABEL[school.board]}</Badge>}
      </div>

      {school && current && rules && (
        <div className="grid gap-6 lg:grid-cols-3">
          <Card title="Step 1 · Send the workbook" subtitle="The school fills it and returns it.">
            <ol className="mb-4 space-y-2 text-sm text-slate-600">
              <li><b className="text-slate-800">School Profile</b> — details and daily timetable structure</li>
              <li><b className="text-slate-800">Students</b> — boys, girls, CWSN by class and group</li>
              <li><b className="text-slate-800">Faculty</b> — one row per staff member</li>
              <li><b className="text-slate-800">Subject Periods</b> — pre-filled board model, edit to actual</li>
              <li><b className="text-slate-800">Compliance</b> — Yes / No / N.A. with expiry dates</li>
            </ol>
            <div className="flex flex-col gap-2">
              <Button variant="primary" disabled={!!busy} onClick={async () => { setBusy('Preparing workbook…'); try { await download(school, rules[school.board], current, false) } finally { setBusy('') } }}>{Icon.download} Blank workbook for this school</Button>
              <Button disabled={!!busy} onClick={async () => { setBusy('Preparing workbook…'); try { await download(school, rules[school.board], current, true) } finally { setBusy('') } }}>{Icon.download} Current data as workbook (to edit)</Button>
            </div>
            <p className="mt-3 text-xs text-slate-500">Drop-down lists and checks are built into the file. No phone, Aadhaar, bank or salary data is collected.</p>
          </Card>

          <Card title="Step 2 · Upload the filled workbook" className="lg:col-span-2">
            <label className={cx('flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-10 text-center', busy ? 'border-slate-200 bg-slate-50' : 'border-slate-300 hover:border-[#0f2744] hover:bg-slate-50')}
              onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void onFile(e.dataTransfer.files[0]) }}>
              <span className="text-slate-400">{Icon.upload}</span>
              <span className="mt-2 font-medium text-slate-800">{busy || 'Choose the workbook or drop it here'}</span>
              <span className="text-xs text-slate-500">.xlsx · up to 8 MB</span>
              <input ref={fileRef} type="file" accept=".xlsx" className="sr-only" disabled={!!busy} onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            {msg && <p role="alert" className="mt-3 text-sm text-red-700">{msg}</p>}
            {parsed && (
              <div className="mt-5 space-y-4">
                <div className="flex flex-wrap items-center gap-3 text-sm">
                  <b className="text-slate-800">{parsed.file}</b>
                  <Badge tone={errors.length ? 'critical' : 'pass'}>{errors.length} error(s)</Badge>
                  <Badge tone={warnings.length ? 'high' : 'neutral'}>{warnings.length} warning(s)</Badge>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {[
                    [SHEETS.profile, parsed.schoolName ? 'Read' : 'Missing'],
                    [SHEETS.students, `${Object.values(parsed.strength).reduce((a, c) => a + c.boys + c.girls, 0) + Object.values(parsed.hss).flatMap((g) => Object.values(g)).reduce((a, c) => a + c.boys + c.girls, 0)} students`],
                    [SHEETS.faculty, `${parsed.staff?.length ?? 0} staff`],
                    [SHEETS.subjects, parsed.subjectsByStandard ? `${Object.keys(parsed.subjectsByStandard).length + (parsed.hssGroups?.length ?? 0)} classes / groups` : 'Board default'],
                    [SHEETS.compliance, `${Object.keys(parsed.compliance).length} answered`],
                  ].map(([s, v]) => {
                    const n = parsed.issues.filter((i) => i.sheet === s && i.level === 'error').length
                    return (
                      <div key={s} className={cx('rounded-lg border p-3', n ? 'border-red-200 bg-red-50' : 'border-slate-200 bg-slate-50')}>
                        <div className="text-xs text-slate-500">{s}</div>
                        <div className="text-sm font-semibold text-slate-800">{v}</div>
                        {n > 0 && <div className="text-xs text-red-700">{n} error(s)</div>}
                      </div>
                    )
                  })}
                </div>
                {parsed.issues.length > 0 && (
                  <div className="max-h-72 overflow-auto rounded-lg border border-slate-200">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-3 py-2">Sheet</th><th className="px-3 py-2">Row</th><th className="px-3 py-2">Column</th><th className="px-3 py-2">Issue</th></tr></thead>
                      <tbody>
                        {[...errors, ...warnings].map((i, k) => (
                          <tr key={k} className="border-t border-slate-100">
                            <td className="px-3 py-2 whitespace-nowrap">{i.sheet}</td><td className="px-3 py-2">{i.row ?? '—'}</td><td className="px-3 py-2">{i.column ?? '—'}</td>
                            <td className={cx('px-3 py-2', i.level === 'error' ? 'text-red-700' : 'text-amber-800')}>{i.level === 'error' ? 'Error: ' : ''}{i.message}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </Card>

          {preview && (
            <Card title="Step 3 · Review and apply" className="lg:col-span-3"
              actions={done ? <Link to={`/school/${preview.nextSchool.id}`} className="rounded-lg bg-[#0f2744] px-3.5 py-2 text-sm font-medium text-white">Open school dashboard →</Link> : (
                <Button variant="primary" disabled={errors.length > 0 || !!busy} onClick={async () => {
                  setBusy('Applying…')
                  try { await store.importSchool(preview.nextSchool, preview.next); setDone(true); setSchools(await store.listSchools()); setCurrent(preview.next) } catch (e) { setMsg((e as Error).message) } finally { setBusy('') }
                }}>{errors.length ? 'Fix errors to apply' : 'Apply import'}</Button>
              )}>
              {done && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">Imported. The school’s dashboard and recommendations now use this data. Re-generate the timetable from the school page.</p>}
              {(preview.nextSchool.name !== school.name || preview.nextSchool.board !== school.board) && (
                <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2.5 text-sm text-amber-900">The workbook changes the school {preview.nextSchool.name !== school.name ? `name to “${preview.nextSchool.name}”` : ''}{preview.nextSchool.name !== school.name && preview.nextSchool.board !== school.board ? ' and ' : ''}{preview.nextSchool.board !== school.board ? `board to ${BOARD_LABEL[preview.nextSchool.board]}` : ''}.</p>
              )}
              <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
                {([
                  ['Students', preview.before.summary.students, preview.after.summary.students],
                  ['Sections', preview.before.summary.sections, preview.after.summary.sections],
                  ['Staff on record', current.staff.length, preview.next.staff.length],
                  ['Teachers needed', preview.before.summary.needed, preview.after.summary.needed],
                  ['Shortage', preview.before.summary.shortage, preview.after.summary.shortage],
                  ['Checks passed', `${preview.before.score.pct}%`, `${preview.after.score.pct}%`],
                ] as const).map(([k, a, b]) => <Kpi key={k} label={k} value={b} hint={`before: ${a}`} tone={k === 'Shortage' && Number(b) > 0 ? 'bad' : 'default'} />)}
              </div>
            </Card>
          )}
        </div>
      )}
    </>
  )
}
