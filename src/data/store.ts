import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildSections, computeDemand } from '../engine/calc'
import { defaultRuleSet } from '../engine/rules'
import { sampleSchoolData, staffFromDemand } from '../engine/sample'
import type { Board, RuleSet, School, SchoolData, Staff } from '../engine/types'

export type Role = 'admin' | 'principal'
export interface Profile {
  email: string
  role: Role
  schoolId: string | null
  name: string
}

export interface Store {
  mode: 'demo' | 'supabase'
  currentProfile(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  listSchools(): Promise<School[]>
  saveSchool(s: School): Promise<void>
  getRules(board: Board): Promise<RuleSet>
  saveRules(r: RuleSet): Promise<void>
  getSchoolData(schoolId: string): Promise<SchoolData>
  /** Saves everything except the faculty list (principal or admin) */
  saveSchoolData(schoolId: string, d: SchoolData): Promise<void>
  /** Saves the faculty list (management only) */
  saveStaff(schoolId: string, staff: Staff[]): Promise<void>
}

export const emptySchoolData = (): SchoolData => ({ strength: {}, hss: { '11': {}, '12': {} }, staff: [], genderSeparate: true })

export const SCHOOLS: School[] = [
  { id: 'nsv-mhss', name: 'NS Vidyalaya Matriculation Higher Secondary School', board: 'MATRIC' },
  { id: 'tmhnu-mhss', name: 'TMHNU Matriculation Higher Secondary School, Muthuthevanpatti', board: 'MATRIC' },
  { id: 'ns-mhss-vp', name: 'NS Matriculation Higher Secondary School, Vadapudupatti', board: 'MATRIC' },
]

// ------------------------------------------------------------------ demo (browser only, fictional figures)

const LS = 'tmhnu-demo-v3'
interface DemoDB {
  schools: School[]
  rules: Partial<Record<Board, RuleSet>>
  data: Record<string, SchoolData>
  profile: Profile | null
}

function safeGet(): DemoDB | null {
  try {
    const raw = localStorage.getItem(LS)
    return raw ? (JSON.parse(raw) as DemoDB) : null
  } catch {
    return null
  }
}
function safeSet(db: DemoDB) {
  try {
    localStorage.setItem(LS, JSON.stringify(db))
  } catch {
    /* storage blocked or full — keep in memory */
  }
}

/** Fictional sample faculty so the demo shows the checks working. Not real staff. */
function demoStaff(board: Board, d: SchoolData, k: number): Staff[] {
  const rules = defaultRuleSet(board)
  const base = staffFromDemand(rules, computeDemand(rules, buildSections(rules, d), []))
  const out = base
    .filter((_, i) => i % 19 !== k) // leave a few gaps
    .map((s, i): Staff => {
      const primary = s.category === 'SGT' || s.category === 'MONTESSORI'
      return {
        ...s,
        name: `Sample Teacher ${i + 1}`,
        employeeId: `T${String(i + 1).padStart(3, '0')}`,
        highestQualification: s.category === 'PGT' ? 'PG' : primary ? (i % 5 === 0 ? 'HSC' : 'UG') : 'UG',
        professionalQualification: primary ? (i % 6 === 0 ? 'BED' : s.category === 'MONTESSORI' ? 'NTT' : 'DELED') : 'BED',
        tet: s.category === 'SGT' ? (i % 4 === 0 ? 'NOT_PASSED' : 'TNTET1') : s.category === 'TGT' ? (i % 5 === 0 ? 'NOT_PASSED' : 'TNTET2') : 'NA',
        appointment: i % 7 === 0 ? 'CONTRACT' : 'REGULAR',
        experienceYears: (i * 3) % 18,
        cpdHours: (i * 11) % 60,
      }
    })
  out.push({ id: 'p1', name: 'Sample Principal', category: 'PRINCIPAL', subjects: [], highestQualification: 'PG', professionalQualification: 'MED', appointment: 'REGULAR', experienceYears: 20, cpdHours: 50 })
  if (k !== 1) out.push({ id: 'c1', name: 'Sample Counsellor', category: 'COUNSELLOR', subjects: ['Counselling'], highestQualification: 'PG', professionalQualification: 'NONE', appointment: 'REGULAR', experienceYears: 4 })
  out.push({ id: 'l1', name: 'Sample Librarian', category: 'LIBRARIAN', subjects: [], highestQualification: 'UG', appointment: 'REGULAR' })
  return out
}

function seedDemo(): DemoDB {
  const data: Record<string, SchoolData> = {}
  SCHOOLS.forEach((s, k) => {
    const d = sampleSchoolData(defaultRuleSet(s.board))
    d.staff = demoStaff(s.board, d, k)
    d.staffUpdatedAt = new Date().toISOString()
    data[s.id] = d
  })
  return { schools: SCHOOLS.map((s) => ({ ...s })), rules: {}, data, profile: null }
}

class DemoStore implements Store {
  mode = 'demo' as const
  private db: DemoDB = safeGet() ?? seedDemo()
  private save() { safeSet(this.db) }
  async currentProfile() { return this.db.profile }
  async signIn(email: string) {
    const [role, school] = email.split(':')
    const s = this.db.schools.find((x) => x.id === school)
    this.db.profile =
      role === 'principal' && s
        ? { email, role: 'principal', schoolId: s.id, name: `Principal — ${s.name.split(',')[0]}` }
        : { email: 'management', role: 'admin', schoolId: null, name: 'Management' }
    this.save()
  }
  async signOut() { this.db.profile = null; this.save() }
  async listSchools() {
    const p = this.db.profile
    return p?.role === 'principal' ? this.db.schools.filter((s) => s.id === p.schoolId) : this.db.schools
  }
  async saveSchool(s: School) {
    if (this.db.profile?.role !== 'admin') throw new Error('Only management can edit schools.')
    const i = this.db.schools.findIndex((x) => x.id === s.id)
    if (i >= 0) this.db.schools[i] = s
    else this.db.schools.push(s)
    this.save()
  }
  async getRules(board: Board) { return this.db.rules[board] ?? defaultRuleSet(board) }
  async saveRules(r: RuleSet) {
    if (this.db.profile?.role !== 'admin') throw new Error('Only management can edit rules.')
    this.db.rules[r.board] = r
    this.save()
  }
  async getSchoolData(id: string) { return structuredClone(this.db.data[id] ?? emptySchoolData()) }
  async saveSchoolData(id: string, d: SchoolData) {
    const staff = this.db.data[id]?.staff ?? []
    const staffUpdatedAt = this.db.data[id]?.staffUpdatedAt
    this.db.data[id] = { ...d, staff, staffUpdatedAt }
    this.save()
  }
  async saveStaff(id: string, staff: Staff[]) {
    if (this.db.profile?.role !== 'admin') throw new Error('Only management can change the faculty list.')
    const cur = this.db.data[id] ?? emptySchoolData()
    this.db.data[id] = { ...cur, staff, staffUpdatedAt: new Date().toISOString() }
    this.save()
  }
  reset() { this.db = seedDemo(); this.save() }
}

// ------------------------------------------------------------------ supabase (real logins, RLS enforced)

class SupabaseStore implements Store {
  mode = 'supabase' as const
  private sb: SupabaseClient
  constructor(sb: SupabaseClient) {
    this.sb = sb
  }
  private async audit(action: string, schoolId: string | null, detail: unknown) {
    const { data } = await this.sb.auth.getUser()
    if (!data.user) return
    await this.sb.from('audit_log').insert({ user_id: data.user.id, action, school_id: schoolId, detail })
  }
  async currentProfile(): Promise<Profile | null> {
    const { data } = await this.sb.auth.getUser()
    if (!data.user) return null
    const { data: p, error } = await this.sb.from('profiles').select('role, school_id, full_name').eq('user_id', data.user.id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!p) throw new Error('No profile found for this login. Ask management to link your account to a school.')
    return { email: data.user.email ?? '', role: p.role, schoolId: p.school_id, name: p.full_name ?? data.user.email ?? '' }
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email, password })
    if (error) throw new Error(error.message)
  }
  async signOut() { await this.sb.auth.signOut() }
  async listSchools() {
    const { data, error } = await this.sb.from('schools').select('id, name, board').order('name')
    if (error) throw new Error(error.message)
    return data as School[]
  }
  async saveSchool(s: School) {
    const { error } = await this.sb.from('schools').upsert(s)
    if (error) throw new Error(error.message)
    await this.audit('save_school', s.id, { name: s.name, board: s.board })
  }
  async getRules(board: Board) {
    const { data, error } = await this.sb.from('rule_sets').select('data').eq('board', board).maybeSingle()
    if (error) throw new Error(error.message)
    return (data?.data as RuleSet) ?? defaultRuleSet(board)
  }
  async saveRules(r: RuleSet) {
    const { error } = await this.sb.from('rule_sets').upsert({ board: r.board, data: r, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    await this.audit('save_rules', null, { board: r.board })
  }
  async getSchoolData(id: string) {
    const [d, st] = await Promise.all([
      this.sb.from('school_data').select('data').eq('school_id', id).maybeSingle(),
      this.sb.from('school_staff').select('data, updated_at').eq('school_id', id).maybeSingle(),
    ])
    if (d.error) throw new Error(d.error.message)
    if (st.error) throw new Error(st.error.message)
    const base = (d.data?.data as SchoolData) ?? emptySchoolData()
    return { ...base, staff: (st.data?.data as Staff[]) ?? [], staffUpdatedAt: st.data?.updated_at ?? undefined }
  }
  async saveSchoolData(id: string, d: SchoolData) {
    const { staff: _s, staffUpdatedAt: _u, ...rest } = d
    void _s; void _u
    const { error } = await this.sb.from('school_data').upsert({ school_id: id, data: { ...rest, staff: [] }, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    await this.audit('save_school_data', id, { timetable: !!d.timetable })
  }
  async saveStaff(id: string, staff: Staff[]) {
    const { error } = await this.sb.from('school_staff').upsert({ school_id: id, data: staff, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    await this.audit('upload_faculty', id, { rows: staff.length })
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const store: Store = url && key ? new SupabaseStore(createClient(url, key)) : new DemoStore()
export const resetDemo = () => {
  if (store instanceof DemoStore) store.reset()
}
