import { CheckCircle2, Flag, HelpCircle, Receipt, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { uid } from '../lib/db'
import { matchPayment } from '../lib/matching'
import { parseMoney, php, toDecimal } from '../lib/money'
import { readReceipt } from '../lib/ocr'
import { maskMobile, parseReceipt, type FieldConfidence } from '../lib/receipts'
import { SAMPLE_RECEIPTS } from '../lib/seed'
import type { Engagement, Entry, MatchStatus, Payment, ReceiptFields } from '../lib/types'
import { useApp } from '../store'
import { Badge, Button, Card, confTone, cx, DataTable, Drawer, Field, inputCls, Kpi, KpiRow, PageHeader, statusTone, useObjectUrl } from '../ui'

interface QueueItem {
  key: string
  name: string
  state: 'waiting' | 'reading' | 'review' | 'error'
  progress: number
  error?: string
  image?: Blob
  source?: string
  fields?: ReceiptFields
  confidence?: FieldConfidence
}

const FIELD_LABELS: [keyof ReceiptFields, string][] = [
  ['ref', 'Reference number'], ['amount', 'Amount (₱)'], ['datetime', 'Date and time'], ['type', 'Transaction type'],
  ['sender', 'Sender'], ['recipient', 'Recipient / merchant'], ['mobile', 'Mobile number'], ['notes', 'Message / notes'],
]
const ACCEPT = ['image/png', 'image/jpeg']

function runMatch(fields: ReceiptFields, self: string | null, payments: Payment[], entries: Entry[], eng: Engagement) {
  const others = payments.filter((p) => p.id !== self)
  return matchPayment(
    { ref: fields.ref, amount: fields.amount, date: fields.datetime.slice(0, 10) },
    entries,
    { periodStart: eng.periodStart, periodEnd: eng.periodEnd, otherRefs: others.map((p) => p.fields.ref).filter(Boolean), taken: new Set(others.flatMap((p) => p.matchedRows)) },
  )
}

/** Image beside editable fields. Nothing is saved until the user confirms. */
function ReceiptImage({ image }: { image: Blob | null }) {
  const url = useObjectUrl(image)
  if (!image) return <div className="hidden min-h-48 place-items-center rounded-lg border border-dashed md:grid border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">Typed in by hand.<br />No receipt image.</div>
  return <div className="rounded-lg border border-slate-200 bg-slate-100 p-2"><img src={url || undefined} alt="Receipt" className="mx-auto max-h-[70vh] object-contain" /></div>
}

const EMPTY: ReceiptFields = { ref: '', amount: null, datetime: '', type: 'Send Money', sender: '', recipient: '', mobile: '', notes: '' }

function ReviewForm({ image, initial, confidence, onConfirm, onCancel, confirmLabel }: {
  image: Blob | null; initial: ReceiptFields; confidence?: FieldConfidence; confirmLabel: string
  onConfirm: (f: ReceiptFields) => Promise<void>; onCancel: () => void
}) {
  const [busy, setBusy] = useState(false) // blocks double-submit, which would save the receipt twice
  const [f, setF] = useState({ ...initial, amount: initial.amount === null ? '' : toDecimal(initial.amount), datetime: initial.datetime && !initial.datetime.includes('T') ? initial.datetime + 'T00:00' : initial.datetime })
  const amount = parseMoney(f.amount)
  const valid = amount !== null && amount > 0 && /^\d{4}-\d{2}-\d{2}/.test(f.datetime)
  const lowCount = confidence ? Object.values(confidence).filter((c) => c !== 'high').length : 0
  return (
    <div className="grid gap-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <ReceiptImage image={image} />
      <form className="space-y-3" onSubmit={async (e) => {
        e.preventDefault()
        if (!valid || busy) return
        setBusy(true)
        try { await onConfirm({ ...f, amount }) } finally { setBusy(false) }
      }}>
        {confidence && (
          <p className={cx('rounded-md px-3 py-2 text-sm', lowCount ? 'bg-amber-50 text-amber-900' : 'bg-sage-50 text-sage-800')}>
            {lowCount ? `${lowCount} field${lowCount > 1 ? 's' : ''} need checking (highlighted). Compare each with the image.` : 'All fields read clearly. Still compare with the image before confirming.'}
          </p>
        )}
        {FIELD_LABELS.map(([k, label]) => {
          const c = confidence?.[k]
          const warn = c && c !== 'high'
          return (
            <Field key={k} label={<span className="flex items-center justify-between">{label}{c && <Badge tone={confTone(c)}>{c === 'high' ? 'High confidence' : c === 'low' ? 'Low confidence' : 'Not found'}</Badge>}</span>}>
              <input
                type={k === 'datetime' ? 'datetime-local' : 'text'}
                inputMode={k === 'amount' ? 'decimal' : undefined}
                className={cx(inputCls, warn && 'bg-amber-50 ring-amber-400', k === 'amount' && 'text-right tabular-nums')}
                value={String(f[k] ?? '')}
                onChange={(e) => setF({ ...f, [k]: e.target.value })}
              />
            </Field>
          )
        })}
        {!valid && <p className="text-xs text-red-700">Amount and date are required.</p>}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" onClick={onCancel}>Discard</Button>
          <Button variant="primary" type="submit" disabled={!valid || busy}>{busy ? 'Saving…' : confirmLabel}</Button>
        </div>
      </form>
    </div>
  )
}

function PaymentDetail({ p, onEdit, onClose }: { p: Payment; onEdit: () => void; onClose: () => void }) {
  const { entries, deletePayment } = useApp()
  const matched = entries.filter((e) => p.matchedRows.includes(e.row))
  const f = p.fields
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <div><ReceiptImage image={p.image} /></div>
      <div className="space-y-5 text-sm">
        <div className="flex items-center gap-2"><Badge tone={statusTone(p.matchStatus)}>{p.matchStatus}</Badge><span className="text-xs text-slate-500">{p.image ? `${p.source} · ${p.fileName}` : 'Typed in by hand'}</span></div>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {[['Reference', f.ref || '—'], ['Amount', f.amount === null ? '—' : php(f.amount)], ['Date', f.datetime.replace('T', ' ')], ['Type', f.type || '—'], ['Sender', f.sender || '—'], ['Recipient', f.recipient || '—'], ['Mobile', maskMobile(f.mobile) || '—'], ['Notes', f.notes || '—']].map(([l, v]) => (
            <div key={l}><dt className="text-xs text-slate-500">{l}</dt><dd className="font-medium tabular-nums">{v}</dd></div>
          ))}
        </dl>
        {p.flags.length > 0 && <div className="space-y-1">{p.flags.map((x) => <p key={x} className="rounded-md bg-red-50 px-3 py-2 text-red-800">{x}</p>)}</div>}
        <div>
          <h3 className="mb-2 font-semibold">Matched ledger lines</h3>
          {matched.length ? (
            <table className="w-full text-sm"><tbody className="divide-y divide-slate-100">
              {matched.map((e) => <tr key={e.row}><td className="py-1.5 tabular-nums">{e.date}</td><td>{e.entryId}</td><td className="text-slate-600">{e.description}</td><td className="num">{php(Math.abs(e.debit - e.credit))}</td></tr>)}
            </tbody></table>
          ) : <p className="text-slate-500">No ledger line matched.</p>}
        </div>
        <p className="text-xs text-slate-500">Confirmed {p.confirmedAt.replace('T', ' ')}</p>
        <div className="flex gap-2">
          <Button onClick={onEdit}>Edit fields</Button>
          <Button variant="danger" onClick={async () => { if (confirm('Delete this payment record and its receipt image? This cannot be undone.')) { await deletePayment(p); onClose() } }}>Delete</Button>
        </div>
      </div>
    </div>
  )
}

export default function Payments() {
  const { eng, entries, payments, savePayment } = useApp()
  const [queue, setQueue] = useState<QueueItem[]>([])
  const [reviewing, setReviewing] = useState<string | null>(null)
  const [detail, setDetail] = useState<Payment | null>(null)
  const [editing, setEditing] = useState<Payment | null>(null)
  const [adding, setAdding] = useState(false)
  const [status, setStatus] = useState<MatchStatus | ''>('')
  const [onlyFlagged, setOnlyFlagged] = useState(false)
  const [drag, setDrag] = useState(false)

  const upd = (key: string, patch: Partial<QueueItem>) => setQueue((q) => q.map((x) => (x.key === key ? { ...x, ...patch } : x)))

  const process = async (files: File[]) => {
    const items = files.map((f) => ({ f, item: { key: uid(), name: f.name, state: 'waiting', progress: 0 } as QueueItem }))
    setQueue((q) => [...q, ...items.map((i) => i.item)])
    for (const { f, item } of items) {
      if (!ACCEPT.includes(f.type)) { upd(item.key, { state: 'error', error: 'Unsupported file type. Use PNG or JPG.' }); continue }
      upd(item.key, { state: 'reading' })
      try {
        const r = await readReceipt(f, (progress) => upd(item.key, { progress }))
        if (r.text.trim().length < 10) throw new Error('No readable text found. Try a clearer screenshot.')
        const parsed = parseReceipt(r.text, r.confidence)
        upd(item.key, { state: 'review', image: f, source: parsed.source, fields: parsed.fields, confidence: parsed.confidence, progress: 100 })
      } catch (e) {
        upd(item.key, { state: 'error', error: (e as Error).message })
      }
    }
  }

  const loadSamples = async () => {
    const files = await Promise.all(SAMPLE_RECEIPTS.map(async (s) => new File([await (await fetch(`${import.meta.env.BASE_URL}samples/${s.file}`)).blob()], s.file, { type: 'image/png' })))
    process(files)
  }

  const confirmItem = async (item: QueueItem, fields: ReceiptFields) => {
    const m = runMatch(fields, null, payments, entries, eng)
    const now = new Date().toISOString().slice(0, 19)
    await savePayment({ id: uid(), engagementId: eng.id, source: item.source!, fields, image: item.image!, fileName: item.name, matchStatus: m.status, matchedRows: m.rows, flags: m.flags, confirmedAt: now })
    const rest = queue.filter((x) => x.key !== item.key)
    setQueue((q) => q.filter((x) => x.key !== item.key))
    setReviewing(rest.find((x) => x.state === 'review')?.key ?? null) // go straight to the next receipt
  }

  const rematchAll = async () => {
    // Re-run in confirmation order so duplicates keep pointing at the later receipt.
    let acc: Payment[] = []
    for (const p of [...payments].sort((a, b) => a.confirmedAt.localeCompare(b.confirmedAt))) {
      const m = runMatch(p.fields, p.id, acc, entries, eng)
      const next = { ...p, matchStatus: m.status, matchedRows: m.rows, flags: m.flags }
      acc = [...acc, next]
      await savePayment(next)
    }
  }

  const rows = useMemo(() => payments.filter((p) => (!status || p.matchStatus === status) && (!onlyFlagged || p.flags.length)), [payments, status, onlyFlagged])
  const reviewItem = queue.find((q) => q.key === reviewing)
  const total = payments.reduce((s, p) => s + (p.fields.amount ?? 0), 0)

  return (
    <>
      <PageHeader title="Payments" subtitle="Upload GCash receipts or type payments in by hand. Receipt text is read in your browser; images never leave this computer."
        actions={<><Button onClick={loadSamples}>Load samples</Button><Button onClick={rematchAll} disabled={!payments.length}>Re-match</Button><Button variant="primary" onClick={() => setAdding(true)}>Add payment</Button></>} />
      <KpiRow>
        <Kpi label="Receipts" icon={Receipt} value={payments.length} sub={php(total)} />
        <Kpi label="Matched" icon={CheckCircle2} value={payments.filter((p) => p.matchStatus === 'Matched').length} tone="green" />
        <Kpi label="Possible match" icon={HelpCircle} value={payments.filter((p) => p.matchStatus === 'Possible match').length} tone="amber" />
        <Kpi label="Unmatched" icon={XCircle} value={payments.filter((p) => p.matchStatus === 'Unmatched').length} tone="red" />
        <Kpi label="With flags" icon={Flag} value={payments.filter((p) => p.flags.length).length} tone={payments.some((p) => p.flags.length) ? 'red' : 'green'} sub="Duplicate ref, amount, period" />
      </KpiRow>

      <div className="mb-6 grid gap-6 lg:grid-cols-[1.2fr_1fr]">
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); process([...e.dataTransfer.files]) }}
          className={cx('flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-10 text-center transition', drag ? 'border-sage-600 bg-sage-50' : 'border-slate-300 bg-white hover:border-sage-600')}>
          <svg viewBox="0 0 24 24" className="mb-2 h-8 w-8 text-slate-400" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden><path d="M12 16V4m0 0l-4 4m4-4l4 4M4 16v3a1 1 0 001 1h14a1 1 0 001-1v-3" /></svg>
          <span className="text-sm font-semibold text-slate-800"><span className="md:hidden">Tap to add receipt photos</span><span className="hidden md:inline">Drop receipt screenshots here, or click to choose</span></span>
          <span className="mt-1 text-xs text-slate-500">PNG or JPG · several at once · first read downloads the free OCR model (~10 MB)</span>
          <input type="file" multiple accept=".png,.jpg,.jpeg" className="sr-only" onChange={(e) => { process([...(e.target.files ?? [])]); e.target.value = '' }} />
        </label>
        <Card title={`Upload queue (${queue.length})`} pad={false}>
          <ul className="max-h-56 divide-y divide-slate-100 overflow-auto">
            {queue.map((q) => (
              <li key={q.key} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                <span className="min-w-0 flex-1 truncate">{q.name}</span>
                {q.state === 'waiting' && <Badge>Waiting</Badge>}
                {q.state === 'reading' && (
                  <div className="flex w-32 items-center gap-2" role="progressbar" aria-valuenow={q.progress} aria-label={`Reading ${q.name}`}>
                    <div className="h-1.5 flex-1 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-sage-600 transition-all" style={{ width: `${q.progress}%` }} /></div>
                    <span className="w-8 text-right text-xs tabular-nums text-slate-500">{q.progress}%</span>
                  </div>
                )}
                {q.state === 'review' && <Button variant="primary" onClick={() => setReviewing(q.key)}>Review</Button>}
                {q.state === 'error' && <><span className="text-xs text-red-700">{q.error}</span><Button variant="ghost" onClick={() => setQueue((x) => x.filter((y) => y.key !== q.key))}>Dismiss</Button></>}
              </li>
            ))}
            {!queue.length && <li className="px-4 py-8 text-center text-sm text-slate-500">Nothing waiting. Uploaded receipts appear here for review.</li>}
          </ul>
        </Card>
      </div>

      <Card title="Captured payments" pad={false} actions={
        <>
          <select className={cx(inputCls, 'w-44')} value={status} onChange={(e) => setStatus(e.target.value as MatchStatus | '')} aria-label="Filter by match status">
            <option value="">All statuses</option><option>Matched</option><option>Possible match</option><option>Unmatched</option>
          </select>
          <label className="flex items-center gap-2 whitespace-nowrap text-sm text-slate-600"><input type="checkbox" className="accent-sage-700" checked={onlyFlagged} onChange={(e) => setOnlyFlagged(e.target.checked)} /> Flagged only</label>
        </>
      }>
        <DataTable rows={rows} rowKey={(p) => p.id} onRow={setDetail} empty="No payments yet. Upload receipts or load the samples." cols={[
          { key: 'date', label: 'Date', sort: (p) => p.fields.datetime, render: (p) => <span className="whitespace-nowrap tabular-nums">{p.fields.datetime.replace('T', ' ')}</span> },
          { key: 'ref', label: 'Reference', sort: (p) => p.fields.ref, render: (p) => <span className="font-medium tabular-nums">{p.fields.ref || '—'}</span> },
          { key: 'type', label: 'Type', render: (p) => p.fields.type },
          { key: 'to', label: 'Recipient', sort: (p) => p.fields.recipient, render: (p) => <span className="line-clamp-1">{p.fields.recipient}</span> },
          { key: 'mob', label: 'Mobile', render: (p) => <span className="tabular-nums">{maskMobile(p.fields.mobile)}</span> },
          { key: 'amt', label: 'Amount', num: true, sort: (p) => p.fields.amount ?? 0, render: (p) => (p.fields.amount === null ? '—' : php(p.fields.amount)) },
          { key: 'status', label: 'Status', sort: (p) => p.matchStatus, render: (p) => <Badge tone={statusTone(p.matchStatus)}>{p.matchStatus}</Badge> },
          { key: 'flags', label: 'Flags', sort: (p) => p.flags.length, render: (p) => <div className="flex flex-col gap-1">{p.flags.map((f) => <Badge key={f} tone="red">{f.split(':')[0].replace(/ \d{6,}.*/, '')}</Badge>)}</div> },
        ]} />
      </Card>

      <Drawer wide open={!!reviewItem} onClose={() => setReviewing(null)} title={`Review receipt · ${reviewItem?.name ?? ''}`}>
        {reviewItem?.fields && (
          <ReviewForm key={reviewItem.key} image={reviewItem.image!} initial={reviewItem.fields} confidence={reviewItem.confidence} confirmLabel="Confirm and save"
            onConfirm={(f) => confirmItem(reviewItem, f)} onCancel={() => { setQueue((q) => q.filter((x) => x.key !== reviewItem.key)); setReviewing(null) }} />
        )}
      </Drawer>
      <Drawer wide open={!!detail && !editing} onClose={() => setDetail(null)} title={`Payment ${detail?.fields.ref ?? ''}`}>
        {detail && <PaymentDetail p={payments.find((p) => p.id === detail.id) ?? detail} onEdit={() => setEditing(detail)} onClose={() => setDetail(null)} />}
      </Drawer>
      <Drawer wide open={!!editing} onClose={() => setEditing(null)} title="Edit payment fields">
        {editing && (
          <ReviewForm key={editing.id} image={editing.image} initial={editing.fields} confirmLabel="Save changes" onCancel={() => setEditing(null)}
            onConfirm={async (fields) => {
              const m = runMatch(fields, editing.id, payments, entries, eng)
              await savePayment({ ...editing, fields, matchStatus: m.status, matchedRows: m.rows, flags: m.flags })
              setEditing(null); setDetail(null)
            }} />
        )}
      </Drawer>
      <Drawer wide open={adding} onClose={() => setAdding(false)} title="Add payment">
        {adding && (
          <ReviewForm image={null} initial={{ ...EMPTY, datetime: `${eng.periodEnd}T09:00` }} confirmLabel="Save payment" onCancel={() => setAdding(false)}
            onConfirm={async (fields) => {
              const m = runMatch(fields, null, payments, entries, eng)
              await savePayment({ id: uid(), engagementId: eng.id, source: 'Manual', fields, image: null, fileName: '', matchStatus: m.status, matchedRows: m.rows, flags: m.flags, confirmedAt: new Date().toISOString().slice(0, 19) })
              setAdding(false)
            }} />
        )}
      </Drawer>
    </>
  )
}
