import { stageOf } from '../../engine/rules'
import { partsOf, planClass, planKey, planMismatch } from '../../engine/sectionPlan'
import type { GenderCount, RuleSet, SchoolData, Section, SectionPlan } from '../../engine/types'
import { STANDARDS } from '../../engine/types'

const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
const label = (s: string) => (s === 'PREKG' ? 'Pre-KG' : /^\d+$/.test(s) ? `Class ${s}` : s)

const th = 'p-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500'
const td = 'p-3'
const input = 'w-24 rounded border border-slate-300 px-2 py-1.5 text-right'

function Chips({ secs }: { secs: Section[] }) {
  if (!secs.length) return <span className="text-slate-400">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {secs.map((s) => {
        const letter = s.id.split('-').pop()
        const mixed = s.gender === 'C' && Number(s.standard) >= 6 && (s.boys ?? 0) > 0 && (s.girls ?? 0) > 0
        const g = s.gender === 'B' ? 'Boys' : s.gender === 'G' ? 'Girls' : mixed ? 'Mixed' : ''
        return (
          <span
            key={s.id}
            title={mixed ? `${s.boys} boys + ${s.girls} girls in one section` : s.genderInferred ? 'Boys/Girls assumed from the counts — write “A (Boys)” / “B (Girls)” in the Subject Periods sheet to confirm' : undefined}
            className={`rounded border px-2 py-0.5 text-xs ${s.gender === 'B' ? 'border-sky-200 bg-sky-50 text-sky-900' : s.gender === 'G' ? 'border-rose-200 bg-rose-50 text-rose-900' : mixed ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}
          >
            {letter}{g && ` · ${g}`} · {mixed ? `${s.boys}B + ${s.girls}G` : s.strength}{s.genderInferred ? ' ?' : ''}
          </span>
        )
      })}
    </div>
  )
}

const PART_NAME = { B: 'Boys', G: 'Girls', C: 'Students' } as const
const PART_KEY = { B: 'boys', G: 'girls', C: 'mixed' } as const

/** Sections of one class: Auto (even split within the limit) or Manual (type each section's strength) */
function SecCell({ std, groupId, c, cap, secs, data, onChange }: { std: string; groupId?: string; c: GenderCount; cap: number; secs: Section[]; data: SchoolData; onChange: (d: SchoolData) => void }) {
  const key = planKey(std, groupId)
  const plan = data.sectionPlan?.[key]
  const setPlan = (p: SectionPlan | undefined) => {
    const next = { ...(data.sectionPlan ?? {}) }
    if (p) next[key] = p
    else delete next[key]
    onChange({ ...data, sectionPlan: next })
  }
  const toManual = () => {
    const p: SectionPlan = {}
    for (const x of planClass(std, c, cap, data.genderSeparate)) (p[PART_KEY[x.gender]] ??= []).push(x.size)
    setPlan(p)
  }
  const parts = partsOf(std, c, data.genderSeparate)
  const bad = planMismatch(std, c, data.genderSeparate, plan)
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <select aria-label={`Sections for ${std}${groupId ? ' ' + groupId : ''}`} className="rounded border border-slate-300 px-1.5 py-1 text-xs" value={plan ? 'manual' : 'auto'} onChange={(e) => (e.target.value === 'auto' ? setPlan(undefined) : toManual())}>
          <option value="auto">Auto</option>
          <option value="manual">Manual</option>
        </select>
        <Chips secs={secs} />
      </div>
      {plan && (
        <div className="space-y-1.5 rounded-md border border-slate-200 bg-slate-50 p-2">
          {parts.map((pt) => {
            const k = PART_KEY[pt.gender]
            const sizes = plan[k] ?? []
            const set = (arr: number[]) => setPlan({ ...plan, [k]: arr })
            const typed = sizes.reduce((a, b) => a + b, 0)
            return (
              <div key={pt.gender} className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="w-14 text-slate-600">{PART_NAME[pt.gender]}</span>
                {sizes.map((n, i) => (
                  <input key={i} aria-label={`${PART_NAME[pt.gender]} section ${i + 1} strength`} type="number" min={0} className="w-14 rounded border border-slate-300 px-1.5 py-1 text-right" value={n} onChange={(e) => set(sizes.map((x, j) => (j === i ? num(e.target.value) : x)))} />
                ))}
                <button type="button" title="Add a section" className="rounded border border-slate-300 bg-white px-2 py-1" onClick={() => set([...sizes, 0])}>+</button>
                {sizes.length > 1 && <button type="button" title="Remove the last section" className="rounded border border-slate-300 bg-white px-2 py-1" onClick={() => set(sizes.slice(0, -1))}>−</button>}
                <span className={typed === pt.n ? 'text-emerald-700' : 'font-medium text-red-600'}>{typed} / {pt.n}{sizes.some((x) => x > cap) ? ` · above limit ${cap}` : ''}</span>
              </div>
            )
          })}
          {bad.length > 0 && <p className="text-xs text-red-600">Typed strengths do not add up to the students entered — correct them or switch back to Auto.</p>}
        </div>
      )}
    </div>
  )
}

function Card({ title, note, children }: { title: string; note: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200/80 bg-white">
      <div className="border-b border-slate-200 px-4 py-3">
        <h3 className="font-semibold text-slate-900">{title}</h3>
        <p className="text-sm text-slate-500">{note}</p>
      </div>
      <div className="overflow-x-auto">{children}</div>
    </section>
  )
}

export default function StrengthTab({ rules, data, sections, onChange }: { rules: RuleSet; data: SchoolData; sections: Section[]; onChange: (d: SchoolData) => void }) {
  const secsOf = (std: string, groupId?: string) => sections.filter((s) => s.standard === std && (groupId ? s.groupId === groupId : true))
  const get = (std: string) => data.strength[std] ?? { boys: 0, girls: 0 }
  const setStd = (std: string, c: GenderCount) => onChange({ ...data, strength: { ...data.strength, [std]: c } })
  const setHss = (std: string, gid: string, c: GenderCount) => onChange({ ...data, hss: { ...data.hss, [std]: { ...(data.hss[std] ?? {}), [gid]: c } } })

  const primary = STANDARDS.filter((s) => s === 'PREKG' || s === 'LKG' || s === 'UKG' || (Number(s) >= 1 && Number(s) <= 5))
  const middle = STANDARDS.filter((s) => Number(s) >= 6 && Number(s) <= 10)
  const split = data.genderSeparate

  const sum = (list: string[], f: (c: GenderCount) => number) => list.reduce((a, s) => a + f(get(s)), 0)
  const secCount = (list: string[]) => list.reduce((a, s) => a + secsOf(s).length, 0)
  const hssRows = ['11', '12'].flatMap((std) => rules.hssGroups.map((g) => ({ std, g, c: data.hss[std]?.[g.id] ?? { boys: 0, girls: 0 } })))

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start gap-4 rounded-xl border border-slate-200/80 bg-white p-4">
        <label className="flex items-center gap-2 font-medium text-slate-900">
          <input type="checkbox" className="h-4 w-4" checked={split} onChange={(e) => onChange({ ...data, genderSeparate: e.target.checked })} />
          Separate boys and girls sections from Class 6
        </label>
        <p className="text-sm text-slate-500 md:ml-auto md:max-w-xl">
          {split
            ? 'On: from Class 6, boys and girls are placed in their own sections. Pre-KG to Class 5 are always mixed.'
            : 'Off: all classes have mixed sections.'}
          {' '}Auto = fewest sections within the limit, students shared evenly (35 with limit 30 → 18 + 17). Manual = type each section’s strength.
          {' '}Section limits are set per board under Board Rules.
        </p>
      </div>

      <Card title="Pre-KG to Class 5" note="Enter the total number of students. Sections are always mixed.">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className={th}>Standard</th><th className={`${th} text-right`}>Students</th><th className={`${th} text-right`}>Max per section</th><th className={`${th} text-right`}>Sections</th><th className={th}>Sections (Auto / Manual)</th></tr>
          </thead>
          <tbody>
            {primary.map((std) => {
              const c = get(std)
              return (
                <tr key={std} className="border-t border-slate-100">
                  <td className={`${td} font-medium`}>{label(std)}</td>
                  <td className={`${td} text-right`}><input aria-label={`${label(std)} students`} type="number" min={0} className={input} value={c.boys + c.girls} onChange={(e) => setStd(std, { boys: num(e.target.value), girls: 0 })} /></td>
                  <td className={`${td} text-right text-slate-500`}>{rules.sectionCap[stageOf(std)]}</td>
                  <td className={`${td} text-right font-semibold`}>{secsOf(std).length}</td>
                  <td className={td}><SecCell std={std} c={c} cap={rules.sectionCap[stageOf(std)]} secs={secsOf(std)} data={data} onChange={onChange} /></td>
                </tr>
              )
            })}
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
              <td className={td}>Total</td><td className={`${td} text-right`}>{sum(primary, (c) => c.boys + c.girls)}</td><td /><td className={`${td} text-right`}>{secCount(primary)}</td><td />
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Class 6 to Class 10" note="Enter boys and girls separately.">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className={th}>Standard</th><th className={`${th} text-right`}>Boys</th><th className={`${th} text-right`}>Girls</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Max per section</th><th className={`${th} text-right`}>Sections</th><th className={th}>Sections (Auto / Manual)</th></tr>
          </thead>
          <tbody>
            {middle.map((std) => {
              const c = get(std)
              return (
                <tr key={std} className="border-t border-slate-100">
                  <td className={`${td} font-medium`}>{label(std)}</td>
                  <td className={`${td} text-right`}><input aria-label={`${label(std)} boys`} type="number" min={0} className={input} value={c.boys} onChange={(e) => setStd(std, { ...c, boys: num(e.target.value) })} /></td>
                  <td className={`${td} text-right`}><input aria-label={`${label(std)} girls`} type="number" min={0} className={input} value={c.girls} onChange={(e) => setStd(std, { ...c, girls: num(e.target.value) })} /></td>
                  <td className={`${td} text-right`}>{c.boys + c.girls}</td>
                  <td className={`${td} text-right text-slate-500`}>{rules.sectionCap[stageOf(std)]}</td>
                  <td className={`${td} text-right font-semibold`}>{secsOf(std).length}</td>
                  <td className={td}><SecCell std={std} c={c} cap={rules.sectionCap[stageOf(std)]} secs={secsOf(std)} data={data} onChange={onChange} /></td>
                </tr>
              )
            })}
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
              <td className={td}>Total</td>
              <td className={`${td} text-right`}>{sum(middle, (c) => c.boys)}</td>
              <td className={`${td} text-right`}>{sum(middle, (c) => c.girls)}</td>
              <td className={`${td} text-right`}>{sum(middle, (c) => c.boys + c.girls)}</td>
              <td /><td className={`${td} text-right`}>{secCount(middle)}</td><td />
            </tr>
          </tbody>
        </table>
      </Card>

      <Card title="Class 11 and Class 12 — by group" note={`Sections are formed separately for each group (max ${rules.sectionCap.HSS} per section).`}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className={th}>Standard</th><th className={th}>Group</th><th className={`${th} text-right`}>Boys</th><th className={`${th} text-right`}>Girls</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Sections</th><th className={th}>Sections (Auto / Manual)</th></tr>
          </thead>
          <tbody>
            {hssRows.map(({ std, g, c }, i) => (
              <tr key={std + g.id} className={`border-t ${i > 0 && hssRows[i - 1].std !== std ? 'border-slate-300' : 'border-slate-100'}`}>
                <td className={`${td} font-medium`}>{i === 0 || hssRows[i - 1].std !== std ? `Class ${std}` : ''}</td>
                <td className={td}>{g.name}</td>
                <td className={`${td} text-right`}><input aria-label={`Class ${std} ${g.name} boys`} type="number" min={0} className={input} value={c.boys} onChange={(e) => setHss(std, g.id, { ...c, boys: num(e.target.value) })} /></td>
                <td className={`${td} text-right`}><input aria-label={`Class ${std} ${g.name} girls`} type="number" min={0} className={input} value={c.girls} onChange={(e) => setHss(std, g.id, { ...c, girls: num(e.target.value) })} /></td>
                <td className={`${td} text-right`}>{c.boys + c.girls}</td>
                <td className={`${td} text-right font-semibold`}>{secsOf(std, g.id).length}</td>
                <td className={td}><SecCell std={std} groupId={g.id} c={c} cap={rules.sectionCap.HSS} secs={secsOf(std, g.id)} data={data} onChange={onChange} /></td>
              </tr>
            ))}
            <tr className="border-t border-slate-200 bg-slate-50 font-semibold">
              <td className={td} colSpan={2}>Total</td>
              <td className={`${td} text-right`}>{hssRows.reduce((a, r) => a + r.c.boys, 0)}</td>
              <td className={`${td} text-right`}>{hssRows.reduce((a, r) => a + r.c.girls, 0)}</td>
              <td className={`${td} text-right`}>{hssRows.reduce((a, r) => a + r.c.boys + r.c.girls, 0)}</td>
              <td className={`${td} text-right`}>{secCount(['11', '12'])}</td><td />
            </tr>
          </tbody>
        </table>
      </Card>
    </div>
  )
}
