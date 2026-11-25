import { AlertTriangle, ArrowDownLeft, ArrowUpRight, Rows3, Scale } from 'lucide-react'
import { useMemo, useState } from 'react'
import { RULES } from '../lib/jet'
import { checkBalance, guessMapping, journalLines, LEDGER_FIELDS, mapRows, nextJournalId, REQUIRED_FIELDS, type ColumnMapping, type LedgerField } from '../lib/ledger'
import { parseMoney, php } from '../lib/money'
import { ACCOUNTS } from '../lib/seed'
import type { Entry } from '../lib/types'
import { useApp } from '../store'
import { Badge, Button, Card, cx, DataTable, Drawer, Field, inputCls, Kpi, KpiRow, Money, PageHeader } from '../ui'

const LABELS: Record<LedgerField, string> = { date: 'Date', entryId: 'Journal / entry ID', account: 'Account code', accountName: 'Account name', description: 'Description', debit: 'Debit', credit: 'Credit', user: 'Posted by (user)' }

/** Type one journal by hand: debit account, credit account, amount. */
function EntryForm({ onDone }: { onDone: () => void }) {
  const { entries, setLedger, ledgerFile, eng } = useApp()
  // Demo chart of accounts plus any account already in the ledger
  const names = useMemo(() => ({ ...ACCOUNTS, ...Object.fromEntries(entries.filter((e) => e.accountName).map((e) => [e.account, e.accountName])) }), [entries])
  const accounts = Object.entries(names).sort(([a], [b]) => a.localeCompare(b))
  const [f, setF] = useState({ date: eng.periodEnd, description: '', debit: '', credit: '', amount: '', user: '' })
  const amount = parseMoney(f.amount)
  const valid = f.date && f.description.trim() && f.debit && f.credit && f.debit !== f.credit && amount !== null && amount > 0 && f.user.trim()
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })
  const acctSelect = (k: 'debit' | 'credit') => (
    <select required className={inputCls} value={f[k]} onChange={set(k)}>
      <option value="">Choose account…</option>
      {accounts.map(([a, n]) => <option key={a} value={a}>{a} {n}</option>)}
    </select>
  )
  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      if (!valid) return
      const lines = journalLines(entries, { ...f, description: f.description.trim(), user: f.user.trim(), amount: amount! }, names)
      await setLedger([...entries, ...lines], ledgerFile || 'Typed entries')
      onDone()
    }}>
      <p className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-600">Saved as journal <b>{nextJournalId(entries)}</b> with one debit line and one credit line, so it always balances.</p>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Date"><input type="date" required className={inputCls} value={f.date} onChange={set('date')} /></Field>
        <Field label="Amount (₱)"><input inputMode="decimal" required placeholder="0.00" className={inputCls + ' text-right tabular-nums'} value={f.amount} onChange={set('amount')} /></Field>
      </div>
      <Field label="Description"><input required placeholder="e.g. Paid electric bill" className={inputCls} value={f.description} onChange={set('description')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Debit account">{acctSelect('debit')}</Field>
        <Field label="Credit account">{acctSelect('credit')}</Field>
      </div>
      {f.debit && f.debit === f.credit && <p className="text-xs text-red-700">Debit and credit must be different accounts.</p>}
      <Field label="Entered by (name)"><input required placeholder="e.g. Juan Dela Cruz" className={inputCls} value={f.user} onChange={set('user')} /></Field>
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onDone}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={!valid}>Add entry</Button>
      </div>
    </form>
  )
}

function Importer({ onDone }: { onDone: () => void }) {
  const { setLedger, entries } = useApp()
  const [file, setFile] = useState<{ name: string; headers: string[]; rows: Record<string, unknown>[] } | null>(null)
  const [map, setMap] = useState<ColumnMapping>({})
  const [err, setErr] = useState('')

  const load = async (f: File) => {
    setErr('')
    try {
      const XLSX = await import('xlsx')
      const wb = XLSX.read(await f.arrayBuffer(), { cellDates: true })
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(wb.Sheets[wb.SheetNames[0]], { defval: '' })
      if (!rows.length) throw new Error('The first sheet has no data rows.')
      const headers = Object.keys(rows[0])
      setFile({ name: f.name, headers, rows })
      setMap(guessMapping(headers))
    } catch (e) {
      setErr(`Could not read ${f.name}: ${(e as Error).message}`)
    }
  }
  const result = useMemo(() => (file ? mapRows(file.rows, map) : null), [file, map])
  const missing = REQUIRED_FIELDS.filter((f) => !map[f])
  const bal = result ? checkBalance(result.entries) : null

  return (
    <div className="space-y-5">
      <label className="flex cursor-pointer flex-col items-center rounded-2xl border-2 border-dashed border-slate-300 px-6 py-8 text-center hover:border-sage-600 hover:bg-sage-50/30">
        <span className="text-sm font-semibold text-slate-800">{file ? file.name : 'Choose a general ledger file'}</span>
        <span className="mt-1 text-xs text-slate-500">CSV or XLSX · first sheet · one row per ledger line with a header row</span>
        <input type="file" accept=".csv,.xlsx,.xls" className="sr-only" onChange={(e) => e.target.files?.[0] && load(e.target.files[0])} />
      </label>
      {err && <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{err}</p>}
      {file && (
        <>
          <div>
            <h3 className="mb-2 text-sm font-semibold">Map columns</h3>
            <div className="grid grid-cols-2 gap-3">
              {LEDGER_FIELDS.map((f) => (
                <Field key={f} label={LABELS[f] + (REQUIRED_FIELDS.includes(f) ? ' *' : '')}>
                  <select className={cx(inputCls, REQUIRED_FIELDS.includes(f) && !map[f] && 'ring-red-400')} value={map[f] ?? ''} onChange={(e) => setMap({ ...map, [f]: e.target.value || undefined })}>
                    <option value="">— not in file —</option>
                    {file.headers.map((h) => <option key={h}>{h}</option>)}
                  </select>
                </Field>
              ))}
            </div>
          </div>
          {result && !missing.length && (
            <div className="space-y-2 rounded-lg bg-slate-50 p-4 text-sm">
              <p><b>{result.entries.length}</b> lines ready · <b>{result.errors.length}</b> skipped</p>
              {bal && <p>Debits {php(bal.totalDebit)} · Credits {php(bal.totalCredit)} · {bal.difference === 0 ? <Badge tone="green">Balanced</Badge> : <Badge tone="red">Out by {php(bal.difference)}</Badge>}</p>}
              {result.errors.length > 0 && <ul className="max-h-32 overflow-auto text-xs text-red-700">{result.errors.slice(0, 50).map((e) => <li key={e}>{e}</li>)}</ul>}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <Button onClick={onDone}>Cancel</Button>
            <Button variant="primary" disabled={!!missing.length || !result?.entries.length} onClick={async () => {
              if (entries.length && !confirm(`Replace the current ledger (${entries.length} lines) with ${file.name}? Payment matches that point to old lines will need re-matching.`)) return
              await setLedger(result!.entries, file.name)
              onDone()
            }}>Import {result?.entries.length ?? 0} lines</Button>
          </div>
        </>
      )}
    </div>
  )
}

export default function Ledger() {
  const { entries, flags, ledgerFile } = useApp()
  const [importing, setImporting] = useState(false)
  const [adding, setAdding] = useState(false)
  const [q, setQ] = useState('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [sel, setSel] = useState<Entry | null>(null)
  const bal = useMemo(() => checkBalance(entries), [entries])
  const flagsByRow = useMemo(() => {
    const m = new Map<number, typeof flags>()
    for (const f of flags) for (const r of f.rows) m.set(r, [...(m.get(r) ?? []), f])
    return m
  }, [flags])
  const rows = useMemo(() => {
    const s = q.toLowerCase()
    return entries.filter((e) => (!onlyFlagged || flagsByRow.has(e.row)) && (!s || `${e.entryId} ${e.account} ${e.accountName} ${e.description} ${e.user}`.toLowerCase().includes(s)))
  }, [entries, q, onlyFlagged, flagsByRow])

  return (
    <>
      <PageHeader title="General ledger" subtitle={ledgerFile ? `Source: ${ledgerFile}` : 'No ledger imported yet'} actions={<><Button onClick={() => setImporting(true)}>Import file</Button><Button variant="primary" onClick={() => setAdding(true)}>Add entry</Button></>} />
      <KpiRow>
        <Kpi label="Lines" icon={Rows3} value={entries.length.toLocaleString()} sub={`${new Set(entries.map((e) => e.entryId)).size} journals`} />
        <Kpi label="Total debits" icon={ArrowDownLeft} value={php(bal.totalDebit)} />
        <Kpi label="Total credits" icon={ArrowUpRight} value={php(bal.totalCredit)} />
        <Kpi label="Difference" icon={Scale} value={php(bal.difference)} tone={bal.difference ? 'red' : 'green'} sub={bal.difference ? 'Ledger does not balance' : 'Debits equal credits'} />
        <Kpi label="Unbalanced journals" icon={AlertTriangle} value={bal.unbalanced.length} tone={bal.unbalanced.length ? 'red' : 'green'} sub={bal.unbalanced.slice(0, 3).map((u) => u.entryId).join(', ') || 'None'} />
      </KpiRow>
      <Card pad={false} title="Ledger lines" actions={
        <>
          <input className={cx(inputCls, 'w-64')} placeholder="Search journal, account, text, user" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search ledger" />
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600"><input type="checkbox" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} className="accent-sage-700" /> Flagged only</label>
        </>
      }>
        <DataTable rows={rows} rowKey={(e) => e.row} onRow={setSel} cols={[
          { key: 'date', label: 'Date', sort: (e) => e.date, render: (e) => <span className="whitespace-nowrap tabular-nums">{e.date}</span> },
          { key: 'je', label: 'Journal', sort: (e) => e.entryId, render: (e) => <span className="font-medium tabular-nums">{e.entryId}</span> },
          { key: 'acct', label: 'Account', sort: (e) => e.account, render: (e) => <><span className="tabular-nums">{e.account}</span> <span className="text-slate-500">{e.accountName}</span></> },
          { key: 'desc', label: 'Description', render: (e) => <span className="line-clamp-1">{e.description}</span> },
          { key: 'user', label: 'User', sort: (e) => e.user, render: (e) => e.user },
          { key: 'dr', label: 'Debit', num: true, sort: (e) => e.debit, render: (e) => (e.debit ? php(e.debit) : '') },
          { key: 'cr', label: 'Credit', num: true, sort: (e) => e.credit, render: (e) => (e.credit ? php(e.credit) : '') },
          { key: 'flags', label: 'Flags', sort: (e) => flagsByRow.get(e.row)?.length ?? 0, render: (e) => <div className="flex flex-wrap gap-1">{flagsByRow.get(e.row)?.map((f, i) => <Badge key={i} tone="amber">{RULES[f.rule].label}</Badge>)}</div> },
        ]} />
      </Card>
      <Drawer open={importing} onClose={() => setImporting(false)} title="Import general ledger"><Importer onDone={() => setImporting(false)} /></Drawer>
      <Drawer open={adding} onClose={() => setAdding(false)} title="Add journal entry">{adding && <EntryForm onDone={() => setAdding(false)} />}</Drawer>
      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? `${sel.entryId} · line ${sel.row + 1}` : ''}>
        {sel && (
          <div className="space-y-5 text-sm">
            <dl className="grid grid-cols-2 gap-x-6 gap-y-3">
              {[['Date', sel.date], ['Posted by', sel.user], ['Account', `${sel.account} ${sel.accountName}`], ['Description', sel.description]].map(([l, v]) => <div key={l}><dt className="text-xs text-slate-500">{l}</dt><dd className="font-medium">{v}</dd></div>)}
              <div><dt className="text-xs text-slate-500">Debit</dt><dd><Money c={sel.debit} bold /></dd></div>
              <div><dt className="text-xs text-slate-500">Credit</dt><dd><Money c={sel.credit} bold /></dd></div>
            </dl>
            <div>
              <h3 className="mb-2 font-semibold">Journal {sel.entryId}</h3>
              <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
                {entries.filter((e) => e.entryId === sel.entryId).map((e) => <tr key={e.row}><td className="py-1.5">{e.account} {e.accountName}</td><td className="num">{e.debit ? php(e.debit) : ''}</td><td className="num">{e.credit ? php(e.credit) : ''}</td></tr>)}
              </tbody></table>
            </div>
            <div>
              <h3 className="mb-2 font-semibold">Why this line is flagged</h3>
              {flagsByRow.get(sel.row)?.map((f, i) => (
                <div key={i} className="mb-2 rounded-md border border-amber-200 bg-amber-50 p-3">
                  <p className="font-medium text-amber-900">{RULES[f.rule].label}</p>
                  <p className="text-xs text-amber-800">Rule: {RULES[f.rule].why}</p>
                  <p className="mt-1 text-amber-900">{f.detail}</p>
                </div>
              )) ?? <p className="text-slate-500">No flags on this line.</p>}
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}
