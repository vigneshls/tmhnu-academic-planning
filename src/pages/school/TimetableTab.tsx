import { useMemo, useState } from 'react'
import { generateTimetable, teacherLoad, validateTimetable } from '../../engine/timetable'
import type { RuleSet, School, SchoolData, Section, TimetableResult } from '../../engine/types'
import { downloadCsv } from '../../lib/csv'

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

const COLORS = ['bg-sky-100', 'bg-emerald-100', 'bg-amber-100', 'bg-rose-100', 'bg-violet-100', 'bg-lime-100', 'bg-orange-100', 'bg-teal-100', 'bg-fuchsia-100', 'bg-cyan-100']
const colorFor = (subject: string) => COLORS[[...subject].reduce((a, c) => a + c.charCodeAt(0), 0) % COLORS.length]

export default function TimetableTab({ rules, school, data, sections, onChange }: { rules: RuleSet; school: School; data: SchoolData; sections: Section[]; onChange: (d: SchoolData) => void }) {
  const tt = data.timetable
  const [view, setView] = useState<'class' | 'teacher' | 'all'>('class')
  const [selSection, setSelSection] = useState('')
  const [selTeacher, setSelTeacher] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')

  const stale = useMemo(() => {
    if (!tt) return false
    const now = sections.map((s) => s.id + ':' + s.subjects.map((x) => x.subject + x.periods).join()).join('|')
    const then = tt.sections.map((s) => s.id + ':' + s.subjects.map((x) => x.subject + x.periods).join()).join('|')
    return now !== then || tt.days !== rules.daysPerWeek || tt.periods !== rules.periodsPerDay
  }, [tt, sections, rules])

  const generate = () => {
    setBusy(true)
    setErr('')
    setTimeout(() => {
      try {
        if (sections.length === 0) throw new Error('Enter student strength first.')
        const res = generateTimetable(rules, sections, data.staff, { seed: Date.now() % 100000 })
        onChange({ ...data, timetable: res })
        setSelSection(res.sections[0]?.id ?? '')
        setSelTeacher(res.teachers[0]?.id ?? '')
      } catch (e) {
        setErr((e as Error).message)
      } finally {
        setBusy(false)
      }
    }, 20)
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-center gap-2">
        <button disabled={busy} onClick={generate} className="rounded bg-[#0f2744] px-4 py-2 text-sm font-medium text-white">
          {busy ? 'Generating…' : tt ? 'Re-generate timetable' : 'Generate timetable'}
        </button>
        {tt && (
          <>
            <select aria-label="View" className="rounded border px-2 py-2 text-sm" value={view} onChange={(e) => setView(e.target.value as typeof view)}>
              <option value="class">Class-wise</option><option value="teacher">Teacher-wise</option><option value="all">All classes (print)</option>
            </select>
            {view === 'class' && (
              <select aria-label="Section" className="rounded border px-2 py-2 text-sm" value={selSection || tt.sections[0]?.id} onChange={(e) => setSelSection(e.target.value)}>
                {tt.sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
            {view === 'teacher' && (
              <select aria-label="Teacher" className="rounded border px-2 py-2 text-sm" value={selTeacher || tt.teachers[0]?.id} onChange={(e) => setSelTeacher(e.target.value)}>
                {tt.teachers.map((t) => <option key={t.id} value={t.id}>{t.vacancy ? '⚠ ' : ''}{t.name}</option>)}
              </select>
            )}
            <button className="rounded border px-3 py-2 text-sm" onClick={() => window.print()}>Print / PDF</button>
            <button className="rounded border px-3 py-2 text-sm" onClick={() => exportCsv(tt)}>Export CSV</button>
          </>
        )}
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {!tt && <p className="text-sm text-slate-500">Uses the staff list from tab 3. Missing teachers are filled with “Vacancy” placeholders so you can still see the full timetable.</p>}
      {tt && <Status tt={tt} rules={rules} stale={stale} />}
      {tt && view === 'class' && <ClassGrid tt={tt} rules={rules} sectionId={selSection || tt.sections[0]?.id} title={school.name} />}
      {tt && view === 'teacher' && <TeacherGrid tt={tt} rules={rules} teacherId={selTeacher || tt.teachers[0]?.id} title={school.name} />}
      {tt && view === 'all' && tt.sections.map((s) => <div key={s.id} className="print-break"><ClassGrid tt={tt} rules={rules} sectionId={s.id} title={school.name} /></div>)}
    </div>
  )
}

function Status({ tt, rules, stale }: { tt: TimetableResult; rules: RuleSet; stale: boolean }) {
  const violations = validateTimetable(rules, tt)
  const missing = tt.unplaced.reduce((a, u) => a + u.remaining, 0)
  const vac = tt.teachers.filter((t) => t.vacancy)
  return (
    <div className="no-print space-y-1 rounded border bg-white p-3 text-sm">
      {stale && <p className="text-amber-700">⚠ Strength or rules changed after this timetable was generated — re-generate.</p>}
      <p className={violations.length ? 'text-red-600' : 'text-emerald-700'}>
        {violations.length ? `✗ ${violations.length} rule violation(s): ${violations.slice(0, 3).join('; ')}` : `✓ All hard rules met (no clashes, max ${rules.maxConsecutive} continuous periods, daily/weekly limits)`}
      </p>
      <p className={missing ? 'text-red-600' : 'text-emerald-700'}>
        {missing ? `✗ ${missing} period(s) could not be placed: ${tt.unplaced.slice(0, 5).map((u) => { const l = tt.lessons.find((x) => x.id === u.lessonId); const sec = tt.sections.find((x) => x.id === l?.sectionId); const t = tt.teachers.find((x) => x.id === l?.teacherId); return `${sec?.label ?? ''} ${l?.subject ?? ''}${t ? ` (${t.name})` : ''} ×${u.remaining}` }).join(', ')}. The teacher has no free period left that matches the section; try Generate again or move one period to another teacher.` : '✓ Every subject got its full weekly periods'}
      </p>
      {vac.length > 0 && <p className="text-amber-700">⚠ {vac.length} vacancy placeholder(s): {vac.map((v) => v.name).join(', ')}</p>}
      <p className="text-xs text-slate-500">Generated {new Date(tt.generatedAt).toLocaleString()} · placement score {tt.softScore}</p>
    </div>
  )
}

function periodHeads(rules: RuleSet) {
  const heads: { p: number; label: string; after?: string }[] = []
  for (let p = 0; p < rules.periodsPerDay; p++) {
    let after: string | undefined
    if (p + 1 === rules.lunchAfterPeriod) after = 'Lunch'
    else if (rules.breaksAfter.includes(p + 1)) after = 'Break'
    heads.push({ p, label: `P${p + 1}`, after })
  }
  return heads
}

function ClassGrid({ tt, rules, sectionId, title }: { tt: TimetableResult; rules: RuleSet; sectionId: string; title: string }) {
  const sec = tt.sections.find((s) => s.id === sectionId)
  if (!sec) return null
  const tName = new Map(tt.teachers.map((t) => [t.id, t]))
  const heads = periodHeads(rules)
  return (
    <div className="rounded-lg border bg-white p-3">
      <h3 className="mb-2 font-semibold">{title} — {sec.label} <span className="text-sm font-normal text-slate-500">({sec.strength} students)</span></h3>
      <div className="overflow-x-auto">
        <table className="grid-table">
          <thead><tr><th>Day</th>{heads.map((h) => [<th key={h.p}>{h.label}</th>, h.after ? <th key={h.p + 'b'} className="w-4 text-[10px]">{h.after[0]}</th> : null])}</tr></thead>
          <tbody>
            {tt.grid[sec.id].map((row, d) => (
              <tr key={d}>
                <th>{DAY_NAMES[d] ?? `D${d + 1}`}</th>
                {heads.map((h) => {
                  const c = row[h.p]
                  const ts = c?.teacherId ? [c.teacherId, ...(c.coTeacherIds ?? [])].map((id) => tName.get(id)) : []
                  const t = ts[0] ?? null
                  return [
                    <td key={h.p} className={c ? colorFor(c.subject) : 'bg-red-50'}>
                      {c ? (<><div className="font-medium">{c.subject}</div><div className={`text-[10px] ${t?.vacancy ? 'text-red-600' : 'text-slate-600'}`}>{ts.map((x) => x?.name).join(' / ')}</div></>) : <span className="text-red-500">—</span>}
                    </td>,
                    h.after ? <td key={h.p + 'b'} className="bg-slate-100" /> : null,
                  ]
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function TeacherGrid({ tt, rules, teacherId, title }: { tt: TimetableResult; rules: RuleSet; teacherId: string; title: string }) {
  const t = tt.teachers.find((x) => x.id === teacherId)
  if (!t) return null
  const heads = periodHeads(rules)
  const load = teacherLoad(tt).get(t.id) ?? 0
  const at = (d: number, p: number) => {
    for (const s of tt.sections) {
      const c = tt.grid[s.id][d][p]
      if (c && (c.teacherId === t.id || c.coTeacherIds?.includes(t.id))) return { s, c }
    }
    return null
  }
  return (
    <div className="rounded-lg border bg-white p-3">
      <h3 className="mb-2 font-semibold">{title} — {t.name} <span className="text-sm font-normal text-slate-500">({load} periods/week · max {t.maxPerWeek}, {t.maxPerDay}/day)</span></h3>
      <div className="overflow-x-auto">
        <table className="grid-table">
          <thead><tr><th>Day</th>{heads.map((h) => [<th key={h.p}>{h.label}</th>, h.after ? <th key={h.p + 'b'} className="w-4 text-[10px]">{h.after[0]}</th> : null])}<th>Total</th></tr></thead>
          <tbody>
            {Array.from({ length: tt.days }, (_, d) => {
              let n = 0
              return (
                <tr key={d}>
                  <th>{DAY_NAMES[d] ?? `D${d + 1}`}</th>
                  {heads.map((h) => {
                    const x = at(d, h.p)
                    if (x) n++
                    return [
                      <td key={h.p} className={x ? colorFor(x.c.subject) : ''}>
                        {x ? (<><div className="font-medium">{x.s.label}</div><div className="text-[10px] text-slate-600">{x.c.subject}</div></>) : <span className="text-slate-300">free</span>}
                      </td>,
                      h.after ? <td key={h.p + 'b'} className="bg-slate-100" /> : null,
                    ]
                  })}
                  <td className="font-semibold">{n}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function exportCsv(tt: TimetableResult) {
  const tName = new Map(tt.teachers.map((t) => [t.id, t.name]))
  const rows: unknown[][] = [['Section', 'Day', ...Array.from({ length: tt.periods }, (_, p) => `P${p + 1}`)]]
  for (const s of tt.sections)
    tt.grid[s.id].forEach((row, d) => rows.push([s.label, DAY_NAMES[d] ?? d + 1, ...row.map((c) => (c ? `${c.subject}${c.teacherId ? ' / ' + [c.teacherId, ...(c.coTeacherIds ?? [])].map((id) => tName.get(id)).join(' + ') : ''}` : ''))]))
  downloadCsv('timetable.csv', rows)
}
