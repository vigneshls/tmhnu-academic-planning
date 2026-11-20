import { CLASS_TEACHER } from './calc'
import type { DemandRow, RuleSet, SchoolData, Staff } from './types'

/** Fictional demo strength — not real school data */
export function sampleSchoolData(rules: RuleSet): SchoolData {
  const strength: SchoolData['strength'] = {
    PREKG: { boys: 14, girls: 12 }, LKG: { boys: 18, girls: 16 }, UKG: { boys: 20, girls: 17 },
    '1': { boys: 22, girls: 20 }, '2': { boys: 21, girls: 19 }, '3': { boys: 24, girls: 22 },
    '4': { boys: 20, girls: 18 }, '5': { boys: 23, girls: 21 },
    '6': { boys: 38, girls: 30 }, '7': { boys: 36, girls: 28 }, '8': { boys: 33, girls: 31 },
    '9': { boys: 42, girls: 35 }, '10': { boys: 40, girls: 36 },
  }
  const hss: SchoolData['hss'] = { '11': {}, '12': {} }
  rules.hssGroups.forEach((g, i) => {
    hss['11'][g.id] = { boys: 18 - i * 3, girls: 16 - i * 2 }
    hss['12'][g.id] = { boys: 17 - i * 3, girls: 15 - i * 2 }
  })
  return { strength, hss, staff: [], genderSeparate: true }
}

/** Creates exactly the staff the demand table asks for (demo / test helper) */
export function staffFromDemand(_rules: RuleSet, demand: DemandRow[]): Staff[] {
  const out: Staff[] = []
  let n = 0
  for (const d of demand) {
    for (let i = 0; i < d.needed; i++) {
      const subject = d.subject === CLASS_TEACHER ? 'All subjects' : d.subject.startsWith('Shared') ? 'English' : d.subject
      out.push({ id: `T${++n}`, name: `Teacher ${n} (${subject})`, category: d.category, subjects: [subject] })
    }
  }
  return out
}
