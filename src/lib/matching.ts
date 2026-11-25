import { php } from './money'
import { net } from './ledger'
import type { Cents, Entry, MatchStatus } from './types'

export interface MatchInput {
  ref: string
  amount: Cents | null
  date: string // YYYY-MM-DD ('' if unknown)
}

export interface MatchResult {
  status: MatchStatus
  rows: number[]
  flags: string[]
}

const days = (a: string, b: string) => Math.abs(+new Date(a) - +new Date(b)) / 86400000

/**
 * Match a payment to ledger lines: reference number in description first,
 * then same amount within ±3 days. `taken` holds rows already matched to other payments.
 */
export function matchPayment(
  p: MatchInput,
  entries: Entry[],
  ctx: { periodStart: string; periodEnd: string; otherRefs: string[]; taken?: Set<number> },
): MatchResult {
  const flags: string[] = []
  if (p.ref && ctx.otherRefs.includes(p.ref)) flags.push(`Duplicate reference number ${p.ref}`)
  if (p.date && (p.date < ctx.periodStart || p.date > ctx.periodEnd)) flags.push(`Dated ${p.date}, outside engagement period`)

  // A journal already matched to another payment is excluded entirely (both its lines).
  const takenJe = new Set(entries.filter((e) => ctx.taken?.has(e.row)).map((e) => e.entryId))
  const free = entries.filter((e) => !takenJe.has(e.entryId))
  const amt = p.amount ?? -1
  const sameAmt = (e: Entry) => Math.abs(net(e)) === amt

  // 1. Reference number appears in the ledger description
  if (p.ref) {
    const byRef = free.filter((e) => e.description.replace(/\s/g, '').includes(p.ref))
    if (byRef.length) {
      const exact = byRef.filter(sameAmt)
      if (exact.length) return { status: 'Matched', rows: [exact[0].row], flags }
      const e = byRef[0]
      flags.push(`Amount differs: receipt ${php(amt)}, ledger ${e.entryId} ${php(Math.abs(net(e)))}`)
      return { status: 'Possible match', rows: [e.row], flags }
    }
  }

  // 2. Same amount within ±3 days
  if (p.amount !== null) {
    const near = free.filter((e) => sameAmt(e) && (!p.date || days(e.date, p.date) <= 3))
    // A journal has a debit and a credit line of the same amount; count journals, not lines.
    const jes = [...new Set(near.map((e) => e.entryId))]
    if (jes.length === 1) return { status: p.date ? 'Matched' : 'Possible match', rows: [near[0].row], flags }
    if (jes.length > 1) return { status: 'Possible match', rows: near.map((e) => e.row), flags }
  }

  return { status: 'Unmatched', rows: [], flags }
}
