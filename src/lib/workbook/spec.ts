/** Single source of truth for the school data workbook (builder and parser both use this). */

export const SHEETS = {
  instructions: 'Instructions',
  profile: 'School Profile',
  students: 'Students',
  faculty: 'Faculty',
  subjects: 'Subject Periods',
  compliance: 'Compliance',
  lists: 'Lists',
} as const

export type ProfileKey =
  | 'schoolName' | 'board' | 'academicYear' | 'udise' | 'recognitionNo' | 'recognitionValidUntil' | 'minority'
  | 'genderSeparate' | 'daysPerWeek' | 'periodsPerDay' | 'periodMinutes' | 'lunchAfterPeriod' | 'workingDaysYear'
  | 'startTime' | 'endTime'

export interface ProfileField {
  key: ProfileKey
  label: string
  type: 'text' | 'date' | 'number' | 'yesno' | 'board'
  required?: boolean
  min?: number
  max?: number
  note: string
}

export const PROFILE_FIELDS: ProfileField[] = [
  { key: 'schoolName', label: 'School Name', type: 'text', required: true, note: 'As in the recognition / affiliation order' },
  { key: 'board', label: 'Board', type: 'board', required: true, note: 'Matriculation or CBSE' },
  { key: 'academicYear', label: 'Academic Year', type: 'text', note: 'e.g. 2026-27' },
  { key: 'udise', label: 'UDISE+ Code', type: 'text', note: '11-digit code' },
  { key: 'recognitionNo', label: 'Recognition / Affiliation No.', type: 'text', note: '' },
  { key: 'recognitionValidUntil', label: 'Recognition Valid Until', type: 'date', note: 'DD-MM-YYYY — used for renewal alerts' },
  { key: 'minority', label: 'Minority Institution', type: 'yesno', note: 'Yes / No — affects RTE admission checks' },
  { key: 'genderSeparate', label: 'Separate Boys / Girls Sections from Class 6', type: 'yesno', note: 'Yes / No' },
  { key: 'daysPerWeek', label: 'Working Days per Week', type: 'number', min: 5, max: 6, note: '5 or 6' },
  { key: 'periodsPerDay', label: 'Teaching Periods per Day', type: 'number', min: 4, max: 12, note: 'Excluding assembly and breaks' },
  { key: 'periodMinutes', label: 'Period Duration (minutes)', type: 'number', min: 30, max: 60, note: 'e.g. 40 or 45' },
  { key: 'lunchAfterPeriod', label: 'Lunch Break After Period', type: 'number', min: 1, max: 11, note: 'e.g. 4' },
  { key: 'workingDaysYear', label: 'Working Days in Academic Year', type: 'number', min: 150, max: 260, note: 'As per the school calendar' },
  { key: 'startTime', label: 'School Start Time', type: 'text', note: 'e.g. 09:00' },
  { key: 'endTime', label: 'School End Time', type: 'text', note: 'e.g. 15:50' },
]

export const CLASS_LABELS: [string, string][] = [
  ['PREKG', 'Pre-KG'], ['LKG', 'LKG'], ['UKG', 'UKG'],
  ...Array.from({ length: 12 }, (_, i) => [String(i + 1), `Class ${i + 1}`] as [string, string]),
]
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
const CLASS_MAP = new Map<string, string>([
  ...CLASS_LABELS.map(([k, l]) => [norm(l), k] as [string, string]),
  ...CLASS_LABELS.map(([k]) => [norm(k), k] as [string, string]),
  ['prekg', 'PREKG'], ['nursery', 'PREKG'], ['std1', '1'],
  ...Array.from({ length: 12 }, (_, i) => [`std${i + 1}`, String(i + 1)] as [string, string]),
  ...Array.from({ length: 12 }, (_, i) => [`standard${i + 1}`, String(i + 1)] as [string, string]),
])
export const classKey = (label: string): string | null => CLASS_MAP.get(norm(label)) ?? null
export const classLabel = (key: string) => CLASS_LABELS.find(([k]) => k === key)?.[1] ?? key

export const BOARD_OPTIONS = ['Matriculation', 'CBSE'] as const
export const YES_NO = ['Yes', 'No'] as const
export const HANDLED_BY = ['Class Teacher', 'Subject Teacher', 'Specialist', 'Shared (any section teacher)', 'No Teacher (supervised)'] as const
export const PREF_TIME = ['First 3 periods', 'After lunch', 'Last period', 'Any'] as const
export const COMPLIANCE_STATUS = ['Yes', 'No', 'Not applicable'] as const

export const STUDENT_HEADERS = ['Class', 'Group (Class 11–12 only)', 'Boys', 'Girls', 'Children with Special Needs (CWSN)'] as const
export const SUBJECT_HEADERS = ['Class', 'Group (Class 11–12 only)', 'Subject', 'Periods per Week', 'Handled By', 'Preferred Time'] as const
export const COMPLIANCE_HEADERS = ['ID', 'Area', 'Requirement', 'Status', 'Valid Until (if any)', 'Remarks', 'Basis'] as const

export const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'group'
