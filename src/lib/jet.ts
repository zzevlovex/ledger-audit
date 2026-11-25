import { php } from './money'
import { net } from './ledger'
import type { Cents, Entry, Flag, RuleId } from './types'

export const RULES: Record<RuleId, { label: string; why: string }> = {
  duplicate: { label: 'Duplicate', why: 'Same account, amount and date on more than one journal' },
  round: { label: 'Round amount', why: 'Amount of ₱1,000 or more that is an exact multiple of ₱1,000' },
  weekend: { label: 'Weekend posting', why: 'Posted on a Saturday or Sunday' },
  holiday: { label: 'Holiday posting', why: 'Posted on a Philippine holiday' },
  materiality: { label: 'Above performance materiality', why: 'Line amount exceeds performance materiality' },
  gap: { label: 'Sequence gap', why: 'Journal numbers missing from the sequence' },
  unusualUser: { label: 'Unusual user', why: 'User posted fewer than 2% of journals' },
}

// Easter Sunday (anonymous Gregorian algorithm); needed for Maundy Thursday and Good Friday.
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(y, month - 1, day))
}

const ymd = (d: Date) => d.toISOString().slice(0, 10)

// shortcut: fixed-date and Easter-based holidays only; Eid and one-off proclaimed holidays are not
// included. Upgrade to a yearly holiday table if a client needs them.
export function phHolidays(y: number): Map<string, string> {
  const h = new Map<string, string>([
    [`${y}-01-01`, "New Year's Day"],
    [`${y}-04-09`, 'Araw ng Kagitingan'],
    [`${y}-05-01`, 'Labor Day'],
    [`${y}-06-12`, 'Independence Day'],
    [`${y}-08-21`, 'Ninoy Aquino Day'],
    [`${y}-11-01`, "All Saints' Day"],
    [`${y}-11-30`, 'Bonifacio Day'],
    [`${y}-12-08`, 'Immaculate Conception'],
    [`${y}-12-25`, 'Christmas Day'],
    [`${y}-12-30`, 'Rizal Day'],
    [`${y}-12-31`, "New Year's Eve"],
  ])
  const e = easter(y)
  h.set(ymd(new Date(+e - 3 * 86400000)), 'Maundy Thursday')
  h.set(ymd(new Date(+e - 2 * 86400000)), 'Good Friday')
  // National Heroes Day: last Monday of August
  const aug31 = new Date(Date.UTC(y, 7, 31))
  h.set(ymd(new Date(+aug31 - ((aug31.getUTCDay() + 6) % 7) * 86400000)), 'National Heroes Day')
  return h
}

export function runTests(entries: Entry[], performanceMateriality: Cents): Flag[] {
  const flags: Flag[] = []

  // Duplicates
  const dup = new Map<string, Entry[]>()
  for (const e of entries) {
    const k = `${e.account}|${net(e)}|${e.date}`
    dup.set(k, [...(dup.get(k) ?? []), e])
  }
  for (const group of dup.values()) {
    if (new Set(group.map((e) => e.entryId)).size > 1)
      flags.push({ rule: 'duplicate', rows: group.map((e) => e.row), detail: `${group.length} lines: account ${group[0].account}, ${php(net(group[0]))} on ${group[0].date} (${[...new Set(group.map((e) => e.entryId))].join(', ')})` })
  }

  const holidays = new Map<number, Map<string, string>>()
  for (const e of entries) {
    const amt = Math.abs(net(e))
    if (amt >= 100000 && amt % 100000 === 0)
      flags.push({ rule: 'round', rows: [e.row], detail: `${e.entryId}: ${php(amt)}` })
    const d = new Date(e.date + 'T00:00:00Z')
    const dow = d.getUTCDay()
    if (dow === 0 || dow === 6)
      flags.push({ rule: 'weekend', rows: [e.row], detail: `${e.entryId} posted ${dow === 0 ? 'Sunday' : 'Saturday'} ${e.date}` })
    const y = d.getUTCFullYear()
    if (!holidays.has(y)) holidays.set(y, phHolidays(y))
    const hol = holidays.get(y)!.get(e.date)
    if (hol) flags.push({ rule: 'holiday', rows: [e.row], detail: `${e.entryId} posted on ${hol} (${e.date})` })
    if (performanceMateriality > 0 && amt > performanceMateriality)
      flags.push({ rule: 'materiality', rows: [e.row], detail: `${e.entryId}: ${php(amt)} > ${php(performanceMateriality)}` })
  }

  // Sequence gaps: compare numeric part of journal IDs that share a prefix
  const seqs = new Map<string, Map<number, number[]>>()
  for (const e of entries) {
    const m = /^(.*?)(\d+)$/.exec(e.entryId)
    if (!m) continue
    const byNum = seqs.get(m[1]) ?? new Map<number, number[]>()
    byNum.set(Number(m[2]), [...(byNum.get(Number(m[2])) ?? []), e.row])
    seqs.set(m[1], byNum)
  }
  for (const [prefix, byNum] of seqs) {
    const nums = [...byNum.keys()].sort((a, b) => a - b)
    for (let i = 1; i < nums.length; i++) {
      if (nums[i] - nums[i - 1] > 1) {
        const width = entries.find((e) => e.entryId.startsWith(prefix))!.entryId.length - prefix.length
        const name = (n: number) => prefix + String(n).padStart(width, '0')
        const missing = nums[i] - nums[i - 1] - 1
        flags.push({
          rule: 'gap',
          rows: [...byNum.get(nums[i - 1])!, ...byNum.get(nums[i])!],
          detail: missing === 1 ? `${name(nums[i - 1] + 1)} missing` : `${name(nums[i - 1] + 1)} to ${name(nums[i] - 1)} missing (${missing})`,
        })
      }
    }
  }

  // Unusual users
  const jeByUser = new Map<string, Set<string>>()
  for (const e of entries) jeByUser.set(e.user, (jeByUser.get(e.user) ?? new Set()).add(e.entryId))
  const totalJe = new Set(entries.map((e) => e.entryId)).size
  for (const [user, jes] of jeByUser) {
    if (jeByUser.size > 1 && jes.size / totalJe < 0.02)
      flags.push({ rule: 'unusualUser', rows: entries.filter((e) => e.user === user).map((e) => e.row), detail: `${user} posted ${jes.size} of ${totalJe} journals` })
  }

  return flags
}

export const BENFORD_EXPECTED = Array.from({ length: 9 }, (_, i) => Math.log10(1 + 1 / (i + 1)))

export interface BenfordResult {
  n: number
  digits: { digit: number; count: number; actual: number; expected: number }[]
  mad: number
  conformity: 'Close conformity' | 'Acceptable conformity' | 'Marginal conformity' | 'Nonconformity'
}

/** First-digit test on line amounts of ₱10 or more (Nigrini MAD thresholds). */
export function benford(amounts: Cents[]): BenfordResult {
  const counts = Array(9).fill(0)
  let n = 0
  for (const c of amounts) {
    const a = Math.abs(c)
    if (a < 1000) continue
    counts[Number(String(a)[0]) - 1]++
    n++
  }
  const digits = counts.map((count, i) => ({ digit: i + 1, count, actual: n ? count / n : 0, expected: BENFORD_EXPECTED[i] }))
  const mad = n ? digits.reduce((s, d) => s + Math.abs(d.actual - d.expected), 0) / 9 : 0
  const conformity = mad < 0.006 ? 'Close conformity' : mad < 0.012 ? 'Acceptable conformity' : mad < 0.015 ? 'Marginal conformity' : 'Nonconformity'
  return { n, digits, mad, conformity }
}
