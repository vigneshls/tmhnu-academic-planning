import { describe, expect, it } from 'vitest'
import { evenSizes, planClass, planMismatch } from './sectionPlan'

describe('section plan', () => {
  it('splits evenly within the limit, never "30 + 5"', () => {
    expect(evenSizes(35, 30)).toEqual([18, 17])
    expect(evenSizes(30, 30)).toEqual([30])
    expect(evenSizes(61, 30)).toEqual([21, 20, 20])
    expect(evenSizes(0, 30)).toEqual([])
  })

  it('makes boys and girls sections from Class 6 and mixed sections below', () => {
    expect(planClass('6', { boys: 35, girls: 12 }, 30, true).map((p) => `${p.letter}${p.gender}${p.size}`)).toEqual(['AB18', 'BB17', 'CG12'])
    expect(planClass('5', { boys: 20, girls: 15 }, 30, true).map((p) => `${p.letter}${p.gender}${p.size}`)).toEqual(['AC18', 'BC17'])
    expect(planClass('6', { boys: 35, girls: 12 }, 30, false).map((p) => p.size)).toEqual([24, 23])
    // the school's own order: girls first
    expect(planClass('6', { boys: 10, girls: 12 }, 30, true, undefined, ['G', 'B']).map((p) => `${p.letter}${p.gender}`)).toEqual(['AG', 'BB'])
  })

  it('uses typed (Manual) sizes and reports when they do not add up', () => {
    const plan = { girls: [20, 15] }
    expect(planClass('8', { boys: 0, girls: 35 }, 40, true, plan).map((p) => [p.size, p.manual])).toEqual([[20, true], [15, true]])
    expect(planMismatch('8', { boys: 0, girls: 38 }, true, plan)).toEqual([{ gender: 'G', typed: 35, students: 38 }])
    expect(planMismatch('8', { boys: 0, girls: 35 }, true, plan)).toEqual([])
  })
})
