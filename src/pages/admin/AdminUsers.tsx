import { useEffect, useState } from 'react'
import { useAuth } from '../../App'
import { PASSWORD_RULE, store, type NewUser, type UserAccount } from '../../data/store'
import type { School } from '../../engine/types'
import { Badge, Button, Card, Field, Modal, PageHeader, inputCls } from '../../ui/kit'

function genPassword() {
  const a = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz'
  const d = '23456789'
  const r = (s: string) => s[crypto.getRandomValues(new Uint32Array(1))[0] % s.length]
  return Array.from({ length: 8 }, () => r(a)).join('') + r(d) + r(d)
}

export default function AdminUsers() {
  const { profile } = useAuth()
  const [users, setUsers] = useState<UserAccount[] | null>(null)
  const [schools, setSchools] = useState<School[]>([])
  const [creating, setCreating] = useState<NewUser | null>(null)
  const [editing, setEditing] = useState<UserAccount | null>(null)
  const [resetFor, setResetFor] = useState<UserAccount | null>(null)
  const [newPw, setNewPw] = useState('')
  const [msg, setMsg] = useState('')
  const [notice, setNotice] = useState('')
  const load = async () => { const [u, s] = await Promise.all([store.listUsers(), store.listSchools()]); setUsers(u); setSchools(s) }
  useEffect(() => { void load() }, [])
  const schoolName = (id: string | null) => schools.find((s) => s.id === id)?.name ?? '—'

  return (
    <>
      <PageHeader eyebrow="Administration" title="Users & Logins" subtitle="Create a login for each principal and link it to their school. Management accounts can see every school."
        actions={<Button variant="primary" onClick={() => { setMsg(''); setCreating({ name: '', email: '', password: genPassword(), role: 'principal', schoolId: schools[0]?.id ?? null }) }}>+ Create login</Button>} />
      {notice && <p role="status" className="mb-4 rounded-lg bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800">{notice}</p>}
      <Card pad={false}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
            <tr><th className="px-5 py-3">Name</th><th className="px-5 py-3">Email</th><th className="px-5 py-3">Role</th><th className="px-5 py-3">School</th><th className="px-5 py-3">Status</th><th className="px-5 py-3" /></tr>
          </thead>
          <tbody>
            {!users ? <tr><td className="px-5 py-4 text-slate-500" colSpan={6}>Loading…</td></tr> : users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-5 py-3.5 font-medium text-slate-900">{u.name}{u.id === profile?.userId && <span className="ml-2 text-xs text-slate-400">(you)</span>}</td>
                <td className="px-5 py-3.5 text-slate-600">{u.email}</td>
                <td className="px-5 py-3.5"><Badge tone={u.role === 'admin' ? 'info' : 'neutral'}>{u.role === 'admin' ? 'Management' : 'Principal'}</Badge></td>
                <td className="px-5 py-3.5 text-slate-600">{u.role === 'admin' ? 'All schools' : schoolName(u.schoolId)}</td>
                <td className="px-5 py-3.5"><Badge tone={u.active ? 'pass' : 'low'}>{u.active ? 'Active' : 'Disabled'}</Badge></td>
                <td className="px-5 py-3.5 text-right">
                  <div className="flex justify-end gap-2">
                    <Button variant="ghost" onClick={() => { setMsg(''); setEditing({ ...u }) }}>Edit</Button>
                    <Button variant="ghost" onClick={() => { setMsg(''); setNewPw(genPassword()); setResetFor(u) }}>Reset password</Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Modal open={!!creating} title="Create login" onClose={() => setCreating(null)}>
        {creating && (
          <form className="space-y-4" onSubmit={async (e) => {
            e.preventDefault()
            try { await store.createUser(creating); setNotice(`Login created for ${creating.email}. Share the password privately: ${creating.password}`); setCreating(null); await load() } catch (er) { setMsg((er as Error).message) }
          }}>
            <Field label="Full name"><input required maxLength={80} className={inputCls} value={creating.name} onChange={(e) => setCreating({ ...creating, name: e.target.value })} /></Field>
            <Field label="Email (used to sign in)"><input type="email" required className={inputCls} value={creating.email} onChange={(e) => setCreating({ ...creating, email: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <select className={inputCls} value={creating.role} onChange={(e) => setCreating({ ...creating, role: e.target.value as NewUser['role'] })}>
                  <option value="principal">Principal</option><option value="admin">Management</option>
                </select>
              </Field>
              <Field label="School">
                <select disabled={creating.role === 'admin'} className={inputCls} value={creating.schoolId ?? ''} onChange={(e) => setCreating({ ...creating, schoolId: e.target.value || null })}>
                  {creating.role === 'admin' ? <option>All schools</option> : schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <Field label="Initial password" hint={`${PASSWORD_RULE} The user can change it under Account.`}>
              <div className="flex gap-2"><input className={`${inputCls} font-mono`} value={creating.password} onChange={(e) => setCreating({ ...creating, password: e.target.value })} /><Button type="button" onClick={() => setCreating({ ...creating, password: genPassword() })}>Generate</Button></div>
            </Field>
            {msg && <p className="text-sm text-red-700">{msg}</p>}
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setCreating(null)}>Cancel</Button><Button variant="primary">Create login</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!editing} title="Edit user" onClose={() => setEditing(null)}>
        {editing && (
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await store.updateUser(editing); setEditing(null); await load() } catch (er) { setMsg((er as Error).message) } }}>
            <Field label="Full name"><input required className={inputCls} value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Role">
                <select className={inputCls} value={editing.role} onChange={(e) => setEditing({ ...editing, role: e.target.value as UserAccount['role'], schoolId: editing.schoolId ?? schools[0]?.id ?? null })}>
                  <option value="principal">Principal</option><option value="admin">Management</option>
                </select>
              </Field>
              <Field label="School">
                <select disabled={editing.role === 'admin'} className={inputCls} value={editing.schoolId ?? ''} onChange={(e) => setEditing({ ...editing, schoolId: e.target.value || null })}>
                  {editing.role === 'admin' ? <option>All schools</option> : schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </Field>
            </div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={editing.active} onChange={(e) => setEditing({ ...editing, active: e.target.checked })} /> Active (untick to block sign-in)</label>
            {msg && <p className="text-sm text-red-700">{msg}</p>}
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setEditing(null)}>Cancel</Button><Button variant="primary">Save</Button></div>
          </form>
        )}
      </Modal>

      <Modal open={!!resetFor} title={`Reset password — ${resetFor?.email ?? ''}`} onClose={() => setResetFor(null)}>
        {resetFor && (
          <form className="space-y-4" onSubmit={async (e) => { e.preventDefault(); try { const m = await store.resetPassword(resetFor, newPw); setNotice(`${m} New password: ${newPw} — share it with the user privately.`); setResetFor(null) } catch (er) { setMsg((er as Error).message) } }}>
            <Field label="New password" hint={PASSWORD_RULE}><div className="flex gap-2"><input className={`${inputCls} font-mono`} value={newPw} onChange={(e) => setNewPw(e.target.value)} /><Button type="button" onClick={() => setNewPw(genPassword())}>Generate</Button></div></Field>
            {msg && <p className="text-sm text-red-700">{msg}</p>}
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setResetFor(null)}>Cancel</Button><Button variant="primary">Set password</Button></div>
          </form>
        )}
      </Modal>
    </>
  )
}
