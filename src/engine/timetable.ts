import { CLASS_TEACHER, teacherCategoryFor } from './calc'
import { blocks, categoryForStage, effectiveLimits, isClassTeacherStage } from './rules'
import type { Cell, Category, Lesson, RuleSet, Section, Staff, TeacherRef, TimetableResult } from './types'
import { isTeachingCategory } from './types'
import { splitParallel } from './parallel'

const norm = (x: string) => x.trim().toLowerCase()

// ---------------- teacher assignment ----------------

export function assignTeachers(rules: RuleSet, sections: Section[], staff: Staff[]) {
  // Periods already given to named teachers in the school's allocation
  const named = new Map<string, number>()
  for (const sec of sections)
    for (const a of sec.allocs ?? [])
      if (a.mode === 'named') a.teachers.forEach((id, i) => named.set(id, (named.get(id) ?? 0) + Math.floor(a.periods / a.teachers.length) + (i < a.periods % a.teachers.length ? 1 : 0)))
  const teachers: TeacherRef[] = staff
    .filter((s) => named.has(s.id) || (isTeachingCategory(s.category) && (s.category !== 'PRINCIPAL' || (s.maxPerWeek ?? 0) > 0)))
    .map((s) => {
      const lim = effectiveLimits(rules, rules.workload[s.category], s)
      const n = named.get(s.id) ?? 0
      // The school's own allocation is respected even above policy; overload is reported separately
      return { id: s.id, name: s.name, category: s.category, maxPerWeek: Math.max(lim.perWeek, n), maxPerDay: Math.max(lim.perDay, Math.ceil(n / rules.daysPerWeek)), vacancy: false }
    })
  const subjOf = new Map(staff.map((s) => [s.id, s.subjects.map(norm)]))
  const load = new Map<string, number>(teachers.map((t) => [t.id, 0]))
  const byId = new Map(teachers.map((t) => [t.id, t]))
  const lessons: Lesson[] = []
  let vacN = 0

  const vacancy = (category: Category, subject: string, need: number): TeacherRef => {
    const existing = teachers.find(
      (t) => t.vacancy && t.category === category && subjOf.get(t.id)?.[0] === norm(subject) && load.get(t.id)! + need <= t.maxPerWeek,
    )
    if (existing) return existing
    const lim = effectiveLimits(rules, rules.workload[category])
    const t: TeacherRef = {
      id: `VAC-${++vacN}`,
      name: `Vacancy ${vacN}: ${subject}`,
      category,
      maxPerWeek: lim.perWeek,
      maxPerDay: lim.perDay,
      vacancy: true,
    }
    teachers.push(t)
    byId.set(t.id, t)
    subjOf.set(t.id, [norm(subject)])
    load.set(t.id, 0)
    return t
  }

  const targetOf = new Map(staff.map((s) => [s.id, s.maxPerWeek ?? effectiveLimits(rules, rules.workload[s.category]).target]))
  const effTarget = (t: TeacherRef) => Math.min(t.maxPerWeek, targetOf.get(t.id) ?? effectiveLimits(rules, rules.workload[t.category]).target)
  const pick = (cands: TeacherRef[], need: number) =>
    cands
      .filter((t) => load.get(t.id)! + need <= t.maxPerWeek)
      .sort((a, b) => load.get(a.id)! / a.maxPerWeek - load.get(b.id)! / b.maxPerWeek)[0]

  const give = (sec: Section, subject: string, count: number, pref: Lesson['pref'], t: TeacherRef | null) => {
    if (t) load.set(t.id, load.get(t.id)! + count)
    lessons.push({ id: `${sec.id}|${subject}`, sectionId: sec.id, subject, teacherId: t?.id ?? null, count, pref })
  }

  // 1) class teachers (pre-primary & primary)
  // 0) sections with the school's own allocation — named periods first, then shared ones fill spare capacity
  const allocSecs = sections.filter((s) => s.allocs)
  const restOf = new Map(allocSecs.map((sec) => {
    const sp = splitParallel(sec.allocs!)
    sp.blocks.forEach((b, i) => {
      const ids = [...new Set(b.lanes.map((l) => l.teacherId).filter((x): x is string => !!x))]
      for (const id of ids) load.set(id, (load.get(id) ?? 0) + b.count)
      lessons.push({
        id: `${sec.id}|P${i}`, sectionId: sec.id, subject: [...new Set(b.lanes.map((l) => l.subject))].join(' / '),
        teacherId: ids[0] ?? null, ...(ids.length > 1 ? { coTeacherIds: ids.slice(1) } : {}), count: b.count, pref: 'any',
      })
    })
    return [sec.id, sp.rest] as const
  }))
  for (const sec of allocSecs)
    for (const a of restOf.get(sec.id)!) {
      if (a.mode !== 'named') continue
      a.teachers.forEach((id, i) => {
        const n = Math.floor(a.periods / a.teachers.length) + (i < a.periods % a.teachers.length ? 1 : 0)
        if (n > 0) { load.set(id, (load.get(id) ?? 0) + n); lessons.push({ id: `${sec.id}|${a.subject}|${id}#${lessons.length}`, sectionId: sec.id, subject: a.subject, teacherId: id, count: n, pref: a.pref }) }
      })
    }
  for (const sec of allocSecs) {
    const mine = [...new Set(sec.allocs!.filter((a) => a.mode === 'named').flatMap((a) => a.teachers))].map((id) => byId.get(id)!).filter(Boolean)
    for (const a of restOf.get(sec.id)!) {
      if (a.mode === 'named') continue
      const t = pick(mine, a.periods) ?? vacancy(teacherCategoryFor(sec, {}), a.mode === 'shared' ? `${a.subject} (shared)` : `${a.subject} (unassigned)`, a.periods)
      load.set(t.id, (load.get(t.id) ?? 0) + a.periods)
      lessons.push({ id: `${sec.id}|${a.subject}|${t.id}#${lessons.length}`, sectionId: sec.id, subject: a.subject, teacherId: t.id, count: a.periods, pref: a.pref })
    }
  }
  for (const sec of sections) {
    if (sec.allocs) continue
    if (!isClassTeacherStage(sec.stage)) continue
    const cat = categoryForStage(sec.stage)
    const core = sec.subjects.filter((s) => !s.specialist && !s.noTeacher)
    const need = core.reduce((a, s) => a + s.periods, 0)
    const ct =
      pick(teachers.filter((t) => !t.vacancy && t.category === cat && load.get(t.id) === 0), need) ??
      vacancy(cat, CLASS_TEACHER, need)
    core.forEach((s) => give(sec, s.subject, s.periods, s.pref, ct))
  }
  // 2) subject teachers: best-fit decreasing (mirrors the demand calculation)
  const items: { sec: Section; sub: Section['subjects'][number] }[] = []
  for (const sec of sections.filter((s) => !s.allocs))
    for (const sub of sec.subjects) {
      if (sub.noTeacher) { give(sec, sub.subject, sub.periods, sub.pref, null); continue }
      if (sub.flex) continue
      if (isClassTeacherStage(sec.stage) && !sub.specialist) continue
      items.push({ sec, sub })
    }
  items.sort((a, b) => b.sub.periods - a.sub.periods)
  const bestFit = (cands: TeacherRef[], need: number) =>
    cands
      .filter((t) => load.get(t.id)! + need <= effTarget(t))
      .sort((a, b) => effTarget(b) - load.get(b.id)! - (effTarget(a) - load.get(a.id)!))
      .reverse()[0] ?? pick(cands, need)
  const sectionTeachers = new Map<string, Set<string>>()
  for (const { sec, sub } of items) {
    const cat = teacherCategoryFor(sec, sub)
    const qualified = teachers.filter(
      (t) => !t.vacancy && (t.category === cat || t.category === 'ACAD_HEAD') && subjOf.get(t.id)!.includes(norm(sub.subject)),
    )
    const t =
      bestFit(qualified.filter((q) => q.category === cat), sub.periods) ??
      bestFit(qualified, sub.periods) ??
      vacancy(cat, sub.subject, sub.periods)
    if (!sectionTeachers.has(sec.id)) sectionTeachers.set(sec.id, new Set())
    sectionTeachers.get(sec.id)!.add(t.id)
    give(sec, sub.subject, sub.periods, sub.pref, t)
  }
  // 3) flex periods (Club / Library) go to a teacher with spare capacity, preferably one already in the section
  for (const sec of sections.filter((s) => !s.allocs))
    for (const sub of sec.subjects.filter((s) => s.flex)) {
      const cat = teacherCategoryFor(sec, sub)
      const mine = [...(sectionTeachers.get(sec.id) ?? [])].map((id) => byId.get(id)!)
      const t =
        pick(mine.filter((x) => !x.vacancy), sub.periods) ??
        pick(teachers.filter((x) => !x.vacancy && x.category === cat), sub.periods) ??
        pick(mine, sub.periods) ??
        vacancy(cat, sub.subject, sub.periods)
      give(sec, sub.subject, sub.periods, sub.pref, t)
    }
  return { teachers, lessons, load }
}

// ---------------- scheduling ----------------

function rng(seed: number) {
  let s = seed >>> 0 || 1
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5
    return ((s >>> 0) % 100000) / 100000
  }
}

interface State {
  grid: Record<string, (Cell | null)[][]>
  busy: Map<string, boolean[][]>
  dayCount: Map<string, number[]>
  rem: Map<string, number>
  /** where[teacherId][d][p] = sectionId teaching then ('' if free) */
  where: Map<string, string[][]>
}

export function generateTimetable(
  rules: RuleSet,
  sections: Section[],
  staff: Staff[],
  opts: { attempts?: number; seed?: number } = {},
): TimetableResult {
  const D = rules.daysPerWeek
  const P = rules.periodsPerDay
  const { teachers, lessons } = assignTeachers(rules, sections, staff)
  const tById = new Map(teachers.map((t) => [t.id, t]))
  const lById = new Map(lessons.map((l) => [l.id, l]))
  const bySection = new Map<string, Lesson[]>()
  for (const l of lessons) bySection.set(l.sectionId, [...(bySection.get(l.sectionId) ?? []), l])
  const blockOf: number[] = []
  blocks(rules).forEach((b, i) => b.forEach((p) => (blockOf[p] = i)))
  const lunch = rules.lunchAfterPeriod

  const prefScore = (pref: Lesson['pref'], p: number) => {
    if (pref === 'morning') return p < 3 ? 1 : p < lunch ? 0.2 : -0.6
    if (pref === 'afternoon') return p >= lunch ? 0.8 : p < 3 ? -0.4 : 0
    if (pref === 'last') return p === P - 1 ? 1.5 : p >= lunch ? 0.3 : -1
    return 0
  }

  const teachersOf = (l: { teacherId: string | null; coTeacherIds?: string[] }) => (l.teacherId ? [l.teacherId, ...(l.coTeacherIds ?? [])] : [])
  const canTeach = (st: State, tid: string, d: number, p: number) => {
    const t = tById.get(tid)!
    const b = st.busy.get(tid)!
    if (b[d][p]) return false
    if (st.dayCount.get(tid)![d] >= t.maxPerDay) return false
    let run = 1
    for (let q = p - 1; q >= 0 && blockOf[q] === blockOf[p] && b[d][q]; q--) run++
    for (let q = p + 1; q < P && blockOf[q] === blockOf[p] && b[d][q]; q++) run++
    return run <= rules.maxConsecutive
  }

  const canTeachAll = (st: State, l: Lesson, d: number, p: number) => teachersOf(l).every((t) => canTeach(st, t, d, p))
  const place = (st: State, l: Lesson, d: number, p: number) => {
    st.grid[l.sectionId][d][p] = { lessonId: l.id, subject: l.subject, teacherId: l.teacherId, ...(l.coTeacherIds ? { coTeacherIds: l.coTeacherIds } : {}) }
    st.rem.set(l.id, st.rem.get(l.id)! - 1)
    for (const t of teachersOf(l)) {
      st.busy.get(t)![d][p] = true
      st.dayCount.get(t)![d]++
      st.where.get(t)![d][p] = l.sectionId
    }
  }
  const unplace = (st: State, d: number, p: number, secId: string) => {
    const c = st.grid[secId][d][p]!
    st.grid[secId][d][p] = null
    st.rem.set(c.lessonId, st.rem.get(c.lessonId)! + 1)
    for (const t of teachersOf(c)) {
      st.busy.get(t)![d][p] = false
      st.dayCount.get(t)![d]--
      st.where.get(t)![d][p] = ''
    }
    return lById.get(c.lessonId)!
  }

  const subjectDayCount = (st: State, l: Lesson, d: number) =>
    st.grid[l.sectionId][d].filter((c) => c?.lessonId === l.id).length

  function attempt(seed: number) {
    const r = rng(seed)
    const st: State = {
      grid: Object.fromEntries(sections.map((s) => [s.id, Array.from({ length: D }, () => Array<Cell | null>(P).fill(null))])),
      busy: new Map(teachers.map((t) => [t.id, Array.from({ length: D }, () => Array(P).fill(false))])),
      dayCount: new Map(teachers.map((t) => [t.id, Array(D).fill(0)])),
      rem: new Map(lessons.map((l) => [l.id, l.count])),
      where: new Map(teachers.map((t) => [t.id, Array.from({ length: D }, () => Array(P).fill(''))])),
    }
    const tRem = new Map<string, number>()
    for (const l of lessons) for (const t of teachersOf(l)) tRem.set(t, (tRem.get(t) ?? 0) + l.count)

    // parallel electives first: every teacher of the block must be free in the same period; these cells are then locked
    const locked = new Set<string>()
    const allSlots: [number, number][] = []
    for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) allSlots.push([d, p])
    const shuffled = () => allSlots.map((x) => [r(), x] as const).sort((a, b) => a[0] - b[0]).map(([, x]) => x)
    const blockLessons = lessons.filter((l) => l.coTeacherIds?.length).sort((a, b) => b.count - a.count)
    for (const l of blockLessons)
      for (const relax of [0, 1, P])
        for (const [d, p] of shuffled()) {
          if (st.rem.get(l.id)! <= 0) break
          if (st.grid[l.sectionId][d][p] || subjectDayCount(st, l, d) >= Math.ceil(l.count / D) + relax || !canTeachAll(st, l, d, p)) continue
          place(st, l, d, p)
          locked.add(`${l.sectionId}|${d}|${p}`)
          for (const t of teachersOf(l)) tRem.set(t, tRem.get(t)! - 1)
        }

    for (let d = 0; d < D; d++) {
      for (let p = 0; p < P; p++) {
        const slotsLeft = (D - d) * P - p
        // candidates per section
        const cands = new Map<string, { l: Lesson; score: number }[]>()
        for (const sec of sections) {
          const ls = st.grid[sec.id][d][p] ? [] : (bySection.get(sec.id) ?? []).filter((l) => st.rem.get(l.id)! > 0 && !l.coTeacherIds?.length)
          const build = (relax: number) =>
            ls
              .filter((l) => subjectDayCount(st, l, d) < Math.ceil(l.count / D) + relax)
              .filter((l) => !l.teacherId || canTeach(st, l.teacherId, d, p))
              .map((l) => {
                const tr = l.teacherId ? tRem.get(l.teacherId)! : 0
                const tMax = l.teacherId ? tById.get(l.teacherId)! : null
                const daysLeft = D - d
                const tCap = tMax ? daysLeft * tMax.maxPerDay - st.dayCount.get(tMax.id)![d] : slotsLeft
                const urgency = tMax ? tr / Math.max(1, tCap) : 0
                const lessonUrg = st.rem.get(l.id)! / Math.max(1, (D - d) )
                return { l, score: urgency * 3 + lessonUrg * 0.5 + prefScore(l.pref, p) + r() * 0.4 }
              })
              .sort((a, b) => b.score - a.score)
          let c = build(0)
          if (!c.length) c = build(1)
          if (!c.length) c = build(P)
          cands.set(sec.id, c)
        }
        // bipartite matching sections -> teachers (Kuhn), sections with fewest options first
        const order = [...sections].sort((a, b) => cands.get(a.id)!.length - cands.get(b.id)!.length)
        const owner = new Map<string, string>() // teacherId -> sectionId
        const choice = new Map<string, Lesson>() // sectionId -> lesson
        const tryAssign = (secId: string, seen: Set<string>): boolean => {
          for (const { l } of cands.get(secId)!) {
            if (!l.teacherId) { choice.set(secId, l); return true }
            if (seen.has(l.teacherId)) continue
            seen.add(l.teacherId)
            const o = owner.get(l.teacherId)
            if (!o || tryAssign(o, seen)) {
              owner.set(l.teacherId, secId)
              choice.set(secId, l)
              return true
            }
          }
          return false
        }
        for (const sec of order) tryAssign(sec.id, new Set())
        for (const [secId, l] of choice) {
          // owner map may have been re-pointed; verify consistency
          if (l.teacherId && owner.get(l.teacherId) !== secId) continue
          place(st, l, d, p)
          if (l.teacherId) tRem.set(l.teacherId, tRem.get(l.teacherId)! - 1)
        }
      }
    }

    // repair: min-conflicts with kick-out and tabu
    const queue: Lesson[] = []
    for (const l of lessons) for (let k = 0; k < st.rem.get(l.id)!; k++) queue.push(l)
    const placedAt = new Map<string, number>() // "sec|d|p" -> iteration
    const maxIter = 4000 + 60 * sections.length
    for (let it = 0; it < maxIter && queue.length; it++) {
      const qi = Math.floor(r() * queue.length)
      const l = queue[qi]
      queue.splice(qi, 1)
      if (st.rem.get(l.id)! <= 0) continue
      const g = st.grid[l.sectionId]
      if (l.coTeacherIds?.length) {
        // a parallel block may only move into a period where all its teachers are already free
        const spot = shuffled().find(([d, p]) => !locked.has(`${l.sectionId}|${d}|${p}`) && g[d][p]?.lessonId !== l.id && canTeachAll(st, l, d, p))
        if (!spot) continue
        const [d, p] = spot
        if (g[d][p]) queue.push(unplace(st, d, p, l.sectionId))
        place(st, l, d, p)
        locked.add(`${l.sectionId}|${d}|${p}`)
        continue
      }
      let bestOpt: { d: number; p: number; kicks: [string, number, number][]; cost: number } | null = null
      for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) {
        if (g[d][p]?.lessonId === l.id || locked.has(`${l.sectionId}|${d}|${p}`)) continue
        const kicks: [string, number, number][] = []
        if (g[d][p]) kicks.push([l.sectionId, d, p])
        if (l.teacherId) {
          const tid = l.teacherId
          const t = tById.get(tid)!
          const row = st.where.get(tid)!
          const busyAfter = row[d].map((s) => s !== '')
          const kickT = (q: number) => {
            if (!busyAfter[q]) return
            busyAfter[q] = false
            if (!(row[d][q] === l.sectionId && q === p)) kicks.push([row[d][q], d, q])
          }
          if (busyAfter[p]) kickT(p)
          busyAfter[p] = true
          let cnt = busyAfter.filter(Boolean).length
          // continuous-period rule
          for (;;) {
            let lo = p, hi = p
            while (lo - 1 >= 0 && blockOf[lo - 1] === blockOf[p] && busyAfter[lo - 1]) lo--
            while (hi + 1 < P && blockOf[hi + 1] === blockOf[p] && busyAfter[hi + 1]) hi++
            if (hi - lo + 1 <= rules.maxConsecutive) break
            const left = p - lo, right = hi - p
            kickT(left >= right ? p - 1 : p + 1)
            cnt--
          }
          // daily maximum
          while (cnt > t.maxPerDay) {
            const others = busyAfter.map((b, q) => (b && q !== p ? q : -1)).filter((q) => q >= 0)
            kickT(others[Math.floor(r() * others.length)])
            cnt--
          }
        }
        if (kicks.some(([s, kd, kp]) => locked.has(`${s}|${kd}|${kp}`))) continue
        let cost = kicks.length + r() * 0.5
        for (const [s, kd, kp] of kicks) if (it - (placedAt.get(`${s}|${kd}|${kp}`) ?? -99) < 8) cost += 5
        cost -= prefScore(l.pref, p) * 0.1
        if (!bestOpt || cost < bestOpt.cost) bestOpt = { d, p, kicks, cost }
      }
      if (!bestOpt) { queue.push(l); continue }
      const seen = new Set<string>()
      for (const [s, kd, kp] of bestOpt.kicks) {
        const k = `${s}|${kd}|${kp}`
        if (seen.has(k) || !st.grid[s][kd][kp]) continue
        seen.add(k)
        queue.push(unplace(st, kd, kp, s))
      }
      place(st, l, bestOpt.d, bestOpt.p)
      placedAt.set(`${l.sectionId}|${bestOpt.d}|${bestOpt.p}`, it)
    }

    const unplaced = lessons.filter((l) => st.rem.get(l.id)! > 0).map((l) => ({ lessonId: l.id, remaining: st.rem.get(l.id)! }))
    let soft = 0
    for (const sec of sections) for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) {
      const c = st.grid[sec.id][d][p]
      if (c) soft += prefScore(lById.get(c.lessonId)!.pref, p)
    }
    return { st, unplaced, soft }
  }

  const attempts = opts.attempts ?? 12
  let best: ReturnType<typeof attempt> | null = null
  const missing = (u: { remaining: number }[]) => u.reduce((a, x) => a + x.remaining, 0)
  for (let i = 0; i < attempts; i++) {
    const res = attempt((opts.seed ?? 7) + i * 7919)
    if (!best || missing(res.unplaced) < missing(best.unplaced) || (missing(res.unplaced) === missing(best.unplaced) && res.soft > best.soft)) best = res
    if (missing(best.unplaced) === 0 && i >= 3) break
  }

  const result: TimetableResult = {
    generatedAt: new Date().toISOString(),
    days: D,
    periods: P,
    sections,
    teachers,
    lessons,
    grid: best!.st.grid,
    unplaced: best!.unplaced,
    violations: [],
    softScore: Math.round(best!.soft * 10) / 10,
  }
  result.violations = validateTimetable(rules, result)
  return result
}

/** Independent check of all hard constraints */
export function validateTimetable(rules: RuleSet, tt: TimetableResult): string[] {
  const v: string[] = []
  const D = tt.days
  const P = tt.periods
  const blockOf: number[] = []
  blocks(rules).forEach((b, i) => b.forEach((p) => (blockOf[p] = i)))
  const tName = new Map(tt.teachers.map((t) => [t.id, t]))
  const occ = new Map<string, string[][][]>()
  const counts = new Map<string, number>()
  for (const sec of tt.sections) {
    for (let d = 0; d < D; d++) for (let p = 0; p < P; p++) {
      const c = tt.grid[sec.id][d][p]
      if (!c) continue
      counts.set(c.lessonId, (counts.get(c.lessonId) ?? 0) + 1)
      for (const tid of c.teacherId ? [c.teacherId, ...(c.coTeacherIds ?? [])] : []) {
        if (!occ.has(tid)) occ.set(tid, Array.from({ length: D }, () => Array.from({ length: P }, () => [] as string[])))
        occ.get(tid)![d][p].push(sec.label)
      }
    }
  }
  for (const l of tt.lessons) {
    const got = counts.get(l.id) ?? 0
    if (got > l.count) v.push(`${l.id}: scheduled ${got} > required ${l.count}`)
  }
  for (const [tid, g] of occ) {
    const t = tName.get(tid)!
    let week = 0
    for (let d = 0; d < D; d++) {
      let day = 0
      let run = 0
      for (let p = 0; p < P; p++) {
        const n = g[d][p].length
        if (n > 1) v.push(`${t.name}: double-booked day ${d + 1} period ${p + 1} (${g[d][p].join(', ')})`)
        if (p > 0 && blockOf[p] !== blockOf[p - 1]) run = 0
        if (n > 0) { day++; run++ } else run = 0
        if (run > rules.maxConsecutive) v.push(`${t.name}: more than ${rules.maxConsecutive} continuous periods on day ${d + 1}`)
      }
      if (day > t.maxPerDay) v.push(`${t.name}: ${day} periods on day ${d + 1} (max ${t.maxPerDay})`)
      week += day
    }
    if (week > t.maxPerWeek) v.push(`${t.name}: ${week} periods/week (max ${t.maxPerWeek})`)
  }
  return v
}

export function teacherLoad(tt: TimetableResult) {
  const m = new Map<string, number>()
  for (const sec of tt.sections) for (const day of tt.grid[sec.id]) for (const c of day) if (c?.teacherId) for (const t of [c.teacherId, ...(c.coTeacherIds ?? [])]) m.set(t, (m.get(t) ?? 0) + 1)
  return m
}
