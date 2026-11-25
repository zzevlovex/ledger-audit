import { parseMoney } from './money'
import type { Cents, Entry } from './types'

export const LEDGER_FIELDS = ['date', 'entryId', 'account', 'accountName', 'description', 'debit', 'credit', 'user'] as const
export type LedgerField = (typeof LEDGER_FIELDS)[number]
export type ColumnMapping = Partial<Record<LedgerField, string>>
export const REQUIRED_FIELDS: LedgerField[] = ['date', 'entryId', 'account', 'debit', 'credit']

const GUESS: Record<LedgerField, RegExp> = {
  date: /date|posted/i,
  entryId: /je|journal|entry|voucher|doc/i,
  account: /^(account|acct|gl)(\s*(no|code|#))?$|code/i,
  accountName: /name|title/i,
  description: /desc|memo|particular|narr/i,
  debit: /debit|dr/i,
  credit: /credit|cr/i,
  user: /user|prepared|posted by|created by/i,
}

/** Best-effort mapping from file headers to ledger fields. User can override in the UI. */
export function guessMapping(headers: string[]): ColumnMapping {
  const m: ColumnMapping = {}
  const used = new Set<string>()
  for (const f of LEDGER_FIELDS) {
    const h = headers.find((h) => !used.has(h) && GUESS[f].test(h))
    if (h) { m[f] = h; used.add(h) }
  }
  return m
}

/** Accepts Date, Excel serial number, YYYY-MM-DD, MM/DD/YYYY. Returns YYYY-MM-DD or null. */
export function normalizeDate(v: unknown): string | null {
  if (v instanceof Date && !isNaN(+v)) return iso(v.getFullYear(), v.getMonth() + 1, v.getDate())
  if (typeof v === 'number' && v > 20000 && v < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + v * 86400000)
    return iso(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate())
  }
  if (typeof v !== 'string') return null
  const s = v.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s)
  if (m) return iso(+m[1], +m[2], +m[3])
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return iso(+m[3], +m[1], +m[2])
  return null
}

function iso(y: number, mo: number, d: number) {
  if (mo < 1 || mo > 12 || d < 1 || d > 31) return null
  return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
}

export interface ImportResult {
  entries: Entry[]
  errors: string[] // per-row problems; rows with errors are skipped
}

export function mapRows(rows: Record<string, unknown>[], map: ColumnMapping): ImportResult {
  const entries: Entry[] = []
  const errors: string[] = []
  const get = (r: Record<string, unknown>, f: LedgerField) => (map[f] ? r[map[f]!] : undefined)
  rows.forEach((r, i) => {
    const line = i + 2 // header is line 1
    const date = normalizeDate(get(r, 'date'))
    const debitRaw = get(r, 'debit')
    const creditRaw = get(r, 'credit')
    const debit = debitRaw === '' || debitRaw == null ? 0 : parseMoney(debitRaw)
    const credit = creditRaw === '' || creditRaw == null ? 0 : parseMoney(creditRaw)
    const entryId = String(get(r, 'entryId') ?? '').trim()
    const account = String(get(r, 'account') ?? '').trim()
    if (!date) return void errors.push(`Line ${line}: invalid date "${get(r, 'date') ?? ''}"`)
    if (debit === null || credit === null) return void errors.push(`Line ${line}: invalid amount`)
    if (!entryId || !account) return void errors.push(`Line ${line}: missing entry ID or account`)
    entries.push({
      row: entries.length,
      entryId,
      date,
      account,
      accountName: String(get(r, 'accountName') ?? '').trim(),
      description: String(get(r, 'description') ?? '').trim(),
      debit,
      credit,
      user: String(get(r, 'user') ?? '').trim() || 'unknown',
    })
  })
  return { entries, errors }
}

export interface BalanceCheck {
  totalDebit: Cents
  totalCredit: Cents
  difference: Cents
  unbalanced: { entryId: string; debit: Cents; credit: Cents; difference: Cents }[]
}

export function checkBalance(entries: Entry[]): BalanceCheck {
  const byJe = new Map<string, { debit: Cents; credit: Cents }>()
  let totalDebit = 0, totalCredit = 0
  for (const e of entries) {
    totalDebit += e.debit
    totalCredit += e.credit
    const j = byJe.get(e.entryId) ?? { debit: 0, credit: 0 }
    j.debit += e.debit
    j.credit += e.credit
    byJe.set(e.entryId, j)
  }
  const unbalanced = [...byJe]
    .filter(([, j]) => j.debit !== j.credit)
    .map(([entryId, j]) => ({ entryId, ...j, difference: j.debit - j.credit }))
  return { totalDebit, totalCredit, difference: totalDebit - totalCredit, unbalanced }
}

/** Next journal number after the highest "JE-" number, e.g. JE-00253. */
export function nextJournalId(entries: Entry[]): string {
  const max = entries.reduce((m, e) => Math.max(m, Number(/^JE-(\d+)$/.exec(e.entryId)?.[1] ?? 0)), 0)
  return `JE-${String(max + 1).padStart(5, '0')}`
}

/** A typed-in journal: one debit line and one credit line of the same amount, appended after existing rows. */
export function journalLines(
  entries: Entry[],
  j: { date: string; debit: string; credit: string; amount: Cents; description: string; user: string },
  names: Record<string, string>,
): Entry[] {
  const entryId = nextJournalId(entries)
  const base = { entryId, date: j.date, description: j.description, user: j.user }
  return [
    { ...base, row: entries.length, account: j.debit, accountName: names[j.debit] ?? '', debit: j.amount, credit: 0 },
    { ...base, row: entries.length + 1, account: j.credit, accountName: names[j.credit] ?? '', debit: 0, credit: j.amount },
  ]
}

/** Signed amount of a line: debit positive, credit negative. */
export const net = (e: Entry): Cents => e.debit - e.credit
