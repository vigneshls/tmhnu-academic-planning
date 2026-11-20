import { useState } from 'react'
import { useAuth } from '../App'
import { store } from '../data/store'

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
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-indigo-900 to-indigo-700 p-4">
      <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl">
        <h1 className="text-xl font-semibold text-indigo-900">TMHNU Staffing & Timetable</h1>
        <p className="mb-5 text-sm text-zinc-500">ஆசிரியர் தேவை கணக்கீடு & பாடவேளை அட்டவணை — 5 schools · CBSE / Matric / State Board</p>

        {store.mode === 'demo' ? (
          <div className="space-y-3">
            <p className="rounded bg-amber-50 p-3 text-sm text-amber-900">
              Demo mode: fictional data, stored only in this browser. Connect Supabase to enable real logins.
            </p>
            <button disabled={busy} className="w-full rounded bg-indigo-700 py-2 font-medium text-white hover:bg-indigo-800" onClick={() => go('admin', '')}>
              Enter as Management (all 5 schools)
            </button>
            <div className="grid grid-cols-5 gap-2">
              {['S1', 'S2', 'S3', 'S4', 'S5'].map((s, i) => (
                <button key={s} disabled={busy} className="rounded border border-indigo-300 py-2 text-xs text-indigo-800 hover:bg-indigo-50" onClick={() => go(`principal:${s}`, '')}>
                  Principal {i + 1}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form className="space-y-3" onSubmit={(e) => { e.preventDefault(); void go() }}>
            <label className="block text-sm">
              Email
              <input type="email" required autoComplete="username" className="mt-1 w-full rounded border px-3 py-2" value={email} onChange={(e) => setEmail(e.target.value)} />
            </label>
            <label className="block text-sm">
              Password
              <input type="password" required autoComplete="current-password" className="mt-1 w-full rounded border px-3 py-2" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
            <button disabled={busy} className="w-full rounded bg-indigo-700 py-2 font-medium text-white hover:bg-indigo-800">
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        )}
        {msg && <p role="alert" className="mt-3 text-sm text-red-600">{msg}</p>}
      </div>
    </div>
  )
}
