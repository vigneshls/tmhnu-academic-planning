import { useMemo, useState } from 'react'
import { generateTimetable, teacherLoad, validateTimetable } from '../../engine/timetable'
import { busyAt, clearCell, lessonsFor, placeLesson, setTeacher, swapCells, swapClashes, typeCell } from '../../engine/ttEdit'
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
  const [editing, setEditing] = useState(false)
  const [sel, setSel] = useState<[number, number] | null>(null)
  const [undo, setUndo] = useState<TimetableResult[]>([])
  const [note, setNote] = useState<{ ok: boolean; text: string } | null>(null)

  /** Save an edited timetable, keep the old one for Undo, and report any rule it now breaks */
  const apply = (next: TimetableResult, what: string) => {
    if (!tt) return
    const before = new Set(validateTimetable(rules, tt))
    const added = validateTimetable(rules, next).filter((v) => !before.has(v))
    setUndo((u) => [...u.slice(-29), tt])
    onChange({ ...data, timetable: next })
    setSel(null)
    setNote(added.length ? { ok: false, text: `${what} — but it breaks: ${added.slice(0, 3).join('; ')}. Use Undo if this was not intended.` } : { ok: true, text: `${what}.` })
  }
  const secId = selSection || tt?.sections[0]?.id || ''
  const onCell = (d: number, p: number) => {
    if (!tt || !editing) return
    if (!sel) { setSel([d, p]); setNote(null); return }
    if (sel[0] === d && sel[1] === p) { setSel(null); return }
    const g = tt.grid[secId]
    if (!g[sel[0]][sel[1]] && !g[d][p]) { setSel([d, p]); return }
    apply(swapCells(tt, secId, sel, [d, p]), `Swapped ${DAY_NAMES[sel[0]]} P${sel[1] + 1} and ${DAY_NAMES[d]} P${p + 1}`)
  }

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
        setUndo([])
        setSel(null)
        setNote(null)
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
              <select aria-label="Section" className="rounded border px-2 py-2 text-sm" value={selSection || tt.sections[0]?.id} onChange={(e) => { setSelSection(e.target.value); setSel(null) }}>
                {tt.sections.map((s) => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
            )}
            {view === 'teacher' && (
              <select aria-label="Teacher" className="rounded border px-2 py-2 text-sm" value={selTeacher || tt.teachers[0]?.id} onChange={(e) => setSelTeacher(e.target.value)}>
                {tt.teachers.map((t) => <option key={t.id} value={t.id}>{t.vacancy ? '⚠ ' : ''}{t.name}</option>)}
              </select>
            )}
            {view === 'class' && (
              <button className={`rounded border px-3 py-2 text-sm ${editing ? 'border-[#0f2744] bg-[#0f2744] text-white' : ''}`} onClick={() => { setEditing(!editing); setSel(null); setNote(null) }}>
                {editing ? 'Done editing' : 'Edit timetable'}
              </button>
            )}
            {undo.length > 0 && (
              <button className="rounded border px-3 py-2 text-sm" onClick={() => { const prev = undo[undo.length - 1]; setUndo(undo.slice(0, -1)); onChange({ ...data, timetable: prev }); setSel(null); setNote({ ok: true, text: 'Last change undone.' }) }}>
                Undo ({undo.length})
              </button>
            )}
            <button className="rounded border px-3 py-2 text-sm" onClick={() => window.print()}>Print / PDF</button>
            <button className="rounded border px-3 py-2 text-sm" onClick={() => exportCsv(tt)}>Export CSV</button>
          </>
        )}
      </div>
      {err && <p role="alert" className="text-sm text-red-600">{err}</p>}
      {!tt && <p className="text-sm text-slate-500">Uses the staff list from tab 3. Missing teachers are filled with “Vacancy” placeholders so you can still see the full timetable.</p>}
      {tt && <Status tt={tt} rules={rules} stale={stale} />}
      {tt && view === 'class' && editing && (
        <p className="no-print rounded border border-sky-200 bg-sky-50 p-2 text-sm text-sky-900">
          Click a period, then another period of this class to swap them (or click an empty period to move it there). Green = no clash, red = a teacher is busy elsewhere then.
          Changes are kept with the school data — press <b>Save changes</b> at the top when done.
        </p>
      )}
      {note && <p className={`no-print rounded border p-2 text-sm ${note.ok ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{note.text}</p>}
      {tt && view === 'class' && <ClassGrid tt={tt} rules={rules} sectionId={secId} title={school.name} editing={editing} sel={sel} onCell={onCell} />}
      {tt && view === 'class' && editing && sel && <CellEditor tt={tt} sectionId={secId} d={sel[0]} p={sel[1]} apply={apply} close={() => setSel(null)} />}
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

function ClassGrid({ tt, rules, sectionId, title, editing, sel, onCell }: { tt: TimetableResult; rules: RuleSet; sectionId: string; title: string; editing?: boolean; sel?: [number, number] | null; onCell?: (d: number, p: number) => void }) {
  const sec = tt.sections.find((s) => s.id === sectionId)
  if (!sec) return null
  // when a period is selected, mark every other period as a safe or clashing swap target
  const target = (d: number, p: number): '' | 'ok' | 'clash' => {
    if (!editing || !sel || (sel[0] === d && sel[1] === p)) return ''
    if (!tt.grid[sectionId][sel[0]][sel[1]] && !tt.grid[sectionId][d][p]) return ''
    return swapClashes(tt, sectionId, sel, [d, p]).length ? 'clash' : 'ok'
  }
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
                    <td
                      key={h.p}
                      onClick={onCell ? () => onCell(d, h.p) : undefined}
                      className={[
                        c ? colorFor(c.subject) : 'bg-red-50',
                        editing ? 'cursor-pointer select-none hover:brightness-95' : '',
                        sel && sel[0] === d && sel[1] === h.p ? 'outline outline-2 -outline-offset-2 outline-[#0f2744]' : '',
                        target(d, h.p) === 'ok' ? 'shadow-[inset_0_0_0_2px_#10b981]' : target(d, h.p) === 'clash' ? 'shadow-[inset_0_0_0_2px_#ef4444]' : '',
                      ].join(' ')}
                    >
                      {c ? (<><div className="font-medium">{c.subject}{c.edited && <span title="Changed by hand" className="ml-1 text-[10px] text-slate-500">✎</span>}</div><div className={`text-[10px] ${t?.vacancy ? 'text-red-600' : 'text-slate-600'}`}>{ts.map((x) => x?.name).join(' / ')}</div></>) : <span className="text-red-500">—</span>}
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

function CellEditor({ tt, sectionId, d, p, apply, close }: { tt: TimetableResult; sectionId: string; d: number; p: number; apply: (n: TimetableResult, what: string) => void; close: () => void }) {
  const c = tt.grid[sectionId][d][p]
  const slot = `${DAY_NAMES[d] ?? `D${d + 1}`} P${p + 1}`
  const teachers = [...tt.teachers].sort((a, b) => a.name.localeCompare(b.name))
  const todo = lessonsFor(tt, sectionId)
  return (
    <div className="no-print space-y-3 rounded-lg border bg-white p-3 text-sm" key={`${sectionId}-${d}-${p}`}>
      <div className="flex items-center justify-between gap-2">
        <b>{slot}: {c ? c.subject : 'empty period'}</b>
        <button className="rounded border px-2 py-1 text-xs" onClick={close}>Close</button>
      </div>
      {c ? (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Teacher for this period</span>
            <select
              className="rounded border px-2 py-2"
              value={c.teacherId ?? ''}
              onChange={(e) => {
                const id = e.target.value || null
                const name = tt.teachers.find((x) => x.id === id)?.name ?? 'no teacher'
                apply(setTeacher(tt, sectionId, d, p, id), `${slot} ${c.subject} given to ${name}`)
              }}
            >
              <option value="">— no teacher —</option>
              {teachers.map((t) => {
                const busy = t.id === c.teacherId ? [] : busyAt(tt, [t.id], d, p, sectionId)
                return <option key={t.id} value={t.id}>{t.name}{busy.length ? ` — busy in ${busy[0].section}` : t.id === c.teacherId ? '' : ' — free'}</option>
              })}
            </select>
          </label>
          <button className="rounded border border-red-200 px-3 py-2 text-red-700" onClick={() => apply(clearCell(tt, sectionId, d, p), `${slot} ${c.subject} removed (now listed as not placed)`)}>Remove period</button>
          <span className="text-xs text-slate-500">To move it, click another period in the grid.</span>
        </div>
      ) : null}
      <TypeRow tt={tt} sectionId={sectionId} d={d} p={p} slot={slot} apply={apply} />
      {c ? null : (
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1">
            <span className="text-xs text-slate-500">Put a subject here</span>
            <select
              className="rounded border px-2 py-2"
              defaultValue=""
              onChange={(e) => {
                const x = todo.find((y) => y.lesson.id === e.target.value)
                if (x) apply(placeLesson(tt, sectionId, d, p, x.lesson), `${x.lesson.subject} placed in ${slot}`)
              }}
            >
              <option value="" disabled>Choose…</option>
              {todo.map(({ lesson, missing }) => {
                const t = tt.teachers.find((y) => y.id === lesson.teacherId)
                const busy = busyAt(tt, [lesson.teacherId, ...(lesson.coTeacherIds ?? [])].filter((x): x is string => !!x), d, p, sectionId)
                return <option key={lesson.id} value={lesson.id}>{lesson.subject}{t ? ` (${t.name})` : ''}{missing ? ` — ${missing} not placed` : ' — extra period'}{busy.length ? ` — teacher busy in ${busy[0].section}` : ''}</option>
              })}
            </select>
          </label>
        </div>
      )}
    </div>
  )
}

/** Type a subject and teacher for this period (suggestions from the class's subjects and the faculty list) */
function TypeRow({ tt, sectionId, d, p, slot, apply }: { tt: TimetableResult; sectionId: string; d: number; p: number; slot: string; apply: (n: TimetableResult, what: string) => void }) {
  const c = tt.grid[sectionId][d][p]
  const [subject, setSubject] = useState(c?.subject ?? '')
  const [teacher, setTeacher] = useState(c?.teacherId ? (tt.teachers.find((t) => t.id === c.teacherId)?.name ?? '') : '')
  const [err, setErr] = useState('')
  const subjects = [...new Set(tt.lessons.filter((l) => l.sectionId === sectionId).map((l) => l.subject))].sort()
  const real = tt.teachers.filter((t) => !t.vacancy).sort((a, b) => a.name.localeCompare(b.name))
  const found = teacher.trim() ? tt.teachers.find((t) => t.name.trim().toLowerCase() === teacher.trim().toLowerCase()) : undefined
  const busy = found ? busyAt(tt, [found.id], d, p, sectionId) : []
  const go = () => {
    if (!subject.trim()) return setErr('Type a subject.')
    if (teacher.trim() && !found) return setErr(`“${teacher}” is not in the faculty list — pick a name from the suggestions or leave it blank.`)
    setErr('')
    apply(typeCell(tt, sectionId, d, p, subject, found?.id ?? null), `${slot}: ${subject.trim()}${found ? ` — ${found.name}` : ''} typed in`)
  }
  return (
    <form className="flex flex-wrap items-end gap-3 border-t pt-3" onSubmit={(e) => { e.preventDefault(); go() }}>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Type subject</span>
        <input className="w-48 rounded border px-2 py-2" list={`subj-${sectionId}`} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="e.g. Maths" />
        <datalist id={`subj-${sectionId}`}>{subjects.map((x) => <option key={x} value={x} />)}</datalist>
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs text-slate-500">Type teacher</span>
        <input className="w-56 rounded border px-2 py-2" list="tt-teachers" value={teacher} onChange={(e) => setTeacher(e.target.value)} placeholder="Start typing a name" />
        <datalist id="tt-teachers">{real.map((t) => <option key={t.id} value={t.name} />)}</datalist>
      </label>
      <button className="rounded bg-[#0f2744] px-3 py-2 text-white">Apply</button>
      {found && <span className={`text-xs ${busy.length ? 'text-red-600' : 'text-emerald-700'}`}>{busy.length ? `busy in ${busy[0].section} at this time` : 'free at this time'}</span>}
      {err && <span className="w-full text-xs text-red-600">{err}</span>}
    </form>
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
