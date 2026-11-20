import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { analyse, type Analysis } from '../data/analyse'
import { store } from '../data/store'
import { BOARD_LABEL } from '../engine/rules'
import type { School, SchoolData } from '../engine/types'
import { Badge, Card, Empty, Kpi, PageHeader, ScoreRing } from '../ui/kit'

interface Row { school: School; a: Analysis; data: SchoolData }

export default function Dashboard() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    void (async () => {
      try {
        const schools = await store.listSchools()
        const out: Row[] = []
        for (const school of schools) {
          const [rules, data] = await Promise.all([store.getRules(school.board), store.getSchoolData(school.id)])
          out.push({ school, a: analyse(school, rules, data), data })
        }
        setRows(out)
      } catch (e) { setErr((e as Error).message) }
    })()
  }, [])

  if (err) return <p role="alert" className="text-red-700">{err}</p>
  if (!rows) return <p className="text-slate-500">Loading…</p>
  const t = rows.reduce((a, r) => ({ students: a.students + r.a.summary.students, staff: a.staff + r.data.staff.length, shortage: a.shortage + r.a.summary.shortage, critical: a.critical + r.a.score.critical }), { students: 0, staff: 0, shortage: 0, critical: 0 })

  return (
    <>
      <PageHeader eyebrow="Management" title="Institution overview" subtitle={`${rows.length} school${rows.length === 1 ? '' : 's'} · staffing and compliance at a glance`} />
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Students" value={t.students.toLocaleString()} />
        <Kpi label="Staff on record" value={t.staff} />
        <Kpi label="Teacher shortage" value={t.shortage} tone={t.shortage ? 'bad' : 'good'} />
        <Kpi label="Critical issues" value={t.critical} tone={t.critical ? 'bad' : 'good'} />
      </div>
      {rows.length === 0 ? <Empty title="No schools yet"><Link className="text-[#0f2744] underline" to="/admin/schools">Add a school</Link> to begin.</Empty> : (
        <div className="grid gap-5 xl:grid-cols-2">
          {rows.map(({ school, a, data }) => {
            const top = a.recs.filter((r) => r.status === 'fail').slice(0, 3)
            return (
              <Card key={school.id}>
                <div className="flex gap-5">
                  <ScoreRing pct={a.score.pct} size={96} label="Checks passed" />
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge tone="info">{BOARD_LABEL[school.board]}</Badge>
                      {data.source === 'sample' && <Badge tone="high">Sample data</Badge>}
                      {data.importedAt && <span className="text-xs text-slate-500">Imported {new Date(data.importedAt).toLocaleDateString()}</span>}
                    </div>
                    <Link to={`/school/${school.id}`} className="mt-1 block text-lg font-semibold leading-snug text-slate-900 hover:underline">{school.name}</Link>
                    <div className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-sm text-slate-600">
                      <span><b className="text-slate-900">{a.summary.students}</b> students</span>
                      <span><b className="text-slate-900">{a.summary.sections}</b> sections</span>
                      <span><b className="text-slate-900">{a.summary.available}</b>/{a.summary.needed} teachers</span>
                      <span className={a.score.critical ? 'text-red-700' : ''}><b>{a.score.critical}</b> critical</span>
                      <span className={a.score.high ? 'text-amber-700' : ''}><b>{a.score.high}</b> high</span>
                    </div>
                  </div>
                </div>
                {top.length > 0 && (
                  <ul className="mt-4 space-y-1.5 border-t border-slate-100 pt-4 text-sm">
                    {top.map((r) => <li key={r.id} className="flex gap-2"><Badge tone={r.severity}>{r.severity === 'low' ? 'Advisory' : r.severity[0].toUpperCase() + r.severity.slice(1)}</Badge><span className="truncate text-slate-700">{r.title}</span></li>)}
                  </ul>
                )}
                <div className="mt-4 flex gap-2 text-sm">
                  <Link to={`/school/${school.id}`} className="rounded-lg bg-[#0f2744] px-3 py-1.5 font-medium text-white">Open dashboard</Link>
                  <Link to={`/admin/import?school=${school.id}`} className="rounded-lg border border-slate-300 px-3 py-1.5 text-slate-700 hover:bg-slate-50">Import data</Link>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </>
  )
}
