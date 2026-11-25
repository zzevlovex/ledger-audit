import { useMemo } from 'react'
import { summary } from '../derived'
import { downloadCsv } from '../lib/csv'
import { benford, RULES } from '../lib/jet'
import { checkBalance, net } from '../lib/ledger'
import { php, toDecimal } from '../lib/money'
import type { RuleId } from '../lib/types'
import { useApp } from '../store'
import { Badge, Button, Card, PageHeader, sevTone, statusTone } from '../ui'
import { StatementTable, useStatements } from './Statements'

export default function Reports() {
  const { eng, entries, flags, findings, payments, ledgerFile } = useApp()
  const s = summary(entries, flags, findings, payments)
  const bal = useMemo(() => checkBalance(entries), [entries])
  const b = useMemo(() => benford(entries.map(net)), [entries])
  const st = useStatements()
  const m = eng.materiality
  const byRule = (Object.keys(RULES) as RuleId[]).map((r) => ({ r, n: flags.filter((f) => f.rule === r).length }))

  const exportCsv = () => downloadCsv(`${eng.client.replace(/\W+/g, '-')}-summary.csv`, [
    ['Client', eng.client], ['Period', `${eng.periodStart} to ${eng.periodEnd}`], ['Ledger file', ledgerFile],
    ['Overall materiality', toDecimal(m.overall)], ['Performance materiality', toDecimal(m.performance)], ['Clearly trivial', toDecimal(m.trivial)],
    ['Ledger lines', entries.length], ['Debits', toDecimal(bal.totalDebit)], ['Credits', toDecimal(bal.totalCredit)], ['Difference', toDecimal(bal.difference)],
    [], ['Test', 'Flags'], ...byRule.map(({ r, n }) => [RULES[r].label, n]), ['Benford MAD', b.mad.toFixed(4)], ['Benford result', b.conformity],
    [], ['Finding', 'Severity', 'Amount', 'Adjustment'], ...findings.map((f) => [f.title, f.severity, toDecimal(f.amount), f.adjDebit ? `Dr ${f.adjDebit} / Cr ${f.adjCredit}` : '']),
    [], ['Payment ref', 'Amount', 'Date', 'Status', 'Flags'], ...payments.map((p) => [p.fields.ref, p.fields.amount === null ? '' : toDecimal(p.fields.amount), p.fields.datetime, p.matchStatus, p.flags.join('; ')]),
  ])

  return (
    <>
      <PageHeader title="Engagement report" subtitle={`${eng.client} · ${eng.periodStart} to ${eng.periodEnd} · generated ${new Date().toISOString().slice(0, 10)}`}
        actions={<><Button onClick={exportCsv}>Export CSV</Button><Button variant="primary" onClick={() => window.print()}>Save as PDF</Button></>} />
      <div className="space-y-6">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Engagement">
            <dl className="space-y-2 text-sm">
              {[['Client', eng.client], ['Ledger', ledgerFile || '—'], ['Lines / journals', `${entries.length} / ${s.journals}`]].map(([l, v]) => <div key={l} className="flex justify-between gap-4"><dt className="text-slate-500">{l}</dt><dd className="text-right font-medium">{v}</dd></div>)}
              <div className="flex justify-between"><dt className="text-slate-500">Debits = credits</dt><dd>{bal.difference ? <Badge tone="red">Out by {php(bal.difference)}</Badge> : <Badge tone="green">Balanced</Badge>}</dd></div>
            </dl>
          </Card>
          <Card title="Materiality">
            <dl className="space-y-2 text-sm">
              {[['Overall', m.overall], ['Performance', m.performance], ['Clearly trivial', m.trivial], ['Proposed adjustments', s.proposedAdj]].map(([l, v]) => <div key={l} className="flex justify-between"><dt className="text-slate-500">{l}</dt><dd className="font-medium tabular-nums">{php(v as number)}</dd></div>)}
              <div className="flex justify-between"><dt className="text-slate-500">Adjustments vs overall</dt><dd>{s.proposedAdj >= m.overall ? <Badge tone="red">Exceeds materiality</Badge> : <Badge tone="green">Below materiality</Badge>}</dd></div>
            </dl>
          </Card>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card title="Journal entry tests">
            <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
              {byRule.map(({ r, n }) => <tr key={r}><td className="py-1.5">{RULES[r].label}</td><td className="text-xs text-slate-500">{RULES[r].why}</td><td className="num font-semibold">{n}</td></tr>)}
              <tr><td className="py-1.5">Benford first digit</td><td className="text-xs text-slate-500">MAD {b.mad.toFixed(4)} on {b.n} amounts</td><td className="num"><Badge tone={b.conformity === 'Nonconformity' ? 'red' : 'green'}>{b.conformity}</Badge></td></tr>
            </tbody></table>
          </Card>
          <Card title="Payments (receipt capture)">
            <p className="mb-3 text-sm text-slate-600">{payments.length} receipts · {payments.filter((p) => p.matchStatus === 'Matched').length} matched · {s.unmatched} not fully matched · {payments.filter((p) => p.flags.length).length} with flags</p>
            <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
              {payments.map((p) => <tr key={p.id}><td className="py-1.5 tabular-nums">{p.fields.ref || '—'}</td><td className="num pl-4">{p.fields.amount === null ? '—' : php(p.fields.amount)}</td><td className="pl-3"><Badge tone={statusTone(p.matchStatus)}>{p.matchStatus}</Badge></td><td className="text-xs text-red-700">{p.flags.join('; ')}</td></tr>)}
            </tbody></table>
          </Card>
        </div>

        <Card title="Findings">
          <table className="w-full text-sm"><thead className="text-xs uppercase text-slate-500"><tr><th className="py-1 text-left">Severity</th><th className="text-left">Finding</th><th className="text-left">Adjustment</th><th className="text-right">Amount</th></tr></thead>
            <tbody className="divide-y divide-slate-100">
              {findings.map((f) => <tr key={f.id}><td className="py-2"><Badge tone={sevTone(f.severity)}>{f.severity}</Badge></td><td className="font-medium">{f.title}</td><td className="text-xs">{f.adjDebit ? `Dr ${f.adjDebit} / Cr ${f.adjCredit}` : '—'}</td><td className="num">{php(f.amount)}</td></tr>)}
            </tbody>
          </table>
        </Card>

        <div className="print-break grid gap-6 lg:grid-cols-2">
          <Card title="Balance sheet" pad={false}><StatementTable rows={st.bsRows} /></Card>
          <Card title="Income statement" pad={false}><StatementTable rows={st.isRows} /></Card>
        </div>

      </div>
    </>
  )
}
