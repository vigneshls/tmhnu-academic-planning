import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { HashRouter, Navigate, NavLink, Route, Routes } from 'react-router-dom'
import { resetDemo, store, supabaseStore, type Profile } from './data/store'
import Account from './pages/Account'
import AdminAudit from './pages/admin/AdminAudit'
import AdminImport from './pages/admin/AdminImport'
import AdminSchools from './pages/admin/AdminSchools'
import AdminUsers from './pages/admin/AdminUsers'
import Dashboard from './pages/Dashboard'
import Login, { RecoveryForm } from './pages/Login'
import Rules from './pages/Rules'
import SchoolPage from './pages/SchoolPage'
import { Icon, cx } from './ui/kit'

interface AuthCtx {
  profile: Profile | null
  refresh: () => Promise<void>
}
const Ctx = createContext<AuthCtx>({ profile: null, refresh: async () => {} })
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(Ctx)

const NavClose = createContext<() => void>(() => {})
function NavItem({ to, icon, children, end }: { to: string; icon: React.ReactNode; children: React.ReactNode; end?: boolean }) {
  const close = useContext(NavClose)
  return (
    <NavLink to={to} end={end} onClick={close} className={({ isActive }) => cx('flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm lg:py-2', isActive ? 'bg-white/10 font-medium text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white')}>
      {icon}
      {children}
    </NavLink>
  )
}

export default function App() {
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [recovery, setRecovery] = useState(false)
  const [menu, setMenu] = useState(false)
  const [installEvt, setInstallEvt] = useState<(Event & { prompt: () => Promise<void> }) | null>(null)
  useEffect(() => {
    const h = (e: Event) => { e.preventDefault(); setInstallEvt(e as Event & { prompt: () => Promise<void> }) }
    window.addEventListener('beforeinstallprompt', h)
    return () => window.removeEventListener('beforeinstallprompt', h)
  }, [])
  const native = !!(window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.()

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
  useEffect(() => {
    void refresh()
    supabaseStore?.onRecovery(() => setRecovery(true))
  }, [refresh])

  if (loading) return <div className="grid min-h-screen place-items-center text-slate-500">Loading…</div>
  if (recovery) return <RecoveryForm onDone={() => { setRecovery(false); void refresh() }} />

  const isAdmin = profile?.role === 'admin'
  return (
    <Ctx.Provider value={{ profile, refresh }}>
      <HashRouter>
        {!profile ? (
          <Login error={error} />
        ) : (
          <NavClose.Provider value={() => setMenu(false)}>
          <div className="min-h-screen bg-[#f5f7fb] text-slate-800 lg:flex">
            {/* phone / tablet top bar */}
            <header className="no-print sticky top-0 z-30 flex items-center gap-3 bg-[#0f2744] px-4 pb-3 text-white lg:hidden" style={{ paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)' }}>
              <button aria-label="Open menu" className="-ml-1 rounded-lg p-2 hover:bg-white/10" onClick={() => setMenu(true)}>
                <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
              </button>
              <div className="grid h-8 w-8 place-items-center rounded-lg bg-white text-sm font-bold text-[#0f2744]">T</div>
              <div className="min-w-0 leading-tight">
                <div className="truncate text-sm font-semibold">TMHNU Schools</div>
                <div className="truncate text-[11px] text-slate-400">{profile.name}</div>
              </div>
            </header>
            {menu && <div className="no-print fixed inset-0 z-40 bg-black/40 lg:hidden" onClick={() => setMenu(false)} />}
            <aside className={cx('no-print fixed inset-y-0 left-0 z-50 flex w-72 max-w-[85vw] flex-col bg-[#0f2744] transition-transform duration-200 lg:w-64 lg:translate-x-0', menu ? 'translate-x-0' : '-translate-x-full')} style={{ paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
              <div className="flex items-center gap-3 px-5 py-5">
                <div className="grid h-9 w-9 place-items-center rounded-lg bg-white text-sm font-bold text-[#0f2744]">T</div>
                <div className="leading-tight">
                  <div className="text-sm font-semibold text-white">TMHNU Schools</div>
                  <div className="text-xs text-slate-400">Academic Planning</div>
                </div>
              </div>
              <nav className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 pb-3">
                {isAdmin ? (
                  <>
                    <NavItem to="/" end icon={Icon.dashboard}>Overview</NavItem>
                    <div className="mt-4 px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Administration</div>
                    <NavItem to="/admin/schools" icon={Icon.school}>Schools</NavItem>
                    <NavItem to="/admin/users" icon={Icon.users}>Users & Logins</NavItem>
                    <NavItem to="/admin/import" icon={Icon.upload}>Data Import</NavItem>
                    <NavItem to="/admin/rules" icon={Icon.rules}>Board Rules</NavItem>
                    <NavItem to="/admin/audit" icon={Icon.log}>Activity Log</NavItem>
                  </>
                ) : (
                  <NavItem to={`/school/${profile.schoolId}`} icon={Icon.school}>My School</NavItem>
                )}
              </nav>
              <div className="border-t border-white/10 p-4">
                <div className="truncate text-sm font-medium text-white">{profile.name}</div>
                <div className="truncate text-xs text-slate-400">{profile.email} · {isAdmin ? 'Management' : 'Principal'}</div>
                <div className="mt-3 flex gap-2">
                  <NavLink to="/account" onClick={() => setMenu(false)} className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10">Account</NavLink>
                  <button className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10" onClick={async () => { await store.signOut(); await refresh() }}>Sign out</button>
                </div>
                {!native && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {installEvt && <button className="rounded-md bg-teal-400 px-2.5 py-1 text-xs font-semibold text-[#0f2744]" onClick={async () => { await installEvt.prompt(); setInstallEvt(null) }}>Install app</button>}
                    <a href="https://github.com/vigneshls/tmhnu-academic-planning/releases/latest/download/TMHNU-Schools.apk" className="rounded-md border border-white/15 px-2.5 py-1 text-xs text-slate-200 hover:bg-white/10">Android app (APK)</a>
                  </div>
                )}
                {store.mode === 'demo' && (
                  <div className="mt-3 rounded-md bg-amber-400/10 px-2.5 py-2 text-[11px] leading-snug text-amber-200">
                    Demo mode — data and logins exist only in this browser.
                    {isAdmin && <button className="mt-1 block underline" onClick={async () => { if (confirm('Reset all demo data and accounts?')) { await resetDemo(); location.reload() } }}>Reset demo</button>}
                  </div>
                )}
              </div>
            </aside>
            <main className="min-w-0 flex-1 lg:pl-64">
              <div className="mx-auto max-w-7xl px-3 py-5 sm:px-4 sm:py-8 lg:px-8" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
                <Routes>
                  <Route path="/" element={isAdmin ? <Dashboard /> : <Navigate to={`/school/${profile.schoolId}`} replace />} />
                  <Route path="/school/:id" element={<SchoolPage />} />
                  <Route path="/account" element={<Account />} />
                  {isAdmin && (
                    <>
                      <Route path="/admin/schools" element={<AdminSchools />} />
                      <Route path="/admin/users" element={<AdminUsers />} />
                      <Route path="/admin/import" element={<AdminImport />} />
                      <Route path="/admin/rules" element={<Rules />} />
                      <Route path="/admin/audit" element={<AdminAudit />} />
                    </>
                  )}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </div>
            </main>
          </div>
          </NavClose.Provider>
        )}
      </HashRouter>
    </Ctx.Provider>
  )
}
