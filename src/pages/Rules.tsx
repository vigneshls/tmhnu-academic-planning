import { useEffect, useState } from 'react'
import { store } from '../data/store'
import { CATEGORY_LABEL, defaultRuleSet, effectiveLimits, stageOf } from '../engine/rules'
import type { Board, Category, RuleSet, Stage, SubjectAlloc } from '../engine/types'
import { STAGES, STANDARDS } from '../engine/types'

const STAGE_LABEL: Record<Stage, string> = { PRE: 'Pre-primary', PRIMARY: 'Primary 1–5', MIDDLE: 'Middle 6–8', HIGH: 'High 9–10', HSS: 'Hr. Sec. 11–12' }
const n = (v: string) => Math.max(0, Math.floor(Number(v) || 0))

export default function Rules() {
  const [board, setBoard] = useState<Board>('STATE')
  const [r, setR] = useState<RuleSet | null>(null)
  const [std, setStd] = useState<string>('6')
  const [grp, setGrp] = useState(0)
  const [msg, setMsg] = useState('')
  const [dirty, setDirty] = useState(false)

  useEffect(() => {
    setR(null)
    void store.getRules(board).then((x) => { setR(x); setDirty(false); setMsg('') }).catch((e) => setMsg((e as Error).message))
  }, [board])

  if (!r) return <p className="text-zinc-500">{msg || 'Loading…'}</p>
  const up = (p: Partial<RuleSet>) => { setR({ ...r, ...p }); setDirty(true); setMsg('') }
  const slots = r.daysPerWeek * r.periodsPerDay
  const subs = std === 'HSS' ? r.hssGroups[grp]?.subjects ?? [] : r.subjectsByStandard[std] ?? []
  const setSubs = (list: SubjectAlloc[]) => {
    if (std === 'HSS') up({ hssGroups: r.hssGroups.map((g, i) => (i === grp ? { ...g, subjects: list } : g)) })
    else up({ subjectsByStandard: { ...r.subjectsByStandard, [std]: list } })
  }
  const total = subs.reduce((a, s) => a + s.periods, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Board rules</h1>
          <p className="text-sm text-zinc-500">வாரிய விதிமுறைகள் — applies to every school of this board</p>
        </div>
        <select aria-label="Board" className="rounded border px-3 py-2" value={board} onChange={(e) => { if (!dirty || confirm('Discard unsaved changes?')) setBoard(e.target.value as Board) }}>
          <option value="CBSE">CBSE</option><option value="MATRIC">Matriculation</option><option value="STATE">State Board</option>
        </select>
        <div className="ml-auto flex items-center gap-2">
          {msg && <span className="text-sm text-emerald-700">{msg}</span>}
          <button className="rounded border px-3 py-2 text-sm" onClick={() => { if (confirm('Reset this board to default rules?')) { setR(defaultRuleSet(board)); setDirty(true) } }}>Reset to defaults</button>
          <button disabled={!dirty} className={`rounded px-4 py-2 text-sm font-medium ${dirty ? 'bg-indigo-700 text-white' : 'bg-zinc-200 text-zinc-500'}`}
            onClick={async () => { try { await store.saveRules(r); setDirty(false); setMsg('Saved ✓') } catch (e) { setMsg((e as Error).message) } }}>
            Save rules
          </button>
        </div>
      </div>

      <ul className="list-disc space-y-1 pl-5 text-xs text-zinc-600">{r.notes.map((x, i) => <li key={i}>{x}</li>)}</ul>

      <section className="grid gap-4 rounded-lg border bg-white p-4 md:grid-cols-3">
        <h2 className="font-semibold md:col-span-3">Day structure (நாள் அமைப்பு)</h2>
        <label className="text-sm">Working days / week<input type="number" min={1} max={6} className="mt-1 block w-full rounded border px-2 py-1" value={r.daysPerWeek} onChange={(e) => up({ daysPerWeek: Math.min(6, Math.max(1, n(e.target.value))) })} /></label>
        <label className="text-sm">Periods / day<input type="number" min={1} max={12} className="mt-1 block w-full rounded border px-2 py-1" value={r.periodsPerDay} onChange={(e) => up({ periodsPerDay: Math.min(12, Math.max(1, n(e.target.value))) })} /></label>
        <label className="text-sm">Lunch after period<input type="number" min={1} className="mt-1 block w-full rounded border px-2 py-1" value={r.lunchAfterPeriod} onChange={(e) => up({ lunchAfterPeriod: n(e.target.value) })} /></label>
        <label className="text-sm">Short intervals after periods (comma)<input className="mt-1 block w-full rounded border px-2 py-1" value={r.breaksAfter.join(', ')} onChange={(e) => up({ breaksAfter: e.target.value.split(',').map((x) => n(x)).filter(Boolean) })} /></label>
        <label className="text-sm">Max continuous periods per teacher<input type="number" min={1} className="mt-1 block w-full rounded border px-2 py-1" value={r.maxConsecutive} onChange={(e) => up({ maxConsecutive: Math.max(1, n(e.target.value)) })} /></label>
        <label className="flex items-center gap-2 self-end text-sm"><input type="checkbox" checked={r.resetAtIntervals} onChange={(e) => up({ resetAtIntervals: e.target.checked })} /> Short intervals also break the continuous count</label>
        <p className="text-xs text-zinc-500 md:col-span-3">Weekly slots per class: {slots}. With these settings a teacher can take at most {effectiveLimits(r, { min: 0, max: 99, target: 99, maxPerDay: 99 }).perDay} periods/day.</p>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">Section cap & pupil–teacher ratio</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500"><tr><th className="p-1">Stage</th><th className="p-1">Max students / section</th><th className="p-1">PTR norm (1:x)</th></tr></thead>
          <tbody>
            {STAGES.map((s) => (
              <tr key={s}>
                <td className="p-1">{STAGE_LABEL[s]}</td>
                <td className="p-1"><input aria-label={`${s} cap`} type="number" min={1} className="w-24 rounded border px-2 py-1" value={r.sectionCap[s]} onChange={(e) => up({ sectionCap: { ...r.sectionCap, [s]: Math.max(1, n(e.target.value)) } })} /></td>
                <td className="p-1"><input aria-label={`${s} PTR`} type="number" min={1} className="w-24 rounded border px-2 py-1" value={r.ptr[s]} onChange={(e) => up({ ptr: { ...r.ptr, [s]: Math.max(1, n(e.target.value)) } })} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="overflow-x-auto rounded-lg border bg-white p-4">
        <h2 className="mb-2 font-semibold">Teacher workload (பணிச்சுமை)</h2>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500"><tr><th className="p-1">Category</th><th className="p-1">Min/week</th><th className="p-1">Max/week</th><th className="p-1">Planning load</th><th className="p-1">Max/day</th><th className="p-1">Schedulable</th></tr></thead>
          <tbody>
            {(Object.keys(r.workload) as Category[]).map((c) => {
              const w = r.workload[c]
              const e = effectiveLimits(r, w)
              const set = (k: keyof typeof w, v: number) => up({ workload: { ...r.workload, [c]: { ...w, [k]: v } } })
              return (
                <tr key={c}>
                  <td className="p-1">{CATEGORY_LABEL[c]}</td>
                  {(['min', 'max', 'target', 'maxPerDay'] as const).map((k) => (
                    <td key={k} className="p-1"><input aria-label={`${c} ${k}`} type="number" min={0} className="w-20 rounded border px-2 py-1" value={w[k]} onChange={(ev) => set(k, n(ev.target.value))} /></td>
                  ))}
                  <td className={`p-1 ${e.perWeek < w.max ? 'text-amber-700' : 'text-zinc-500'}`}>{e.perWeek}/week · {e.perDay}/day · plan {e.target}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <p className="mt-2 text-xs text-zinc-500">Planning load = periods used to count how many teachers are needed. Keep it below Max to leave a buffer for substitution and remedial classes.</p>
      </section>

      <section className="rounded-lg border bg-white p-4">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <h2 className="font-semibold">Subject periods per week (பாடவாரியான பாடவேளை)</h2>
          <select aria-label="Standard" className="rounded border px-2 py-1 text-sm" value={std} onChange={(e) => setStd(e.target.value)}>
            {STANDARDS.filter((s) => stageOf(s) !== 'HSS').map((s) => <option key={s} value={s}>{s === 'PREKG' ? 'Pre-KG' : s}</option>)}
            <option value="HSS">11 & 12 (groups)</option>
          </select>
          {std === 'HSS' && (
            <>
              <select aria-label="Group" className="rounded border px-2 py-1 text-sm" value={grp} onChange={(e) => setGrp(Number(e.target.value))}>
                {r.hssGroups.map((g, i) => <option key={g.id} value={i}>{g.name}</option>)}
              </select>
              <input aria-label="Group name" className="rounded border px-2 py-1 text-sm" value={r.hssGroups[grp]?.name ?? ''} onChange={(e) => up({ hssGroups: r.hssGroups.map((g, i) => (i === grp ? { ...g, name: e.target.value } : g)) })} />
              <button className="rounded border px-2 py-1 text-xs" onClick={() => { up({ hssGroups: [...r.hssGroups, { id: `G${Date.now().toString(36)}`, name: 'New group', subjects: [] }] }); setGrp(r.hssGroups.length) }}>+ Group</button>
            </>
          )}
          {std !== 'HSS' && (
            <button className="rounded border px-2 py-1 text-xs" onClick={() => {
              const same = STANDARDS.filter((s) => stageOf(s) === stageOf(std))
              const next = { ...r.subjectsByStandard }
              same.forEach((s) => (next[s] = JSON.parse(JSON.stringify(subs))))
              up({ subjectsByStandard: next })
              setMsg(`Copied to ${same.join(', ')} (not saved yet)`)
            }}>Copy to all standards in this stage</button>
          )}
          <span className={`ml-auto text-sm font-semibold ${total === slots ? 'text-emerald-700' : 'text-red-600'}`}>Total {total} / {slots} slots</span>
        </div>
        <table className="w-full text-sm">
          <thead className="text-left text-zinc-500"><tr><th className="p-1">Subject</th><th className="p-1">Periods</th><th className="p-1">Preferred time</th><th className="p-1">Specialist</th><th className="p-1">Shared (any teacher)</th><th className="p-1">No teacher</th><th /></tr></thead>
          <tbody>
            {subs.map((s, i) => {
              const set = (p: Partial<SubjectAlloc>) => setSubs(subs.map((x, j) => (j === i ? { ...x, ...p } : x)))
              return (
                <tr key={i}>
                  <td className="p-1"><input aria-label="Subject" className="w-48 rounded border px-2 py-1" value={s.subject} onChange={(e) => set({ subject: e.target.value })} /></td>
                  <td className="p-1"><input aria-label="Periods" type="number" min={0} className="w-16 rounded border px-2 py-1" value={s.periods} onChange={(e) => set({ periods: n(e.target.value) })} /></td>
                  <td className="p-1">
                    <select aria-label="Preferred time" className="rounded border px-2 py-1" value={s.pref} onChange={(e) => set({ pref: e.target.value as SubjectAlloc['pref'] })}>
                      <option value="morning">First 3 periods</option><option value="afternoon">After lunch</option><option value="last">Last period</option><option value="any">Any</option>
                    </select>
                  </td>
                  <td className="p-1"><input aria-label="Specialist" type="checkbox" checked={!!s.specialist} onChange={(e) => set({ specialist: e.target.checked })} /></td>
                  <td className="p-1"><input aria-label="Shared" type="checkbox" checked={!!s.flex} onChange={(e) => set({ flex: e.target.checked })} /></td>
                  <td className="p-1"><input aria-label="No teacher" type="checkbox" checked={!!s.noTeacher} onChange={(e) => set({ noTeacher: e.target.checked })} /></td>
                  <td className="p-1"><button className="text-red-600" onClick={() => setSubs(subs.filter((_, j) => j !== i))}>Remove</button></td>
                </tr>
              )
            })}
          </tbody>
        </table>
        <button className="mt-2 rounded border px-3 py-1 text-sm" onClick={() => setSubs([...subs, { subject: '', periods: 1, pref: 'any' }])}>+ Subject</button>
        {total !== slots && <p className="mt-2 text-xs text-red-600">Total periods should equal {slots} weekly slots. If it is less, the extra slots stay empty; if more, the timetable cannot fit.</p>}
      </section>
    </div>
  )
}
