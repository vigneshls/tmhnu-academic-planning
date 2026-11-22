import { useEffect, useRef, type ReactNode } from 'react'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function PageHeader({ title, subtitle, actions, eyebrow }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end gap-4">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-teal-700">{eyebrow}</div>}
        <h1 className="text-xl font-semibold tracking-tight text-slate-900 sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print ml-auto flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

export function Card({ title, subtitle, actions, children, className, pad = true }: { title?: ReactNode; subtitle?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('min-w-0 rounded-xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,39,68,0.04)]', className)}>
      {(title || actions) && (
        <div className="flex flex-wrap items-center gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            {title && <h2 className="font-semibold text-slate-900">{title}</h2>}
            {subtitle && <p className="text-sm text-slate-500">{subtitle}</p>}
          </div>
          {actions && <div className="no-print ml-auto flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className={pad ? 'p-4 sm:p-5' : 'overflow-x-auto'}>{children}</div>
    </section>
  )
}

export function Kpi({ label, value, hint, tone = 'default', icon }: { label: string; value: ReactNode; hint?: ReactNode; tone?: 'default' | 'bad' | 'good' | 'warn'; icon?: ReactNode }) {
  const t = { default: 'text-slate-900', bad: 'text-red-700', good: 'text-emerald-700', warn: 'text-amber-700' }[tone]
  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-4 shadow-[0_1px_2px_rgba(15,39,68,0.04)]">
      <div className="flex items-center gap-2 text-xs font-medium text-slate-500">{icon}{label}</div>
      <div className={cx('mt-1 text-2xl font-semibold tabular-nums tracking-tight', t)}>{value}</div>
      {hint && <div className="mt-0.5 text-xs text-slate-500">{hint}</div>}
    </div>
  )
}

const BADGE = {
  critical: 'bg-red-50 text-red-700 ring-red-200',
  high: 'bg-amber-50 text-amber-800 ring-amber-200',
  medium: 'bg-sky-50 text-sky-800 ring-sky-200',
  low: 'bg-slate-100 text-slate-700 ring-slate-200',
  pass: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
  info: 'bg-indigo-50 text-indigo-800 ring-indigo-200',
  neutral: 'bg-slate-100 text-slate-600 ring-slate-200',
} as const
export type BadgeTone = keyof typeof BADGE
export function Badge({ tone = 'neutral', children }: { tone?: BadgeTone; children: ReactNode }) {
  return <span className={cx('inline-flex items-center rounded-md px-2 py-0.5 text-xs font-medium ring-1 ring-inset', BADGE[tone])}>{children}</span>
}

export function Button({ children, variant = 'secondary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const v = {
    primary: 'bg-[#0f2744] text-white hover:bg-[#173a63] disabled:bg-slate-300',
    secondary: 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:text-slate-400',
    danger: 'border border-red-200 bg-white text-red-700 hover:bg-red-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant]
  return <button {...p} className={cx('inline-flex items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors disabled:cursor-not-allowed', v, className)}>{children}</button>
}

export function Field({ label, hint, children }: { label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}
export const inputCls = 'w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-[#0f2744] focus:outline-none focus:ring-2 focus:ring-[#0f2744]/15'

export function Modal({ open, title, onClose, children, width = 'max-w-lg' }: { open: boolean; title: string; onClose: () => void; children: ReactNode; width?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', h)
    ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus()
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/40 p-4 pt-20" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={cx('w-full rounded-xl bg-white shadow-xl', width)}>
        <div className="flex items-center border-b border-slate-100 px-5 py-4">
          <h2 className="font-semibold text-slate-900">{title}</h2>
          <button aria-label="Close" className="ml-auto rounded p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-700" onClick={onClose}>✕</button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  )
}

export function ScoreRing({ pct, size = 112, label }: { pct: number; size?: number; label?: string }) {
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const color = pct >= 80 ? '#047857' : pct >= 60 ? '#b45309' : '#b91c1c'
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`${label ?? 'Score'} ${pct}%`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#e2e8f0" strokeWidth="10" />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth="10" strokeLinecap="round" strokeDasharray={`${(pct / 100) * c} ${c}`} transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dominantBaseline="central" textAnchor="middle" fontSize={size / 4.2} fontWeight="600" fill="#0f172a">{pct}%</text>
    </svg>
  )
}

/** Horizontal paired bars: needed vs available */
export function NeedBars({ rows }: { rows: { label: string; sub?: string; needed: number; available: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => Math.max(r.needed, r.available)))
  return (
    <div className="space-y-2.5">
      <div className="flex gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-slate-300" />Needed</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-[#0f2744]" />Available</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-3 rounded-sm bg-red-500" />Shortage</span>
      </div>
      {rows.map((r) => {
        const gap = r.available - r.needed
        return (
          <div key={r.label + r.sub} className="grid grid-cols-[minmax(0,11rem)_1fr_3.5rem] items-center gap-3 text-sm">
            <div className="truncate" title={`${r.label}${r.sub ? ' — ' + r.sub : ''}`}>
              <span className="text-slate-800">{r.label}</span>
              {r.sub && <span className="block truncate text-xs text-slate-400">{r.sub}</span>}
            </div>
            <div className="space-y-1">
              <div className="h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-slate-300" style={{ width: `${(r.needed / max) * 100}%` }} /></div>
              <div className="h-2 rounded-full bg-slate-100"><div className={cx('h-2 rounded-full', gap < 0 ? 'bg-red-500' : 'bg-[#0f2744]')} style={{ width: `${(r.available / max) * 100}%` }} /></div>
            </div>
            <div className={cx('text-right text-xs font-semibold tabular-nums', gap < 0 ? 'text-red-700' : gap > 0 ? 'text-amber-700' : 'text-emerald-700')}>{gap > 0 ? `+${gap}` : gap === 0 ? 'OK' : gap}</div>
          </div>
        )
      })}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <div className="font-medium text-slate-800">{title}</div>
      {children && <div className="mt-1 text-sm text-slate-500">{children}</div>}
    </div>
  )
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: readonly (readonly [T, string, number?])[]; value: T; onChange: (t: T) => void }) {
  return (
    <div role="tablist" className="no-print mb-6 flex gap-1 overflow-x-auto border-b border-slate-200">
      {tabs.map(([k, label, count]) => (
        <button key={k} role="tab" aria-selected={value === k} onClick={() => onChange(k)} className={cx('-mb-px flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-sm', value === k ? 'border-[#0f2744] font-semibold text-[#0f2744]' : 'border-transparent text-slate-500 hover:text-slate-800')}>
          {label}
          {count !== undefined && count > 0 && <span className="rounded-full bg-red-100 px-1.5 text-xs font-semibold text-red-700">{count}</span>}
        </button>
      ))}
    </div>
  )
}

/** Small inline icons (stroke, currentColor) */
export const Icon = {
  dashboard: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="3" width="7" height="9" rx="1.5" /><rect x="14" y="3" width="7" height="5" rx="1.5" /><rect x="14" y="12" width="7" height="9" rx="1.5" /><rect x="3" y="16" width="7" height="5" rx="1.5" /></svg>,
  school: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M3 10l9-6 9 6-9 6-9-6z" /><path d="M7 12.5V17c0 1 2.2 3 5 3s5-2 5-3v-4.5" /></svg>,
  users: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" /><circle cx="17" cy="9" r="2.5" /><path d="M16.5 14.5c2.4.2 4.2 1.9 5 5" /></svg>,
  upload: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 15V4m0 0l-4 4m4-4l4 4" /><path d="M4 15v3a2 2 0 002 2h12a2 2 0 002-2v-3" /></svg>,
  rules: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M5 4h11l3 3v13H5z" /><path d="M9 10h6M9 14h6M9 18h3" /></svg>,
  log: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>,
  key: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="8" cy="15" r="4" /><path d="M11 12l9-9m-3 3l2 2m-5 1l2 2" /></svg>,
  download: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 4v11m0 0l-4-4m4 4l4-4" /><path d="M4 17v1a2 2 0 002 2h12a2 2 0 002-2v-1" /></svg>,
  check: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M5 12.5l4.5 4.5L19 7" /></svg>,
  alert: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3l9.5 17h-19z" /><path d="M12 10v4m0 3h.01" /></svg>,
}
