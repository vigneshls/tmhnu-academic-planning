import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { HashRouter, Link, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { resetDemo, store, type Profile } from './data/store'
import Dashboard from './pages/Dashboard'
import Login from './pages/Login'
import Rules from './pages/Rules'
import SchoolPage from './pages/SchoolPage'

interface AuthCtx {
  profile: Profile | null
  refresh: () => Promise<void>
}
const Ctx = createContext<AuthCtx>({ profile: null, refresh: async () => {} })
export const useAuth = () => useContext(Ctx)

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const refresh = useCallback(async () => {
    try {
      setError('')
      setProfile(await store.currentProfile())
    } catch (e) {
      setError((e as Error).message)
      setProfile(null)
    } finally {
      setLoading(false)
    }
  }, [])
  useEffect(() => { void refresh() }, [refresh])

  if (loading) return <div className="p-8 text-zinc-500">Loading…</div>

  return (
    <Ctx.Provider value={{ profile, refresh }}>
      <HashRouter>
        {!profile ? (
          <Login error={error} />
        ) : (
          <div className="min-h-screen bg-zinc-50">
            <header className="no-print bg-indigo-900 text-white">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
                <Link to="/" className="font-semibold">
                  TMHNU Staffing & Timetable
                  <span className="ml-2 text-xs font-normal text-indigo-200">ஆசிரியர் பணியிடம் & பாடவேளை அட்டவணை</span>
                </Link>
                <nav className="flex gap-3 text-sm">
                  <NavLink to="/" end className={({ isActive }) => (isActive ? 'underline' : 'opacity-80')}>Dashboard</NavLink>
                  {profile.role === 'admin' && (
                    <NavLink to="/rules" className={({ isActive }) => (isActive ? 'underline' : 'opacity-80')}>Board Rules</NavLink>
                  )}
                </nav>
                <div className="ml-auto flex items-center gap-3 text-sm">
                  {store.mode === 'demo' && <span className="rounded bg-amber-400 px-2 py-0.5 text-xs font-semibold text-black">DEMO — data stays in this browser</span>}
                  <span>{profile.name}</span>
                  {store.mode === 'demo' && (
                    <button className="rounded border border-indigo-300 px-2 py-0.5 text-xs" onClick={() => { resetDemo(); location.reload() }}>Reset demo</button>
                  )}
                  <button className="rounded bg-white/10 px-2 py-0.5" onClick={async () => { await store.signOut(); await refresh() }}>Sign out</button>
                </div>
              </div>
            </header>
            <main className="mx-auto max-w-7xl px-4 py-6">
              <Routes>
                <Route path="/" element={profile.role === 'principal' && profile.schoolId ? <Navigate to={`/school/${profile.schoolId}`} replace /> : <Dashboard />} />
                <Route path="/school/:id" element={<SchoolPage />} />
                <Route path="/rules" element={profile.role === 'admin' ? <Rules /> : <Navigate to="/" replace />} />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
          </div>
        )}
      </HashRouter>
    </Ctx.Provider>
  )
}
