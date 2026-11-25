import { FileText, Scale, ShieldAlert, Target } from 'lucide-react'
import { useMemo, useState } from 'react'
import { downloadCsv } from '../lib/csv'
import { uid } from '../lib/db'
import { parseMoney, php, toDecimal } from '../lib/money'
import type { Finding, Severity } from '../lib/types'
import { useApp } from '../store'
import { Badge, Button, Card, DataTable, Drawer, Field, inputCls, Kpi, PageHeader, sevTone } from '../ui'

const now = () => new Date().toISOString().slice(0, 19)

function FindingForm({ initial, onDone }: { initial: Finding | null; onDone: () => void }) {
  const { entries, eng, saveFinding, deleteFinding } = useApp()
  const accounts = useMemo(() => [...new Map(entries.map((e) => [e.account, e.accountName])).entries()].sort(), [entries])
  const jeOf = (rows: number[]) => [...new Set(entries.filter((e) => rows.includes(e.row)).map((e) => e.entryId))].join(', ')
  const [f, setF] = useState({
    title: initial?.title ?? '', description: initial?.description ?? '', severity: initial?.severity ?? ('Medium' as Severity),
    amount: initial ? toDecimal(initial.amount) : '', jes: initial ? jeOf(initial.rows) : '', adjDebit: initial?.adjDebit ?? '', adjCredit: initial?.adjCredit ?? '',
  })
  const amount = parseMoney(f.amount)
  const jeList = f.jes.split(/[\s,]+/).filter(Boolean)
  const unknown = jeList.filter((j) => !entries.some((e) => e.entryId === j))
  const adjBad = (!!f.adjDebit !== !!f.adjCredit) || (f.adjDebit && f.adjDebit === f.adjCredit)
  const valid = f.title.trim() && amount !== null && !unknown.length && !adjBad
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      if (!valid) return
      const next: Finding = {
        id: initial?.id ?? uid(), engagementId: eng.id, title: f.title.trim(), description: f.description, severity: f.severity, amount: amount!,
        rows: entries.filter((x) => jeList.includes(x.entryId)).map((x) => x.row), adjDebit: f.adjDebit, adjCredit: f.adjCredit,
        createdAt: initial?.createdAt ?? now(),
      }
      await saveFinding(next)
      onDone()
    }}>
      <Field label="Title"><input required className={inputCls} value={f.title} onChange={set('title')} /></Field>
      <Field label="Description and evidence"><textarea rows={4} className={inputCls} value={f.description} onChange={set('description')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Severity"><select className={inputCls} value={f.severity} onChange={set('severity')}>{['High', 'Medium', 'Low'].map((s) => <option key={s}>{s}</option>)}</select></Field>
        <Field label="Amount (₱)"><input inputMode="decimal" className={inputCls + ' text-right tabular-nums'} value={f.amount} onChange={set('amount')} placeholder="0.00" /></Field>
      </div>
      <Field label="Linked journals" hint={unknown.length ? <span className="text-red-700">Not in ledger: {unknown.join(', ')}</span> : 'Journal IDs separated by commas, e.g. JE-00012, JE-00013'}>
        <input className={inputCls} value={f.jes} onChange={set('jes')} />
      </Field>
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Proposed adjusting entry (optional)</legend>
        <div className="grid grid-cols-2 gap-3">
          {(['adjDebit', 'adjCredit'] as const).map((k) => (
            <Field key={k} label={k === 'adjDebit' ? 'Debit account' : 'Credit account'}>
              <select className={inputCls} value={f[k]} onChange={set(k)}>
                <option value="">— none —</option>
                {accounts.map(([a, n]) => <option key={a} value={a}>{a} {n}</option>)}
              </select>
            </Field>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">{adjBad ? <span className="text-red-700">Pick two different accounts, or neither.</span> : 'Applied in the adjusted columns of the financial statements.'}</p>
      </fieldset>
      <div className="flex justify-between">
        {initial ? <Button type="button" variant="danger" onClick={async () => { if (confirm('Delete this finding? This cannot be undone.')) { await deleteFinding(initial); onDone() } }}>Delete</Button> : <span />}
        <div className="flex gap-2"><Button type="button" onClick={onDone}>Cancel</Button><Button variant="primary" type="submit" disabled={!valid}>Save finding</Button></div>
      </div>
    </form>
  )
}

export default function Findings() {
  const { findings, eng, entries } = useApp()
  const [editing, setEditing] = useState<Finding | 'new' | null>(null)
  const m = eng.materiality
  const adjTotal = findings.filter((f) => f.adjDebit).reduce((s, f) => s + Math.abs(f.amount), 0)
  const uncorrected = findings.filter((f) => !f.adjDebit).reduce((s, f) => s + Math.abs(f.amount), 0)
  const pct = m.overall ? adjTotal / m.overall : 0
  const jeOf = (rows: number[]) => [...new Set(entries.filter((e) => rows.includes(e.row)).map((e) => e.entryId))].join(', ')

  return (
    <>
      <PageHeader title="Findings and adjustments" subtitle="Issues found during the audit, with proposed adjusting entries."
        actions={<>
          <Button onClick={() => downloadCsv('findings.csv', [['Severity', 'Title', 'Amount', 'Debit', 'Credit', 'Journals'], ...findings.map((f) => [f.severity, f.title, toDecimal(f.amount), f.adjDebit, f.adjCredit, jeOf(f.rows)])])}>Export CSV</Button>
          <Button variant="primary" onClick={() => setEditing('new')}>New finding</Button>
        </>} />
      <div className="mb-6 grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Kpi label="Findings" icon={ShieldAlert} value={findings.length} sub={`${findings.filter((f) => f.severity === 'High').length} high severity`} tone={findings.some((f) => f.severity === 'High') ? 'red' : 'default'} />
        <Kpi label="Proposed adjustments" icon={Scale} value={php(adjTotal)} sub={`${(pct * 100).toFixed(0)}% of overall materiality`} tone={pct >= 1 ? 'red' : pct >= 0.5 ? 'amber' : 'green'} />
        <Kpi label="No adjustment proposed" icon={FileText} value={php(uncorrected)} sub="Control or disclosure findings" />
        <Kpi label="Overall materiality" icon={Target} value={php(m.overall)} sub={`Trivial below ${php(m.trivial)}`} />
      </div>
      <Card title="Running total vs materiality" className="mb-6">
        <div className="relative h-3 rounded-full bg-slate-100">
          <div className={`h-3 rounded-full ${pct >= 1 ? 'bg-red-600' : pct >= 0.5 ? 'bg-amber-500' : 'bg-sage-600'}`} style={{ width: `${Math.min(100, pct * 100)}%` }} />
          <span className="absolute -top-1 h-5 w-0.5 bg-slate-500" style={{ left: `${Math.min(100, (m.performance / m.overall) * 100)}%` }} title="Performance materiality" />
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500"><span>{php(adjTotal)} proposed</span><span>Marker = performance materiality {php(m.performance)}</span><span>{php(m.overall)}</span></div>
      </Card>
      <Card pad={false}>
        <DataTable rows={findings} rowKey={(f) => f.id} onRow={setEditing} empty="No findings yet." cols={[
          { key: 'sev', label: 'Severity', sort: (f) => ['High', 'Medium', 'Low'].indexOf(f.severity), render: (f) => <Badge tone={sevTone(f.severity)}>{f.severity}</Badge> },
          { key: 'title', label: 'Finding', render: (f) => <><p className="font-medium">{f.title}</p><p className="line-clamp-1 text-xs text-slate-500">{f.description}</p></> },
          { key: 'je', label: 'Journals', render: (f) => <span className="text-xs tabular-nums">{jeOf(f.rows) || '—'}</span> },
          { key: 'adj', label: 'Adjustment', render: (f) => (f.adjDebit ? <span className="text-xs">Dr {f.adjDebit} / Cr {f.adjCredit}</span> : <span className="text-xs text-slate-400">None</span>) },
          { key: 'amt', label: 'Amount', num: true, sort: (f) => f.amount, render: (f) => php(f.amount) },
        ]} />
      </Card>
      <Drawer open={!!editing} onClose={() => setEditing(null)} title={editing === 'new' ? 'New finding' : 'Edit finding'}>
        {editing && <FindingForm key={editing === 'new' ? 'new' : editing.id} initial={editing === 'new' ? null : editing} onDone={() => setEditing(null)} />}
      </Drawer>
    </>
  )
}
