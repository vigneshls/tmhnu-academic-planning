import { useMemo } from 'react'
import { checklist } from '../../engine/recommend'
import type { Board, ComplianceEntry, SchoolData } from '../../engine/types'
import { Badge, Card, Kpi } from '../../ui/kit'

const today = () => new Date().toISOString().slice(0, 10)
const daysTo = (iso: string) => Math.round((new Date(iso + 'T00:00:00Z').getTime() - new Date(today() + 'T00:00:00Z').getTime()) / 86400000)

export default function ComplianceTab({ board, data, onChange, userName }: { board: Board; data: SchoolData; onChange: (d: SchoolData) => void; userName: string }) {
  const items = useMemo(() => checklist(board), [board])
  const get = (id: string): ComplianceEntry => data.compliance?.[id] ?? { done: false }
  const set = (id: string, p: Partial<ComplianceEntry>) => {
    const cur = get(id)
    const next = { ...cur, ...p }
    if ('status' in p) Object.assign(next, { done: p.status === 'YES', date: p.status ? today() : undefined, by: p.status ? userName : undefined })
    onChange({ ...data, compliance: { ...(data.compliance ?? {}), [id]: next } })
  }
  const counts = items.reduce((a, i) => {
    const e = get(i.id)
    const exp = e.validUntil && e.status !== 'NA' ? daysTo(e.validUntil) : null
    if (!e.status) a.open++
    else if (e.status === 'NO') a.no++
    else a.ok++
    if (exp !== null && exp <= 60) a.expiring++
    return a
  }, { ok: 0, no: 0, open: 0, expiring: 0 })
  const areas = [...new Set(items.map((i) => i.area))]

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Kpi label="In place / not applicable" value={counts.ok} tone="good" />
        <Kpi label="Not in place" value={counts.no} tone={counts.no ? 'bad' : 'default'} />
        <Kpi label="Not yet confirmed" value={counts.open} tone={counts.open ? 'warn' : 'default'} />
        <Kpi label="Expired / expiring in 60 days" value={counts.expiring} tone={counts.expiring ? 'bad' : 'default'} />
      </div>
      <p className="text-sm text-slate-500">These requirements cannot be checked from staffing data. Set the status (normally filled in the workbook), add validity dates for certificates, then click <b>Save changes</b>. Items marked “No” or expiring appear in the recommendations.</p>
      {areas.map((ar) => (
        <Card key={ar} title={ar} pad={false}>
          <table className="w-full text-sm">
            <tbody>
              {items.filter((i) => i.area === ar).map((i) => {
                const e = get(i.id)
                const left = e.validUntil && e.status !== 'NA' ? daysTo(e.validUntil) : null
                return (
                  <tr key={i.id} className="border-t border-slate-100 align-top first:border-t-0">
                    <td className="px-5 py-4">
                      <div className="text-slate-800">{i.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {i.frequency} · Basis: {i.source.url.startsWith('http') ? <a className="underline decoration-slate-300" href={i.source.url} target="_blank" rel="noopener noreferrer">{i.source.title}</a> : i.source.title}
                      </div>
                      {e.status && e.date && <div className="mt-1 text-xs text-slate-400">Updated {e.date}{e.by ? ` by ${e.by}` : ''}</div>}
                    </td>
                    <td className="w-40 px-3 py-4">
                      <select aria-label={`Status: ${i.title}`} className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm" value={e.status ?? ''} onChange={(ev) => set(i.id, { status: (ev.target.value || undefined) as ComplianceEntry['status'] })}>
                        <option value="">Not confirmed</option><option value="YES">Yes — in place</option><option value="NO">No</option><option value="NA">Not applicable</option>
                      </select>
                    </td>
                    <td className="w-44 px-3 py-4">
                      <input aria-label="Valid until" type="date" className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={e.validUntil ?? ''} onChange={(ev) => set(i.id, { validUntil: ev.target.value || undefined })} />
                      {left !== null && <div className="mt-1">{left < 0 ? <Badge tone="critical">Expired</Badge> : left <= 60 ? <Badge tone="high">{left} days left</Badge> : <span className="text-xs text-slate-400">{left} days left</span>}</div>}
                    </td>
                    <td className="w-56 px-5 py-4">
                      <input aria-label="Remarks" placeholder="Remarks" maxLength={200} className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-sm" value={e.note ?? ''} onChange={(ev) => set(i.id, { note: ev.target.value.slice(0, 200) })} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </Card>
      ))}
    </div>
  )
}
