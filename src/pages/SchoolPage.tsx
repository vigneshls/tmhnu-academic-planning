import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { useAuth } from '../App'
import { analyse } from '../data/analyse'
import { store } from '../data/store'
import { BOARD_LABEL } from '../engine/rules'
import type { RuleSet, School, SchoolData } from '../engine/types'
import { Badge, Button, PageHeader, Tabs } from '../ui/kit'
import AllocationTab from './school/AllocationTab'
import ComplianceTab from './school/ComplianceTab'
import FacultyTab from './school/FacultyTab'
import OverviewTab from './school/OverviewTab'
import ProfileTab from './school/ProfileTab'
import RequirementTab from './school/RequirementTab'
import StaffingTab from './school/StaffingTab'
import StrengthTab from './school/StrengthTab'
import TimetableTab from './school/TimetableTab'

type Tab = 'overview' | 'students' | 'allocation' | 'staffing' | 'faculty' | 'timetable' | 'compliance' | 'profile'

export default function SchoolPage() {
  const { id = '' } = useParams()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'overview'
  const setTab = (t: Tab) => setParams({ tab: t }, { replace: true })
  const { profile } = useAuth()
  const [school, setSchool] = useState<School | null>(null)
  const [rules, setRules] = useState<RuleSet | null>(null)
  const [data, setData] = useState<SchoolData | null>(null)
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

  const a = useMemo(() => (school && rules && data ? analyse(school, rules, data) : null), [school, rules, data])

  useEffect(() => {
    const h = (e: BeforeUnloadEvent) => { if (dirty) e.preventDefault() }
    window.addEventListener('beforeunload', h)
    return () => window.removeEventListener('beforeunload', h)
  }, [dirty])

  if (err) return <p role="alert" className="text-red-700">{err}</p>
  if (!school || !rules || !data || !a) return <p className="text-slate-500">Loading…</p>

  const isAdmin = profile?.role === 'admin'
  const update = (d: SchoolData) => { setData(d); setDirty(true); setMsg('') }
  const save = async () => { try { await store.saveSchoolData(school.id, data); setDirty(false); setMsg('Saved') } catch (e) { setMsg('Save failed: ' + (e as Error).message) } }
  const issues = a.recs.filter((r) => r.status === 'fail' && (r.severity === 'critical' || r.severity === 'high')).length
  const openCompliance = a.recs.filter((r) => r.status === 'fail' && r.area === 'Compliance & records').length

  return (
    <>
      <PageHeader
        eyebrow={<span className="flex items-center gap-2">{BOARD_LABEL[school.board]}{data.profile?.academicYear && <span className="text-slate-400">· {data.profile.academicYear}</span>}</span>}
        title={school.name}
        subtitle={<>
          {a.summary.students} students · {a.summary.sections} sections · {data.staff.length} staff
          {data.source === 'sample' && <span className="ml-2"><Badge tone="high">Sample data — import the school workbook to replace</Badge></span>}
          {data.importedAt && <span className="ml-2 text-slate-400">· data imported {new Date(data.importedAt).toLocaleDateString()}</span>}
        </>}
        actions={<>
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          {isAdmin && <Link to={`/admin/import?school=${school.id}`} className="rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Import data</Link>}
          <Button variant={dirty ? 'primary' : 'secondary'} disabled={!dirty} onClick={save}>{dirty ? 'Save changes' : 'Saved'}</Button>
        </>}
      />
      <Tabs<Tab> value={tab} onChange={setTab} tabs={[
        ['overview', 'Overview', issues], ['students', 'Students'],
        ...(data.allocations?.length ? ([['allocation', 'Teacher Allocation']] as const) : []),
        ['staffing', 'Staffing'], ['faculty', 'Faculty'],
        ['timetable', 'Timetable'], ['compliance', 'Compliance', openCompliance], ['profile', 'School Profile'],
      ] as const} />
      {tab === 'overview' && <OverviewTab school={school} data={data} a={a} goTo={setTab} />}
      {tab === 'students' && <StrengthTab rules={a.rules} data={data} sections={a.sections} onChange={update} />}
      {tab === 'allocation' && <AllocationTab rules={a.rules} data={data} sections={a.sections} />}
      {tab === 'staffing' && (a.staffing ? <StaffingTab rules={a.rules} staffing={a.staffing} summary={a.summary} /> : <RequirementTab rules={a.rules} sections={a.sections} demand={a.demand} summary={a.summary} />)}
      {tab === 'faculty' && <FacultyTab rules={a.rules} data={data} isAdmin={isAdmin} schoolId={school.id} />}
      {tab === 'timetable' && <TimetableTab rules={a.rules} school={school} data={data} sections={a.sections} onChange={update} />}
      {tab === 'compliance' && <ComplianceTab board={school.board} data={data} onChange={update} userName={profile?.name ?? ''} />}
      {tab === 'profile' && <ProfileTab school={school} data={data} rules={a.rules} />}
    </>
  )
}
