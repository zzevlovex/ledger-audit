import type { Cents, Entry, Finding } from './types'

// shortcut: account category comes from the first digits of the account code (common PH chart of
// accounts layout). Upgrade to a user-editable account mapping table if a client's codes differ.
export type Category =
  | 'Current assets' | 'Non-current assets' | 'Current liabilities' | 'Non-current liabilities' | 'Equity'
  | 'Revenue' | 'Cost of sales' | 'Operating expenses' | 'Other income' | 'Other expenses' | 'Income tax'

export function categorize(account: string): Category {
  const d = account.replace(/\D/g, '')
  const a = d[0], b = Number(d[1] ?? 0)
  switch (a) {
    case '1': return b < 5 ? 'Current assets' : 'Non-current assets'
    case '2': return b < 5 ? 'Current liabilities' : 'Non-current liabilities'
    case '3': return 'Equity'
    case '4': return 'Revenue'
    case '5': return 'Cost of sales'
    case '6': return 'Operating expenses'
    case '7': return 'Other income'
    case '8': return 'Other expenses'
    default: return 'Income tax'
  }
}

const DEBIT_NORMAL = new Set<Category>(['Current assets', 'Non-current assets', 'Cost of sales', 'Operating expenses', 'Other expenses', 'Income tax'])

export interface TbRow {
  account: string
  name: string
  category: Category
  debit: Cents
  credit: Cents
  adjustment: Cents // signed, debit positive
  balance: Cents // signed, debit positive, after adjustments
}

/** Trial balance per account, with proposed adjustments from findings applied in a separate column. */
export function trialBalance(entries: Entry[], findings: Finding[] = []): TbRow[] {
  const m = new Map<string, TbRow>()
  const row = (account: string, name = '') => {
    let r = m.get(account)
    if (!r) m.set(account, (r = { account, name, category: categorize(account), debit: 0, credit: 0, adjustment: 0, balance: 0 }))
    if (!r.name && name) r.name = name
    return r
  }
  for (const e of entries) {
    const r = row(e.account, e.accountName)
    r.debit += e.debit
    r.credit += e.credit
  }
  for (const f of findings) {
    if (!f.adjDebit || !f.adjCredit || !f.amount) continue
    row(f.adjDebit).adjustment += Math.abs(f.amount)
    row(f.adjCredit).adjustment -= Math.abs(f.amount)
  }
  for (const r of m.values()) r.balance = r.debit - r.credit + r.adjustment
  return [...m.values()].sort((a, b) => a.account.localeCompare(b.account))
}

export interface Line { label: string; unadjusted: Cents; adjusted: Cents }
export interface Section { title: Category; accounts: Line[]; total: Line }

/** Amount shown with its normal sign (credits positive for revenue, liabilities, equity). */
const shown = (r: TbRow, adjusted: boolean) => {
  const v = adjusted ? r.balance : r.debit - r.credit
  return DEBIT_NORMAL.has(r.category) ? v : -v
}

function section(tb: TbRow[], title: Category): Section {
  const rows = tb.filter((r) => r.category === title)
  const accounts = rows.map((r) => ({ label: `${r.account} ${r.name}`.trim(), unadjusted: shown(r, false), adjusted: shown(r, true) }))
  const sum = (k: 'unadjusted' | 'adjusted') => accounts.reduce((s, a) => s + a[k], 0)
  return { title, accounts, total: { label: `Total ${title.toLowerCase()}`, unadjusted: sum('unadjusted'), adjusted: sum('adjusted') } }
}

const diff = (label: string, a: Line, b: Line): Line => ({ label, unadjusted: a.unadjusted - b.unadjusted, adjusted: a.adjusted - b.adjusted })
const add = (label: string, ...ls: Line[]): Line => ({ label, unadjusted: ls.reduce((s, l) => s + l.unadjusted, 0), adjusted: ls.reduce((s, l) => s + l.adjusted, 0) })

export function incomeStatement(tb: TbRow[]) {
  const revenue = section(tb, 'Revenue')
  const cos = section(tb, 'Cost of sales')
  const opex = section(tb, 'Operating expenses')
  const otherInc = section(tb, 'Other income')
  const otherExp = section(tb, 'Other expenses')
  const tax = section(tb, 'Income tax')
  const grossProfit = diff('Gross profit', revenue.total, cos.total)
  const operatingIncome = diff('Operating income', grossProfit, opex.total)
  const pretax = diff('Income before tax', add('', operatingIncome, otherInc.total), otherExp.total)
  const netIncome = diff('Net income', pretax, tax.total)
  return { revenue, cos, grossProfit, opex, operatingIncome, otherInc, otherExp, pretax, tax, netIncome }
}

export function balanceSheet(tb: TbRow[]) {
  const ca = section(tb, 'Current assets')
  const nca = section(tb, 'Non-current assets')
  const cl = section(tb, 'Current liabilities')
  const ncl = section(tb, 'Non-current liabilities')
  const eq = section(tb, 'Equity')
  const ni = incomeStatement(tb).netIncome
  const totalAssets = add('Total assets', ca.total, nca.total)
  const totalLiabilities = add('Total liabilities', cl.total, ncl.total)
  const totalEquity = add('Total equity', eq.total, { ...ni, label: '' })
  const totalLE = add('Total liabilities and equity', totalLiabilities, totalEquity)
  return { ca, nca, cl, ncl, eq, netIncome: { ...ni, label: 'Net income for the period' }, totalAssets, totalLiabilities, totalEquity, totalLE }
}
