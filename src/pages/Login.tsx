import { useState } from 'react'
import { useAuth } from '../App'
import { SCHOOLS, store } from '../data/store'

export default function Login({ error }: { error: string }) {
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(error)
  const [busy, setBusy] = useState(false)

  const go = async (e?: string, p?: string) => {
    setBusy(true)
    setMsg('')
    try {
      await store.signIn(e ?? email, p ?? password)
      await refresh()
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 p-4">
      <div className="w-full max-w-lg rounded-lg border border-slate-200 bg-white p-8">
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded bg-[#1f3a5f] font-bold text-white">T</span>
          <div>
            <h1 className="text-lg font-semibold text-slate-900">TMHNU Schools — Academic Planning</h1>
            <p className="text-sm text-slate-500">Staffing, timetables and compliance for CBSE and Matriculation schools</p>
          </div>
        </div>

        {store.mode === 'demo' ? (
          <div className="space-y-3">
            <p className="rounded border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
              Demonstration mode: sample figures and fictional staff, stored only in this browser. Real logins are enabled once the database is connected.
            </p>
            <button disabled={busy} className="w-full rounded bg-[#1f3a5f] py-2.5 font-medium text-white hover:bg-[#17304f]" onClick={() => go('admin', '')}>
              Sign in as Management
            </button>
            <p className="pt-2 text-xs font-medium uppercase tracking-wide text-slate-500">Sign in as Principal</p>
            {SCHOOLS.map((s) => (
              <button key={s.id} disabled={busy} className="block w-full rounded border border-slate-300 px-3 py-2 text-left text-sm hover:bg-slate-50" onClick={() => go(`principal:${s.id}`, '')}>
                {s.name}
              </button>
            ))}
          </div>
        ) : (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void go() }}>
            <label className="block text-sm font-medium">
              Email
              <input type="email" required autoComplete="username" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm font-medium">
              Password
              <input type="password" required autoComplete="current-password" className="mt-1 w-full rounded border border-slate-300 px-3 py-2 font-normal" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button disabled={busy} className="w-full rounded bg-[#1f3a5f] py-2.5 font-medium text-white">{busy ? 'Signing in…' : 'Sign in'}</button>
          </form>
        )}
        {msg && <p role="alert" className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  )
}
