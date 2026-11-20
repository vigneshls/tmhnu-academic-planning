import { useMemo, useRef, useState } from 'react'
import templateUrl from '../../assets/faculty-template.xlsx?url'
import { CATEGORY_LABEL } from '../../engine/rules'
import type { Category, RuleSet, SchoolData, Staff } from '../../engine/types'
import { isTeachingCategory } from '../../engine/types'
import { downloadCsv } from '../../lib/csv'
import { LABEL, parseFacultyRows, type Cell, type ParseResult } from '../../lib/facultyExcel'

const MAX_BYTES = 5 * 1024 * 1024

export default function FacultyTab({ rules, data, isAdmin, onSave }: { rules: RuleSet; data: SchoolData; isAdmin: boolean; onSave: (s: Staff[]) => Promise<void> }) {
  const [preview, setPreview] = useState<(ParseResult & { file: string }) | null>(null)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | ''>('')
  const fileRef = useRef<HTMLInputElement>(null)
  const staff = data.staff

  const counts = useMemo(() => {
    const m = new Map<Category, number>()
    for (const s of staff) m.set(s.category, (m.get(s.category) ?? 0) + 1)
    return m
  }, [staff])

  const shown = staff.filter((s) => (!cat || s.category === cat) && (!q || `${s.name} ${s.employeeId ?? ''} ${s.subjects.join(' ')}`.toLowerCase().includes(q.toLowerCase())))

  const onFile = async (f: File | undefined) => {
    setMsg('')
    setPreview(null)
    if (!f) return
    if (!/\.xlsx$/i.test(f.name)) { setMsg('Please choose an .xlsx file (use the template).'); return }
    if (f.size > MAX_BYTES) { setMsg('File is larger than 5 MB.'); return }
    setBusy(true)
    try {
      const { readSheet } = await import('read-excel-file/browser')
      let rows: Cell[][]
      try { rows = (await readSheet(f, 'Faculty')) as Cell[][] } catch { rows = (await readSheet(f)) as Cell[][] }
      setPreview({ ...parseFacultyRows(rows, `st-${Date.now().toString(36)}`), file: f.name })
    } catch (e) {
      setMsg(`Could not read the file: ${(e as Error).message}`)
    } finally {
      setBusy(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }

  const apply = async () => {
    if (!preview) return
    setBusy(true)
    try {
      await onSave(preview.staff)
      setMsg(`Faculty list replaced with ${preview.staff.length} record(s) from ${preview.file}.`)
      setPreview(null)
    } catch (e) {
      setMsg(`Upload failed: ${(e as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="space-y-5">
      {isAdmin ? (
        <section className="rounded-lg border border-slate-200 bg-white p-4">
          <h2 className="font-semibold text-slate-900">Upload faculty details</h2>
          <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm text-slate-600">
            <li>Download the template and send it to the school.</li>
            <li>The school fills one row per staff member (drop-down lists guide each column).</li>
            <li>Upload the completed file here, review the check results, then confirm. The new list replaces the current one.</li>
          </ol>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" href={templateUrl} download="Faculty-Template.xlsx">Download template (.xlsx)</a>
            <label className={`cursor-pointer rounded px-3 py-1.5 text-sm text-white ${busy ? 'bg-slate-400' : 'bg-[#1f3a5f]'}`}>
              {busy ? 'Reading…' : 'Upload completed Excel'}
              <input ref={fileRef} type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only" disabled={busy} onChange={(e) => void onFile(e.target.files?.[0])} />
            </label>
            {msg && <span role="status" className="text-sm text-slate-700">{msg}</span>}
          </div>

          {preview && (
            <div className="mt-4 rounded border border-slate-200">
              <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-slate-50 p-3 text-sm">
                <b>{preview.file}</b>
                <span className="text-emerald-700">{preview.staff.length} valid row(s)</span>
                <span className={preview.errors.length ? 'text-red-700' : 'text-slate-500'}>{preview.errors.length} row(s) rejected</span>
                <span className={preview.warnings.length ? 'text-amber-700' : 'text-slate-500'}>{preview.warnings.length} warning(s)</span>
                <div className="ml-auto flex gap-2">
                  <button className="rounded border border-slate-300 bg-white px-3 py-1" onClick={() => setPreview(null)}>Cancel</button>
                  <button disabled={!preview.staff.length || busy} className="rounded bg-[#1f3a5f] px-3 py-1 text-white disabled:bg-slate-300" onClick={() => void apply()}>
                    Replace faculty list ({preview.staff.length})
                  </button>
                </div>
              </div>
              {(preview.errors.length > 0 || preview.warnings.length > 0) && (
                <div className="max-h-64 overflow-auto">
                  <table className="w-full text-sm">
                    <thead className="text-left text-slate-500"><tr><th className="p-2">Row</th><th className="p-2">Type</th><th className="p-2">Column</th><th className="p-2">Message</th></tr></thead>
                    <tbody>
                      {[...preview.errors.map((e) => ({ ...e, t: 'Rejected' })), ...preview.warnings.map((w) => ({ ...w, t: 'Warning' }))].sort((a, b) => a.row - b.row).map((x, i) => (
                        <tr key={i} className="border-t border-slate-100">
                          <td className="p-2">{x.row}</td>
                          <td className={`p-2 ${x.t === 'Rejected' ? 'text-red-700' : 'text-amber-700'}`}>{x.t}</td>
                          <td className="p-2">{x.column ?? '—'}</td>
                          <td className="p-2">{x.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </section>
      ) : (
        <p className="rounded border border-slate-200 bg-white p-3 text-sm text-slate-600">The faculty list is maintained by management. Contact management to correct any record.</p>
      )}

      <div className="flex flex-wrap gap-2 text-xs">
        {[...counts].map(([c, k]) => (
          <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={`rounded border px-2 py-1 ${cat === c ? 'border-[#1f3a5f] bg-[#1f3a5f] text-white' : 'border-slate-300 bg-white text-slate-700'}`}>
            {CATEGORY_LABEL[c]}: {k}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <input aria-label="Search faculty" placeholder="Search name, ID or subject" className="w-72 rounded border border-slate-300 px-3 py-1.5 text-sm" value={q} onChange={(e) => setQ(e.target.value)} />
        <span className="text-sm text-slate-500">{shown.length} of {staff.length} shown{data.staffUpdatedAt ? ` · last uploaded ${new Date(data.staffUpdatedAt).toLocaleDateString()}` : ''}</span>
        <button className="ml-auto rounded border border-slate-300 bg-white px-3 py-1.5 text-sm" onClick={() => downloadCsv('faculty.csv', [
          ['Employee ID', 'Name', 'Designation', 'Subjects', 'Highest Qualification', 'Professional Qualification', 'TET', 'Appointment', 'Date of Joining', 'Experience', 'CPD Hours'],
          ...staff.map((s) => [s.employeeId ?? '', s.name, CATEGORY_LABEL[s.category], s.subjects.join('; '), LABEL.highest[s.highestQualification ?? ''], LABEL.prof[s.professionalQualification ?? ''], LABEL.tet[s.tet ?? ''], LABEL.appt[s.appointment ?? ''], s.dateOfJoining ?? '', s.experienceYears ?? '', s.cpdHours ?? '']),
        ])}>Export CSV</button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr><th className="p-2">ID</th><th className="p-2">Name</th><th className="p-2">Designation</th><th className="p-2">Subjects</th><th className="p-2">Qualification</th><th className="p-2">Professional</th><th className="p-2">TET</th><th className="p-2">Appointment</th><th className="p-2 text-right">Exp. (yrs)</th><th className="p-2 text-right">CPD h</th><th className="p-2 text-right">Max/week</th></tr>
          </thead>
          <tbody>
            {shown.map((s) => (
              <tr key={s.id} className="border-t border-slate-100">
                <td className="p-2 text-slate-500">{s.employeeId ?? '—'}</td>
                <td className="p-2 font-medium">{s.name}</td>
                <td className="p-2">{CATEGORY_LABEL[s.category]}</td>
                <td className="p-2">{s.subjects.join(', ') || '—'}</td>
                <td className="p-2">{LABEL.highest[s.highestQualification ?? '']}</td>
                <td className="p-2">{LABEL.prof[s.professionalQualification ?? '']}</td>
                <td className={`p-2 ${s.tet === 'NOT_PASSED' ? 'text-red-700' : ''}`}>{LABEL.tet[s.tet ?? '']}</td>
                <td className="p-2">{LABEL.appt[s.appointment ?? '']}</td>
                <td className="p-2 text-right">{s.experienceYears ?? '—'}</td>
                <td className={`p-2 text-right ${s.cpdHours !== undefined && s.cpdHours < 50 ? 'text-amber-700' : ''}`}>{s.cpdHours ?? '—'}</td>
                <td className="p-2 text-right text-slate-500">{isTeachingCategory(s.category) ? (s.maxPerWeek ?? rules.workload[s.category].max) : '—'}</td>
              </tr>
            ))}
            {staff.length === 0 && <tr><td colSpan={11} className="p-6 text-center text-slate-500">No faculty uploaded yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
