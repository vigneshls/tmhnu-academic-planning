import { useState } from 'react'
import type { Analysis } from '../../data/analyse'
import { CLASS_TEACHER } from '../../engine/calc'
import type { Area, Recommendation, Severity } from '../../engine/recommend'
import { CATEGORY_LABEL } from '../../engine/rules'
import type { School, SchoolData } from '../../engine/types'
import { Badge, Button, Card, Kpi, NeedBars, ScoreRing, cx } from '../../ui/kit'

const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Advisory' }

export function RecCard({ r }: { r: Recommendation }) {
  const ext = r.source.url.startsWith('http')
  return (
    <article className={cx('rounded-xl border bg-white p-4', r.status === 'pass' ? 'border-slate-200' : { critical: 'border-red-200', high: 'border-amber-200', medium: 'border-sky-200', low: 'border-slate-200' }[r.severity])}>
      <div className="flex flex-wrap items-center gap-2">
        <Badge tone={r.status === 'pass' ? 'pass' : r.severity}>{r.status === 'pass' ? 'Compliant' : SEV_LABEL[r.severity]}</Badge>
        <span className="text-xs text-slate-500">{r.area}</span>
      </div>
      <h3 className="mt-2 font-semibold text-slate-900">{r.title}</h3>
      <p className="mt-1 text-sm text-slate-600">{r.finding}</p>
      {r.status === 'fail' && (
        <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
          <span className="font-medium text-slate-900">Recommended action: </span><span className="text-slate-700">{r.action}</span>
        </div>
      )}
      {r.people && r.people.length > 0 && (
        <details className="mt-2 text-sm">
          <summary className="cursor-pointer text-[#0f2744]">{r.people.length} staff member(s)</summary>
          <p className="mt-1 text-slate-600">{r.people.join(', ')}</p>
        </details>
      )}
      <p className="mt-3 text-xs text-slate-500">
        Basis: {ext ? <a className="text-[#0f2744] underline decoration-slate-300 underline-offset-2" href={r.source.url} target="_blank" rel="noopener noreferrer">{r.source.title}</a> : r.source.title}
        {r.source.ref && <> — {r.source.ref}</>}{r.source.note && <span className="italic"> ({r.source.note})</span>}
      </p>
    </article>
  )
}

export default function OverviewTab({ school, data, a, goTo }: { school: School; data: SchoolData; a: Analysis; goTo: (t: 'staffing' | 'compliance' | 'faculty') => void }) {
  const [filter, setFilter] = useState<'issues' | 'all' | 'passed'>('issues')
  const [area, setArea] = useState<Area | ''>('')
  const { score: sc, summary: s, recs, demand } = a
  const areas = [...new Set(recs.map((r) => r.area))]
  const shown = recs.filter((r) => (filter === 'all' || (filter === 'issues' ? r.status === 'fail' : r.status === 'pass')) && (!area || r.area === area))
  const byArea = areas.map((ar) => ({ ar, fail: recs.filter((r) => r.area === ar && r.status === 'fail').length, total: recs.filter((r) => r.area === ar).length }))
  const bars = demand.filter((d) => d.needed > 0 || d.available > 0).sort((x, y) => (x.gap - y.gap) || y.needed - x.needed).slice(0, 10)
    .map((d) => ({ label: d.subject === CLASS_TEACHER ? 'Class teachers' : d.subject, sub: CATEGORY_LABEL[d.category], needed: d.needed, available: d.available }))
  const ptr = s.ptr

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <div className="flex items-center gap-5">
            <ScoreRing pct={sc.pct} label="Checks passed" />
            <div>
              <div className="text-sm font-medium text-slate-500">Checks passed</div>
              <div className="text-sm text-slate-700">{sc.pass} of {sc.total} verifiable checks</div>
              <div className="mt-3 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                {(['critical', 'high', 'medium', 'low'] as Severity[]).map((k) => (
                  <button key={k} onClick={() => { setFilter('issues'); setArea('') }} className="flex items-center gap-2 text-left">
                    <span className={cx('h-2 w-2 rounded-full', { critical: 'bg-red-500', high: 'bg-amber-500', medium: 'bg-sky-500', low: 'bg-slate-400' }[k])} />
                    <span className="text-slate-600">{SEV_LABEL[k]}</span><b className="ml-auto tabular-nums text-slate-900">{sc[k]}</b>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </Card>
        <div className="grid grid-cols-2 gap-4 lg:col-span-2 lg:grid-cols-3">
          <Kpi label="Students" value={s.students} hint={`Boys ${s.boys6to12} · Girls ${s.girls6to12} (Class 6–12)`} />
          <Kpi label="Sections" value={s.sections} hint={`${data.genderSeparate ? 'Separate' : 'Mixed'} boys/girls from Class 6`} />
          <Kpi label="Pupil–teacher ratio" value={ptr ? `${ptr}:1` : '—'} hint={school.board === 'CBSE' ? 'CBSE limit 30:1' : 'RTE 30:1 (1–5), 35:1 (6–8)'} tone={ptr && ptr > 30 ? 'warn' : 'default'} />
          <Kpi label="Teachers needed" value={s.needed} hint="Subject-wise, at planning load" />
          <Kpi label="Teachers available" value={s.available} hint={`${data.staff.length} staff on record`} />
          <Kpi label="Teacher shortage" value={s.shortage} tone={s.shortage ? 'bad' : 'good'} hint={s.shortage ? 'See Staffing' : 'All subjects covered'} />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-5">
        <Card title="Teacher requirement by subject" subtitle="Largest gaps first" className="lg:col-span-3" actions={<Button variant="ghost" onClick={() => goTo('staffing')}>Full table →</Button>}>
          {bars.length ? <NeedBars rows={bars} /> : <p className="text-sm text-slate-500">Enter student strength to calculate requirements.</p>}
        </Card>
        <Card title="Status by area" className="lg:col-span-2">
          <ul className="space-y-3">
            {byArea.map(({ ar, fail, total }) => (
              <li key={ar}>
                <button className="w-full text-left" onClick={() => { setArea(ar); setFilter('all') }}>
                  <div className="flex items-center text-sm"><span className="text-slate-700">{ar}</span><span className={cx('ml-auto text-xs font-semibold', fail ? 'text-red-700' : 'text-emerald-700')}>{fail ? `${fail} to act on` : 'All clear'}</span></div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100"><div className={cx('h-1.5 rounded-full', fail ? 'bg-amber-500' : 'bg-emerald-600')} style={{ width: `${((total - fail) / Math.max(1, total)) * 100}%` }} /></div>
                </button>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <section>
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold text-slate-900">Recommendations</h2>
          <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {([['issues', 'Action required'], ['passed', 'Compliant'], ['all', 'All']] as const).map(([k, l]) => (
              <button key={k} onClick={() => setFilter(k)} className={cx('rounded-md px-3 py-1', filter === k ? 'bg-[#0f2744] text-white' : 'text-slate-600')}>{l}</button>
            ))}
          </div>
          <select aria-label="Area" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm" value={area} onChange={(e) => setArea(e.target.value as Area | '')}>
            <option value="">All areas</option>{areas.map((x) => <option key={x}>{x}</option>)}
          </select>
          <Button onClick={() => window.print()}>Print report</Button>
        </div>
        {shown.length === 0 ? <p className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-500">Nothing to show for this filter.</p> : (
          <div className="grid gap-3 xl:grid-cols-2">{shown.map((r) => <RecCard key={r.id} r={r} />)}</div>
        )}
      </section>
      <p className="text-xs text-slate-500">Recommendations are generated from the school’s data and the cited regulations as summarised by the linked sources. They support, and do not replace, the school’s reading of the current official notifications.</p>
    </div>
  )
}
