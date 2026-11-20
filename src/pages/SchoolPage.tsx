import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import { useAuth } from '../App'
import { store } from '../data/store'
import { buildSections, computeDemand, summarize } from '../engine/calc'
import { recommend } from '../engine/recommend'
import { BOARD_LABEL } from '../engine/rules'
import type { RuleSet, School, SchoolData, Staff } from '../engine/types'
import FacultyTab from './school/FacultyTab'
import OverviewTab from './school/OverviewTab'
import RequirementTab from './school/RequirementTab'
import StrengthTab from './school/StrengthTab'
import TimetableTab from './school/TimetableTab'

const TABS = [
  ['overview', 'Overview & Recommendations'],
  ['strength', 'Student Strength'],
  ['requirement', 'Sections & Teachers Needed'],
  ['faculty', 'Faculty'],
  ['timetable', 'Timetable'],
] as const
type Tab = (typeof TABS)[number][0]

export default function SchoolPage() {
  const { id = '' } = useParams()
  const { profile } = useAuth()
  const [school, setSchool] = useState<School | null>(null)
  const [rules, setRules] = useState<RuleSet | null>(null)
  const [data, setData] = useState<SchoolData | null>(null)
  const [tab, setTab] = useState<Tab>('overview')
  const [dirty, setDirty] = useState(false)
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState('')

  useEffect(() => {
    void (async () => {
      try {
        const s = (await store.listSchools()).find((x) => x.id === id)
        if (!s) { setErr('School not found, or you do not have access to it.'); return }
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
  const recs = useMemo(() => (school && rules && data && summary ? recommend({ board: school.board, rules, data, sections, demand, summary }) : []), [school, rules, data, sections, demand, summary])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (err) return <p role="alert" className="text-red-600">{err}</p>
  if (!school || !rules || !data || !summary) return <p className="text-slate-500">Loading…</p>

  const isAdmin = profile?.role === 'admin'
  const update = (d: SchoolData) => { setData(d); setDirty(true); setMsg('') }
  const save = async () => {
    try { await store.saveSchoolData(school.id, data); setDirty(false); setMsg('Saved') } catch (e) { setMsg('Save failed: ' + (e as Error).message) }
  }
  const saveStaff = async (staff: Staff[]) => {
    await store.saveStaff(school.id, staff)
    setData({ ...data, staff, staffUpdatedAt: new Date().toISOString() })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold text-slate-900">{school.name}</h1>
          <p className="text-sm text-slate-500">{BOARD_LABEL[school.board]} · {summary.students} students · {summary.sections} sections · {data.staff.length} staff on record</p>
        </div>
        <div className="no-print ml-auto flex items-center gap-3">
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          <button disabled={!dirty} onClick={save} className={`rounded px-4 py-2 text-sm font-medium ${dirty ? 'bg-[#1f3a5f] text-white' : 'border border-slate-200 bg-white text-slate-400'}`}>
            {dirty ? 'Save changes' : 'All changes saved'}
          </button>
        </div>
      </div>

      <div className="no-print flex flex-wrap gap-1 border-b border-slate-200">
        {TABS.map(([k, label]) => (
          <button key={k} onClick={() => setTab(k)} className={`-mb-px border-b-2 px-3 py-2 text-sm ${tab === k ? 'border-[#1f3a5f] font-semibold text-[#1f3a5f]' : 'border-transparent text-slate-600 hover:text-slate-900'}`}>
            {label}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab school={school} data={data} summary={summary} recs={recs} onChange={update} userName={profile?.name ?? ''} />}
      {tab === 'strength' && <StrengthTab rules={rules} data={data} sections={sections} onChange={update} />}
      {tab === 'requirement' && <RequirementTab rules={rules} sections={sections} demand={demand} summary={summary} />}
      {tab === 'faculty' && <FacultyTab rules={rules} data={data} isAdmin={isAdmin} onSave={saveStaff} />}
      {tab === 'timetable' && <TimetableTab rules={rules} school={school} data={data} sections={sections} onChange={update} />}
    </div>
  )
}
