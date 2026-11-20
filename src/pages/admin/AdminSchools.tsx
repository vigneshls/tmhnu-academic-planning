import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { store } from '../../data/store'
import { BOARD_LABEL } from '../../engine/rules'
import type { Board, School } from '../../engine/types'
import { Badge, Button, Card, Empty, Field, Modal, PageHeader, inputCls } from '../../ui/kit'

export default function AdminSchools() {
  const [schools, setSchools] = useState<School[] | null>(null)
  const [edit, setEdit] = useState<School | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [msg, setMsg] = useState('')
  const load = async () => setSchools(await store.listSchools())
  useEffect(() => { void load() }, [])

  const save = async () => {
    if (!edit || !edit.name.trim()) return setMsg('Enter the school name.')
    try { await store.saveSchool({ ...edit, name: edit.name.trim() }); setEdit(null); setMsg(''); await load() } catch (e) { setMsg((e as Error).message) }
  }

  return (
    <>
      <PageHeader eyebrow="Administration" title="Schools" subtitle="Add the schools managed by the institution. Each school's data is loaded from its workbook."
        actions={<Button variant="primary" onClick={() => { setIsNew(true); setEdit({ id: store.mode === 'demo' ? `s-${Date.now().toString(36)}` : crypto.randomUUID(), name: '', board: 'MATRIC' }) }}>+ Add school</Button>} />
      {!schools ? <p className="text-slate-500">Loading…</p> : schools.length === 0 ? <Empty title="No schools yet">Add the first school to begin.</Empty> : (
        <Card pad={false}>
          <table className="w-full text-sm">
            <thead className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-500">
              <tr><th className="px-5 py-3">School</th><th className="px-5 py-3">Board</th><th className="px-5 py-3" /></tr>
            </thead>
            <tbody>
              {schools.map((s) => (
                <tr key={s.id} className="border-t border-slate-100">
                  <td className="px-5 py-3.5 font-medium text-slate-900"><Link className="hover:underline" to={`/school/${s.id}`}>{s.name}</Link></td>
                  <td className="px-5 py-3.5"><Badge tone="info">{BOARD_LABEL[s.board]}</Badge></td>
                  <td className="px-5 py-3.5 text-right">
                    <div className="flex justify-end gap-2">
                      <Link to={`/admin/import?school=${s.id}`} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100">Import data</Link>
                      <Button variant="ghost" onClick={() => { setIsNew(false); setEdit({ ...s }) }}>Edit</Button>
                      <Button variant="danger" onClick={async () => { if (confirm(`Delete "${s.name}" and all its data? Principal logins for this school will be disabled.`)) { await store.deleteSchool(s.id); await load() } }}>Delete</Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
      <Modal open={!!edit} title={isNew ? 'Add school' : 'Edit school'} onClose={() => setEdit(null)}>
        {edit && (
          <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); void save() }}>
            <Field label="School name"><input required maxLength={160} className={inputCls} value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} /></Field>
            <Field label="Board" hint="Selects the rule set used for checks and recommendations.">
              <select className={inputCls} value={edit.board} onChange={(e) => setEdit({ ...edit, board: e.target.value as Board })}>
                <option value="MATRIC">Matriculation (Tamil Nadu)</option><option value="CBSE">CBSE</option>
              </select>
            </Field>
            {msg && <p className="text-sm text-red-700">{msg}</p>}
            <div className="flex justify-end gap-2"><Button type="button" onClick={() => setEdit(null)}>Cancel</Button><Button variant="primary">Save</Button></div>
          </form>
        )}
      </Modal>
    </>
  )
}
