import { Fragment, useMemo, useState } from 'react'
import { teacherLoads } from '../../engine/allocationChecks'
import { CATEGORY_LABEL, effectiveLimits } from '../../engine/rules'
import { teacherLoad } from '../../engine/timetable'
import type { RuleSet, SchoolData, Section } from '../../engine/types'
import { isTeachingCategory } from '../../engine/types'
import { downloadCsv } from '../../lib/csv'
import { Badge, Button, Card, Kpi, cx } from '../../ui/kit'

export default function AllocationTab({ rules, data, sections }: { rules: RuleSet; data: SchoolData; sections: Section[] }) {
  const [view, setView] = useState<'teachers' | 'classes'>('teachers')
  const [open, setOpen] = useState<string | null>(null)
  const allocs = data.allocations ?? []
  const loads = useMemo(() => teacherLoads(allocs), [allocs])
  const name = useMemo(() => new Map(data.staff.map((s) => [s.id, s.name])), [data.staff])
  // periods each teacher has in the current timetable, including changes made by hand
  const inTT = useMemo(() => (data.timetable ? teacherLoad(data.timetable) : null), [data.timetable])

  const rows = data.staff
    .filter((s) => isTeachingCategory(s.category))
    .map((s) => {
      const w = rules.workload[s.category]
      const lim = effectiveLimits(rules, w)
      const p = loads.get(s.id)?.periods ?? 0
      const status = p === 0 ? 'unused' : p > w.max ? 'over' : p > lim.perWeek ? 'tight' : p < w.min && !['PRINCIPAL', 'ACAD_HEAD'].includes(s.category) ? 'under' : 'ok'
      return { s, p, care: loads.get(s.id)?.care ?? 0, w, status, items: loads.get(s.id)?.items ?? [], tt: inTT ? (inTT.get(s.id) ?? 0) : null }
    })
    .sort((a, b) => b.p - a.p)
  const total = allocs.filter((a) => !a.care).reduce((a, x) => a + x.periods, 0)
  const careTotal = allocs.filter((a) => a.care).reduce((a, x) => a + x.periods, 0)
  const named = allocs.filter((a) => a.mode === 'named').reduce((a, x) => a + x.periods, 0)
  const count = (st: string) => rows.filter((r) => r.status === st).length
  const STATUS: Record<string, [string, 'critical' | 'high' | 'medium' | 'low' | 'pass']> = {
    over: ['Above policy max', 'critical'], tight: ['Above schedulable', 'high'], under: ['Below policy min', 'medium'], unused: ['No periods', 'low'], ok: ['Within policy', 'pass'],
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        <Kpi label="Teaching periods / week" value={total} hint={`${named} with a named teacher${careTotal ? ` · ${careTotal} supervision periods not counted` : ''}`} />
        <Kpi label="Above policy max" value={count('over')} tone={count('over') ? 'bad' : 'good'} />
        <Kpi label="Above schedulable" value={count('tight')} tone={count('tight') ? 'warn' : 'default'} />
        <Kpi label="Below policy min" value={count('under')} />
        <Kpi label="No periods allocated" value={count('unused')} tone={count('unused') ? 'warn' : 'default'} />
      </div>

      <div className="flex items-center gap-2">
        <div className="flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
          {([['teachers', 'By teacher'], ['classes', 'By class']] as const).map(([k, l]) => (
            <button key={k} onClick={() => setView(k)} className={cx('rounded-md px-3 py-1', view === k ? 'bg-[#0f2744] text-white' : 'text-slate-600')}>{l}</button>
          ))}
        </div>
        <Button className="ml-auto" onClick={() => downloadCsv('teacher-allocation.csv', [['Teacher', 'Designation', 'Teaching periods', 'Supervision periods', 'In timetable', 'Policy min', 'Policy max', 'Status', 'Allocation'], ...rows.map((r) => [r.s.name, r.s.designation ?? CATEGORY_LABEL[r.s.category], r.p, r.care, r.tt ?? '', r.w.min, r.w.max, STATUS[r.status][0], r.items.join(' | ')])])}>Export CSV</Button>
      </div>

      {view === 'teachers' ? (
        <Card pad={false} title="Teacher workload" subtitle={`From the Subject Periods sheet · policy ranges from the TMHNU workload policy · schedulable = what ${rules.daysPerWeek} days × ${rules.periodsPerDay} periods allow under the continuous-period rule`}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-4 py-3">Teacher</th><th className="px-4 py-3">Designation</th><th className="px-4 py-3">Load</th><th className="px-4 py-3 text-right">Periods</th>{inTT && <th className="px-4 py-3 text-right" title="Periods in the current timetable, including changes made by hand">In timetable</th>}<th className="px-4 py-3 text-right">Policy</th><th className="px-4 py-3">Status</th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <Fragment key={r.s.id}>
                  <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/60" onClick={() => setOpen(open === r.s.id ? null : r.s.id)}>
                    <td className="px-4 py-2.5 font-medium text-slate-900">{open === r.s.id ? '▾' : '▸'} {r.s.name}</td>
                    <td className="px-4 py-2.5 text-slate-600">{r.s.designation ?? CATEGORY_LABEL[r.s.category]}</td>
                    <td className="w-48 px-4 py-2.5">
                      <div className="relative h-2 rounded-full bg-slate-100">
                        <div className="absolute h-2 rounded-full bg-emerald-100" style={{ left: `${(r.w.min / 48) * 100}%`, width: `${((r.w.max - r.w.min) / 48) * 100}%` }} />
                        <div className={cx('absolute h-2 rounded-full', r.status === 'over' ? 'bg-red-500' : r.status === 'tight' ? 'bg-amber-500' : 'bg-[#0f2744]')} style={{ width: `${Math.min(100, (r.p / 48) * 100)}%` }} />
                      </div>
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{r.p}{r.care ? <span className="ml-1 text-xs font-normal text-slate-400">+{r.care} sup.</span> : null}</td>
                    {inTT && <td className={cx('px-4 py-2.5 text-right tabular-nums', r.tt !== r.p + r.care && 'font-semibold text-amber-700')} title={r.tt !== r.p + r.care ? 'Differs from the planned allocation' : undefined}>{r.tt}</td>}
                    <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{r.w.min}–{r.w.max}</td>
                    <td className="px-4 py-2.5"><Badge tone={STATUS[r.status][1]}>{STATUS[r.status][0]}</Badge></td>
                  </tr>
                  {open === r.s.id && (
                    <tr className="bg-slate-50/60"><td colSpan={6} className="px-8 py-3 text-sm text-slate-600">{r.items.length ? r.items.join(' · ') : 'No periods allocated.'}</td></tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.filter((s) => s.allocs).map((sec) => {
            const sum = sec.weekPeriods ?? sec.allocs!.reduce((a, x) => a + x.periods, 0)
            const slots = rules.daysPerWeek * rules.periodsPerDay
            return (
              <Card key={sec.id} title={`Class ${sec.label}`} subtitle={`${sec.strength} students${sec.allocs?.[0]?.copiedFrom ? ` · section added for the student count — subjects and teachers copied from section ${sec.allocs[0].copiedFrom}` : ''}`} actions={<Badge tone={sum > slots ? 'critical' : sum < slots ? 'medium' : 'pass'}>{sum}/{slots} periods</Badge>} pad={false}>
                <table className="w-full text-sm">
                  <tbody>
                    {sec.allocs!.map((a, i) => (
                      <tr key={i} className="border-t border-slate-100 first:border-t-0">
                        <td className="px-4 py-2 text-slate-800">
                          {a.subject}
                          {a.option && <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-[11px] text-indigo-700">{a.option === a.subject ? 'Elective' : `Elective: ${a.option}`} · with {a.replaces?.join(' + ')}</span>}
                          {a.care && <span className="ml-2 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600">Supervision</span>}
                        </td>
                        <td className="px-4 py-2 text-right tabular-nums text-slate-500">{a.periods}</td>
                        <td className="px-4 py-2">
                          {a.mode === 'named' ? a.teachers.map((id) => name.get(id)).join(', ') : a.mode === 'shared' ? <span className="text-slate-500">{a.autoShared ? 'Any section teacher' : 'Subject Wise'}</span> : <Badge tone="high">No teacher{a.unmatched?.length ? `: ${a.unmatched.join(', ')}` : ''}</Badge>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
