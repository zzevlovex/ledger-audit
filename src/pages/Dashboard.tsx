import { useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { summary } from '../derived'
import { RULES } from '../lib/jet'
import { BENCHMARKS, computeMateriality } from '../lib/materiality'
import { parseMoney, php, toDecimal } from '../lib/money'
import type { Benchmark, RuleId } from '../lib/types'
import { useApp } from '../store'
import { Banknote, BookOpenText, Flag, Scale, Settings2, Wallet } from 'lucide-react'
import { Badge, Button, Card, Drawer, Field, inputCls, Kpi, KpiRow, sevTone } from '../ui'

function CompanyForm({ onDone }: { onDone: () => void }) {
  const { eng, saveEngagement } = useApp()
  const [f, setF] = useState({
    client: eng.client, periodStart: eng.periodStart, periodEnd: eng.periodEnd,
    benchmark: eng.materiality.benchmark, base: toDecimal(eng.materiality.base), pct: String(eng.materiality.pct),
  })
  const base = parseMoney(f.base)
  const pct = Number(f.pct)
  const valid = f.client.trim() && f.periodStart <= f.periodEnd && base !== null && base > 0 && pct > 0 && pct <= 100
  const mat = valid ? computeMateriality(f.benchmark, base!, pct) : null
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => setF({ ...f, [k]: e.target.value })

  return (
    <form className="space-y-4" onSubmit={async (e) => {
      e.preventDefault()
      if (!mat) return
      await saveEngagement({ ...eng, client: f.client.trim(), periodStart: f.periodStart, periodEnd: f.periodEnd, materiality: mat })
      onDone()
    }}>
      <Field label="Company name"><input required className={inputCls} value={f.client} onChange={set('client')} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Period start"><input type="date" className={inputCls} value={f.periodStart} onChange={set('periodStart')} /></Field>
        <Field label="Period end"><input type="date" className={inputCls} value={f.periodEnd} onChange={set('periodEnd')} /></Field>
      </div>
      <fieldset className="rounded-lg border border-slate-200 p-4">
        <legend className="px-1 text-sm font-semibold">Materiality</legend>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Benchmark"><select className={inputCls} value={f.benchmark} onChange={set('benchmark')}>{(Object.keys(BENCHMARKS) as Benchmark[]).map((b) => <option key={b} value={b}>{BENCHMARKS[b].label}</option>)}</select></Field>
          <Field label="Benchmark amount (₱)"><input inputMode="decimal" className={inputCls + ' text-right tabular-nums'} value={f.base} onChange={set('base')} /></Field>
          <Field label="Percentage" hint={`Typical: ${BENCHMARKS[f.benchmark].range}`}><input type="number" step="0.1" min="0.1" max="100" className={inputCls} value={f.pct} onChange={set('pct')} /></Field>
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-3 rounded-md bg-slate-50 p-3 text-sm">
          {[['Overall', mat?.overall], ['Performance (75%)', mat?.performance], ['Clearly trivial (5%)', mat?.trivial]].map(([l, v]) => (
            <div key={l as string}><dt className="text-xs text-slate-500">{l}</dt><dd className="font-semibold tabular-nums">{v == null ? '—' : php(v as number)}</dd></div>
          ))}
        </dl>
      </fieldset>
      <div className="flex justify-end gap-2">
        <Button type="button" onClick={onDone}>Cancel</Button>
        <Button variant="primary" type="submit" disabled={!valid}>Save</Button>
      </div>
    </form>
  )
}

export default function Dashboard() {
  const { eng, entries, flags, findings, payments, setPage } = useApp()
  const [editing, setEditing] = useState(false)
  const s = summary(entries, flags, findings, payments)
  const m = eng.materiality
  const byRule = (Object.keys(RULES) as RuleId[]).map((r) => ({ rule: RULES[r].label, count: flags.filter((f) => f.rule === r).length }))
  const adjPct = m.overall ? s.proposedAdj / m.overall : 0
  const barTone = adjPct >= 1 ? 'from-rose-400 to-pink-500' : adjPct >= 0.5 ? 'from-amber-300 to-orange-400' : 'from-sage-300 to-sage-400'

  return (
    <>
      {/* Hero */}
      <section className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-sage-600 via-sage-500 to-sage-400 p-5 text-white shadow-xl shadow-sage-500/25 md:mb-7 md:p-7">
        <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-48 w-48 rounded-full bg-sage-200/30 blur-2xl" />
        <div className="relative flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-widest text-sage-100/80">Audit engagement · FY {eng.periodEnd.slice(0, 4)}</p>
            <h1 className="mt-1 text-2xl font-extrabold tracking-tight md:text-4xl">{eng.client}</h1>
            <p className="mt-1 text-sm text-sage-100/90">{eng.periodStart} to {eng.periodEnd}</p>
          </div>
          <button onClick={() => setEditing(true)} className="no-print inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-bold ring-1 ring-white/30 backdrop-blur hover:bg-white/25">
            <Settings2 size={16} /> Edit company & materiality
          </button>
        </div>
        <div className="relative mt-5 rounded-2xl bg-white/10 p-4 ring-1 ring-white/20 backdrop-blur">
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="font-semibold text-sage-50">Proposed adjustments vs materiality</span>
            <span className="text-lg font-extrabold tabular-nums">{(adjPct * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-2 h-2.5 rounded-full bg-white/20"><div className={`h-2.5 rounded-full bg-gradient-to-r ${barTone}`} style={{ width: `${Math.min(100, adjPct * 100)}%` }} /></div>
          <p className="mt-2 text-xs text-sage-100/90 tabular-nums">{php(s.proposedAdj)} of {php(m.overall)} overall materiality</p>
        </div>
      </section>

      <KpiRow>
        <Kpi label="Ledger lines" value={entries.length.toLocaleString()} sub={`${s.journals} journals`} icon={BookOpenText} />
        <Kpi label="Flagged lines" value={s.flaggedRows.size} sub={`${flags.length} flags`} tone={s.flaggedRows.size ? 'amber' : 'green'} icon={Flag} />
        <Kpi label="Flagged amount" value={php(s.flaggedAmount)} sub="Sum of flagged lines" tone="blue" icon={Banknote} />
        <Kpi label="Unmatched payments" value={s.unmatched} sub={`${payments.length} receipts`} tone={s.unmatched ? 'red' : 'green'} icon={Wallet} />
        <Kpi label="Proposed adjustments" value={php(s.proposedAdj)} sub={`${(adjPct * 100).toFixed(0)}% of materiality`} tone={adjPct >= 1 ? 'red' : adjPct >= 0.5 ? 'amber' : 'green'} icon={Scale} />
      </KpiRow>

      <div className="grid gap-5 xl:grid-cols-3">
        <Card title="Journal entry test results" className="xl:col-span-2" actions={<button className="text-sm font-bold text-sage-600 hover:underline" onClick={() => setPage('Testing')}>Review →</button>}>
          <div className="h-64">
            <ResponsiveContainer>
              <BarChart data={byRule} layout="vertical" margin={{ left: 0, right: 12 }}>
                <defs>
                  <linearGradient id="barGrad" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stopColor="#8fb093" /><stop offset="100%" stopColor="#c3d6c2" /></linearGradient>
                </defs>
                <CartesianGrid horizontal={false} stroke="#f1f5f1" />
                <XAxis type="number" allowDecimals={false} tick={{ fontSize: 11, fill: '#64748b' }} />
                <YAxis type="category" dataKey="rule" width={118} tick={{ fontSize: 11, fill: '#334155', fontWeight: 600 }} />
                <Tooltip cursor={{ fill: '#f1f5f1' }} />
                <Bar dataKey="count" name="Flags" fill="url(#barGrad)" radius={[0, 6, 6, 0]} barSize={14} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Materiality">
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-slate-500">Benchmark</dt><dd className="text-right font-bold">{BENCHMARKS[m.benchmark].label} × {m.pct}%</dd></div>
            {[['Overall', m.overall, 'bg-sage-500'], ['Performance (75%)', m.performance, 'bg-sage-400'], ['Clearly trivial (5%)', m.trivial, 'bg-sage-400']].map(([l, v, dot]) => (
              <div key={l as string} className="flex items-center justify-between gap-3"><dt className="flex items-center gap-2 text-slate-500"><span className={`h-2 w-2 rounded-full ${dot}`} />{l}</dt><dd className="font-extrabold tabular-nums">{php(v as number)}</dd></div>
            ))}
          </dl>
        </Card>

        <Card title="Findings" pad={false} className="xl:col-span-3" actions={<button className="text-sm font-bold text-sage-600 hover:underline" onClick={() => setPage('Findings')}>All →</button>}>
          <ul className="divide-y divide-slate-100">
            {findings.slice(0, 5).map((f) => (
              <li key={f.id} className="flex items-center gap-3 px-4 py-3 text-sm md:px-5">
                <Badge tone={sevTone(f.severity)}>{f.severity}</Badge>
                <span className="min-w-0 flex-1 truncate font-medium">{f.title}</span>
                <span className="font-bold tabular-nums">{php(f.amount)}</span>
              </li>
            ))}
            {!findings.length && <li className="px-4 py-6 text-center text-sm text-slate-500">No findings yet</li>}
          </ul>
        </Card>
      </div>
      <Drawer open={editing} onClose={() => setEditing(false)} title="Company and materiality">
        {editing && <CompanyForm onDone={() => setEditing(false)} />}
      </Drawer>
    </>
  )
}
