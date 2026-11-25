import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { db, uid } from './lib/db'
import { runTests } from './lib/jet'
import { buildDemoLedger, DEMO_ENGAGEMENT, DEMO_ID } from './lib/seed'
import type { Engagement, Entry, Finding, Flag, Payment } from './lib/types'

export type Page = 'Dashboard' | 'Ledger' | 'Payments' | 'Testing' | 'Findings' | 'Statements' | 'Reports'

interface State {
  page: Page
  setPage: (p: Page) => void
  eng: Engagement
  saveEngagement: (e: Engagement) => Promise<void>
  entries: Entry[]
  ledgerFile: string
  setLedger: (entries: Entry[], fileName: string) => Promise<void>
  flags: Flag[]
  payments: Payment[]
  savePayment: (p: Payment) => Promise<void>
  deletePayment: (p: Payment) => Promise<void>
  findings: Finding[]
  saveFinding: (f: Finding) => Promise<void>
  deleteFinding: (f: Finding) => Promise<void>
}

const Ctx = createContext<State>(null!)
export const useApp = () => useContext(Ctx)

async function seedIfEmpty() {
  if (await db.get('engagements', DEMO_ID)) return
  const ledger = buildDemoLedger()
  const rowsOf = (desc: string) => ledger.filter((e) => e.description === desc).map((e) => e.row)
  await db.put('engagements', DEMO_ENGAGEMENT)
  await db.put('ledgers', { id: DEMO_ID, entries: ledger, fileName: 'demo-general-ledger-2025.xlsx', importedAt: new Date().toISOString() })
  const base = { engagementId: DEMO_ID, createdAt: '2026-02-03T10:00:00' }
  await db.put('findings', {
    ...base, id: uid(), severity: 'High', title: 'Year-end revenue recorded without delivery', rows: rowsOf('Year-end sale - per CEO'),
    description: 'JE posted 29 Dec 2025 by temp.admin "per CEO". No delivery receipt; goods shipped Jan 2026. Cut-off error.',
    amount: 23891742, adjDebit: '4010', adjCredit: '1100',
  })
  await db.put('findings', {
    ...base, id: uid(), severity: 'Medium', title: 'Consulting fee lacks contract support', rows: rowsOf('Consulting fee - per CEO instruction'),
    description: 'Round ₱50,000 consulting fee posted by temp.admin. No contract or BIR Form 2307 on file.',
    amount: 5000000, adjDebit: '', adjCredit: '',
  })
}

let seeding: Promise<void> | null = null // StrictMode runs effects twice; seed once

export function AppProvider({ children }: { children: ReactNode }) {
  const [page, setPage] = useState<Page>('Dashboard')
  const [eng, setEng] = useState<Engagement | null>(null)
  const [entries, setEntries] = useState<Entry[]>([])
  const [ledgerFile, setLedgerFile] = useState('')
  const [payments, setPayments] = useState<Payment[]>([])
  const [findings, setFindings] = useState<Finding[]>([])

  useEffect(() => {
    // Ask the browser not to clear this app's data when storage runs low.
    navigator.storage?.persist?.()
    ;(seeding ??= seedIfEmpty()).then(async () => {
      const l = await db.get('ledgers', DEMO_ID)
      setEntries(l?.entries ?? [])
      setLedgerFile(l?.fileName ?? '')
      setPayments(await db.all('payments'))
      setFindings(await db.all('findings'))
      setEng((await db.get('engagements', DEMO_ID)) ?? DEMO_ENGAGEMENT)
    })
  }, [])

  const upsert = <T extends { id: string }>(set: (f: (xs: T[]) => T[]) => void, v: T) =>
    set((xs) => (xs.some((x) => x.id === v.id) ? xs.map((x) => (x.id === v.id ? v : x)) : [...xs, v]))

  const flags = useMemo(() => runTests(entries, eng?.materiality.performance ?? 0), [entries, eng?.materiality.performance])

  if (!eng) return <div className="grid h-screen place-items-center text-sm text-slate-500">Loading…</div>

  const value: State = {
    page, setPage, eng,
    saveEngagement: async (e) => { await db.put('engagements', e); setEng(e) },
    entries, ledgerFile,
    setLedger: async (es, fileName) => {
      await db.put('ledgers', { id: DEMO_ID, entries: es, fileName, importedAt: new Date().toISOString() })
      setEntries(es); setLedgerFile(fileName)
    },
    flags,
    payments,
    savePayment: async (p) => { await db.put('payments', p); upsert(setPayments, p) },
    deletePayment: async (p) => { await db.del('payments', p.id); setPayments((xs) => xs.filter((x) => x.id !== p.id)) },
    findings,
    saveFinding: async (f) => { await db.put('findings', f); upsert(setFindings, f) },
    deleteFinding: async (f) => { await db.del('findings', f.id); setFindings((xs) => xs.filter((x) => x.id !== f.id)) },
  }
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
