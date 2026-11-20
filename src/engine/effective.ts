import type { RuleSet, SchoolData } from './types'

/** Board rules with the school's own day structure and subject periods applied */
export function effectiveRules(base: RuleSet, data: SchoolData): RuleSet {
  const o = data.overrides
  if (!o) return base
  return {
    ...base,
    daysPerWeek: o.daysPerWeek ?? base.daysPerWeek,
    periodsPerDay: o.periodsPerDay ?? base.periodsPerDay,
    lunchAfterPeriod: o.lunchAfterPeriod ?? base.lunchAfterPeriod,
    breaksAfter: base.breaksAfter.filter((b) => b < (o.periodsPerDay ?? base.periodsPerDay)),
    subjectsByStandard: { ...base.subjectsByStandard, ...(o.subjectsByStandard ?? {}) },
    hssGroups: o.hssGroups ?? base.hssGroups,
  }
}
