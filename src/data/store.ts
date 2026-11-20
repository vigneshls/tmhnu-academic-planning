import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { buildSections, computeDemand } from '../engine/calc'
import { defaultRuleSet } from '../engine/rules'
import { sampleSchoolData, staffFromDemand } from '../engine/sample'
import type { Board, RuleSet, School, SchoolData, Staff } from '../engine/types'

export type Role = 'admin' | 'principal'
export interface Profile {
  userId: string
  email: string
  role: Role
  schoolId: string | null
  name: string
}
export interface UserAccount {
  id: string
  email: string
  name: string
  role: Role
  schoolId: string | null
  active: boolean
  createdAt?: string
}
export interface NewUser {
  name: string
  email: string
  password: string
  role: Role
  schoolId: string | null
}
export interface AuditEntry {
  at: string
  user: string
  action: string
  schoolId?: string | null
  detail?: string
}

export interface Store {
  mode: 'demo' | 'supabase'
  currentProfile(): Promise<Profile | null>
  signIn(email: string, password: string): Promise<void>
  signOut(): Promise<void>
  changeOwnPassword(current: string, next: string): Promise<void>
  listSchools(): Promise<School[]>
  saveSchool(s: School): Promise<void>
  deleteSchool(id: string): Promise<void>
  getRules(board: Board): Promise<RuleSet>
  saveRules(r: RuleSet): Promise<void>
  getSchoolData(schoolId: string): Promise<SchoolData>
  /** Everything except the faculty list (principal or admin) */
  saveSchoolData(schoolId: string, d: SchoolData): Promise<void>
  /** Faculty list (management only) */
  saveStaff(schoolId: string, staff: Staff[]): Promise<void>
  /** Replace a school's full data from an imported workbook (management only) */
  importSchool(school: School, d: SchoolData): Promise<void>
  listUsers(): Promise<UserAccount[]>
  createUser(u: NewUser): Promise<void>
  updateUser(u: UserAccount): Promise<void>
  /** Demo: sets the password directly. Live: emails a reset link. */
  resetPassword(u: UserAccount, newPassword?: string): Promise<string>
  listAudit(): Promise<AuditEntry[]>
}

export const emptySchoolData = (): SchoolData => ({ strength: {}, hss: { '11': {}, '12': {} }, staff: [], genderSeparate: true, source: 'manual' })
export const PASSWORD_RULE = 'At least 8 characters, with a letter and a number.'
export const validPassword = (p: string) => p.length >= 8 && /[a-z]/i.test(p) && /\d/.test(p)
const validEmail = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)

export const SEED_SCHOOL: School = { id: 'ns-mhss-vp', name: 'NS Matriculation Higher Secondary School, Vadapudupatti', board: 'MATRIC' }
export const DEMO_LOGINS = [
  { email: 'admin@tmhnu.local', password: 'Admin@2026', label: 'Management (administrator)' },
  { email: 'principal@nsmhss.local', password: 'Principal@2026', label: 'Principal — NS MHSS Vadapudupatti' },
]

// ================================================================== demo (browser only)

const LS = 'tmhnu-demo-v4'
interface DemoUser extends UserAccount { salt: string; hash: string }
interface DemoDB {
  schools: School[]
  rules: Partial<Record<Board, RuleSet>>
  data: Record<string, SchoolData>
  users: DemoUser[]
  session: string | null
  audit: AuditEntry[]
}

const b64 = (buf: ArrayBuffer) => btoa(String.fromCharCode(...new Uint8Array(buf)))
async function hashPassword(password: string, salt: string) {
  if (!crypto?.subtle) throw new Error('This browser blocks secure password hashing on this page. Open the app over https.')
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 120_000 }, key, 256)
  return b64(bits)
}
const newSalt = () => b64(crypto.getRandomValues(new Uint8Array(16)).buffer)
const newId = () => (crypto.randomUUID ? crypto.randomUUID() : `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`)

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
    /* storage blocked — keep in memory */
  }
}

/** Fictional sample faculty so the demo shows the checks working. Not real staff. */
function demoStaff(d: SchoolData): Staff[] {
  const rules = defaultRuleSet('MATRIC')
  const base = staffFromDemand(rules, computeDemand(rules, buildSections(rules, d), []))
  const out = base
    .filter((_, i) => i % 19 !== 3)
    .map((s, i): Staff => {
      const primary = s.category === 'SGT' || s.category === 'MONTESSORI'
      return {
        ...s,
        name: `Sample Teacher ${i + 1}`,
        employeeId: `T${String(i + 1).padStart(3, '0')}`,
        highestQualification: s.category === 'PGT' ? 'PG' : primary && i % 5 === 0 ? 'HSC' : 'UG',
        professionalQualification: primary ? (i % 6 === 0 ? 'BED' : s.category === 'MONTESSORI' ? 'NTT' : 'DELED') : 'BED',
        tet: s.category === 'SGT' ? (i % 4 === 0 ? 'NOT_PASSED' : 'TNTET1') : s.category === 'TGT' ? (i % 5 === 0 ? 'NOT_PASSED' : 'TNTET2') : 'NA',
        appointment: i % 7 === 0 ? 'CONTRACT' : 'REGULAR',
        experienceYears: (i * 3) % 18,
        cpdHours: (i * 11) % 60,
      }
    })
  out.push({ id: 'p1', name: 'Sample Principal', category: 'PRINCIPAL', subjects: [], highestQualification: 'PG', professionalQualification: 'MED', appointment: 'REGULAR', experienceYears: 20, cpdHours: 50 })
  out.push({ id: 'l1', name: 'Sample Librarian', category: 'LIBRARIAN', subjects: [], highestQualification: 'UG', appointment: 'REGULAR' })
  return out
}

async function seedDemo(): Promise<DemoDB> {
  const d = sampleSchoolData(defaultRuleSet('MATRIC'))
  d.staff = demoStaff(d)
  d.staffUpdatedAt = new Date().toISOString()
  d.source = 'sample'
  d.profile = { academicYear: '2026-27', workingDaysYear: 220, periodMinutes: 40 }
  const users: DemoUser[] = []
  for (const [i, l] of DEMO_LOGINS.entries()) {
    const salt = newSalt()
    users.push({ id: newId(), email: l.email, name: i === 0 ? 'Management' : 'Principal', role: i === 0 ? 'admin' : 'principal', schoolId: i === 0 ? null : SEED_SCHOOL.id, active: true, createdAt: new Date().toISOString(), salt, hash: await hashPassword(l.password, salt) })
  }
  return { schools: [{ ...SEED_SCHOOL }], rules: {}, data: { [SEED_SCHOOL.id]: d }, users, session: null, audit: [] }
}

class DemoStore implements Store {
  mode = 'demo' as const
  private db: DemoDB | null = safeGet()
  private async ready(): Promise<DemoDB> {
    if (!this.db) { this.db = await seedDemo(); this.save() }
    return this.db
  }
  private save() { if (this.db) safeSet(this.db) }
  private async me() {
    const db = await this.ready()
    const u = db.users.find((x) => x.id === db.session && x.active)
    if (!u) throw new Error('Please sign in again.')
    return u
  }
  private async admin() {
    const u = await this.me()
    if (u.role !== 'admin') throw new Error('Only management can do this.')
    return u
  }
  private async log(action: string, schoolId?: string | null, detail?: string) {
    const db = await this.ready()
    const u = db.users.find((x) => x.id === db.session)
    db.audit.unshift({ at: new Date().toISOString(), user: u?.email ?? '—', action, schoolId, detail })
    db.audit = db.audit.slice(0, 300)
    this.save()
  }
  private canSee(u: DemoUser, schoolId: string) { return u.role === 'admin' || u.schoolId === schoolId }

  async currentProfile() {
    const db = await this.ready()
    const u = db.users.find((x) => x.id === db.session && x.active)
    return u ? { userId: u.id, email: u.email, role: u.role, schoolId: u.schoolId, name: u.name } : null
  }
  async signIn(email: string, password: string) {
    const db = await this.ready()
    const u = db.users.find((x) => x.email.toLowerCase() === email.trim().toLowerCase())
    if (!u || !u.active || (await hashPassword(password, u.salt)) !== u.hash) throw new Error('Incorrect email or password.')
    db.session = u.id
    this.save()
    await this.log('sign_in')
  }
  async signOut() { const db = await this.ready(); db.session = null; this.save() }
  async changeOwnPassword(current: string, next: string) {
    const u = await this.me()
    if ((await hashPassword(current, u.salt)) !== u.hash) throw new Error('Current password is incorrect.')
    if (!validPassword(next)) throw new Error(PASSWORD_RULE)
    u.salt = newSalt()
    u.hash = await hashPassword(next, u.salt)
    this.save()
    await this.log('change_password')
  }
  async listSchools() {
    const u = await this.me()
    return this.db!.schools.filter((s) => this.canSee(u, s.id))
  }
  async saveSchool(s: School) {
    await this.admin()
    const db = this.db!
    const i = db.schools.findIndex((x) => x.id === s.id)
    if (i >= 0) db.schools[i] = s
    else { db.schools.push(s); db.data[s.id] = emptySchoolData() }
    this.save()
    await this.log(i >= 0 ? 'edit_school' : 'add_school', s.id, s.name)
  }
  async deleteSchool(id: string) {
    await this.admin()
    const db = this.db!
    const s = db.schools.find((x) => x.id === id)
    db.schools = db.schools.filter((x) => x.id !== id)
    delete db.data[id]
    db.users.forEach((u) => { if (u.schoolId === id) { u.active = false; u.schoolId = null } })
    this.save()
    await this.log('delete_school', id, s?.name)
  }
  async getRules(board: Board) { await this.ready(); return this.db!.rules[board] ?? defaultRuleSet(board) }
  async saveRules(r: RuleSet) { await this.admin(); this.db!.rules[r.board] = r; this.save(); await this.log('save_rules', null, r.label) }
  async getSchoolData(id: string) {
    const u = await this.me()
    if (!this.canSee(u, id)) throw new Error('You do not have access to this school.')
    return structuredClone(this.db!.data[id] ?? emptySchoolData())
  }
  async saveSchoolData(id: string, d: SchoolData) {
    const u = await this.me()
    if (!this.canSee(u, id)) throw new Error('You do not have access to this school.')
    const cur = this.db!.data[id] ?? emptySchoolData()
    this.db!.data[id] = { ...d, staff: cur.staff, staffUpdatedAt: cur.staffUpdatedAt }
    this.save()
    await this.log('save_school_data', id)
  }
  async saveStaff(id: string, staff: Staff[]) {
    await this.admin()
    const cur = this.db!.data[id] ?? emptySchoolData()
    this.db!.data[id] = { ...cur, staff, staffUpdatedAt: new Date().toISOString() }
    this.save()
    await this.log('upload_faculty', id, `${staff.length} rows`)
  }
  async importSchool(school: School, d: SchoolData) {
    await this.admin()
    const db = this.db!
    const i = db.schools.findIndex((x) => x.id === school.id)
    if (i >= 0) db.schools[i] = school
    else db.schools.push(school)
    db.data[school.id] = { ...d, staffUpdatedAt: new Date().toISOString(), importedAt: new Date().toISOString(), source: 'import' }
    this.save()
    await this.log('import_workbook', school.id, `${d.staff.length} staff`)
  }
  async listUsers() {
    await this.admin()
    return this.db!.users.map(({ salt: _s, hash: _h, ...u }) => { void _s; void _h; return u })
  }
  async createUser(n: NewUser) {
    await this.admin()
    const db = this.db!
    const email = n.email.trim().toLowerCase()
    if (!validEmail(email)) throw new Error('Enter a valid email address.')
    if (!n.name.trim()) throw new Error('Enter the person’s name.')
    if (!validPassword(n.password)) throw new Error(PASSWORD_RULE)
    if (n.role === 'principal' && !n.schoolId) throw new Error('Choose the school for this principal.')
    if (db.users.some((u) => u.email === email)) throw new Error('A user with this email already exists.')
    const salt = newSalt()
    db.users.push({ id: newId(), email, name: n.name.trim().slice(0, 80), role: n.role, schoolId: n.role === 'admin' ? null : n.schoolId, active: true, createdAt: new Date().toISOString(), salt, hash: await hashPassword(n.password, salt) })
    this.save()
    await this.log('create_user', n.schoolId, email)
  }
  async updateUser(u: UserAccount) {
    const me = await this.admin()
    const db = this.db!
    const cur = db.users.find((x) => x.id === u.id)
    if (!cur) throw new Error('User not found.')
    if (u.id === me.id && (!u.active || u.role !== 'admin')) throw new Error('You cannot remove your own administrator access.')
    if (u.role === 'principal' && !u.schoolId) throw new Error('Choose the school for this principal.')
    Object.assign(cur, { name: u.name.trim().slice(0, 80), role: u.role, schoolId: u.role === 'admin' ? null : u.schoolId, active: u.active })
    this.save()
    await this.log('update_user', u.schoolId, `${u.email}${u.active ? '' : ' (disabled)'}`)
  }
  async resetPassword(u: UserAccount, newPassword?: string) {
    await this.admin()
    if (!newPassword || !validPassword(newPassword)) throw new Error(PASSWORD_RULE)
    const cur = this.db!.users.find((x) => x.id === u.id)!
    cur.salt = newSalt()
    cur.hash = await hashPassword(newPassword, cur.salt)
    this.save()
    await this.log('reset_password', null, u.email)
    return 'Password updated. Share it with the user privately.'
  }
  async listAudit() { await this.admin(); return this.db!.audit }
  async reset() { this.db = await seedDemo(); this.save() }
}

// ================================================================== supabase (real logins, RLS enforced)

class SupabaseStore implements Store {
  mode = 'supabase' as const
  private sb: SupabaseClient
  private url: string
  private key: string
  constructor(url: string, key: string) {
    this.url = url
    this.key = key
    this.sb = createClient(url, key)
  }
  private async audit(action: string, schoolId: string | null, detail?: string) {
    const { data } = await this.sb.auth.getUser()
    if (!data.user) return
    await this.sb.from('audit_log').insert({ user_id: data.user.id, action, school_id: schoolId, detail: detail ? { text: detail } : null })
  }
  private check(error: { message: string } | null) { if (error) throw new Error(error.message) }

  async currentProfile(): Promise<Profile | null> {
    const { data } = await this.sb.auth.getUser()
    if (!data.user) return null
    const { data: p, error } = await this.sb.from('profiles').select('role, school_id, full_name, active').eq('user_id', data.user.id).maybeSingle()
    this.check(error)
    if (!p || p.active === false) { await this.sb.auth.signOut(); throw new Error('This account is not active. Contact management.') }
    return { userId: data.user.id, email: data.user.email ?? '', role: p.role, schoolId: p.school_id, name: p.full_name ?? data.user.email ?? '' }
  }
  async signIn(email: string, password: string) {
    const { error } = await this.sb.auth.signInWithPassword({ email: email.trim(), password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Incorrect email or password.' : error.message)
    await this.audit('sign_in', null)
  }
  async signOut() { await this.sb.auth.signOut() }
  async changeOwnPassword(current: string, next: string) {
    const { data } = await this.sb.auth.getUser()
    if (!data.user?.email) throw new Error('Please sign in again.')
    const { error: e1 } = await this.sb.auth.signInWithPassword({ email: data.user.email, password: current })
    if (e1) throw new Error('Current password is incorrect.')
    if (!validPassword(next)) throw new Error(PASSWORD_RULE)
    this.check((await this.sb.auth.updateUser({ password: next })).error)
    await this.audit('change_password', null)
  }
  async listSchools() {
    const { data, error } = await this.sb.from('schools').select('id, name, board').order('name')
    this.check(error)
    return data as School[]
  }
  async saveSchool(s: School) {
    this.check((await this.sb.from('schools').upsert(s)).error)
    await this.audit('save_school', s.id, s.name)
  }
  async deleteSchool(id: string) {
    this.check((await this.sb.from('schools').delete().eq('id', id)).error)
    await this.audit('delete_school', null, id)
  }
  async getRules(board: Board) {
    const { data, error } = await this.sb.from('rule_sets').select('data').eq('board', board).maybeSingle()
    this.check(error)
    return (data?.data as RuleSet) ?? defaultRuleSet(board)
  }
  async saveRules(r: RuleSet) {
    this.check((await this.sb.from('rule_sets').upsert({ board: r.board, data: r, updated_at: new Date().toISOString() })).error)
    await this.audit('save_rules', null, r.label)
  }
  async getSchoolData(id: string) {
    const [d, st] = await Promise.all([
      this.sb.from('school_data').select('data').eq('school_id', id).maybeSingle(),
      this.sb.from('school_staff').select('data, updated_at').eq('school_id', id).maybeSingle(),
    ])
    this.check(d.error)
    this.check(st.error)
    const base = (d.data?.data as SchoolData) ?? emptySchoolData()
    return { ...base, staff: (st.data?.data as Staff[]) ?? [], staffUpdatedAt: st.data?.updated_at ?? undefined }
  }
  async saveSchoolData(id: string, d: SchoolData) {
    const { staff: _s, staffUpdatedAt: _u, ...rest } = d
    void _s; void _u
    this.check((await this.sb.from('school_data').upsert({ school_id: id, data: { ...rest, staff: [] }, updated_at: new Date().toISOString() })).error)
    await this.audit('save_school_data', id)
  }
  async saveStaff(id: string, staff: Staff[]) {
    this.check((await this.sb.from('school_staff').upsert({ school_id: id, data: staff, updated_at: new Date().toISOString() })).error)
    await this.audit('upload_faculty', id, `${staff.length} rows`)
  }
  async importSchool(school: School, d: SchoolData) {
    await this.saveSchool(school)
    await this.saveSchoolData(school.id, { ...d, importedAt: new Date().toISOString(), source: 'import' })
    await this.saveStaff(school.id, d.staff)
    await this.audit('import_workbook', school.id, `${d.staff.length} staff`)
  }
  async listUsers() {
    const { data, error } = await this.sb.from('profiles').select('user_id, email, full_name, role, school_id, active, created_at').order('created_at')
    this.check(error)
    return (data ?? []).map((p) => ({ id: p.user_id, email: p.email ?? '', name: p.full_name ?? '', role: p.role, schoolId: p.school_id, active: p.active !== false, createdAt: p.created_at }))
  }
  async createUser(n: NewUser) {
    const email = n.email.trim().toLowerCase()
    if (!validEmail(email)) throw new Error('Enter a valid email address.')
    if (!validPassword(n.password)) throw new Error(PASSWORD_RULE)
    if (n.role === 'principal' && !n.schoolId) throw new Error('Choose the school for this principal.')
    // A separate client so the administrator stays signed in while the new account is registered.
    const tmp = createClient(this.url, this.key, { auth: { persistSession: false, autoRefreshToken: false, storageKey: 'tmhnu-signup' } })
    const { data, error } = await tmp.auth.signUp({ email, password: n.password })
    this.check(error)
    if (!data.user || (data.user.identities && data.user.identities.length === 0)) throw new Error('A user with this email already exists.')
    this.check((await this.sb.from('profiles').insert({ user_id: data.user.id, email, full_name: n.name.trim(), role: n.role, school_id: n.role === 'admin' ? null : n.schoolId, active: true })).error)
    await this.audit('create_user', n.schoolId, email)
  }
  async updateUser(u: UserAccount) {
    const me = await this.currentProfile()
    if (me?.userId === u.id && (!u.active || u.role !== 'admin')) throw new Error('You cannot remove your own administrator access.')
    this.check((await this.sb.from('profiles').update({ full_name: u.name, role: u.role, school_id: u.role === 'admin' ? null : u.schoolId, active: u.active }).eq('user_id', u.id)).error)
    await this.audit('update_user', u.schoolId, u.email)
  }
  async resetPassword(u: UserAccount) {
    this.check((await this.sb.auth.resetPasswordForEmail(u.email, { redirectTo: location.origin + location.pathname })).error)
    await this.audit('reset_password', null, u.email)
    return `A password reset link has been emailed to ${u.email}.`
  }
  async listAudit() {
    const [a, p] = await Promise.all([
      this.sb.from('audit_log').select('at, user_id, action, school_id, detail').order('at', { ascending: false }).limit(300),
      this.sb.from('profiles').select('user_id, email'),
    ])
    this.check(a.error)
    const email = new Map((p.data ?? []).map((x) => [x.user_id, x.email]))
    return (a.data ?? []).map((x) => ({ at: x.at, user: email.get(x.user_id) ?? x.user_id, action: x.action, schoolId: x.school_id, detail: (x.detail as { text?: string } | null)?.text }))
  }
  /** Handles the e-mailed password-reset link */
  onRecovery(cb: () => void) {
    this.sb.auth.onAuthStateChange((event) => { if (event === 'PASSWORD_RECOVERY') cb() })
  }
  async setRecoveredPassword(p: string) {
    if (!validPassword(p)) throw new Error(PASSWORD_RULE)
    this.check((await this.sb.auth.updateUser({ password: p })).error)
  }
}

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

export const store: Store = url && key ? new SupabaseStore(url, key) : new DemoStore()
export const supabaseStore = store instanceof SupabaseStore ? store : null
export const resetDemo = async () => {
  if (store instanceof DemoStore) await store.reset()
}
