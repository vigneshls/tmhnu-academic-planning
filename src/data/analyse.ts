import { buildSections, computeDemand, summarize } from '../engine/calc'
import { effectiveRules } from '../engine/effective'
import { recommend, score } from '../engine/recommend'
import type { RuleSet, School, SchoolData } from '../engine/types'

/** One place that turns stored data into everything the screens show */
export function analyse(school: School, boardRules: RuleSet, data: SchoolData) {
  const rules = effectiveRules(boardRules, data)
  const sections = buildSections(rules, data)
  const demand = computeDemand(rules, sections, data.staff)
  const summary = summarize(rules, data, sections, demand)
  const recs = recommend({ board: school.board, rules, data, sections, demand, summary })
  return { rules, sections, demand, summary, recs, score: score(recs) }
}
export type Analysis = ReturnType<typeof analyse>
