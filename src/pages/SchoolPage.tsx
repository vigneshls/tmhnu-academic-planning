import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { store } from '../data/store'
import { buildSections, computeDemand, summarize } from '../engine/calc'
import type { RuleSet, School, SchoolData } from '../engine/types'
import RequirementTab from './school/RequirementTab'
import StaffTab from './school/StaffTab'
import StrengthTab from './school/StrengthTab'
import TimetableTab from './school/TimetableTab'

const TABS = [
  ['strength', '1. Student strength', 'மாணவர் எண்ணிக்கை'],
  ['requirement', '2. Sections & teachers needed', 'பிரிவு & ஆசிரியர் தேவை'],
  ['staff', '3. Staff list', 'ஆசிரியர் பட்டியல்'],
  ['timetable', '4. Timetable', 'பாடவேளை அட்டவணை'],
] as const
type Tab = (typeof TABS)[number][0]

export default function SchoolPage() {
  const { id = '' } = useParams()
  const [school, setSchool] = useState<School | null>(null)
  const [rules, setRules] = useState<RuleSet | null>(null)
  const [data, setData] = useState<SchoolData | null>(null)
  const [tab, setTab] = useState<Tab>('strength')
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const s = (await store.listSchools()).find((x) => x.id === id)
        if (!s) { setErr('School not found or you do not have access.'); return }
        setSchool(s)
        const [r, d] = await Promise.all([store.getRules(s.board), store.getSchoolData(s.id)])
        setRules(r)
        setData(d)
      } catch (e) { setErr((e as Error).message) }
    })()
  }, [id])

  const sections = useMemo(() => (rules && data ? buildSections(rules, data) : []), [rules, data])
  const demand = useMemo(() => (rules && data ? computeDemand(rules, sections, data.staff) : []), [rules, data, sections])
  const summary = useMemo(() => (rules && data ? summarize(rules, data, sections, demand) : null), [rules, data, sections, demand])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (err) return <p role="alert" className="text-red-600">{err}</p>
  if (!school || !rules || !data || !summary) return <p className="text-zinc-500">Loading…</p>

  const update = (d: SchoolData) => { setData(d); setDirty(true); setMsg('') }
  const save = async () => {
    try {
      await store.saveSchoolData(school.id, data)
      setDirty(false)
      setMsg('Saved ✓')
    } catch (e) { setMsg('Save failed: ' + (e as Error).message) }
  }

  return (
    <div className="space-y-4">
      <div className="no-print flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{school.name}</h1>
          <p className="text-sm text-zinc-500">{rules.label} · {summary.students} students · {summary.sections} sections · needed {summary.needed} / available {summary.available}</p>
        </div>
        <div className="ml-auto flex items-center gap-3">
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          <button disabled={!dirty} onClick={save} className={`rounded px-4 py-2 text-sm font-medium ${dirty ? 'bg-indigo-700 text-white' : 'bg-zinc-200 text-zinc-500'}`}>
            {dirty ? 'Save changes' : 'All changes saved'}
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-1 border-b">
        {TABS.map(([k, en, ta]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-left text-sm ${tab === k ? 'border-indigo-700 font-semibold text-indigo-800' : 'border-transparent text-zinc-600'}`}>
            {en}<span className="block text-xs font-normal text-zinc-400">{ta}</span>
          </button>
        ))}
      </div>

      {tab === 'strength' && <StrengthTab rules={rules} data={data} sections={sections} onChange={update} />}
      {tab === 'requirement' && <RequirementTab rules={rules} sections={sections} demand={demand} summary={summary} />}
      {tab === 'staff' && <StaffTab rules={rules} data={data} demand={demand} onChange={update} />}
      {tab === 'timetable' && <TimetableTab rules={rules} school={school} data={data} sections={sections} onChange={update} />}
    </div>
  )
}
