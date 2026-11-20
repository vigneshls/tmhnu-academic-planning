import { useEffect, useState } from 'react'
import { store, type AuditEntry } from '../../data/store'
import type { School } from '../../engine/types'
import { Card, PageHeader } from '../../ui/kit'

const LABEL: Record<string, string> = {
  sign_in: 'Signed in', change_password: 'Changed own password', add_school: 'Added school', edit_school: 'Edited school', save_school: 'Saved school',
  delete_school: 'Deleted school', save_rules: 'Changed board rules', save_school_data: 'Saved school data', upload_faculty: 'Updated faculty list',
  import_workbook: 'Imported school workbook', create_user: 'Created login', update_user: 'Updated user', reset_password: 'Reset password',
}

export default function AdminAudit() {
  const [rows, setRows] = useState<AuditEntry[] | null>(null)
  const [schools, setSchools] = useState<School[]>([])
  useEffect(() => { void Promise.all([store.listAudit(), store.listSchools()]).then(([a, s]) => { setRows(a); setSchools(s) }) }, [])
  const sn = (id?: string | null) => (id ? schools.find((s) => s.id === id)?.name ?? '' : '')
  return (
    <>
      <PageHeader eyebrow="Administration" title="Activity Log" subtitle="Who changed what, most recent first." />
      <Card pad={false}>
        <table className="w-full text-sm">
          <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500"><tr><th className="px-5 py-3">When</th><th className="px-5 py-3">User</th><th className="px-5 py-3">Action</th><th className="px-5 py-3">School</th><th className="px-5 py-3">Detail</th></tr></thead>
          <tbody>
            {!rows ? <tr><td className="px-5 py-4 text-slate-500" colSpan={5}>Loading…</td></tr> : rows.length === 0 ? <tr><td className="px-5 py-4 text-slate-500" colSpan={5}>No activity yet.</td></tr> : rows.map((r, i) => (
              <tr key={i} className="border-t border-slate-100">
                <td className="whitespace-nowrap px-5 py-3 text-slate-500">{new Date(r.at).toLocaleString()}</td>
                <td className="px-5 py-3">{r.user}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{LABEL[r.action] ?? r.action}</td>
                <td className="px-5 py-3 text-slate-600">{sn(r.schoolId)}</td>
                <td className="px-5 py-3 text-slate-500">{r.detail ?? ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </>
  )
}
