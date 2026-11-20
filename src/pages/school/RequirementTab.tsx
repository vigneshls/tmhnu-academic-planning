import { Fragment } from 'react'
import type { SchoolSummary } from '../../engine/calc'
import { CATEGORY_LABEL, effectiveLimits } from '../../engine/rules'
import type { Category, DemandRow, RuleSet, Section } from '../../engine/types'
import { downloadCsv } from '../../lib/csv'

export default function RequirementTab({ rules, sections, demand, summary }: { rules: RuleSet; sections: Section[]; demand: DemandRow[]; summary: SchoolSummary }) {
  const cats = [...new Set(demand.map((d) => d.category))] as Category[]
  const capped = (Object.keys(rules.workload) as Category[])
    .map((c) => ({ c, w: rules.workload[c], e: effectiveLimits(rules, rules.workload[c]) }))
    .filter((x) => x.e.perWeek < x.w.max)

  return (
    <div className="space-y-6">
      <ul className="space-y-1 text-sm">
        {summary.checks.map((c, i) => (
          <li key={i} className={c.ok ? 'text-emerald-700' : 'text-red-600'}>{c.ok ? '✓' : '✗'} {c.text}</li>
        ))}
      </ul>

      {capped.length > 0 && (
        <div className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          <b>Rule conflict:</b> with {rules.periodsPerDay} periods/day, lunch after period {rules.lunchAfterPeriod} and max {rules.maxConsecutive} continuous periods,
          a teacher can take at most {effectiveLimits(rules, rules.workload.TGT).perDay} periods/day.
          {' '}{capped.map((x) => `${CATEGORY_LABEL[x.c]}: policy max ${x.w.max} → schedulable ${x.e.perWeek}/week`).join('; ')}.
          {' '}Calculations use the schedulable limit. Change it under Board Rules.
        </div>
      )}

      <div>
        <h3 className="mb-2 font-semibold">Standard-wise sections</h3>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left"><tr><th className="p-2">Standard</th><th className="p-2 text-right">Boys</th><th className="p-2 text-right">Girls</th><th className="p-2 text-right">Students</th><th className="p-2 text-right">Sections</th><th className="p-2">Section sizes</th></tr></thead>
            <tbody>
              {summary.perStandard.map((p) => (
                <tr key={p.standard} className="border-t">
                  <td className="p-2 font-medium">{p.standard === 'PREKG' ? 'Pre-KG' : p.standard}</td>
                  <td className="p-2 text-right">{Number(p.standard) >= 6 ? p.boys : '–'}</td>
                  <td className="p-2 text-right">{Number(p.standard) >= 6 ? p.girls : '–'}</td>
                  <td className="p-2 text-right">{p.students}</td>
                  <td className="p-2 text-right font-semibold">{p.sections}</td>
                  <td className="p-2 text-xs text-slate-500">{sections.filter((s) => s.standard === p.standard).map((s) => `${s.label.replace(/^\S+\s/, '')}: ${s.strength}`).join(' · ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-center">
          <h3 className="font-semibold">Teachers needed — subject-wise</h3>
          <button className="ml-auto rounded border px-3 py-1 text-sm" onClick={() => downloadCsv('teacher-requirement.csv', [['Category', 'Subject', 'Periods/week', 'Planning load', 'Needed', 'Available', 'Gap'], ...demand.map((d) => [CATEGORY_LABEL[d.category], d.subject, d.periods, d.target, d.needed, d.available, d.gap])])}>
            Export CSV
          </button>
        </div>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-slate-100 text-left"><tr><th className="p-2">Subject</th><th className="p-2 text-right">Periods / week</th><th className="p-2 text-right">Load per teacher</th><th className="p-2 text-right">Needed</th><th className="p-2 text-right">Available</th><th className="p-2 text-right">Gap</th></tr></thead>
            <tbody>
              {cats.map((c) => (
                <Fragment key={c}>
                  <tr className="border-t bg-slate-100"><td colSpan={6} className="p-2 font-semibold text-[#1f3a5f]">{CATEGORY_LABEL[c]}</td></tr>
                  {demand.filter((d) => d.category === c).map((d) => (
                    <tr key={d.key} className="border-t">
                      <td className="p-2">{d.subject}</td>
                      <td className="p-2 text-right">{d.periods}</td>
                      <td className="p-2 text-right">{d.target}</td>
                      <td className="p-2 text-right font-semibold">{d.needed}</td>
                      <td className="p-2 text-right">{d.available}</td>
                      <td className={`p-2 text-right font-semibold ${d.gap < 0 ? 'text-red-600' : d.gap > 0 ? 'text-amber-600' : 'text-emerald-700'}`}>{d.gap > 0 ? `+${d.gap}` : d.gap}</td>
                    </tr>
                  ))}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Needed = each section's subject taught by one teacher, packed up to the planning load. Pre-primary and Classes 1–5 get one class teacher per section.
          Available counts staff by category and main (first) subject. Negative gap = shortage, positive = surplus.
        </p>
      </div>
    </div>
  )
}
