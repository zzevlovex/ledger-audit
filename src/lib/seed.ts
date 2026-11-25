// Demo data: a fake company with ~500 ledger lines and planted anomalies.
// Everything is deterministic (seeded) so tests can assert on it.
import { phHolidays } from './jet'
import { computeMateriality } from './materiality'
import type { Engagement, Entry } from './types'

/** mulberry32: small seeded PRNG so demo data is the same every time. */
function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export const DEMO_ID = 'demo-bayanihan'

export const DEMO_ENGAGEMENT: Engagement = {
  id: DEMO_ID,
  client: 'Bayanihan Trading Corp.',
  periodStart: '2025-01-01',
  periodEnd: '2025-12-31',
  status: 'Fieldwork',
  materiality: computeMateriality('assets', 600000000, 2),
  createdAt: '2026-01-15T09:00:00',
}

export const ACCOUNTS: Record<string, string> = {
  '1010': 'Cash in Bank',
  '1020': 'Cash - GCash Wallet',
  '1100': 'Accounts Receivable',
  '1200': 'Inventory',
  '1510': 'Equipment',
  '1520': 'Accumulated Depreciation',
  '2010': 'Accounts Payable',
  '2510': 'Bank Loan',
  '3010': 'Share Capital',
  '3100': 'Retained Earnings',
  '4010': 'Sales Revenue',
  '5010': 'Cost of Sales',
  '6010': 'Salaries and Wages',
  '6020': 'Rent Expense',
  '6030': 'Utilities',
  '6040': 'Office Supplies',
  '6050': 'Transportation and Courier',
  '6060': 'Depreciation Expense',
  '6070': 'Professional Fees',
  '7010': 'Interest Income',
  '8010': 'Interest Expense',
  '9010': 'Income Tax Expense',
}

/** Receipts used for sample images (public/samples) and tests. */
export const SAMPLE_RECEIPTS = [
  { file: 'receipt-1-matched-ref.png', ref: '1012345678901', amount: 438550, date: '2025-03-14', time: '10:22 AM', type: 'Send Money', to: 'KALAYAAN OFFICE SUPPLY', mobile: '09171234321', note: 'Office supplies March' },
  { file: 'receipt-2-matched-amount.png', ref: '2023456789012', amount: 215075, date: '2025-07-08', time: '2:41 PM', type: 'Send Money', to: 'MABILIS COURIER SERVICES', mobile: '09182345678', note: 'Courier fees' },
  { file: 'receipt-3-matched-ref.png', ref: '3045678912345', amount: 892040, date: '2025-10-21', time: '9:05 AM', type: 'Pay Bills', to: 'LIWANAG ELECTRIC COOP', mobile: '09193456789', note: 'Electric bill Oct' },
  { file: 'receipt-4-amount-mismatch.png', ref: '5067891234567', amount: 648000, date: '2025-09-03', time: '4:18 PM', type: 'Send Money', to: 'DELA CRUZ PRINTING', mobile: '09204567890', note: 'Brochure printing' },
  { file: 'receipt-5-duplicate-ref.png', ref: '1012345678901', amount: 438550, date: '2025-03-14', time: '10:22 AM', type: 'Send Money', to: 'KALAYAAN OFFICE SUPPLY', mobile: '09171234321', note: 'Office supplies March' },
]

interface Je { date: string; lines: [account: string, debit: number, credit: number][]; desc: string; user?: string }

export function buildDemoLedger(): Entry[] {
  const r = rng(2025)
  const between = (lo: number, hi: number) => {
    // Log-uniform pesos (real ledgers roughly follow Benford's Law) plus non-zero centavos so random entries never look "round".
    const pesos = Math.floor(lo * Math.pow(hi / lo, r()))
    return pesos * 100 + 1 + Math.floor(r() * 99)
  }
  const hol = phHolidays(2025)
  const workday = () => {
    for (;;) {
      const d = new Date(Date.UTC(2025, 0, 2) + Math.floor(r() * 362) * 86400000)
      const s = d.toISOString().slice(0, 10)
      if (d.getUTCDay() % 6 !== 0 && !hol.has(s)) return s
    }
  }
  const jes: Je[] = []
  const add = (date: string, dr: string, cr: string, amt: number, desc: string, user?: string) =>
    jes.push({ date, lines: [[dr, amt, 0], [cr, 0, amt]], desc, user })

  // Opening balances (retained earnings is the plug)
  const ob: Je['lines'] = [
    ['1010', 152341825, 0], ['1020', 4825000, 0], ['1100', 81233060, 0], ['1200', 120477515, 0], ['1510', 215060000, 0],
    ['1520', 0, 43012000], ['2010', 0, 61544230], ['2510', 0, 148725000], ['3010', 0, 200000000],
  ]
  const plug = ob.reduce((s, l) => s + l[1] - l[2], 0)
  ob.push(['3100', 0, plug])
  jes.push({ date: '2025-01-02', lines: ob, desc: 'Opening balances' })

  const templates: [weight: number, make: () => void][] = [
    [30, () => add(workday(), '1100', '4010', between(5000, 85000), 'Sales on account')],
    [26, () => add(workday(), '1010', '1100', between(5000, 85000), 'Customer collection')],
    [12, () => add(workday(), '1200', '2010', between(8000, 80000), 'Purchase of merchandise')],
    [16, () => add(workday(), '5010', '1200', between(4000, 60000), 'Cost of goods sold')],
    [10, () => add(workday(), '2010', '1010', between(8000, 70000), 'Payment to supplier')],
    [6, () => add(workday(), '6040', '1020', between(300, 6000), 'Office supplies - GCash')],
    [6, () => add(workday(), '6050', '1020', between(150, 4000), 'Transportation - GCash')],
    [4, () => add(workday(), '1020', '1010', between(5000, 30000), 'GCash wallet top-up')],
    [4, () => add(workday(), '6030', '1010', between(3000, 15000), 'Utilities')],
  ]
  const totalW = templates.reduce((s, t) => s + t[0], 0)
  for (let i = 0; i < 180; i++) {
    let x = r() * totalW
    for (const [w, make] of templates) if ((x -= w) < 0) { make(); break }
  }
  // Monthly recurring entries
  for (let m = 1; m <= 12; m++) {
    const mm = String(m).padStart(2, '0')
    const d = (day: number) => {
      // move to the previous working day
      let t = Date.UTC(2025, m - 1, day)
      for (;;) {
        const s = new Date(t).toISOString().slice(0, 10)
        const dow = new Date(t).getUTCDay()
        if (dow % 6 !== 0 && !hol.has(s)) return s
        t -= 86400000
      }
    }
    add(d(15), '6010', '1010', between(21000, 23000), `Payroll ${mm}/15`)
    add(d(28), '6010', '1010', between(21000, 23000), `Payroll ${mm}/30`)
    add(d(5), '6020', '1010', 1800050, `Office rent ${mm}`)
    add(d(28), '6060', '1520', 1792167, `Depreciation ${mm}`)
    add(d(28), '8010', '1010', between(11000, 12500), `Loan interest ${mm}`)
  }
  add('2025-06-30', '1010', '7010', 312455, 'Bank interest income')
  add('2025-12-29', '9010', '1010', between(60000, 80000), 'Income tax payment')

  // GCash receipt-backed entries (see SAMPLE_RECEIPTS)
  add('2025-03-14', '6040', '1020', 438550, 'Office supplies - GCash Ref 1012345678901')
  add('2025-07-08', '6050', '1020', 215075, 'Courier fees - GCash')
  add('2025-10-21', '6030', '1020', 892040, 'Electric bill - GCash Ref 3045678912345')
  add('2025-09-03', '6070', '1020', 684000, 'Brochure printing - GCash Ref 5067891234567') // receipt says 6,480.00

  // Planted anomalies
  const supplierPay = jes.find((j) => j.desc === 'Payment to supplier')!
  jes.push({ ...supplierPay, lines: supplierPay.lines.map((l) => [...l] as Je['lines'][number]) }) // duplicate payment
  add('2025-08-12', '6070', '1010', 5000000, 'Consulting fee - per CEO instruction', 'temp.admin') // round + unusual user
  add('2025-06-14', '6050', '1010', 784530, 'Manual adjustment - transport') // Saturday
  add('2025-12-25', '4010', '1100', 1248075, 'Sales return') // Christmas Day
  add('2025-12-29', '1100', '4010', 23891742, 'Year-end sale - per CEO', 'temp.admin') // above materiality + unusual user

  // Number journals by date; skip two numbers to plant a sequence gap.
  jes.sort((a, b) => a.date.localeCompare(b.date))
  const users = ['a.reyes', 'a.reyes', 'a.reyes', 'j.santos', 'j.santos', 'm.cruz']
  const entries: Entry[] = []
  let n = 0
  jes.forEach((je, i) => {
    n += i === 120 ? 3 : 1
    const entryId = `JE-${String(n).padStart(5, '0')}`
    const user = je.user ?? users[Math.floor(r() * users.length)]
    for (const [account, debit, credit] of je.lines)
      entries.push({ row: entries.length, entryId, date: je.date, account, accountName: ACCOUNTS[account], description: je.desc, debit, credit, user })
  })
  return entries
}
