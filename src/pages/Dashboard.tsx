import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../data/store'
import { buildSections, computeDemand, summarize, type SchoolSummary } from '../engine/calc'
import type { Board, School } from '../engine/types'
import { useAuth } from '../App'

const BOARD_LABEL: Record<Board, string> = { CBSE: 'CBSE', MATRIC: 'Matriculation', STATE: 'State Board' }

interface Row { school: School; sum: SchoolSummary }

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
        const secs = buildSections(rules, data)
        out.push({ school, sum: summarize(rules, data, secs, computeDemand(rules, secs, data.staff)) })
      }
      setRows(out)
    } catch (e) {
      setErr((e as Error).message)
    }
  }
  useEffect(() => { void load() }, [])

  if (err) return <p role="alert" className="text-red-600">{err}</p>
  if (!rows) return <p className="text-zinc-500">Loading schools…</p>

  const tot = rows.reduce(
    (a, r) => ({ students: a.students + r.sum.students, sections: a.sections + r.sum.sections, needed: a.needed + r.sum.needed, available: a.available + r.sum.available, shortage: a.shortage + r.sum.shortage }),
    { students: 0, sections: 0, needed: 0, available: 0, shortage: 0 },
  )

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">All schools</h1>
        <p className="text-sm text-zinc-500">அனைத்து பள்ளிகளின் மாணவர் எண்ணிக்கை, பிரிவுகள், ஆசிரியர் தேவை</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-5">
        {[
          ['Students', tot.students],
          ['Sections', tot.sections],
          ['Teachers needed', tot.needed],
          ['Teachers available', tot.available],
          ['Shortage', tot.shortage],
        ].map(([k, v]) => (
          <div key={k} className={`rounded-lg border bg-white p-4 ${k === 'Shortage' && Number(v) > 0 ? 'border-red-300' : ''}`}>
            <div className="text-xs text-zinc-500">{k}</div>
            <div className={`text-2xl font-semibold ${k === 'Shortage' && Number(v) > 0 ? 'text-red-600' : ''}`}>{v}</div>
          </div>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left">
            <tr>
              <th className="p-3">School</th><th className="p-3">Board</th><th className="p-3 text-right">Students</th>
              <th className="p-3 text-right">Boys 6–12</th><th className="p-3 text-right">Girls 6–12</th>
              <th className="p-3 text-right">Sections</th><th className="p-3 text-right">Needed</th>
              <th className="p-3 text-right">Available</th><th className="p-3 text-right">Shortage</th><th className="p-3" />
            </tr>
          </thead>
          <tbody>
            {rows.map(({ school, sum }) => (
              <tr key={school.id} className="border-t">
                <td className="p-3 font-medium"><Link className="text-indigo-700 hover:underline" to={`/school/${school.id}`}>{school.name}</Link></td>
                <td className="p-3">{BOARD_LABEL[school.board]}</td>
                <td className="p-3 text-right">{sum.students}</td>
                <td className="p-3 text-right">{sum.boys6to12}</td>
                <td className="p-3 text-right">{sum.girls6to12}</td>
                <td className="p-3 text-right">{sum.sections}</td>
                <td className="p-3 text-right">{sum.needed}</td>
                <td className="p-3 text-right">{sum.available}</td>
                <td className={`p-3 text-right font-semibold ${sum.shortage > 0 ? 'text-red-600' : 'text-emerald-700'}`}>{sum.shortage}</td>
                <td className="p-3 text-right">
                  {profile?.role === 'admin' && <button className="text-xs text-zinc-500 hover:underline" onClick={() => setEditing({ ...school })}>Edit</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {profile?.role === 'admin' && (
        <button
          className="rounded border border-indigo-300 px-3 py-1.5 text-sm text-indigo-800"
          onClick={() => setEditing({ id: store.mode === 'demo' ? `S${Date.now()}` : crypto.randomUUID(), name: '', board: 'STATE' })}
        >
          + Add school
        </button>
      )}

      {editing && (
        <form
          className="max-w-md space-y-3 rounded-lg border bg-white p-4"
          onSubmit={async (e) => {
            e.preventDefault()
            if (!editing.name.trim()) return
            try {
              await store.saveSchool({ ...editing, name: editing.name.trim() })
              setEditing(null)
              await load()
            } catch (er) { setErr((er as Error).message) }
          }}
        >
          <h2 className="font-semibold">School details</h2>
          <label className="block text-sm">Name
            <input required className="mt-1 w-full rounded border px-2 py-1" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} />
          </label>
          <label className="block text-sm">Board
            <select className="mt-1 w-full rounded border px-2 py-1" value={editing.board} onChange={(e) => setEditing({ ...editing, board: e.target.value as Board })}>
              <option value="CBSE">CBSE</option><option value="MATRIC">Matriculation</option><option value="STATE">State Board</option>
            </select>
          </label>
          <div className="flex gap-2">
            <button className="rounded bg-indigo-700 px-3 py-1.5 text-sm text-white">Save</button>
            <button type="button" className="rounded border px-3 py-1.5 text-sm" onClick={() => setEditing(null)}>Cancel</button>
          </div>
        </form>
      )}
    </div>
  )
}
