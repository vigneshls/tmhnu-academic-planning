import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { defaultRuleSet } from '../engine/rules'
import { sampleSchoolData, staffFromDemand } from '../engine/sample'
import { buildSections, computeDemand } from '../engine/calc'
import type { Board, RuleSet, School, SchoolData } from '../engine/types'

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
  saveSchoolData(schoolId: string, d: SchoolData): Promise<void>
}

export const emptySchoolData = (): SchoolData => ({ strength: {}, hss: { '11': {}, '12': {} }, staff: [], genderSeparate: true })

// ------------------------------------------------------------------ demo (browser only)

const LS = 'tmhnu-demo-v2'
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
    /* storage full or blocked — keep in memory */
  }
}

function seedDemo(): DemoDB {
  const schools: School[] = [
    { id: 'S1', name: 'Demo School 1', board: 'CBSE' },
    { id: 'S2', name: 'Demo School 2', board: 'MATRIC' },
    { id: 'S3', name: 'Demo School 3', board: 'STATE' },
    { id: 'S4', name: 'Demo School 4', board: 'MATRIC' },
    { id: 'S5', name: 'Demo School 5', board: 'STATE' },
  ]
  const data: Record<string, SchoolData> = {}
  schools.forEach((s, i) => {
    const rules = defaultRuleSet(s.board)
    const d = sampleSchoolData(rules)
    const staff = staffFromDemand(rules, computeDemand(rules, buildSections(rules, d), []))
    // leave a few deliberate vacancies so the shortage view has something to show
    d.staff = staff.filter((_, k) => k % 17 !== i)
    data[s.id] = d
  })
  return { schools, rules: {}, data, profile: null }
}

class DemoStore implements Store {
  mode = 'demo' as const
  private db: DemoDB = safeGet() ?? seedDemo()
  private save() { safeSet(this.db) }
  async currentProfile() { return this.db.profile }
  async signIn(email: string) {
    // demo: "admin" or "principal:S2"
    const [role, school] = email.split(':')
    this.db.profile =
      role === 'principal'
        ? { email, role: 'principal', schoolId: school ?? 'S1', name: `Principal (${school ?? 'S1'})` }
        : { email: 'management', role: 'admin', schoolId: null, name: 'Management' }
    this.save()
  }
  async signOut() { this.db.profile = null; this.save() }
  async listSchools() {
    const p = this.db.profile
    return p?.role === 'principal' ? this.db.schools.filter((s) => s.id === p.schoolId) : this.db.schools
  }
  async saveSchool(s: School) {
    const i = this.db.schools.findIndex((x) => x.id === s.id)
    if (i >= 0) this.db.schools[i] = s
    else this.db.schools.push(s)
    this.save()
  }
  async getRules(board: Board) { return this.db.rules[board] ?? defaultRuleSet(board) }
  async saveRules(r: RuleSet) { this.db.rules[r.board] = r; this.save() }
  async getSchoolData(id: string) { return this.db.data[id] ?? emptySchoolData() }
  async saveSchoolData(id: string, d: SchoolData) { this.db.data[id] = d; this.save() }
  reset() { this.db = seedDemo(); this.save() }
}

// ------------------------------------------------------------------ supabase

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
    if (!p) throw new Error('No profile found for this login. Ask management to add you in the profiles table.')
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
    const { data, error } = await this.sb.from('school_data').select('data').eq('school_id', id).maybeSingle()
    if (error) throw new Error(error.message)
    return (data?.data as SchoolData) ?? emptySchoolData()
  }
  async saveSchoolData(id: string, d: SchoolData) {
    const { error } = await this.sb.from('school_data').upsert({ school_id: id, data: d, updated_at: new Date().toISOString() })
    if (error) throw new Error(error.message)
    await this.audit('save_school_data', id, { staff: d.staff.length, timetable: !!d.timetable })
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const store: Store = url && key ? new SupabaseStore(createClient(url, key)) : new DemoStore()
export const resetDemo = () => {
  if (store instanceof DemoStore) store.reset()
}
