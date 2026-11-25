import { parseMoney } from './money'
import type { Confidence, ReceiptFields } from './types'

export type FieldConfidence = Record<keyof ReceiptFields, Confidence>

export interface ParsedReceipt {
  source: string
  fields: ReceiptFields
  confidence: FieldConfidence
}

/** One parser per wallet/bank. Add Maya, bank slips, etc. by adding to PARSERS. */
export interface ReceiptParser {
  name: string
  detect(text: string): boolean
  parse(text: string): ParsedReceipt
}

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec']
// OCR often reads ₱ as P, F, ® or drops it.
const MONEY = /(?:₱|PHP|P|F|®)?\s*(\d{1,3}(?:,\d{3})*(?:\.\d{2})|\d+\.\d{2})/i
const TYPES = ['Express Send', 'Send Money', 'Bank Transfer', 'Send to Bank', 'Pay Bills', 'Buy Load', 'Cash In', 'Cash Out', 'Pay QR', 'Payment']

function lines(text: string) {
  return text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
}

/** Value on the same line after the label, else the next line. */
function after(ls: string[], label: RegExp): string {
  for (let i = 0; i < ls.length; i++) {
    const m = label.exec(ls[i])
    if (!m) continue
    const rest = ls[i].slice(m.index + m[0].length).replace(/^[\s:.-]+/, '')
    return rest || ls[i + 1] || ''
  }
  return ''
}

export const gcashParser: ReceiptParser = {
  name: 'GCash',
  detect: (t) => /gcash|ref\.?\s*no|express send/i.test(t),
  parse(text) {
    const ls = lines(text)
    const c = {} as FieldConfidence
    const f: ReceiptFields = { ref: '', amount: null, datetime: '', type: '', sender: '', recipient: '', mobile: '', notes: '' }

    // Reference number: GCash refs are 13 digits, often shown as 4-3-6 groups.
    const refM = /ref(?:erence)?\.?\s*(?:no\.?|number|#)?\s*:?\s*([\d][\d ]{8,20}\d)/i.exec(text)
    const refAny = /\b(\d{4}\s?\d{3}\s?\d{6})\b/.exec(text)
    const ref = (refM?.[1] ?? refAny?.[1] ?? '').replace(/\s/g, '')
    f.ref = ref
    c.ref = !ref ? 'missing' : refM && ref.length === 13 ? 'high' : 'low'

    // Amount: prefer the total, then a labelled amount, else the largest money value on the page.
    const amtLine = ls.find((l) => /total\s+amount/i.test(l) && MONEY.test(l)) ?? ls.find((l) => /amount/i.test(l) && MONEY.test(l))
    if (amtLine) {
      f.amount = parseMoney(MONEY.exec(amtLine.replace(/^.*amount[^\d₱]*/i, ''))?.[1] ?? '')
      c.amount = f.amount !== null ? 'high' : 'low'
    }
    if (f.amount === null) {
      const all = [...text.matchAll(new RegExp(MONEY, 'gi'))].map((m) => parseMoney(m[1])).filter((v): v is number => v !== null)
      f.amount = all.length ? Math.max(...all) : null
      c.amount = f.amount === null ? 'missing' : 'low'
    }

    // Date/time: "Nov 25, 2026 3:45 PM" or "11-25-2026 15:45"
    const dm = /\b([A-Za-z]{3})[a-z]*\.?\s+(\d{1,2}),?\s+(\d{4})(?:[\s,]+(\d{1,2}):(\d{2})\s*([AP]M)?)?/i.exec(text)
    const dn = /\b(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\s+(\d{1,2}):(\d{2})\s*([AP]M)?)?/i.exec(text)
    let y = 0, mo = 0, d = 0, h = -1, mi = 0, ap = ''
    if (dm && MONTHS.includes(dm[1].toLowerCase())) {
      ;[y, mo, d] = [+dm[3], MONTHS.indexOf(dm[1].toLowerCase()) + 1, +dm[2]]
      if (dm[4]) [h, mi, ap] = [+dm[4], +dm[5], dm[6] ?? '']
    } else if (dn) {
      ;[y, mo, d] = [+dn[3], +dn[1], +dn[2]]
      if (dn[4]) [h, mi, ap] = [+dn[4], +dn[5], dn[6] ?? '']
    }
    if (y) {
      if (ap.toUpperCase() === 'PM' && h < 12) h += 12
      if (ap.toUpperCase() === 'AM' && h === 12) h = 0
      const p = (n: number) => String(n).padStart(2, '0')
      f.datetime = `${y}-${p(mo)}-${p(d)}` + (h >= 0 ? `T${p(h)}:${p(mi)}` : '')
      c.datetime = h >= 0 ? 'high' : 'low'
    } else c.datetime = 'missing'

    const type = TYPES.find((t) => new RegExp(t.replace(' ', '\\s+'), 'i').test(text)) ?? ''
    f.type = type
    c.type = type ? 'high' : 'missing'

    const mob = /(?:\+?63|0)\s?(9\d{2})\s?(\d{3})\s?(\d{4})\b/.exec(text)
    const masked = /(?:\+?63|0)\s?(9\d{2})\s?[*•.x]{3,}\s?(\d{4})\b/i.exec(text)
    if (mob) { f.mobile = `0${mob[1]}${mob[2]}${mob[3]}`; c.mobile = 'high' }
    else if (masked) { f.mobile = `0${masked[1]}•••${masked[2]}`; c.mobile = 'low' }
    else c.mobile = 'missing'

    const name = (label: RegExp) => {
      const v = after(ls, label)
      // Names are letters, spaces, dots, commas; a phone number or amount here means the label didn't match a name.
      return /^[A-Za-zÑñ .,'-]{3,}$/.test(v) ? v : ''
    }
    f.recipient = name(/\b(sent to|recipient|merchant|biller|paid to|to)\b:?/i)
    f.sender = name(/\b(sent by|sender|from)\b:?/i)
    c.recipient = f.recipient ? 'high' : 'missing'
    c.sender = f.sender ? 'high' : 'missing'

    f.notes = after(ls, /\b(message|notes?|purpose)\b:?/i)
    c.notes = f.notes ? 'high' : 'missing'

    return { source: 'GCash', fields: f, confidence: c }
  },
}

export const PARSERS: ReceiptParser[] = [gcashParser]

/** Pick a parser for the text. GCash is the fallback while it is the only one. */
export function parseReceipt(text: string, ocrConfidence = 100): ParsedReceipt {
  const p = PARSERS.find((p) => p.detect(text)) ?? gcashParser
  const r = p.parse(text)
  // Blurry image: don't trust any field as high.
  if (ocrConfidence < 60) for (const k in r.confidence) if (r.confidence[k as keyof ReceiptFields] === 'high') r.confidence[k as keyof ReceiptFields] = 'low'
  return r
}

/** 09171234321 -> 0917•••4321 */
export function maskMobile(m: string): string {
  return m.length >= 11 ? `${m.slice(0, 4)}•••${m.slice(-4)}` : m
}
