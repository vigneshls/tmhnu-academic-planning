import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../App'
import { store } from '../data/store'
import { buildSections, computeDemand, summarize, type SchoolSummary } from '../engine/calc'
import { recommend, score } from '../engine/recommend'
import { BOARD_LABEL } from '../engine/rules'
import type { Board, School } from '../engine/types'

interface Row { school: School; sum: SchoolSummary; sc: ReturnType<typeof score>; staff: number }

export default function Dashboard() {
  const { profile } = useAuth()
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<School | null>(null)

  const load = async () => {
    try {
      const schools = await store.listSchools()
      const out: Row[] = []
      for (const school of schools) {
        const [rules, data] = await Promise.all([store.getRules(school.board), store.getSchoolData(school.id)])
        const sections = buildSections(rules, data)
        const demand = computeDemand(rules, sections, data.staff)
        const sum = summarize(rules, data, sections, demand)
        const sc = score(recommend({ board: school.board, rules, data, sections, demand, summary: sum }))
        out.push({ school, sum, sc, staff: data.staff.length })
      }
      setRows(out)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  useEffect(() => { void load() }, [])

  if (err) return <p role="alert" className="text-red-600">{err}</p>
  if (!rows) return <p className="text-slate-500">Loading schools…</p>

  const tot = rows.reduce((a, r) => ({ students: a.students + r.sum.students, sections: a.sections + r.sum.sections, staff: a.staff + r.staff, shortage: a.shortage + r.sum.shortage, critical: a.critical + r.sc.critical }), { students: 0, sections: 0, staff: 0, shortage: 0, critical: 0 })

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">All Schools</h1>
        <p className="text-sm text-slate-500">Strength, staffing and compliance status across the institution.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {([['Students', tot.students], ['Sections', tot.sections], ['Faculty on record', tot.staff], ['Teacher shortage', tot.shortage], ['Critical issues', tot.critical]] as const).map(([k, v]) => (
          <div key={k} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-xs text-slate-500">{k}</div>
            <div className={`text-2xl font-semibold ${(k === 'Teacher shortage' || k === 'Critical issues') && v > 0 ? 'text-red-700' : 'text-slate-900'}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="p-3">School</th><th className="p-3">Board</th><th className="p-3 text-right">Students</th>
              <th className="p-3 text-right">Sections</th><th className="p-3 text-right">Teachers needed</th><th className="p-3 text-right">Available</th>
              <th className="p-3 text-right">Shortage</th><th className="p-3 text-right">Critical</th><th className="p-3 text-right">High</th>
              <th className="p-3 text-right">Checks passed</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ school, sum, sc }) => (
              <tr key={school.id} className="border-t border-slate-100">
                <td className="p-3 font-medium"><Link className="text-[#1f3a5f] hover:underline" to={`/school/${school.id}`}>{school.name}</Link></td>
                <td className="p-3">{BOARD_LABEL[school.board]}</td>
                <td className="p-3 text-right">{sum.students}</td>
                <td className="p-3 text-right">{sum.sections}</td>
                <td className="p-3 text-right">{sum.needed}</td>
                <td className="p-3 text-right">{sum.available}</td>
                <td className={`p-3 text-right font-semibold ${sum.shortage > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{sum.shortage}</td>
                <td className={`p-3 text-right ${sc.critical ? 'font-semibold text-red-700' : ''}`}>{sc.critical}</td>
                <td className={`p-3 text-right ${sc.high ? 'text-amber-700' : ''}`}>{sc.high}</td>
                <td className="p-3 text-right">{sc.pass}/{sc.total} ({sc.pct}%)</td>
                <td className="p-3 text-right">{profile?.role === 'admin' && <button className="text-xs text-slate-500 hover:underline" onClick={() => setEditing({ ...school })}>Edit</button>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profile?.role === 'admin' && !editing && (
        <button className="rounded border border-slate-300 bg-white px-3 py-1.5 text-sm" onClick={() => setEditing({ id: store.mode === 'demo' ? `s-${Date.now().toString(36)}` : crypto.randomUUID(), name: '', board: 'MATRIC' })}>
          + Add school
        </button>
      )}

      {editing && (
        <form
          className="max-w-xl space-y-3 rounded-lg border border-slate-200 bg-white p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!editing.name.trim()) return
            try { await store.saveSchool({ ...editing, name: editing.name.trim() }); setEditing(null); await load() } catch (er) { setErr((er as Error).message) }
          }}
        >
          <h2 className="font-semibold">School details</h2>
          <label className="block text-sm">Name
            <input required maxLength={120} className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </label>
          <label className="block text-sm">Board
            <select className="mt-1 w-full rounded border border-slate-300 px-2 py-1" value={editing.board} onChange={(e) => setEditing({ ...editing, board: e.target.value as Board })}>
              <option value="MATRIC">Matriculation (TN)</option><option value="CBSE">CBSE</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="rounded bg-[#1f3a5f] px-3 py-1.5 text-sm text-white">Save</button>
            <button type="button" className="rounded border border-slate-300 px-3 py-1.5 text-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
