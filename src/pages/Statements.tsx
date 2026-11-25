import { useMemo, useState } from 'react'
import { downloadCsv } from '../lib/csv'
import { toDecimal } from '../lib/money'
import { balanceSheet, incomeStatement, trialBalance, type Line, type Section } from '../lib/statements'
import { useApp } from '../store'
import { Badge, Button, Card, cx, Money, PageHeader } from '../ui'

const TABS = ['Balance sheet', 'Income statement', 'Trial balance'] as const
type Tab = (typeof TABS)[number]

type Row = { kind: 'head' | 'line' | 'total' | 'grand'; line: Line }

function StatementTable({ rows }: { rows: Row[] }) {
  return (
    <table className="w-full text-sm">
      <thead className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
        <tr className="border-b border-slate-100"><th className="px-4 py-2.5 text-left">Line item</th><th className="hidden px-4 py-2.5 text-right md:table-cell">Unadjusted</th><th className="hidden px-4 py-2.5 text-right md:table-cell">Adjustments</th><th className="px-4 py-2.5 text-right">Adjusted</th></tr>
      </thead>
      <tbody>
        {rows.map((r, i) => r.kind === 'head' ? (
          <tr key={i}><td colSpan={4} className="px-4 pb-1 pt-5 text-[11px] font-bold uppercase tracking-wider text-sage-600">{r.line.label}</td></tr>
        ) : (
          <tr key={i} className={cx(r.kind === 'total' && 'border-t border-slate-100 font-bold', r.kind === 'grand' && 'bg-gradient-to-r from-sage-50 to-sage-50 font-extrabold text-sage-950')}>
            <td className={cx('px-4 py-2', r.kind === 'line' && 'pl-6 text-slate-700 md:pl-8')}>{r.line.label}</td>
            <td className="num hidden px-4 md:table-cell"><Money c={r.line.unadjusted} /></td>
            <td className="num hidden px-4 text-slate-500 md:table-cell">{r.line.adjusted - r.line.unadjusted ? <Money c={r.line.adjusted - r.line.unadjusted} /> : '—'}</td>
            <td className="num px-4">
              <Money c={r.line.adjusted} />
              {r.line.adjusted !== r.line.unadjusted && <span className="block text-[11px] font-medium text-slate-400 md:hidden">was <Money c={r.line.unadjusted} /></span>}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

const sec = (s: Section): Row[] => [{ kind: 'head', line: { label: s.title, unadjusted: 0, adjusted: 0 } }, ...s.accounts.map((line) => ({ kind: 'line' as const, line })), { kind: 'total', line: s.total }]
const tot = (line: Line, grand = false): Row => ({ kind: grand ? 'grand' : 'total', line })

export function useStatements() {
  const { entries, findings } = useApp()
  return useMemo(() => {
    const tb = trialBalance(entries, findings)
    const is = incomeStatement(tb)
    const bs = balanceSheet(tb)
    const bsRows: Row[] = [...sec(bs.ca), ...sec(bs.nca), tot(bs.totalAssets, true), ...sec(bs.cl), ...sec(bs.ncl), tot(bs.totalLiabilities), ...sec(bs.eq), { kind: 'line', line: bs.netIncome }, tot(bs.totalEquity), tot(bs.totalLE, true)]
    const isRows: Row[] = [...sec(is.revenue), ...sec(is.cos), tot(is.grossProfit, true), ...sec(is.opex), tot(is.operatingIncome), ...sec(is.otherInc), ...sec(is.otherExp), tot(is.pretax), ...sec(is.tax), tot(is.netIncome, true)]
    return { tb, is, bs, bsRows, isRows }
  }, [entries, findings])
}

export { StatementTable }

export default function Statements() {
  const { eng } = useApp()
  const [tab, setTab] = useState<Tab>('Balance sheet')
  const s = useStatements()
  const balanced = s.bs.totalAssets.unadjusted === s.bs.totalLE.unadjusted && s.bs.totalAssets.adjusted === s.bs.totalLE.adjusted
  const exportCsv = () => {
    const rows = tab === 'Balance sheet' ? s.bsRows : tab === 'Income statement' ? s.isRows : null
    if (rows) return downloadCsv(`${tab.toLowerCase().replace(' ', '-')}.csv`, [['Line item', 'Unadjusted', 'Adjustments', 'Adjusted'], ...rows.map((r) => r.kind === 'head' ? [r.line.label] : [r.line.label, toDecimal(r.line.unadjusted), toDecimal(r.line.adjusted - r.line.unadjusted), toDecimal(r.line.adjusted)])])
    downloadCsv('trial-balance.csv', [['Account', 'Name', 'Category', 'Debit', 'Credit', 'Adjustment', 'Adjusted balance'], ...s.tb.map((r) => [r.account, r.name, r.category, toDecimal(r.debit), toDecimal(r.credit), toDecimal(r.adjustment), toDecimal(r.balance)])])
  }

  return (
    <>
      <PageHeader title="Financial statements" subtitle={<>Built from the ledger for {eng.periodStart} to {eng.periodEnd}. Adjusted columns apply proposed adjustments from findings. {balanced ? <Badge tone="green">Assets = Liabilities + Equity</Badge> : <Badge tone="red">Balance sheet does not balance</Badge>}</>}
        actions={<Button onClick={exportCsv}>Export CSV</Button>} />
      <div className="mb-4 flex gap-1 overflow-x-auto rounded-2xl bg-white p-1 shadow-sm ring-1 ring-slate-200/80" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={cx('flex-1 whitespace-nowrap rounded-xl px-4 py-2 text-sm font-bold transition', tab === t ? 'bg-gradient-to-r from-sage-500 to-sage-500 text-white shadow-md shadow-sage-500/25' : 'text-slate-500 hover:text-slate-800')}>{t}</button>
        ))}
      </div>
      <Card pad={false}>
        {tab === 'Balance sheet' && <StatementTable rows={s.bsRows} />}
        {tab === 'Income statement' && <StatementTable rows={s.isRows} />}
        {tab === 'Trial balance' && (
          <div className="max-h-[65vh] overflow-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead className="sticky top-0 bg-slate-50 text-xs uppercase tracking-wide text-slate-500"><tr>{['Account', 'Category', 'Debit', 'Credit', 'Adjustment', 'Adjusted balance'].map((h, i) => <th key={h} className={cx('px-4 py-2 font-medium', i > 1 ? 'text-right' : 'text-left')}>{h}</th>)}</tr></thead>
              <tbody className="divide-y divide-slate-100">
                {s.tb.map((r) => (
                  <tr key={r.account}><td className="px-4 py-1.5"><span className="tabular-nums">{r.account}</span> {r.name}</td><td className="px-4 text-slate-500">{r.category}</td>
                    <td className="num px-4"><Money c={r.debit} /></td><td className="num px-4"><Money c={r.credit} /></td><td className="num px-4 text-slate-500">{r.adjustment ? <Money c={r.adjustment} /> : '—'}</td><td className="num px-4 font-medium"><Money c={r.balance} /></td></tr>
                ))}
                <tr className="border-t-2 border-slate-800 bg-slate-50 font-bold"><td className="px-4 py-2" colSpan={2}>Totals</td>
                  <td className="num px-4"><Money c={s.tb.reduce((a, r) => a + r.debit, 0)} /></td><td className="num px-4"><Money c={s.tb.reduce((a, r) => a + r.credit, 0)} /></td>
                  <td className="num px-4"><Money c={s.tb.reduce((a, r) => a + r.adjustment, 0)} /></td><td className="num px-4"><Money c={s.tb.reduce((a, r) => a + r.balance, 0)} /></td></tr>
              </tbody>
            </table>
          </div>
        )}
      </Card>
      <p className="mt-3 text-xs text-slate-500">Accounts are grouped by code: 1x assets (10–14 current), 2x liabilities (20–24 current), 3 equity, 4 revenue, 5 cost of sales, 6 operating expenses, 7 other income, 8 other expenses, 9 income tax.</p>
    </>
  )
}
