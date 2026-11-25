// All money values are integer centavos. Never store pesos as floats.
export type Cents = number

export type EngagementStatus = 'Planning' | 'Fieldwork' | 'Review' | 'Completed'
export type Benchmark = 'revenue' | 'assets' | 'pretax'

export interface Materiality {
  benchmark: Benchmark
  base: Cents
  pct: number
  overall: Cents
  performance: Cents
  trivial: Cents
}

export interface Engagement {
  id: string
  client: string
  periodStart: string // YYYY-MM-DD
  periodEnd: string
  status: EngagementStatus
  materiality: Materiality
  createdAt: string
}

export interface Entry {
  row: number // stable row index within the engagement ledger
  entryId: string // journal number, e.g. JE-00012
  date: string // YYYY-MM-DD
  account: string
  accountName: string
  description: string
  debit: Cents
  credit: Cents
  user: string
}

export interface Flag {
  rule: RuleId
  rows: number[]
  detail: string
}

export type RuleId = 'duplicate' | 'round' | 'weekend' | 'holiday' | 'materiality' | 'gap' | 'unusualUser'

export type Confidence = 'high' | 'low' | 'missing'

export interface ReceiptFields {
  ref: string
  amount: Cents | null
  datetime: string // ISO-ish 'YYYY-MM-DDTHH:mm' or ''
  type: string
  sender: string
  recipient: string
  mobile: string
  notes: string
}

export type MatchStatus = 'Matched' | 'Possible match' | 'Unmatched'

export interface Payment {
  id: string
  engagementId: string
  source: string // parser name, e.g. 'GCash'
  fields: ReceiptFields
  image: Blob | null // null when the payment was typed in without a receipt
  fileName: string
  matchStatus: MatchStatus
  matchedRows: number[]
  flags: string[]
  confirmedAt: string
}

export type Severity = 'High' | 'Medium' | 'Low'

export interface Finding {
  id: string
  engagementId: string
  title: string
  description: string
  severity: Severity
  amount: Cents
  rows: number[]
  // Proposed adjusting entry; empty accounts means no adjustment proposed.
  adjDebit: string
  adjCredit: string
  createdAt: string
}
