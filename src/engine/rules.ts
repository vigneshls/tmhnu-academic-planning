import type { Board, Category, HssGroup, RuleSet, Stage, SubjectAlloc, Workload } from './types'

/**
 * Default rule sets.
 * Source of each value:
 *  [DOC-TMHNU]  TMHNU Staff Workload Policy & Period Distribution Guidelines
 *  [DOC-TN]     Tamil Nadu norms document supplied by management
 *  [CBSE]       CBSE Affiliation Bye-Laws 2018 (cl. 4.8: 40/section; cl. 5.4: 1.5 teachers/section, PTR 30:1)
 *  [SAMPLE]     Editable placeholder — not from any document; confirm with each school
 */

// [DOC-TMHNU] ranges; target = planning load (leaves buffer up to max for substitution)
const TMHNU_WORKLOAD: Record<Category, Workload> = {
  MONTESSORI: { min: 25, max: 30, target: 30, maxPerDay: 6 },
  SGT: { min: 30, max: 35, target: 32, maxPerDay: 7 },
  TGT: { min: 32, max: 36, target: 32, maxPerDay: 7 },
  PGT: { min: 30, max: 32, target: 30, maxPerDay: 6 },
  SPECIALIST: { min: 30, max: 36, target: 32, maxPerDay: 7 },
  ACAD_HEAD: { min: 15, max: 20, target: 15, maxPerDay: 4 },
  PRINCIPAL: { min: 0, max: 5, target: 0, maxPerDay: 2 },
  SPECIAL_EDUCATOR: { min: 0, max: 0, target: 0, maxPerDay: 0 },
  COUNSELLOR: { min: 0, max: 0, target: 0, maxPerDay: 0 },
  CAREER_COUNSELLOR: { min: 0, max: 0, target: 0, maxPerDay: 0 },
  LIBRARIAN: { min: 0, max: 0, target: 0, maxPerDay: 0 },
  LAB_ASSISTANT: { min: 0, max: 0, target: 0, maxPerDay: 0 },
}

const s = (
  subject: string,
  periods: number,
  pref: SubjectAlloc['pref'] = 'any',
  extra: Partial<SubjectAlloc> = {},
): SubjectAlloc => ({ subject, periods, pref, ...extra })

// ---- Pre-primary (all boards) [SAMPLE] ----
const PRE: SubjectAlloc[] = [
  s('Language Activities', 8, 'morning'),
  s('Numeracy', 6, 'morning'),
  s('Montessori Activity', 7, 'any'),
  s('Rhymes & Story', 5, 'afternoon'),
  s('Art & Craft', 4, 'afternoon'),
  s('Play / Rest', 10, 'last', { noTeacher: true }),
]

// ---- State Board / Matriculation (Samacheer Kalvi) ----
const SAM_1_2: SubjectAlloc[] = [
  s('Tamil', 7, 'afternoon'), s('English', 7, 'morning'), s('Maths', 8, 'morning'),
  s('EVS', 8, 'any'), s('Library / Value Ed', 2, 'last', { specialist: true }),
  s('Computer Science', 2, 'any', { specialist: true }),
  s('PE / Art', 6, 'afternoon', { specialist: true }),
]
const SAM_3_5: SubjectAlloc[] = [
  s('Tamil', 7, 'afternoon'), s('English', 7, 'morning'), s('Maths', 8, 'morning'),
  s('Science', 4, 'morning'), s('Social Science', 4, 'afternoon'), s('Library / Value Ed', 2, 'last', { specialist: true }),
  s('Computer Science', 2, 'any', { specialist: true }),
  s('PE / Art', 6, 'afternoon', { specialist: true }),
]
// [DOC-TN] Classes 6–8 model allocation (38 periods) + Computer Science 2 [SAMPLE] to fill 40 slots
const SAM_6_8: SubjectAlloc[] = [
  s('Tamil', 6, 'afternoon'), s('English', 6, 'morning'), s('Maths', 7, 'morning'),
  s('Science', 6, 'morning'), s('Social Science', 6, 'afternoon'),
  s('PE / Art', 4, 'afternoon', { specialist: true }),
  s('Club / Library', 3, 'last', { flex: true }),
  s('Computer Science', 2, 'any', { specialist: true }),
]
const SAM_9_10: SubjectAlloc[] = [
  s('Tamil', 6, 'afternoon'), s('English', 6, 'morning'), s('Maths', 8, 'morning'),
  s('Science', 8, 'morning'), s('Social Science', 7, 'afternoon'),
  s('PE / Art', 3, 'last', { specialist: true }),
  s('Computer Science', 2, 'any', { specialist: true }),
]
const SAM_HSS: HssGroup[] = [
  {
    id: 'MB', name: 'Maths-Biology',
    subjects: [s('Tamil', 5, 'afternoon'), s('English', 5, 'afternoon'), s('Maths', 7, 'morning'),
      s('Physics', 7, 'morning'), s('Chemistry', 7, 'morning'), s('Biology', 7, 'any'),
      s('PE / Art', 2, 'last', { specialist: true })],
  },
  {
    id: 'MCS', name: 'Maths-Computer Science',
    subjects: [s('Tamil', 5, 'afternoon'), s('English', 5, 'afternoon'), s('Maths', 7, 'morning'),
      s('Physics', 7, 'morning'), s('Chemistry', 7, 'morning'), s('Computer Science', 7, 'any'),
      s('PE / Art', 2, 'last', { specialist: true })],
  },
  {
    id: 'COM', name: 'Commerce',
    subjects: [s('Tamil', 5, 'afternoon'), s('English', 5, 'afternoon'), s('Accountancy', 7, 'morning'),
      s('Commerce', 7, 'morning'), s('Economics', 7, 'any'), s('Computer Applications', 7, 'any'),
      s('PE / Art', 2, 'last', { specialist: true })],
  },
]

// ---- CBSE [SAMPLE] ----
const CBSE_1_2: SubjectAlloc[] = [
  s('English', 8, 'morning'), s('Tamil', 6, 'afternoon'), s('Maths', 8, 'morning'),
  s('EVS', 8, 'any'), s('Library / Value Ed', 2, 'last', { specialist: true }),
  s('Hindi', 3, 'afternoon', { specialist: true }),
  s('Computer Science', 2, 'any', { specialist: true }),
  s('PE / Art', 3, 'afternoon', { specialist: true }),
]
const CBSE_3_5: SubjectAlloc[] = [
  s('English', 8, 'morning'), s('Tamil', 6, 'afternoon'), s('Maths', 8, 'morning'),
  s('Science', 4, 'morning'), s('Social Science', 4, 'afternoon'), s('Library / Value Ed', 2, 'last', { specialist: true }),
  s('Hindi', 3, 'afternoon', { specialist: true }),
  s('Computer Science', 2, 'any', { specialist: true }),
  s('PE / Art', 3, 'afternoon', { specialist: true }),
]
const CBSE_6_8: SubjectAlloc[] = [
  s('English', 6, 'morning'), s('Tamil', 5, 'afternoon'), s('Hindi', 4, 'afternoon'),
  s('Maths', 7, 'morning'), s('Science', 7, 'morning'), s('Social Science', 6, 'afternoon'),
  s('Computer Science', 2, 'any', { specialist: true }),
  s('PE / Art', 3, 'last', { specialist: true }),
]
const CBSE_9_10: SubjectAlloc[] = [
  s('English', 6, 'morning'), s('Tamil', 5, 'afternoon'), s('Maths', 8, 'morning'),
  s('Science', 8, 'morning'), s('Social Science', 7, 'afternoon'),
  s('Computer Science', 3, 'any', { specialist: true }),
  s('PE / Art', 3, 'last', { specialist: true }),
]
const CBSE_HSS: HssGroup[] = [
  {
    id: 'PCMB', name: 'PCM-Biology',
    subjects: [s('English', 6, 'afternoon'), s('Physics', 8, 'morning'), s('Chemistry', 8, 'morning'),
      s('Maths', 8, 'morning'), s('Biology', 8, 'any'), s('PE / Art', 2, 'last', { specialist: true })],
  },
  {
    id: 'PCMC', name: 'PCM-Computer Science',
    subjects: [s('English', 6, 'afternoon'), s('Physics', 8, 'morning'), s('Chemistry', 8, 'morning'),
      s('Maths', 8, 'morning'), s('Computer Science', 8, 'any'), s('PE / Art', 2, 'last', { specialist: true })],
  },
  {
    id: 'COM', name: 'Commerce',
    subjects: [s('English', 6, 'afternoon'), s('Accountancy', 8, 'morning'), s('Business Studies', 8, 'morning'),
      s('Economics', 8, 'any'), s('Applied Maths', 8, 'morning'), s('PE / Art', 2, 'last', { specialist: true })],
  },
]

function bySt(pre: SubjectAlloc[], p12: SubjectAlloc[], p35: SubjectAlloc[], m: SubjectAlloc[], h: SubjectAlloc[]) {
  return {
    PREKG: pre, LKG: pre, UKG: pre,
    '1': p12, '2': p12, '3': p35, '4': p35, '5': p35,
    '6': m, '7': m, '8': m, '9': h, '10': h,
  }
}

// [SAMPLE] section caps for State/Matric are based on TN PTR norms (Primary 30, Middle 35, High 40);
// HSS PTR 1:60 is a staffing norm, so the section cap is kept at 40.
const TN_CAP: Record<Stage, number> = { PRE: 30, PRIMARY: 30, MIDDLE: 35, HIGH: 40, HSS: 40 }
const TN_PTR: Record<Stage, number> = { PRE: 30, PRIMARY: 30, MIDDLE: 35, HIGH: 40, HSS: 60 } // [DOC-TN]

const COMMON = {
  daysPerWeek: 5, // [DOC-TMHNU] header: working days 5
  periodsPerDay: 8, // [DOC-TN] Classes 6–10: 8–9 periods/day
  lunchAfterPeriod: 4,
  breaksAfter: [2, 6], // [DOC-TN] two 10-minute intervals
  resetAtIntervals: false,
  maxConsecutive: 3, // [DOC-TN] no more than 3 continuous periods
}

function clone<T>(v: T): T {
  return JSON.parse(JSON.stringify(v))
}

export function defaultRuleSet(board: Board): RuleSet {
  if (board === 'CBSE') {
    return clone({
      board, label: 'CBSE', ...COMMON,
      sectionCap: { PRE: 40, PRIMARY: 40, MIDDLE: 40, HIGH: 40, HSS: 40 },
      ptr: { PRE: 30, PRIMARY: 30, MIDDLE: 30, HIGH: 30, HSS: 30 },
      workload: TMHNU_WORKLOAD,
      subjectsByStandard: bySt(PRE, CBSE_1_2, CBSE_3_5, CBSE_6_8, CBSE_9_10),
      hssGroups: CBSE_HSS,
      minTeachersPerSection: 1.5,
      notes: [
        'CBSE Affiliation Bye-Laws 2018 cl. 4.8: optimum 40 students per section; Circular 11/2025: never more than 45, only in documented exceptional cases.',
        'CBSE cl. 5.4: pupil–teacher ratio not above 30:1 and 1.5 teachers per section (excluding Principal, PE teacher and counsellor).',
        'CBSE 2026-27 scheme: third language (R3) compulsory from Class 6, with at least two Indian languages. TN Tamil Learning Act 2006: Tamil to be taught in Classes 1–10.',
        'Subject period allocation is a sample — confirm with the school.',
      ],
    })
  }
  return clone({
    board, label: board === 'MATRIC' ? 'Matriculation' : 'State Board', ...COMMON,
    sectionCap: TN_CAP,
    ptr: TN_PTR,
    workload: TMHNU_WORKLOAD,
    subjectsByStandard: bySt(PRE, SAM_1_2, SAM_3_5, SAM_6_8, SAM_9_10),
    hssGroups: SAM_HSS,
    notes: [
      'Matriculation schools follow the common Samacheer Kalvi syllabus (TN Uniform System of School Education Act, 2010) and are regulated by the TN Private Schools (Regulation) Act 2018 and Rules 2023.',
      'Rules 2023 fix staff strength from pupil strength under Government norms (Rule 28(1), 32(A)(1)) but state no section size; caps here follow TN norms — Primary 1:30, Middle 1:35, High 1:40 — as an institution setting.',
      'RTE Act 2009 Schedule applies to Classes 1–8: PTR 30:1 (1–5) and 35:1 (6–8).',
      'Classes 6–8 allocation from the management document (38 periods) + Computer Science 2 added to fill 40 slots. Other allocations are samples — confirm with the school.',
    ],
  })
}

export function stageOf(std: string): Stage {
  if (std === 'PREKG' || std === 'LKG' || std === 'UKG') return 'PRE'
  const n = Number(std)
  if (n <= 5) return 'PRIMARY'
  if (n <= 8) return 'MIDDLE'
  if (n <= 10) return 'HIGH'
  return 'HSS'
}

export function categoryForStage(stage: Stage): Category {
  return ({ PRE: 'MONTESSORI', PRIMARY: 'SGT', MIDDLE: 'TGT', HIGH: 'TGT', HSS: 'PGT' } as const)[stage]
}

export const CATEGORY_LABEL: Record<Category, string> = {
  MONTESSORI: 'Pre-primary Teacher',
  SGT: 'Primary Teacher (PRT / SGT)',
  TGT: 'Graduate Teacher (TGT / BT Asst.)',
  PGT: 'Post Graduate Teacher (PGT / PG Asst.)',
  SPECIALIST: 'Specialist Teacher (PE, Art, Computer, Library, Hindi)',
  ACAD_HEAD: 'Vice Principal / Academic Head',
  PRINCIPAL: 'Principal',
  SPECIAL_EDUCATOR: 'Special Educator',
  COUNSELLOR: 'Counsellor & Wellness Teacher',
  CAREER_COUNSELLOR: 'Career Counsellor',
  LIBRARIAN: 'Librarian',
  LAB_ASSISTANT: 'Lab Assistant',
}

export const BOARD_LABEL: Record<Board, string> = { CBSE: 'CBSE', MATRIC: 'Matriculation (TN)', STATE: 'State Board' }

/** Class-teacher stages: one teacher per section takes all non-specialist subjects */
export const isClassTeacherStage = (st: Stage) => st === 'PRE' || st === 'PRIMARY'

/** Period blocks (0-based period indices) inside which the continuous-period limit applies */
export function blocks(rules: RuleSet): number[][] {
  const cuts = new Set<number>([rules.lunchAfterPeriod])
  if (rules.resetAtIntervals) rules.breaksAfter.forEach((b) => cuts.add(b))
  const out: number[][] = []
  let cur: number[] = []
  for (let p = 0; p < rules.periodsPerDay; p++) {
    cur.push(p)
    if (cuts.has(p + 1)) { out.push(cur); cur = [] }
  }
  if (cur.length) out.push(cur)
  return out
}

/** Max periods a teacher can physically take given the continuous-period rule */
export function effectiveLimits(rules: RuleSet, w: Workload, override?: { maxPerWeek?: number; maxPerDay?: number }) {
  const blockCap = blocks(rules).reduce((a, b) => {
    const n = b.length
    const k = rules.maxConsecutive
    // best packing of a run-limited block: k on, 1 off, repeated
    return a + n - Math.floor(n / (k + 1))
  }, 0)
  const perDay = Math.min(override?.maxPerDay ?? w.maxPerDay, blockCap)
  const perWeek = Math.min(override?.maxPerWeek ?? w.max, perDay * rules.daysPerWeek)
  const target = Math.min(w.target || w.max, perWeek)
  return { perDay, perWeek, target, blockCap }
}
