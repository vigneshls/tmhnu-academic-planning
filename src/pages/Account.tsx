import { useState } from 'react'
import { useAuth } from '../App'
import { PASSWORD_RULE, store } from '../data/store'
import { Button, Card, Field, PageHeader, inputCls } from '../ui/kit'

export default function Account() {
  const { profile } = useAuth()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [again, setAgain] = useState('')
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null)
  return (
    <>
      <PageHeader title="Account" subtitle={`${profile?.name} · ${profile?.email}`} />
      <Card title="Change password" className="max-w-lg">
        <form className="space-y-4" onSubmit={async (e) => {
          e.preventDefault()
          if (next !== again) return setMsg({ ok: false, text: 'The new passwords do not match.' })
          try { await store.changeOwnPassword(cur, next); setCur(''); setNext(''); setAgain(''); setMsg({ ok: true, text: 'Password changed.' }) } catch (er) { setMsg({ ok: false, text: (er as Error).message }) }
        }}>
          <Field label="Current password"><input type="password" autoComplete="current-password" className={inputCls} value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
          <Field label="New password" hint={PASSWORD_RULE}><input type="password" autoComplete="new-password" className={inputCls} value={next} onChange={(e) => setNext(e.target.value)} /></Field>
          <Field label="Repeat new password"><input type="password" autoComplete="new-password" className={inputCls} value={again} onChange={(e) => setAgain(e.target.value)} /></Field>
          {msg && <p role="status" className={msg.ok ? 'text-sm text-emerald-700' : 'text-sm text-red-700'}>{msg.text}</p>}
          <Button variant="primary">Change password</Button>
        </form>
      </Card>
    </>
  )
}
