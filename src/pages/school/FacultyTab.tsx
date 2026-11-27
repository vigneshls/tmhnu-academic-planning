import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORY_LABEL } from '../../engine/rules'
import { teacherLoad } from '../../engine/timetable'
import type { Category, RuleSet, SchoolData } from '../../engine/types'
import { isTeachingCategory } from '../../engine/types'
import { downloadCsv } from '../../lib/csv'
import { LABEL } from '../../lib/facultyExcel'
import { Badge, Button, Card, Empty, cx, inputCls } from '../../ui/kit'

export default function FacultyTab({ rules, data, isAdmin, schoolId }: { rules: RuleSet; data: SchoolData; isAdmin: boolean; schoolId: string }) {
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<Category | ''>('')
  const staff = data.staff
  const inTT = useMemo(() => (data.timetable ? teacherLoad(data.timetable) : null), [data.timetable])
  const counts = useMemo(() => {
    const m = new Map<Category, number>()
    for (const s of staff) m.set(s.category, (m.get(s.category) ?? 0) + 1)
    return [...m].sort((a, b) => b[1] - a[1])
  }, [staff])
  const shown = staff.filter((s) => (!cat || s.category === cat) && (!q || `${s.name} ${s.employeeId ?? ''} ${s.subjects.join(' ')}`.toLowerCase().includes(q.toLowerCase())))

  if (!staff.length)
    return <Empty title="No faculty on record">{isAdmin ? <>Import the school workbook from <Link className="text-[#0f2744] underline" to={`/admin/import?school=${schoolId}`}>Data Import</Link>.</> : 'Management loads the faculty list from the school workbook.'}</Empty>

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <button onClick={() => setCat('')} className={cx('rounded-full border px-3 py-1 text-xs', !cat ? 'border-[#0f2744] bg-[#0f2744] text-white' : 'border-slate-300 bg-white text-slate-700')}>All · {staff.length}</button>
        {counts.map(([c, n]) => (
          <button key={c} onClick={() => setCat(cat === c ? '' : c)} className={cx('rounded-full border px-3 py-1 text-xs', cat === c ? 'border-[#0f2744] bg-[#0f2744] text-white' : 'border-slate-300 bg-white text-slate-700')}>{CATEGORY_LABEL[c]} · {n}</button>
        ))}
      </div>
      <Card pad={false} title={`${shown.length} staff`} subtitle={data.staffUpdatedAt ? `Last loaded ${new Date(data.staffUpdatedAt).toLocaleDateString()}${isAdmin ? '' : ' by management'}` : undefined}
        actions={<>
          <input aria-label="Search faculty" placeholder="Search name, ID or subject" className={`${inputCls} w-64`} value={q} onChange={(e) => setQ(e.target.value)} />
          <Button onClick={() => downloadCsv('faculty.csv', [
            ['Employee ID', 'Name', 'Designation', 'Subjects', 'Highest Qualification', 'Professional Qualification', 'TET', 'Appointment', 'Date of Joining', 'Experience', 'CPD Hours'],
            ...staff.map((s) => [s.employeeId ?? '', s.name, s.designation ?? CATEGORY_LABEL[s.category], s.subjects.join('; '), LABEL.highest[s.highestQualification ?? ''], LABEL.prof[s.professionalQualification ?? ''], LABEL.tet[s.tet ?? ''], LABEL.appt[s.appointment ?? ''], s.dateOfJoining ?? '', s.experienceYears ?? '', s.cpdHours ?? '']),
          ])}>Export CSV</Button>
          {isAdmin && <Link to={`/admin/import?school=${schoolId}`} className="rounded-lg bg-[#0f2744] px-3.5 py-2 text-sm font-medium text-white">Update via workbook</Link>}
        </>}>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">ID</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Subjects</th><th className="px-4 py-3">Qualification</th><th className="px-4 py-3">TET</th><th className="px-4 py-3">Appointment</th><th className="px-4 py-3 text-right">Exp.</th><th className="px-4 py-3 text-right">CPD h</th><th className="px-4 py-3 text-right">Max / wk</th>{inTT && <th className="px-4 py-3 text-right" title="Periods in the current timetable, including changes made by hand">In timetable</th>}</tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-t border-slate-100 hover:bg-slate-50/60">
                  <td className="px-4 py-2.5 text-slate-500">{s.employeeId ?? '—'}</td>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{s.name}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.designation ?? CATEGORY_LABEL[s.category]}</td>
                  <td className="px-4 py-2.5 text-slate-700">{s.subjects.join(', ') || '—'}</td>
                  <td className="px-4 py-2.5 text-slate-700">{LABEL.highest[s.highestQualification ?? '']}{s.professionalQualification ? <span className="text-slate-400"> · {LABEL.prof[s.professionalQualification]}</span> : ''}</td>
                  <td className="px-4 py-2.5">{s.tet === 'NOT_PASSED' ? <Badge tone="critical">Not passed</Badge> : <span className="text-slate-700">{LABEL.tet[s.tet ?? '']}</span>}</td>
                  <td className="px-4 py-2.5">{s.appointment === 'CONTRACT' || s.appointment === 'PART_TIME' ? <Badge tone="high">{LABEL.appt[s.appointment]}</Badge> : <span className="text-slate-700">{LABEL.appt[s.appointment ?? '']}</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{s.experienceYears ?? '—'}</td>
                  <td className={cx('px-4 py-2.5 text-right tabular-nums', s.cpdHours !== undefined && s.cpdHours < 50 && 'text-amber-700')}>{s.cpdHours ?? '—'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{isTeachingCategory(s.category) ? (s.maxPerWeek ?? rules.workload[s.category].max) : '—'}</td>
                  {inTT && <td className="px-4 py-2.5 text-right tabular-nums">{inTT.get(s.id) ?? 0}</td>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  )
}
