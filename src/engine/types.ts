export type Board = 'CBSE' | 'MATRIC' | 'STATE'
export type Stage = 'PRE' | 'PRIMARY' | 'MIDDLE' | 'HIGH' | 'HSS'
export type Category =
  | 'MONTESSORI'
  | 'SGT'
  | 'TGT'
  | 'PGT'
  | 'SPECIALIST'
  | 'ACAD_HEAD'
  | 'PRINCIPAL'
  // support roles — not timetabled, not counted as subject teachers
  | 'SPECIAL_EDUCATOR'
  | 'COUNSELLOR'
  | 'CAREER_COUNSELLOR'
  | 'LIBRARIAN'
  | 'LAB_ASSISTANT'

export const SUPPORT_CATEGORIES: Category[] = ['SPECIAL_EDUCATOR', 'COUNSELLOR', 'CAREER_COUNSELLOR', 'LIBRARIAN', 'LAB_ASSISTANT']
export const isTeachingCategory = (c: Category) => !SUPPORT_CATEGORIES.includes(c)

export type HighestQualification = 'HSC' | 'DIPLOMA' | 'UG' | 'PG' | 'MPHIL' | 'PHD' | ''
export type ProfessionalQualification = 'DELED' | 'BELED' | 'BED' | 'MED' | 'NTT' | 'BPED' | 'SPLED' | 'NONE' | ''
export type TetStatus = 'TNTET1' | 'TNTET2' | 'TNTET_BOTH' | 'CTET1' | 'CTET2' | 'CTET_BOTH' | 'NOT_PASSED' | 'NA' | ''
export type Appointment = 'REGULAR' | 'PROBATION' | 'CONTRACT' | 'PART_TIME' | ''
export type SlotPref = 'morning' | 'afternoon' | 'last' | 'any'

export const STANDARDS = [
  'PREKG', 'LKG', 'UKG', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12',
] as const
export type Standard = (typeof STANDARDS)[number]
export const HSS_STANDARDS = ['11', '12'] as const

export const STAGES: Stage[] = ['PRE', 'PRIMARY', 'MIDDLE', 'HIGH', 'HSS']

export interface SubjectAlloc {
  subject: string
  periods: number
  pref: SlotPref
  /** Taught by a specialist teacher (Computer, PE/Art, Hindi in primary...) */
  specialist?: boolean
  /** Any teacher already teaching this section may take it (Club/Library) */
  flex?: boolean
  /** Supervised slot, no teacher needed (Play/Rest in pre-primary) */
  noTeacher?: boolean
}

export interface HssGroup {
  id: string
  name: string
  subjects: SubjectAlloc[]
}

export interface Workload {
  min: number
  max: number
  /** Planning load used to compute teachers needed (max − target = buffer) */
  target: number
  maxPerDay: number
}

export interface RuleSet {
  board: Board
  label: string
  daysPerWeek: number
  periodsPerDay: number
  /** Lunch comes after this period number (1-based). Consecutive count resets at lunch. */
  lunchAfterPeriod: number
  /** Short intervals after these periods (1-based), e.g. [2, 6] */
  breaksAfter: number[]
  /** If true, short intervals also reset the continuous-period count (otherwise only lunch does) */
  resetAtIntervals: boolean
  maxConsecutive: number
  sectionCap: Record<Stage, number>
  ptr: Record<Stage, number>
  workload: Record<Category, Workload>
  /** Subject allocation for PREKG..10 */
  subjectsByStandard: Record<string, SubjectAlloc[]>
  /** Groups / streams for 11 and 12 */
  hssGroups: HssGroup[]
  /** CBSE: minimum teachers per section (1.5) */
  minTeachersPerSection?: number
  notes: string[]
}

export interface GenderCount {
  boys: number
  girls: number
}

export interface Staff {
  id: string
  name: string
  category: Category
  /** First subject = main subject */
  subjects: string[]
  maxPerWeek?: number
  maxPerDay?: number
  employeeId?: string
  highestQualification?: HighestQualification
  professionalQualification?: ProfessionalQualification
  tet?: TetStatus
  appointment?: Appointment
  dateOfJoining?: string
  experienceYears?: number
  /** Continuous Professional Development hours completed in the current academic year */
  cpdHours?: number
}

export interface ComplianceEntry {
  done: boolean
  /** YES = in place, NO = not in place, NA = not applicable; blank = not yet confirmed */
  status?: 'YES' | 'NO' | 'NA'
  validUntil?: string
  date?: string
  note?: string
  by?: string
}

export interface SchoolProfile {
  academicYear?: string
  udise?: string
  recognitionNo?: string
  recognitionValidUntil?: string
  minority?: boolean
  workingDaysYear?: number
  periodMinutes?: number
  startTime?: string
  endTime?: string
}

/** Per-school changes to the board rules, normally loaded from the school workbook */
export interface RuleOverrides {
  daysPerWeek?: number
  periodsPerDay?: number
  lunchAfterPeriod?: number
  subjectsByStandard?: Record<string, SubjectAlloc[]>
  hssGroups?: HssGroup[]
}

export interface SchoolData {
  /** PREKG..5: total in boys+girls (girls can stay 0); 6..10: boys/girls */
  strength: Record<string, GenderCount>
  /** 11/12 → groupId → counts */
  hss: Record<string, Record<string, GenderCount>>
  staff: Staff[]
  /** Separate boys/girls sections from Class 6 upward */
  genderSeparate: boolean
  timetable?: TimetableResult
  /** Checklist items confirmed by the school (id → entry) */
  compliance?: Record<string, ComplianceEntry>
  /** When the faculty list was last uploaded */
  staffUpdatedAt?: string
  profile?: SchoolProfile
  /** Children with special needs per standard (11/12 summed across groups) */
  cwsn?: Record<string, number>
  overrides?: RuleOverrides
  /** 'sample' = demo figures; 'import' = loaded from the school's workbook */
  source?: 'sample' | 'import' | 'manual'
  importedAt?: string
}

export interface School {
  id: string
  name: string
  board: Board
}

// ---------- derived ----------

export interface Section {
  id: string
  standard: string
  stage: Stage
  groupId?: string
  gender: 'B' | 'G' | 'C'
  label: string
  strength: number
  subjects: SubjectAlloc[]
}

export interface DemandRow {
  key: string
  category: Category
  subject: string
  periods: number
  target: number
  needed: number
  available: number
  gap: number
}

export interface Lesson {
  id: string
  sectionId: string
  subject: string
  teacherId: string | null
  count: number
  pref: SlotPref
}

export interface TeacherRef {
  id: string
  name: string
  category: Category
  maxPerWeek: number
  maxPerDay: number
  vacancy: boolean
}

export interface Cell {
  lessonId: string
  subject: string
  teacherId: string | null
}

export interface TimetableResult {
  generatedAt: string
  days: number
  periods: number
  sections: Section[]
  teachers: TeacherRef[]
  lessons: Lesson[]
  /** grid[sectionId][day][period] */
  grid: Record<string, (Cell | null)[][]>
  unplaced: { lessonId: string; remaining: number }[]
  violations: string[]
  softScore: number
}
