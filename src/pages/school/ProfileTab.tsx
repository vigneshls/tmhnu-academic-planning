import { BOARD_LABEL } from '../../engine/rules'
import type { RuleSet, School, SchoolData } from '../../engine/types'
import { Card } from '../../ui/kit'

export default function ProfileTab({ school, data, rules }: { school: School; data: SchoolData; rules: RuleSet }) {
  const p = data.profile ?? {}
  const d = (iso?: string) => (iso ? new Date(iso + 'T00:00:00Z').toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' }) : '—')
  const hours = p.workingDaysYear && p.periodMinutes ? Math.round((p.workingDaysYear * rules.periodsPerDay * p.periodMinutes) / 60) : null
  const rows: [string, React.ReactNode][] = [
    ['School name', school.name], ['Board', BOARD_LABEL[school.board]], ['Academic year', p.academicYear ?? '—'], ['UDISE+ code', p.udise ?? '—'],
    ['Recognition / affiliation no.', p.recognitionNo ?? '—'], ['Recognition valid until', d(p.recognitionValidUntil)],
    ['Minority institution', p.minority === undefined ? '—' : p.minority ? 'Yes' : 'No'], ['Separate boys / girls sections from Class 6', data.genderSeparate ? 'Yes' : 'No'],
  ]
  const day: [string, React.ReactNode][] = [
    ['Working days per week', rules.daysPerWeek], ['Teaching periods per day', rules.periodsPerDay], ['Period duration', p.periodMinutes ? `${p.periodMinutes} minutes` : '—'],
    ['Lunch break after period', rules.lunchAfterPeriod], ['School hours', p.startTime || p.endTime ? `${p.startTime ?? '?'} – ${p.endTime ?? '?'}` : '—'],
    ['Working days in academic year', p.workingDaysYear ?? '—'], ['Teaching hours per year (calculated)', hours ? `${hours} hours` : '—'],
  ]
  const List = ({ items }: { items: [string, React.ReactNode][] }) => (
    <dl className="divide-y divide-slate-100">
      {items.map(([k, v]) => <div key={k} className="grid grid-cols-2 gap-4 py-2.5 text-sm"><dt className="text-slate-500">{k}</dt><dd className="font-medium text-slate-900">{v}</dd></div>)}
    </dl>
  )
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Card title="School details" subtitle="From the School Profile sheet of the workbook"><List items={rows} /></Card>
      <Card title="Daily structure" subtitle="Used for timetable and RTE hour checks"><List items={day} /></Card>
    </div>
  )
}
