import { describe, expect, it } from 'vitest'
import { makeBackup, readBackup } from './backup'
import { benford, BENFORD_EXPECTED, phHolidays, runTests } from './jet'
import { checkBalance, mapRows, guessMapping, journalLines, nextJournalId } from './ledger'
import { computeMateriality } from './materiality'
import { matchPayment } from './matching'
import { parseMoney, php } from './money'
import { maskMobile, parseReceipt } from './receipts'
import { buildDemoLedger, DEMO_ENGAGEMENT, SAMPLE_RECEIPTS } from './seed'
import { balanceSheet, incomeStatement, trialBalance } from './statements'
import type { Entry, Finding } from './types'

const e = (p: Partial<Entry>): Entry => ({ row: 0, entryId: 'JE-1', date: '2025-03-03', account: '1010', accountName: '', description: '', debit: 0, credit: 0, user: 'u', ...p })

describe('backup file', () => {
  const dump = () => ({
    engagements: [{ ...DEMO_ENGAGEMENT }],
    ledgers: [{ id: 'l', entries: buildDemoLedger().slice(0, 3) }],
    payments: [{ id: 'p1', image: new Blob([new Uint8Array([137, 80, 78, 71, 0, 255])], { type: 'image/png' }) }, { id: 'p2', image: null }],
    findings: [],
  })
  it('round-trips records and receipt images', async () => {
    const back = readBackup(await makeBackup(dump()))
    expect(back.engagements[0]).toEqual(DEMO_ENGAGEMENT)
    expect(back.ledgers[0]).toEqual(dump().ledgers[0])
    const img = back.payments[0].image as Blob
    expect(img.type).toBe('image/png')
    expect([...new Uint8Array(await img.arrayBuffer())]).toEqual([137, 80, 78, 71, 0, 255])
    expect(back.payments[1].image).toBeNull()
  })
  it('rejects files that are not valid backups', async () => {
    expect(() => readBackup('hello')).toThrow(/not a Ledger Audit backup/)
    expect(() => readBackup('{"app":"other","stores":{}}')).toThrow(/not a Ledger Audit backup/)
    const good = JSON.parse(await makeBackup(dump()))
    expect(() => readBackup(JSON.stringify({ ...good, version: 99 }))).toThrow(/newer version/)
    expect(() => readBackup(JSON.stringify({ ...good, stores: { ...good.stores, findings: 'x' } }))).toThrow(/findings/)
    expect(() => readBackup(JSON.stringify({ ...good, stores: { ...good.stores, engagements: [] } }))).toThrow(/no company/)
  })
})

describe('money', () => {
  it('parses peso strings to centavos', () => {
    expect(parseMoney('₱1,234.56')).toBe(123456)
    expect(parseMoney('(1,234.5)')).toBe(-123450)
    expect(parseMoney('PHP 10')).toBe(1000)
    expect(parseMoney(0.1 + 0.2)).toBe(30)
    expect(parseMoney('abc')).toBeNull()
    expect(php(-123456)).toBe('(₱1,234.56)')
  })
})

describe('ledger import and balance', () => {
  it('maps columns and reports bad rows', () => {
    const rows = [
      { Date: '2025-01-05', 'JE No': 'JE-1', Account: '1010', Debit: '1,000.00', Credit: '' },
      { Date: '2025-01-05', 'JE No': 'JE-1', Account: '4010', Debit: '', Credit: '1,000.00' },
      { Date: 'bad', 'JE No': 'JE-2', Account: '1010', Debit: '5', Credit: '' },
    ]
    const map = guessMapping(Object.keys(rows[0]))
    expect(map).toMatchObject({ date: 'Date', entryId: 'JE No', account: 'Account', debit: 'Debit', credit: 'Credit' })
    const { entries, errors } = mapRows(rows, map)
    expect(entries).toHaveLength(2)
    expect(errors[0]).toMatch(/Line 4/)
  })
  it('finds unbalanced journals', () => {
    const b = checkBalance([e({ entryId: 'A', debit: 100 }), e({ entryId: 'A', credit: 100 }), e({ entryId: 'B', debit: 50 })])
    expect(b.difference).toBe(50)
    expect(b.unbalanced.map((u) => u.entryId)).toEqual(['B'])
  })
  it('typed-in journal gets next number and balances', () => {
    const lines = journalLines([e({ entryId: 'JE-00009' }), e({ row: 1, entryId: 'X-1' })], { date: '2025-05-02', debit: '6040', credit: '1010', amount: 12345, description: 'Pens', user: 'Ana' }, { '6040': 'Office Supplies' })
    expect(lines.map((l) => [l.entryId, l.row, l.debit, l.credit])).toEqual([['JE-00010', 2, 12345, 0], ['JE-00010', 3, 0, 12345]])
    expect(lines[0].accountName).toBe('Office Supplies')
    expect(nextJournalId([])).toBe('JE-00001')
  })
  it('demo ledger balances', () => {
    expect(checkBalance(buildDemoLedger()).difference).toBe(0)
  })
})

describe('materiality', () => {
  it('computes overall, performance and trivial', () => {
    expect(computeMateriality('revenue', 1000000000, 1)).toMatchObject({ overall: 10000000, performance: 7500000, trivial: 500000 })
  })
})

describe('journal entry tests', () => {
  const flags = runTests(buildDemoLedger(), DEMO_ENGAGEMENT.materiality.performance)
  const of = (rule: string) => flags.filter((f) => f.rule === rule)

  it('PH holidays include moveable dates', () => {
    const h = phHolidays(2025)
    expect(h.get('2025-04-18')).toBe('Good Friday')
    expect(h.get('2025-08-25')).toBe('National Heroes Day')
  })
  it('flags every planted anomaly', () => {
    expect(of('duplicate').some((f) => /Payment|1010|2010/.test(f.detail))).toBe(true)
    expect(of('round').some((f) => f.detail.includes('₱50,000.00'))).toBe(true)
    expect(of('weekend').some((f) => f.detail.includes('2025-06-14'))).toBe(true)
    expect(of('holiday').some((f) => f.detail.includes('Christmas'))).toBe(true)
    expect(of('materiality').some((f) => f.detail.includes('₱238,917.42'))).toBe(true)
    expect(of('gap')).toHaveLength(1)
    expect(of('gap')[0].detail).toMatch(/to .* missing \(2\)/)
    expect(of('unusualUser').map((f) => f.detail)).toEqual([expect.stringContaining('temp.admin')])
  })
  it('single-rule checks', () => {
    const t = (x: Entry[]) => runTests(x, 100000).map((f) => f.rule)
    expect(t([e({ debit: 300000 })])).toEqual(expect.arrayContaining(['round', 'materiality']))
    expect(t([e({ date: '2025-03-08', debit: 1234 })])).toContain('weekend')
    expect(t([e({ entryId: 'X1', debit: 1234 }), e({ row: 1, entryId: 'X2', debit: 1234 })])).toContain('duplicate')
    expect(t([e({ entryId: 'X1', debit: 1 }), e({ row: 1, entryId: 'X3', debit: 2 })])).toContain('gap')
  })
})

describe('benford', () => {
  it('expected distribution sums to 1 and digit 1 is ~30.1%', () => {
    expect(BENFORD_EXPECTED.reduce((a, b) => a + b, 0)).toBeCloseTo(1)
    expect(BENFORD_EXPECTED[0]).toBeCloseTo(0.30103)
  })
  it('counts first digits and ignores amounts under ₱10', () => {
    const r = benford([12300, 19900, 25000, 999])
    expect(r.n).toBe(3)
    expect(r.digits[0].count).toBe(2)
    expect(r.digits[1].count).toBe(1)
  })
  it('all-ones data is nonconforming', () => {
    expect(benford(Array(100).fill(150000)).conformity).toBe('Nonconformity')
  })
})

// Text as tesseract returns it from public/samples/receipt-1 (₱ commonly read as P).
const OCR_SAMPLE = `Payment Receipt
Send Money
Sent to
KALAYAAN OFFICE SUPPLY
+63 917 123 4321
Sent by
BAYANIHAN TRADING CORP
Amount P4,385.50
Total Amount Sent P4,385.50
Message Office supplies March
Ref No. 1012 345 678901
Mar 14, 2025 10:22 AM`

describe('GCash receipt parsing', () => {
  it('extracts fields with high confidence', () => {
    const r = parseReceipt(OCR_SAMPLE)
    expect(r.source).toBe('GCash')
    expect(r.fields).toMatchObject({
      ref: '1012345678901', amount: 438550, datetime: '2025-03-14T10:22', type: 'Send Money',
      recipient: 'KALAYAAN OFFICE SUPPLY', sender: 'BAYANIHAN TRADING CORP', mobile: '09171234321', notes: 'Office supplies March',
    })
    expect(r.confidence.ref).toBe('high')
    expect(r.confidence.amount).toBe('high')
  })
  it('marks missing and low-confidence fields', () => {
    const r = parseReceipt('GCash\n₱1,200.00\n11-05-2025', 90)
    expect(r.fields.amount).toBe(120000)
    expect(r.confidence.amount).toBe('low')
    expect(r.confidence.ref).toBe('missing')
    expect(r.confidence.datetime).toBe('low')
    expect(parseReceipt(OCR_SAMPLE, 40).confidence.ref).toBe('low')
  })
  it('masks mobile numbers', () => expect(maskMobile('09171234321')).toBe('0917•••4321'))
})

describe('payment matching', () => {
  const ledger = buildDemoLedger()
  const ctx = { periodStart: '2025-01-01', periodEnd: '2025-12-31', otherRefs: [] as string[] }
  const input = (i: number) => ({ ref: SAMPLE_RECEIPTS[i].ref, amount: SAMPLE_RECEIPTS[i].amount, date: SAMPLE_RECEIPTS[i].date })

  it('matches by reference, by amount+date, and flags amount mismatch', () => {
    expect(matchPayment(input(0), ledger, ctx).status).toBe('Matched')
    expect(matchPayment(input(1), ledger, ctx).status).toBe('Matched')
    expect(matchPayment(input(2), ledger, ctx).status).toBe('Matched')
    const mis = matchPayment(input(3), ledger, ctx)
    expect(mis.status).toBe('Possible match')
    expect(mis.flags[0]).toMatch(/Amount differs/)
  })
  it('flags duplicate reference and out-of-period dates', () => {
    const first = matchPayment(input(0), ledger, ctx)
    const dup = matchPayment(input(4), ledger, { ...ctx, otherRefs: [SAMPLE_RECEIPTS[0].ref], taken: new Set(first.rows) })
    expect(dup.flags).toContain('Duplicate reference number 1012345678901')
    expect(dup.status).toBe('Unmatched')
    expect(matchPayment({ ref: '', amount: 1, date: '2026-02-01' }, ledger, ctx).flags[0]).toMatch(/outside/)
  })
})

describe('financial statements', () => {
  const ledger = buildDemoLedger()
  it('balance sheet balances, before and after adjustments', () => {
    const adj: Finding = { id: 'f', engagementId: 'x', title: '', description: '', severity: 'High', amount: 23891742, rows: [], adjDebit: '4010', adjCredit: '1100', createdAt: '' }
    const tb = trialBalance(ledger, [adj])
    const bs = balanceSheet(tb)
    expect(bs.totalAssets.unadjusted).toBe(bs.totalLE.unadjusted)
    expect(bs.totalAssets.adjusted).toBe(bs.totalLE.adjusted)
    const is = incomeStatement(tb)
    expect(is.revenue.total.unadjusted - is.revenue.total.adjusted).toBe(23891742)
  })
})
