import { Fragment, useState } from 'react'
import type { SchoolSummary } from '../../engine/calc'
import { CATEGORY_LABEL } from '../../engine/rules'
import type { Staffing } from '../../engine/staffing'
import type { RuleSet } from '../../engine/types'
import { downloadCsv } from '../../lib/csv'
import { Badge, Button, Card, Kpi, cx } from '../../ui/kit'

const TONE = { deficit: 'critical', excess: 'medium', ok: 'pass' } as const
const WORD = { deficit: 'Deficit', excess: 'Excess', ok: 'Balanced' } as const
const f1 = (x: number) => (Number.isInteger(x) ? String(x) : x.toFixed(1))

export default function StaffingTab({ rules, staffing: s, summary }: { rules: RuleSet; staffing: Staffing; summary: SchoolSummary }) {
  const [open, setOpen] = useState<string | null>(null)
  const capNote = (lvl: string) => `${lvl === 'Pre-primary' ? 'Pre-primary' : 'Classes 1–5'} cap ${lvl === 'Pre-primary' ? rules.sectionCap.PRE : rules.sectionCap.PRIMARY}`
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="Teachers required" value={s.requiredPosts} hint={`at ${s.load} periods/week (TGT), ${s.pgtLoad} (PGT)`} />
        <Kpi label="Teaching staff" value={summary.available} />
        <Kpi label="Deficit (posts)" value={s.deficitPosts} tone={s.deficitPosts ? 'bad' : 'good'} />
        <Kpi label="Excess (posts)" value={s.excessPosts} tone={s.excessPosts ? 'warn' : 'default'} />
      </div>

      <Card title="Class teachers — Pre-KG to Class 5" subtitle={`One class teacher per section run. 'If cap enforced' = sections needed when no section exceeds ${rules.sectionCap.PRIMARY} students; each extra section needs one more class teacher.`} pad={false}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Level</th><th className="px-4 py-3 text-right">Sections run</th><th className="px-4 py-3 text-right">If cap enforced</th><th className="px-4 py-3 text-right">Required</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Teachers</th></tr>
          </thead>
          <tbody>
            {s.classTeachers.map((c) => (
              <tr key={c.level} className="border-t border-slate-100">
                <td className="px-4 py-2.5 font-medium text-slate-900">{c.level}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.sections}</td>
                <td className="px-4 py-2.5 text-right tabular-nums" title={capNote(c.level)}>{c.atCap}{c.atCap > c.sections && <span className="ml-1 text-xs text-red-600">(+{c.atCap - c.sections})</span>}</td>
                <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{c.required}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{c.available}</td>
                <td className="px-4 py-2.5"><Badge tone={c.gap < 0 ? 'critical' : c.gap > 0 ? 'medium' : 'pass'}>{c.gap < 0 ? `Deficit ${-c.gap}` : c.gap > 0 ? `Excess ${c.gap}` : 'Balanced'}</Badge></td>
                <td className="px-4 py-2.5 text-xs text-slate-600">{c.names.join(', ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card
        title="Subject teachers — Classes 6 to 12"
        subtitle={`Required = periods in the Subject Periods sheet ÷ policy target load (Classes 1–10: ${s.load}, Classes 11–12: ${s.pgtLoad} periods per teacher). Coordinators count as part-time (max ${rules.workload.ACAD_HEAD.max}). Click a row for details.`}
        actions={<Button onClick={() => downloadCsv('subject-staffing.csv', [['Subject', 'Periods 1-5', 'Periods 6-10', 'Periods 11-12', 'Required', 'Available', 'Gap', 'Status', 'Teachers', 'Notes'], ...s.families.map((f) => [f.label, f.periods['1-5'], f.periods['6-10'], f.periods['11-12'], f.required, f.available, f.gap, WORD[f.status], f.teachers.map((t) => t.name).join('; '), f.notes.join(' ')])])}>Export CSV</Button>}
        pad={false}
      >
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 bg-slate-50/60 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-4 py-3">Subject</th><th className="px-4 py-3 text-right">Periods 1–5*</th><th className="px-4 py-3 text-right">6–10</th><th className="px-4 py-3 text-right">11–12</th><th className="px-4 py-3 text-right">Required</th><th className="px-4 py-3 text-right">Available</th><th className="px-4 py-3 text-right">Gap</th><th className="px-4 py-3">Status</th></tr>
          </thead>
          <tbody>
            {s.families.map((f) => (
              <Fragment key={f.family}>
                <tr className="cursor-pointer border-t border-slate-100 hover:bg-slate-50/60" onClick={() => setOpen(open === f.family ? null : f.family)}>
                  <td className="px-4 py-2.5 font-medium text-slate-900">{open === f.family ? '▾' : '▸'} {f.label}{f.notes.length > 0 && <span className="ml-2 text-xs text-amber-600">⚠ {f.notes.length}</span>}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{f.periods['1-5'] || '–'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{f.periods['6-10'] || '–'}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-slate-500">{f.periods['11-12'] || '–'}</td>
                  <td className="px-4 py-2.5 text-right font-semibold tabular-nums">{f1(f.required)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{f1(f.available)}</td>
                  <td className={cx('px-4 py-2.5 text-right font-semibold tabular-nums', f.status === 'deficit' ? 'text-red-600' : f.status === 'excess' ? 'text-amber-600' : 'text-emerald-700')}>{f.gap > 0 ? '+' : ''}{f1(f.gap)}</td>
                  <td className="px-4 py-2.5"><Badge tone={TONE[f.status]}>{WORD[f.status]}</Badge></td>
                </tr>
                {open === f.family && (
                  <tr className="bg-slate-50/60">
                    <td colSpan={8} className="px-8 py-3 text-sm text-slate-700">
                      <div><b>Teachers of this subject:</b> {f.teachers.length ? f.teachers.map((t) => `${t.name} (${CATEGORY_LABEL[t.category].split(' (')[0]}${t.fte < 1 ? `, ${f1(t.fte)}` : ''})`).join(', ') : 'none'}</div>
                      {f.notes.map((x, i) => <div key={i} className="mt-1 text-amber-800">• {x}</div>)}
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
          </tbody>
        </table>
        <p className="border-t border-slate-100 px-4 py-3 text-xs text-slate-500">
          * Classes 1–5 periods here are only those taken by subject teachers (e.g. Hindi, Computer, PET); class-teacher periods are counted above.
          Deficit when at least half a teacher is missing; excess when a full teacher is spare.
          {s.other.length > 0 && <> Activity periods not tied to a subject ({s.other.slice(0, 8).map((o) => `${o.subject} ${o.periods}`).join(', ')}) are shared by the section’s teachers.</>}
        </p>
      </Card>
    </div>
  )
}
