import { net } from './lib/ledger'
import type { Entry, Finding, Flag, Payment } from './lib/types'

export function summary(entries: Entry[], flags: Flag[], findings: Finding[], payments: Payment[]) {
  const flaggedRows = new Set(flags.flatMap((f) => f.rows))
  const flaggedAmount = entries.filter((e) => flaggedRows.has(e.row)).reduce((s, e) => s + Math.abs(net(e)), 0)
  const proposedAdj = findings.filter((f) => f.adjDebit && f.adjCredit).reduce((s, f) => s + Math.abs(f.amount), 0)
  const unmatched = payments.filter((p) => p.matchStatus !== 'Matched').length
  const journals = new Set(entries.map((e) => e.entryId)).size
  return { flaggedRows, flaggedAmount, proposedAdj, unmatched, journals }
}
