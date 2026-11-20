import { useState } from 'react'
import { CLASS_TEACHER } from '../../engine/calc'
import { CATEGORY_LABEL, effectiveLimits } from '../../engine/rules'
import type { Category, DemandRow, RuleSet, SchoolData, Staff } from '../../engine/types'
import { downloadCsv } from '../../lib/csv'

const CATS = Object.keys(CATEGORY_LABEL) as Category[]
const newId = () => `st-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`

function parseCategory(s: string): Category | null {
  const u = s.trim().toUpperCase().replace(/[\s-]+/g, '_')
  if (CATS.includes(u as Category)) return u as Category
  if (u.startsWith('MONT') || u === 'PRE_PRIMARY') return 'MONTESSORI'
  if (u.startsWith('SPEC') || u === 'PET') return 'SPECIALIST'
  if (u.startsWith('ACAD') || u === 'HOD' || u === 'VP') return 'ACAD_HEAD'
  return null
}

export default function StaffTab({ rules, data, demand, onChange }: { rules: RuleSet; data: SchoolData; demand: DemandRow[]; onChange: (d: SchoolData) => void }) {
  const [paste, setPaste] = useState('')
  const [pasteMsg, setPasteMsg] = useState('')
  const staff = data.staff
  const set = (list: Staff[]) => onChange({ ...data, staff: list })
  const patch = (id: string, p: Partial<Staff>) => set(staff.map((s) => (s.id === id ? { ...s, ...p } : s)))

  const importPaste = () => {
    const added: Staff[] = []
    const bad: number[] = []
    paste.split(/\r?\n/).forEach((line, i) => {
      if (!line.trim()) return
      const [name, cat, subj] = line.split(/\t|,/).map((x) => x?.trim() ?? '')
      const category = parseCategory(cat ?? '')
      if (!name || !category) { bad.push(i + 1); return }
      added.push({ id: newId(), name: name.slice(0, 80), category, subjects: (subj ?? '').split(/[;/|]/).map((x) => x.trim()).filter(Boolean) })
    })
    set([...staff, ...added])
    setPaste('')
    setPasteMsg(`${added.length} added${bad.length ? `; skipped lines ${bad.join(', ')} (need: Name, Category, Subject1;Subject2)` : ''}`)
  }

  const addPlaceholders = () => {
    const extra: Staff[] = []
    for (const d of demand) {
      if (d.gap >= 0) continue
      const subj = d.subject === CLASS_TEACHER ? 'All subjects' : d.subject.startsWith('Shared') ? '' : d.subject
      for (let i = 0; i < -d.gap; i++) extra.push({ id: newId(), name: `NEW ${d.category} ${subj || 'Any'} ${i + 1}`, category: d.category, subjects: subj ? [subj] : [] })
    }
    set([...staff, ...extra])
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-indigo-700 px-3 py-1.5 text-sm text-white" onClick={() => set([...staff, { id: newId(), name: '', category: 'TGT', subjects: [] }])}>+ Add teacher</button>
        <button className="rounded border px-3 py-1.5 text-sm" onClick={addPlaceholders} title="Adds 'NEW …' rows for every shortage so you can plan recruitment">
          Add placeholders for shortages
        </button>
        <button className="rounded border px-3 py-1.5 text-sm" onClick={() => downloadCsv('staff.csv', [['Name', 'Category', 'Subjects', 'Max/week', 'Max/day'], ...staff.map((s) => [s.name, s.category, s.subjects.join(';'), s.maxPerWeek ?? '', s.maxPerDay ?? ''])])}>
          Export CSV
        </button>
        <span className="self-center text-sm text-zinc-500">{staff.length} staff</span>
      </div>

      <div className="overflow-x-auto rounded-lg border bg-white">
        <table className="w-full text-sm">
          <thead className="bg-zinc-100 text-left">
            <tr><th className="p-2">Name</th><th className="p-2">Category</th><th className="p-2">Subjects (main first, separated by ;)</th><th className="p-2">Max / week</th><th className="p-2">Max / day</th><th className="p-2" /></tr>
          </thead>
          <tbody>
            {staff.map((s) => {
              const lim = effectiveLimits(rules, rules.workload[s.category])
              return (
                <tr key={s.id} className="border-t">
                  <td className="p-2"><input aria-label="Name" className="w-48 rounded border px-2 py-1" value={s.name} maxLength={80} onChange={(e) => patch(s.id, { name: e.target.value })} /></td>
                  <td className="p-2">
                    <select aria-label="Category" className="rounded border px-2 py-1" value={s.category} onChange={(e) => patch(s.id, { category: e.target.value as Category })}>
                      {CATS.map((c) => <option key={c} value={c}>{CATEGORY_LABEL[c]}</option>)}
                    </select>
                  </td>
                  <td className="p-2"><input aria-label="Subjects" className="w-64 rounded border px-2 py-1" value={s.subjects.join('; ')} onChange={(e) => patch(s.id, { subjects: e.target.value.split(';').map((x) => x.trimStart()).filter((x, i, a) => x || i === a.length - 1) })} onBlur={(e) => patch(s.id, { subjects: e.target.value.split(';').map((x) => x.trim()).filter(Boolean) })} /></td>
                  <td className="p-2"><input aria-label="Max per week" type="number" min={0} placeholder={String(lim.perWeek)} className="w-20 rounded border px-2 py-1" value={s.maxPerWeek ?? ''} onChange={(e) => patch(s.id, { maxPerWeek: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></td>
                  <td className="p-2"><input aria-label="Max per day" type="number" min={0} placeholder={String(lim.perDay)} className="w-16 rounded border px-2 py-1" value={s.maxPerDay ?? ''} onChange={(e) => patch(s.id, { maxPerDay: e.target.value === '' ? undefined : Math.max(0, Number(e.target.value)) })} /></td>
                  <td className="p-2"><button aria-label={`Remove ${s.name}`} className="text-red-600 hover:underline" onClick={() => set(staff.filter((x) => x.id !== s.id))}>Remove</button></td>
                </tr>
              )
            })}
            {staff.length === 0 && <tr><td colSpan={6} className="p-6 text-center text-zinc-500">No staff yet. Add teachers, paste a list below, or add placeholders for the shortages.</td></tr>}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        Subject names must match the board rules exactly (case ignored):{' '}
        {[...new Set([...Object.values(rules.subjectsByStandard).flat(), ...rules.hssGroups.flatMap((g) => g.subjects)].filter((x) => !x.noTeacher && !x.flex).map((x) => x.subject))].sort().join(' · ')}
      </p>

      <div className="rounded-lg border bg-white p-4">
        <h3 className="font-semibold">Paste from Excel</h3>
        <p className="mb-2 text-xs text-zinc-500">One teacher per line: <code>Name, Category, Subject1;Subject2</code> — Category: MONTESSORI, SGT, TGT, PGT, SPECIALIST, ACAD_HEAD, PRINCIPAL. For SGT/Montessori class teachers use subject “All subjects”.</p>
        <textarea aria-label="Paste staff list" className="h-28 w-full rounded border p-2 font-mono text-xs" value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={'R. Kumar, TGT, Maths\nS. Priya, PGT, Physics\nA. Devi, SGT, All subjects'} />
        <div className="mt-2 flex items-center gap-3">
          <button className="rounded border px-3 py-1.5 text-sm" disabled={!paste.trim()} onClick={importPaste}>Import</button>
          {pasteMsg && <span className="text-sm text-zinc-600">{pasteMsg}</span>}
        </div>
      </div>
    </div>
  )
}
