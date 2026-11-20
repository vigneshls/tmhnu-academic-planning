import { stageOf } from '../../engine/rules'
import type { GenderCount, RuleSet, SchoolData, Section } from '../../engine/types'
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
        const g = s.gender === 'B' ? 'Boys' : s.gender === 'G' ? 'Girls' : ''
        return (
          <span key={s.id} className={`rounded border px-2 py-0.5 text-xs ${s.gender === 'B' ? 'border-sky-200 bg-sky-50 text-sky-900' : s.gender === 'G' ? 'border-rose-200 bg-rose-50 text-rose-900' : 'border-slate-200 bg-slate-50 text-slate-700'}`}>
            {letter}{g && ` · ${g}`} · {s.strength}
          </span>
        )
      })}
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
            ? 'On: from Class 6, boys and girls are placed in their own sections, each filled up to the section limit. Pre-KG to Class 5 are always mixed.'
            : 'Off: all classes have mixed sections, filled up to the section limit.'}
          {' '}Section limits are set per board under Board Rules.
        </p>
      </div>

      <Card title="Pre-KG to Class 5" note="Enter the total number of students. Sections are always mixed.">
        <table className="w-full text-sm">
          <thead className="border-b border-slate-200 bg-slate-50">
            <tr><th className={th}>Standard</th><th className={`${th} text-right`}>Students</th><th className={`${th} text-right`}>Max per section</th><th className={`${th} text-right`}>Sections</th><th className={th}>Sections formed (letter · students)</th></tr>
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
                  <td className={td}><Chips secs={secsOf(std)} /></td>
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
            <tr><th className={th}>Standard</th><th className={`${th} text-right`}>Boys</th><th className={`${th} text-right`}>Girls</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Max per section</th><th className={`${th} text-right`}>Sections</th><th className={th}>Sections formed (letter · students)</th></tr>
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
                  <td className={td}><Chips secs={secsOf(std)} /></td>
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
            <tr><th className={th}>Standard</th><th className={th}>Group</th><th className={`${th} text-right`}>Boys</th><th className={`${th} text-right`}>Girls</th><th className={`${th} text-right`}>Total</th><th className={`${th} text-right`}>Sections</th><th className={th}>Sections formed (letter · students)</th></tr>
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
                <td className={td}><Chips secs={secsOf(std, g.id)} /></td>
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
