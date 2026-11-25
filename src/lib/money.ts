import type { Cents } from './types'

/** Parse "₱1,234.56", "PHP 1234.5", "(1,234.56)" or "-12" into centavos. Returns null if not a number. */
export function parseMoney(input: unknown): Cents | null {
  if (typeof input === 'number') return Number.isFinite(input) ? Math.round(input * 100) : null
  if (typeof input !== 'string') return null
  let s = input.trim()
  if (!s) return null
  let neg = false
  if (/^\(.*\)$/.test(s)) { neg = true; s = s.slice(1, -1) }
  s = s.replace(/₱|PHP|Php|php|P(?=\s*\d)|,|\s/g, '')
  if (s.startsWith('-')) { neg = !neg; s = s.slice(1) }
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(s)
  if (!m) return null
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'))
  return neg ? -cents : cents
}

const fmt = new Intl.NumberFormat('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

/** ₱1,234.56 ; negatives as (₱1,234.56) */
export function php(c: Cents): string {
  const s = '₱' + fmt.format(Math.abs(c) / 100)
  return c < 0 ? `(${s})` : s
}

/** Plain decimal string for CSV export. */
export function toDecimal(c: Cents): string {
  const sign = c < 0 ? '-' : ''
  const a = Math.abs(c)
  return `${sign}${Math.floor(a / 100)}.${String(a % 100).padStart(2, '0')}`
}
