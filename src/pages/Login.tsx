import { useState } from 'react'
import { useAuth } from '../App'
import { DEMO_LOGINS, PASSWORD_RULE, store, supabaseStore } from '../data/store'
import { Button, Field, inputCls } from '../ui/kit'

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1.1fr_1fr]">
      <div className="hidden flex-col justify-between bg-[#0f2744] p-12 text-white lg:flex">
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-lg bg-white font-bold text-[#0f2744]">T</div>
          <div><div className="font-semibold">TMHNU Schools</div><div className="text-sm text-slate-400">Academic Planning</div></div>
        </div>
        <div className="max-w-md">
          <h2 className="text-3xl font-semibold leading-tight tracking-tight">Staffing, timetables and compliance — from one workbook per school.</h2>
          <ul className="mt-8 space-y-4 text-sm text-slate-300">
            {[
              ['Upload', 'Each school fills one Excel workbook: profile, students, faculty, subject periods and compliance.'],
              ['Analyse', 'Sections, subject-wise teacher requirement and a clash-free timetable are calculated automatically.'],
              ['Act', 'Recommendations are ranked by severity and linked to the CBSE, RTE and Tamil Nadu rule behind each one.'],
            ].map(([t, d]) => (
              <li key={t} className="flex gap-3"><span className="mt-0.5 h-5 w-5 shrink-0 rounded-full border border-teal-400/60 text-center text-[11px] leading-5 text-teal-300">✓</span><span><b className="text-white">{t}.</b> {d}</span></li>
            ))}
          </ul>
        </div>
        <div className="text-xs text-slate-500">CBSE · Matriculation (Tamil Nadu)</div>
      </div>
      <div className="flex items-center justify-center bg-[#f5f7fb] p-6">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  )
}

export default function Login({ error }: { error: string }) {
  const { refresh } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [msg, setMsg] = useState(error)
  const [busy, setBusy] = useState(false)

  const go = async (e = email, p = password) => {
    setBusy(true)
    setMsg('')
    try {
      await store.signIn(e, p)
      await refresh()
    } catch (err) {
      setMsg((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <Shell>
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Sign in</h1>
      <p className="mt-1 text-sm text-slate-500">Use the account created for you by management.</p>
      <form className="mt-6 space-y-4" onSubmit={(e) => { e.preventDefault(); void go() }}>
        <Field label="Email"><input type="email" required autoComplete="username" className={inputCls} value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input type="password" required autoComplete="current-password" className={inputCls} value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {msg && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{msg}</p>}
        <Button variant="primary" className="w-full py-2.5" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      {store.mode === 'demo' && (
        <div className="mt-8 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm">
          <div className="font-medium text-amber-900">Demo accounts</div>
          <p className="mt-1 text-xs text-amber-800">Demo mode: accounts and data are stored only in this browser. Connect the database for real logins.</p>
          <div className="mt-3 space-y-2">
            {DEMO_LOGINS.map((l) => (
              <button key={l.email} type="button" disabled={busy} onClick={() => { setEmail(l.email); setPassword(l.password); void go(l.email, l.password) }} className="block w-full rounded-lg border border-amber-200 bg-white px-3 py-2 text-left hover:bg-amber-100/40">
                <div className="text-xs font-medium text-slate-800">{l.label}</div>
                <div className="font-mono text-xs text-slate-500">{l.email} · {l.password}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Shell>
  )
}

export function RecoveryForm({ onDone }: { onDone: () => void }) {
  const [p, setP] = useState('')
  const [msg, setMsg] = useState('')
  return (
    <Shell>
      <h1 className="text-2xl font-semibold text-slate-900">Set a new password</h1>
      <form className="mt-6 space-y-4" onSubmit={async (e) => { e.preventDefault(); try { await supabaseStore!.setRecoveredPassword(p); onDone() } catch (er) { setMsg((er as Error).message) } }}>
        <Field label="New password" hint={PASSWORD_RULE}><input type="password" autoComplete="new-password" className={inputCls} value={p} onChange={(e) => setP(e.target.value)} /></Field>
        {msg && <p role="alert" className="text-sm text-red-700">{msg}</p>}
        <Button variant="primary" className="w-full">Save password</Button>
      </form>
    </Shell>
  )
}
