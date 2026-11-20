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
// eslint-disable-next-line react-refresh/only-export-components
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

  if (loading) return <div className="p-8 text-slate-500">Loading…</div>

  const nav = ({ isActive }: { isActive: boolean }) => `px-2 py-1 rounded ${isActive ? 'bg-slate-100 text-slate-900 font-medium' : 'text-slate-600 hover:text-slate-900'}`

  return (
    <Ctx.Provider value={{ profile, refresh }}>
      <HashRouter>
        {!profile ? (
          <Login error={error} />
        ) : (
          <div className="min-h-screen bg-slate-50 text-slate-800">
            <header className="no-print border-b border-slate-200 bg-white">
              <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-4 px-4 py-3">
                <Link to="/" className="flex items-center gap-2">
                  <span className="grid h-8 w-8 place-items-center rounded bg-[#1f3a5f] text-sm font-bold text-white">T</span>
                  <span className="font-semibold text-slate-900">TMHNU Schools — Academic Planning</span>
                </Link>
                <nav className="flex gap-1 text-sm">
                  <NavLink to="/" end className={nav}>{profile.role === 'admin' ? 'All Schools' : 'My School'}</NavLink>
                  {profile.role === 'admin' && <NavLink to="/rules" className={nav}>Board Rules</NavLink>}
                </nav>
                <div className="ml-auto flex items-center gap-3 text-sm">
                  {store.mode === 'demo' && <span className="rounded border border-amber-300 bg-amber-50 px-2 py-0.5 text-xs text-amber-800">Demo data — stored in this browser only</span>}
                  <span className="text-slate-600">{profile.name}</span>
                  {store.mode === 'demo' && profile.role === 'admin' && (
                    <button className="rounded border border-slate-300 px-2 py-0.5 text-xs" onClick={() => { if (confirm('Reset all demo data?')) { resetDemo(); location.reload() } }}>Reset demo</button>
                  )}
                  <button className="rounded border border-slate-300 px-2 py-0.5" onClick={async () => { await store.signOut(); await refresh() }}>Sign out</button>
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
