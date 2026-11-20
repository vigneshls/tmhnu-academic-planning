import { describe, expect, it } from 'vitest'
import { buildSections, computeDemand, summarize } from './calc'
import { checklist, recommend, score } from './recommend'
import { defaultRuleSet } from './rules'
import { sampleSchoolData, staffFromDemand } from './sample'
import type { Board, SchoolData, Staff } from './types'

function run(board: Board, mutate?: (d: SchoolData) => void) {
  const rules = defaultRuleSet(board)
  const data = sampleSchoolData(rules)
  const secs0 = buildSections(rules, data)
  data.staff = staffFromDemand(rules, computeDemand(rules, secs0, []))
  mutate?.(data)
  const sections = buildSections(rules, data)
  const demand = computeDemand(rules, sections, data.staff)
  const summary = summarize(rules, data, sections, demand)
  return { recs: recommend({ board, rules, data, sections, demand, summary }), rules }
}
const get = (recs: ReturnType<typeof recommend>, id: string) => recs.find((r) => r.id === id)

describe('recommendations', () => {
  it('flags missing CBSE support staff and passes them once added', () => {
    let { recs } = run('CBSE')
    expect(get(recs, 'cbse-special-educator')?.status).toBe('fail')
    expect(get(recs, 'cbse-counsellor')?.status).toBe('fail')
    ;({ recs } = run('CBSE', (d) => {
      const add = (category: Staff['category'], i: number) => d.staff.push({ id: `x${category}${i}`, name: category, category, subjects: [], appointment: 'REGULAR' })
      add('SPECIAL_EDUCATOR', 1); add('COUNSELLOR', 1); add('COUNSELLOR', 2); add('CAREER_COUNSELLOR', 1)
    }))
    expect(get(recs, 'cbse-special-educator')?.status).toBe('pass')
    expect(get(recs, 'cbse-counsellor')?.status).toBe('pass') // 824 students → 2 counsellors
    expect(get(recs, 'cbse-career')?.status).toBe('pass')
  })

  it('CBSE section above 45 is critical; Matric uses its own cap', () => {
    const { recs } = run('CBSE', (d) => { d.genderSeparate = false; d.strength['5'] = { boys: 46, girls: 0 } })
    // 46 with cap 40 splits into two sections, so no violation
    expect(get(recs, 'cbse-45')?.status).toBe('pass')
    const m = run('MATRIC')
    expect(get(m.recs, 'cbse-45')).toBeUndefined()
    expect(get(m.recs, 'matric-counsellor')?.status).toBe('fail')
  })

  it('detects missing Tamil and teacher shortages', () => {
    const { recs } = run('MATRIC', (d) => { d.staff = d.staff.filter((s) => s.subjects[0] !== 'Maths') })
    expect(recs.filter((r) => r.id.startsWith('short-') && r.status === 'fail').length).toBeGreaterThan(0)
    expect(get(recs, 'tamil')?.status).toBe('pass')
  })

  it('qualification checks use uploaded fields', () => {
    const { recs } = run('MATRIC', (d) => {
      const sgt = d.staff.find((s) => s.category === 'SGT')!
      Object.assign(sgt, { professionalQualification: 'BED', tet: 'NOT_PASSED', highestQualification: 'UG' })
    })
    expect(get(recs, 'qual-primary')?.status).toBe('fail')
    expect(get(recs, 'qual-tet')?.people?.length).toBe(1)
  })

  it('score and checklist', () => {
    const { recs } = run('CBSE')
    const s = score(recs)
    expect(s.total).toBeGreaterThan(5)
    expect(s.critical).toBeGreaterThan(0)
    expect(checklist('CBSE').length).toBeGreaterThan(8)
    expect(checklist('MATRIC').some((c) => c.id === 'tn-recognition')).toBe(true)
    for (const r of recs) expect(r.source.url).toBeTruthy()
  })
})
