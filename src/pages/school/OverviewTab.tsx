import { useMemo, useState } from 'react'
import type { SchoolSummary } from '../../engine/calc'
import { checklist, score, type Area, type Recommendation, type Severity } from '../../engine/recommend'
import { BOARD_LABEL } from '../../engine/rules'
import type { School, SchoolData } from '../../engine/types'

const SEV: Record<Severity, string> = {
  critical: 'bg-red-50 text-red-800 border-red-200',
  high: 'bg-amber-50 text-amber-800 border-amber-200',
  medium: 'bg-sky-50 text-sky-800 border-sky-200',
  low: 'bg-slate-50 text-slate-700 border-slate-200',
}
const SEV_LABEL: Record<Severity, string> = { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Advisory' }

function SourceLink({ r }: { r: Pick<Recommendation, 'source'> }) {
  const ext = r.source.url.startsWith('http')
  return (
    <span className="text-xs text-slate-500">
      Basis:{' '}
      {ext ? <a className="text-[#1f3a5f] underline" href={r.source.url} target="_blank" rel="noopener noreferrer">{r.source.title}</a> : <span>{r.source.title}</span>}
      {r.source.ref && <> — {r.source.ref}</>}
      {r.source.note && <span className="italic"> ({r.source.note})</span>}
    </span>
  )
}

export default function OverviewTab({ school, data, summary, recs, onChange, userName }: { school: School; data: SchoolData; summary: SchoolSummary; recs: Recommendation[]; onChange: (d: SchoolData) => void; userName: string }) {
  const [filter, setFilter] = useState<'issues' | 'all' | 'passed'>('issues')
  const [area, setArea] = useState<Area | ''>('')
  const sc = score(recs)
  const areas = [...new Set(recs.map((r) => r.area))]
  const shown = recs.filter((r) => (filter === 'all' ? true : filter === 'issues' ? r.status === 'fail' : r.status === 'pass') && (!area || r.area === area))
  const items = useMemo(() => checklist(school.board), [school.board])
  const done = items.filter((i) => data.compliance?.[i.id]?.done).length
  const toggle = (id: string, v: boolean) =>
    onChange({ ...data, compliance: { ...(data.compliance ?? {}), [id]: { done: v, date: v ? new Date().toISOString().slice(0, 10) : undefined, by: v ? userName : undefined, note: data.compliance?.[id]?.note } } })
  const note = (id: string, v: string) => onChange({ ...data, compliance: { ...(data.compliance ?? {}), [id]: { ...(data.compliance?.[id] ?? { done: false }), note: v.slice(0, 200) } } })

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <div className="col-span-2 rounded-lg border border-slate-200 bg-white p-4">
          <div className="text-xs text-slate-500">Checks passed</div>
          <div className="text-3xl font-semibold text-slate-900">{sc.pct}%</div>
          <div className="mt-2 h-2 rounded bg-slate-100"><div className="h-2 rounded bg-[#1f3a5f]" style={{ width: `${sc.pct}%` }} /></div>
          <div className="mt-1 text-xs text-slate-500">{sc.pass} of {sc.total} verifiable checks · {BOARD_LABEL[school.board]}</div>
        </div>
        {(['critical', 'high', 'medium', 'low'] as Severity[]).map((s) => (
          <div key={s} className={`rounded-lg border p-4 ${SEV[s]}`}>
            <div className="text-xs">{SEV_LABEL[s]}</div>
            <div className="text-2xl font-semibold">{sc[s]}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        {([['Students', summary.students], ['Sections', summary.sections], ['Teachers needed (subject-wise)', summary.needed], ['Teachers available', summary.available]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white p-3"><div className="text-xs text-slate-500">{k}</div><div className="text-xl font-semibold">{v}</div></div>
        ))}
      </div>

      <section>
        <div className="no-print mb-3 flex flex-wrap items-center gap-2">
          <h2 className="mr-auto text-lg font-semibold text-slate-900">Recommendations</h2>
          <select aria-label="Show" className="rounded border border-slate-300 bg-white px-2 py-1 text-sm" value={filter} onChange={(e) => setFilter(e.target.value as typeof filter)}>
            <option value="issues">Action required</option><option value="passed">Compliant</option><option value="all">All checks</option>
          </select>
          <select aria-label="Area" className="rounded border border-slate-300 bg-white px-2 py-1 text-sm" value={area} onChange={(e) => setArea(e.target.value as Area | '')}>
            <option value="">All areas</option>{areas.map((a) => <option key={a}>{a}</option>)}
          </select>
          <button className="rounded border border-slate-300 bg-white px-3 py-1 text-sm" onClick={() => window.print()}>Print report</button>
        </div>
        <div className="space-y-2">
          {shown.length === 0 && <p className="rounded border border-slate-200 bg-white p-4 text-sm text-slate-500">Nothing to show for this filter.</p>}
          {shown.map((r) => (
            <article key={r.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="flex flex-wrap items-start gap-2">
                <span className={`rounded border px-2 py-0.5 text-xs font-medium ${r.status === 'pass' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : SEV[r.severity]}`}>
                  {r.status === 'pass' ? 'Compliant' : SEV_LABEL[r.severity]}
                </span>
                <span className="rounded bg-slate-100 px-2 py-0.5 text-xs text-slate-600">{r.area}</span>
                <h3 className="w-full font-medium text-slate-900 md:w-auto">{r.title}</h3>
              </div>
              <p className="mt-2 text-sm text-slate-700">{r.finding}</p>
              {r.status === 'fail' && <p className="mt-1 text-sm"><span className="font-medium text-slate-900">Action: </span>{r.action}</p>}
              {r.people && r.people.length > 0 && (
                <details className="mt-1 text-sm">
                  <summary className="cursor-pointer text-[#1f3a5f]">{r.people.length} staff member(s)</summary>
                  <p className="mt-1 text-slate-600">{r.people.join(', ')}</p>
                </details>
              )}
              <div className="mt-2"><SourceLink r={r} /></div>
            </article>
          ))}
        </div>
      </section>

      <section className="print-break">
        <div className="mb-3 flex items-center">
          <h2 className="text-lg font-semibold text-slate-900">Compliance to maintain</h2>
          <span className="ml-auto text-sm text-slate-500">{done} of {items.length} confirmed</span>
        </div>
        <p className="mb-3 text-sm text-slate-500">These cannot be verified from staffing data. The school confirms each item; the date and person are recorded. Click “Save changes” after updating.</p>
        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
          <table className="w-full text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
              <tr><th className="w-10 p-3">Done</th><th className="p-3">Requirement</th><th className="p-3">Area</th><th className="p-3">Frequency</th><th className="p-3">Confirmed</th><th className="p-3">Note</th></tr>
            </thead>
            <tbody>
              {items.map((i) => {
                const e = data.compliance?.[i.id]
                return (
                  <tr key={i.id} className="border-t border-slate-100 align-top">
                    <td className="p-3"><input aria-label={`Confirm: ${i.title}`} type="checkbox" checked={!!e?.done} onChange={(ev) => toggle(i.id, ev.target.checked)} /></td>
                    <td className="p-3"><div>{i.title}</div><div className="mt-1"><SourceLink r={i} /></div></td>
                    <td className="p-3 text-slate-600">{i.area}</td>
                    <td className="p-3 text-slate-600">{i.frequency}</td>
                    <td className="p-3 text-xs text-slate-500">{e?.done ? `${e.date}${e.by ? ' · ' + e.by : ''}` : '—'}</td>
                    <td className="p-3"><input aria-label="Note" className="w-48 rounded border border-slate-300 px-2 py-1 text-xs" maxLength={200} value={e?.note ?? ''} onChange={(ev) => note(i.id, ev.target.value)} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-xs text-slate-500">
        Recommendations are generated from the data entered and the cited regulations as summarised by the sources linked. They support, and do not replace, the school’s reading of the current official notifications.
      </p>
    </div>
  )
}
