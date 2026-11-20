import { stageOf } from '../../engine/rules'
import type { GenderCount, RuleSet, SchoolData, Section } from '../../engine/types'
import { STANDARDS } from '../../engine/types'

const num = (v: string) => Math.max(0, Math.floor(Number(v) || 0))
const label = (s: string) => (s === 'PREKG' ? 'Pre-KG' : /^\d+$/.test(s) ? `Class ${s}` : s)

export default function StrengthTab({ rules, data, sections, onChange }: { rules: RuleSet; data: SchoolData; sections: Section[]; onChange: (d: SchoolData) => void }) {
  const secCount = (std: string, groupId?: string) => sections.filter((s) => s.standard === std && (groupId ? s.groupId === groupId : true)).length
  const setStd = (std: string, c: GenderCount) => onChange({ ...data, strength: { ...data.strength, [std]: c } })
  const setHss = (std: string, gid: string, c: GenderCount) =>
    onChange({ ...data, hss: { ...data.hss, [std]: { ...(data.hss[std] ?? {}), [gid]: c } } })

  const lower = STANDARDS.filter((s) => stageOf(s) !== 'HSS')

  return (
    <div className="space-y-6">
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={data.genderSeparate} onChange={(e) => onChange({ ...data, genderSeparate: e.target.checked })} />
        Separate Boys / Girls sections from Class 6 (6-ம் வகுப்பு முதல் ஆண்/பெண் தனிப் பிரிவு)
      </label>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left">
            <tr><th className="p-2">Standard</th><th className="p-2">Section cap</th><th className="p-2">Boys</th><th className="p-2">Girls</th><th className="p-2">Total</th><th className="p-2">Sections</th></tr>
          </thead>
          <tbody>
            {lower.map((std) => {
              const c = data.strength[std] ?? { boys: 0, girls: 0 }
              const split = Number(std) >= 6
              return (
                <tr key={std} className="border-t">
                  <td className="p-2 font-medium">{label(std)}</td>
                  <td className="p-2 text-zinc-500">{rules.sectionCap[stageOf(std)]}</td>
                  {split ? (
                    <>
                      <td className="p-2"><input aria-label={`${label(std)} boys`} type="number" min={0} className="w-24 rounded border px-2 py-1" value={c.boys} onChange={(e) => setStd(std, { ...c, boys: num(e.target.value) })} /></td>
                      <td className="p-2"><input aria-label={`${label(std)} girls`} type="number" min={0} className="w-24 rounded border px-2 py-1" value={c.girls} onChange={(e) => setStd(std, { ...c, girls: num(e.target.value) })} /></td>
                    </>
                  ) : (
                    <td className="p-2" colSpan={2}>
                      <input aria-label={`${label(std)} total`} type="number" min={0} className="w-24 rounded border px-2 py-1" value={c.boys + c.girls} onChange={(e) => setStd(std, { boys: num(e.target.value), girls: 0 })} />
                      <span className="ml-2 text-xs text-zinc-400">total</span>
                    </td>
                  )}
                  <td className="p-2">{c.boys + c.girls}</td>
                  <td className="p-2 font-semibold text-indigo-800">{secCount(std)}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">Classes 11 & 12 — by group (பிரிவு வாரியாக)</h3>
        <div className="overflow-x-auto rounded-lg border bg-white">
          <table className="w-full text-sm">
            <thead className="bg-zinc-100 text-left">
              <tr><th className="p-2">Standard</th><th className="p-2">Group</th><th className="p-2">Boys</th><th className="p-2">Girls</th><th className="p-2">Total</th><th className="p-2">Sections</th></tr>
            </thead>
            <tbody>
              {['11', '12'].flatMap((std) =>
                rules.hssGroups.map((g) => {
                  const c = data.hss[std]?.[g.id] ?? { boys: 0, girls: 0 }
                  return (
                    <tr key={std + g.id} className="border-t">
                      <td className="p-2 font-medium">Class {std}</td>
                      <td className="p-2">{g.name}</td>
                      <td className="p-2"><input aria-label={`${std} ${g.name} boys`} type="number" min={0} className="w-24 rounded border px-2 py-1" value={c.boys} onChange={(e) => setHss(std, g.id, { ...c, boys: num(e.target.value) })} /></td>
                      <td className="p-2"><input aria-label={`${std} ${g.name} girls`} type="number" min={0} className="w-24 rounded border px-2 py-1" value={c.girls} onChange={(e) => setHss(std, g.id, { ...c, girls: num(e.target.value) })} /></td>
                      <td className="p-2">{c.boys + c.girls}</td>
                      <td className="p-2 font-semibold text-indigo-800">{secCount(std, g.id)}</td>
                    </tr>
                  )
                }),
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
