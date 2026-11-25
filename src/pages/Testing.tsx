import { useMemo, useState } from 'react'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { downloadCsv } from '../lib/csv'
import { uid } from '../lib/db'
import { benford, RULES } from '../lib/jet'
import { net } from '../lib/ledger'
import { php, toDecimal } from '../lib/money'
import type { Flag, RuleId } from '../lib/types'
import { useApp } from '../store'
import { Badge, Button, Card, cx, DataTable, Drawer, PageHeader } from '../ui'

export default function Testing() {
  const { entries, flags, eng, saveFinding, setPage } = useApp()
  const [rule, setRule] = useState<RuleId | ''>('')
  const [sel, setSel] = useState<Flag | null>(null)
  const b = useMemo(() => benford(entries.map(net)), [entries])
  const rows = flags.filter((f) => !rule || f.rule === rule)
  const amountOf = (f: Flag) => entries.filter((e) => f.rows.includes(e.row)).reduce((s, e) => Math.max(s, Math.abs(net(e))), 0)
  const chart = b.digits.map((d) => ({ digit: String(d.digit), Actual: +(d.actual * 100).toFixed(1), Expected: +(d.expected * 100).toFixed(1) }))
  const conformTone = b.conformity.startsWith('Close') || b.conformity.startsWith('Acceptable') ? 'green' : b.conformity.startsWith('Marginal') ? 'amber' : 'red'

  const toFinding = async (f: Flag) => {
    const now = new Date().toISOString().slice(0, 19)
    await saveFinding({
      id: uid(), engagementId: eng.id, title: `${RULES[f.rule].label}: ${f.detail}`.slice(0, 120), description: `Raised from journal entry test. Rule: ${RULES[f.rule].why}.`,
      severity: 'Medium', amount: amountOf(f), rows: f.rows, adjDebit: '', adjCredit: '', createdAt: now,
    })
    setPage('Findings')
  }

  return (
    <>
      <PageHeader title="Journal entry testing" subtitle={`${flags.length} flags on ${entries.length.toLocaleString()} lines · performance materiality ${php(eng.materiality.performance)}`}
        actions={<Button onClick={() => downloadCsv('journal-entry-flags.csv', [['Rule', 'Why', 'Detail', 'Lines'], ...flags.map((f) => [RULES[f.rule].label, RULES[f.rule].why, f.detail, f.rows.map((r) => r + 1).join(' ')])])}>Export flags CSV</Button>} />

      <div className="-mx-4 mb-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:mb-6 md:flex-wrap md:px-0 [scrollbar-width:none]" role="group" aria-label="Filter by rule">
        <button onClick={() => setRule('')} className={cx('shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition', !rule ? 'bg-gradient-to-r from-sage-500 to-sage-500 text-white ring-transparent shadow-md shadow-sage-500/25' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}>All <span className="tabular-nums opacity-70">{flags.length}</span></button>
        {(Object.keys(RULES) as RuleId[]).map((r) => {
          const n = flags.filter((f) => f.rule === r).length
          return (
            <button key={r} onClick={() => setRule(r)} title={RULES[r].why} className={cx('shrink-0 whitespace-nowrap rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 ring-inset transition', rule === r ? 'bg-gradient-to-r from-sage-500 to-sage-500 text-white ring-transparent shadow-md shadow-sage-500/25' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50')}>
              {RULES[r].label} <span className={cx('tabular-nums', n ? 'font-semibold' : 'opacity-50')}>{n}</span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
        <Card title={rule ? RULES[rule].label : 'All flags'} pad={false}>
          {rule && <p className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">Rule: {RULES[rule].why}</p>}
          <DataTable rows={rows} rowKey={(f) => `${f.rule}-${f.rows.join('-')}`} onRow={setSel} pageSize={25} cols={[
            { key: 'rule', label: 'Rule', sort: (f) => f.rule, render: (f) => <Badge tone={f.rule === 'materiality' || f.rule === 'duplicate' ? 'red' : 'amber'}>{RULES[f.rule].label}</Badge> },
            { key: 'detail', label: 'Detail', render: (f) => f.detail },
            { key: 'amt', label: 'Largest line', num: true, sort: amountOf, render: (f) => php(amountOf(f)) },
          ]} />
        </Card>

        <Card title="Benford's Law · first digit">
          <div className="mb-3 flex items-center justify-between text-sm">
            <span className="text-slate-500">{b.n.toLocaleString()} amounts ≥ ₱10 · MAD {b.mad.toFixed(4)}</span>
            <Badge tone={conformTone}>{b.conformity}</Badge>
          </div>
          <div className="h-64">
            <ResponsiveContainer>
              <ComposedChart data={chart} margin={{ left: -10, right: 8 }}>
                <CartesianGrid vertical={false} stroke="#e2e8f0" />
                <XAxis dataKey="digit" tick={{ fontSize: 12, fill: '#64748b' }} />
                <YAxis unit="%" tick={{ fontSize: 12, fill: '#64748b' }} />
                <Tooltip formatter={(v) => `${v}%`} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="Actual" fill="#6f9273" radius={[3, 3, 0, 0]} />
                <Line dataKey="Expected" stroke="#f59e0b" strokeWidth={2} dot={{ r: 3 }} />
              </ComposedChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-3 text-xs text-slate-500">Mean absolute deviation thresholds (Nigrini): &lt;0.006 close, &lt;0.012 acceptable, &lt;0.015 marginal, above that nonconformity. Large spikes on one digit point to repeated amounts worth testing.</p>
        </Card>
      </div>

      <Drawer open={!!sel} onClose={() => setSel(null)} title={sel ? RULES[sel.rule].label : ''}>
        {sel && (
          <div className="space-y-4 text-sm">
            <div className="rounded-md border border-amber-200 bg-amber-50 p-3">
              <p className="text-xs text-amber-800">Rule: {RULES[sel.rule].why}</p>
              <p className="mt-1 font-medium text-amber-900">{sel.detail}</p>
            </div>
            <table className="w-full"><thead className="text-xs text-slate-500"><tr><th className="py-1 text-left">Date</th><th className="text-left">Journal</th><th className="text-left">Account</th><th className="text-left">User</th><th className="text-right">Amount</th></tr></thead>
              <tbody className="divide-y divide-slate-100">
                {entries.filter((e) => sel.rows.includes(e.row)).map((e) => <tr key={e.row}><td className="py-1.5 tabular-nums">{e.date}</td><td>{e.entryId}</td><td>{e.account} {e.accountName}</td><td>{e.user}</td><td className="num">{php(net(e))}</td></tr>)}
              </tbody>
            </table>
            <div className="flex gap-2">
              <Button variant="primary" onClick={() => toFinding(sel)}>Raise finding</Button>
              <Button onClick={() => downloadCsv('flag-lines.csv', [['Date', 'Journal', 'Account', 'User', 'Amount'], ...entries.filter((e) => sel.rows.includes(e.row)).map((e) => [e.date, e.entryId, e.account, e.user, toDecimal(net(e))])])}>Export lines</Button>
            </div>
          </div>
        )}
      </Drawer>
    </>
  )
}
