import type { Allocation, SchoolData } from './types'

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'

/**
 * Separate Boys / Girls sections from Class 6.
 * When the School Profile asks for separate sections and the school's sheet runs boys and girls of a class
 * in one section, that section becomes the Boys section and a Girls section is added with the same subjects,
 * periods and teachers. Sections already marked "A (Boys)" / "B (Girls)" and single-gender classes are left as they are.
 */
export function splitGenderSections(data: SchoolData): { data: SchoolData; split: { cls: string; boys: string; girls: string; periods: number }[] } {
  const allocs = data.allocations
  if (!data.genderSeparate || !allocs?.length) return { data, split: [] }
  const byClass = new Map<string, Allocation[]>()
  for (const a of allocs) {
    if (!(Number(a.standard) >= 6)) continue
    const k = `${a.standard}|${a.groupId ?? ''}`
    byClass.set(k, [...(byClass.get(k) ?? []), a])
  }
  const extra: Allocation[] = []
  const genderOf = new Map<Allocation, 'B'>()
  const split: { cls: string; boys: string; girls: string; periods: number }[] = []
  for (const [k, rows] of byClass) {
    const [std, gid] = k.split('|')
    const c = (gid ? data.hss[std]?.[gid] : data.strength[std]) ?? { boys: 0, girls: 0 }
    if (!(c.boys > 0 && c.girls > 0)) continue
    const secs = [...new Set(rows.map((a) => a.section))].sort()
    const written = rows.some((a) => a.gender)
    if (written || secs.length >= 2) continue // the school already runs (or marks) separate sections
    const used = new Set(secs)
    const boysSec = secs[0]
    const girlsSec = [...LETTERS].find((L) => !used.has(L))!
    const list = rows.filter((a) => a.section === boysSec)
    for (const a of list) {
      genderOf.set(a, 'B')
      extra.push({ ...a, section: girlsSec, gender: 'G', autoSplit: true })
    }
    const name = `${std}${list[0].groupName ? ' ' + list[0].groupName : ''}`
    split.push({ cls: name, boys: `${name} ${boysSec} (Boys) — ${c.boys}`, girls: `${name} ${girlsSec} (Girls) — ${c.girls}`, periods: list.filter((a) => !a.option).reduce((s, a) => s + a.periods, 0) })
  }
  if (!extra.length) return { data, split }
  const out: Allocation[] = []
  for (const a of allocs) {
    out.push(genderOf.has(a) ? { ...a, gender: 'B' } : a)
    // keep the new Girls rows right after the class they belong to
  }
  return { data: { ...data, allocations: [...out, ...extra] }, split }
}
