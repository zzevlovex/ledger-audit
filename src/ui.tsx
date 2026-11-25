import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, ChevronsUpDown, ArrowDown, ArrowUp, Sparkles, X, type LucideIcon } from 'lucide-react'
import { php } from './lib/money'

export const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-5 flex flex-col gap-3 md:mb-7 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <h1 className="text-2xl font-extrabold tracking-tight text-slate-900 md:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2 [&>*]:flex-1 md:[&>*]:flex-none">{actions}</div>}
    </div>
  )
}

export function Card({ title, actions, children, className, pad = true }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={cx('overflow-hidden rounded-2xl border border-slate-200/80 bg-white shadow-sm shadow-slate-200/60', className)}>
      {title && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-4 py-3.5 md:px-5">
          <h2 className="text-[15px] font-bold text-slate-900">{title}</h2>
          {actions && <div className="no-print flex flex-wrap items-center gap-2">{actions}</div>}
        </header>
      )}
      <div className={cx('overflow-x-auto', pad && 'p-4 md:p-5')}>{children}</div>
    </section>
  )
}

type KpiTone = 'default' | 'red' | 'amber' | 'green' | 'blue'
const KPI_STYLE: Record<KpiTone, { chip: string; icon: LucideIcon }> = {
  default: { chip: 'from-sage-400 to-sage-500 shadow-sage-500/30', icon: Sparkles },
  blue: { chip: 'from-sage-400 to-sage-500 shadow-sage-500/30', icon: Sparkles },
  green: { chip: 'from-sage-400 to-sage-500 shadow-sage-500/30', icon: CheckCircle2 },
  amber: { chip: 'from-amber-400 to-orange-500 shadow-amber-500/30', icon: AlertTriangle },
  red: { chip: 'from-rose-500 to-pink-600 shadow-rose-500/30', icon: AlertTriangle },
}

export function Kpi({ label, value, sub, tone = 'default', icon }: { label: string; value: ReactNode; sub?: ReactNode; tone?: KpiTone; icon?: LucideIcon }) {
  const s = KPI_STYLE[tone]
  const Icon = icon ?? s.icon
  return (
    <div className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-200/60">
      <div className="flex items-start justify-between gap-2">
        <p className="text-xs font-semibold text-slate-500">{label}</p>
        <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-white shadow-md', s.chip)}><Icon size={16} strokeWidth={2.4} /></span>
      </div>
      <p className="mt-1 truncate text-[17px] font-extrabold tabular-nums tracking-tight text-slate-900 sm:text-xl 2xl:text-2xl" title={typeof value === 'string' ? value : undefined}>{value}</p>
      {sub && <p className="mt-0.5 truncate text-xs text-slate-500">{sub}</p>}
    </div>
  )
}

export function KpiRow({ children }: { children: ReactNode }) {
  return <div className="mb-5 grid grid-cols-2 gap-3 md:mb-7 md:gap-4 lg:grid-cols-3 xl:grid-cols-5 [&>*:last-child:nth-child(odd)]:col-span-2 lg:[&>*:last-child:nth-child(odd)]:col-span-1">{children}</div>
}

type Tone = 'slate' | 'red' | 'amber' | 'green' | 'emerald'
export function Badge({ tone = 'slate', children }: { tone?: Tone; children: ReactNode }) {
  const c = {
    slate: 'bg-slate-100 text-slate-700',
    red: 'bg-rose-100 text-rose-700',
    amber: 'bg-amber-100 text-amber-800',
    green: 'bg-sage-100 text-sage-700',
    emerald: 'bg-sage-100 text-sage-700',
  }[tone]
  return <span className={cx('inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', c)}>{children}</span>
}

export function Button({ variant = 'secondary', className, ...p }: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: 'primary' | 'secondary' | 'danger' | 'ghost' }) {
  const v = {
    primary: 'bg-gradient-to-r from-sage-500 to-sage-500 text-white shadow-md shadow-sage-500/25 hover:from-sage-400 hover:to-sage-400',
    secondary: 'bg-white text-slate-700 ring-1 ring-inset ring-slate-200 hover:bg-slate-50 shadow-sm',
    danger: 'bg-white text-rose-700 ring-1 ring-inset ring-rose-200 hover:bg-rose-50',
    ghost: 'text-slate-600 hover:bg-slate-100',
  }[variant]
  return <button {...p} className={cx('inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition active:scale-[.98] disabled:cursor-not-allowed disabled:opacity-50 md:min-h-9', v, className)} />
}

// 16px text on phones stops iOS from zooming into inputs.
export const inputCls = 'block w-full rounded-xl border-0 bg-white px-3 py-2.5 text-base text-slate-900 ring-1 ring-inset ring-slate-200 placeholder:text-slate-400 focus:ring-2 focus:ring-sage-500 md:py-2 md:text-sm'

export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-xs font-semibold text-slate-600">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}
    </label>
  )
}

export function Money({ c, bold }: { c: number; bold?: boolean }) {
  return <span className={cx('tabular-nums', c < 0 && 'text-rose-700', bold && 'font-bold')}>{php(c)}</span>
}

/** Full-screen sheet on phones, side panel on desktop. */
export function Drawer({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', k)
    return () => window.removeEventListener('keydown', k)
  }, [onClose])
  if (!open) return null
  return (
    <div className="no-print fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm" onClick={onClose} />
      <div className={cx('relative flex h-full w-full flex-col bg-white shadow-2xl md:rounded-l-3xl', wide ? 'md:max-w-5xl' : 'md:max-w-2xl')}>
        <header className="flex items-center justify-between gap-3 border-b border-slate-100 px-4 py-3 md:px-6 md:py-4">
          <h2 className="truncate text-lg font-bold">{title}</h2>
          <Button variant="ghost" onClick={onClose} aria-label="Close" className="!px-2"><X size={20} /></Button>
        </header>
        <div className="flex-1 overflow-y-auto p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] md:p-6">{children}</div>
      </div>
    </div>
  )
}

/** Object URL for a Blob, revoked when the blob changes or the component unmounts. */
export function useObjectUrl(b: Blob | null | undefined) {
  const [url, setUrl] = useState('')
  useEffect(() => {
    if (!b) return setUrl('')
    const u = URL.createObjectURL(b)
    setUrl(u)
    return () => URL.revokeObjectURL(u)
  }, [b])
  return url
}

export interface Col<T> {
  key: string
  label: string
  render: (r: T) => ReactNode
  sort?: (r: T) => string | number
  num?: boolean
  width?: string
}

/** Sortable, paginated table. On phones each row becomes a card. */
export function DataTable<T>({ rows, cols, onRow, rowKey, pageSize = 50, empty = 'No rows', maxH = 'md:max-h-[60vh]' }: {
  rows: T[]; cols: Col<T>[]; onRow?: (r: T) => void; rowKey: (r: T) => string | number; pageSize?: number; empty?: string; maxH?: string
}) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(null)
  const [page, setPage] = useState(0)
  const sorted = useMemo(() => {
    const c = cols.find((c) => c.key === sort?.key)
    if (!c?.sort || !sort) return rows
    return [...rows].sort((a, b) => {
      const x = c.sort!(a), y = c.sort!(b)
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir
    })
  }, [rows, sort, cols])
  useEffect(() => setPage(0), [rows.length])
  const pages = Math.max(1, Math.ceil(sorted.length / pageSize))
  const view = sorted.slice(page * pageSize, (page + 1) * pageSize)
  const [head, ...rest] = cols
  const amountCol = [...cols].reverse().find((c) => c.num)
  return (
    <div>
      {/* Phone: cards */}
      <ul className="divide-y divide-slate-100 md:hidden">
        {view.map((r) => (
          <li key={rowKey(r)} onClick={onRow && (() => onRow(r))} className={cx('px-4 py-3', onRow && 'cursor-pointer active:bg-sage-50/60')}>
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 text-sm font-semibold text-slate-900">{head.render(r)}</div>
              {amountCol && amountCol !== head && <div className="shrink-0 text-sm font-bold tabular-nums">{amountCol.render(r)}</div>}
            </div>
            <dl className="mt-1.5 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
              {rest.filter((c) => c !== amountCol && c.label).map((c) => (
                <div key={c.key} className="contents"><dt className="text-slate-400">{c.label}</dt><dd className="min-w-0 text-slate-700">{c.render(r)}</dd></div>
              ))}
            </dl>
          </li>
        ))}
        {!view.length && <li className="px-4 py-10 text-center text-sm text-slate-500">{empty}</li>}
      </ul>
      {/* Desktop: table */}
      <div className={cx('hidden overflow-auto md:block', maxH)}>
        <table className="min-w-full text-sm">
          <thead className="sticky top-0 z-10 bg-slate-50/95 text-[11px] font-bold uppercase tracking-wider text-slate-500 backdrop-blur">
            <tr>
              {cols.map((c) => (
                <th key={c.key} scope="col" className={cx('px-4 py-2.5', c.num ? 'text-right' : 'text-left', c.width)}>
                  {c.sort ? (
                    <button className="inline-flex items-center gap-1 uppercase hover:text-sage-700" onClick={() => setSort((s) => ({ key: c.key, dir: s?.key === c.key && s.dir === 1 ? -1 : 1 }))}>
                      {c.label}
                      {sort?.key === c.key ? (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />) : <ChevronsUpDown size={12} className="opacity-50" />}
                    </button>
                  ) : c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {view.map((r) => (
              <tr key={rowKey(r)} onClick={onRow && (() => onRow(r))} className={cx(onRow && 'cursor-pointer hover:bg-sage-50/50')}>
                {cols.map((c) => <td key={c.key} className={cx('px-4 py-2.5 align-top', c.num && 'num')}>{c.render(r)}</td>)}
              </tr>
            ))}
            {!view.length && <tr><td colSpan={cols.length} className="px-4 py-10 text-center text-slate-500">{empty}</td></tr>}
          </tbody>
        </table>
      </div>
      {sorted.length > pageSize && (
        <div className="no-print flex items-center justify-between border-t border-slate-100 px-4 py-2 text-xs text-slate-500">
          <span>{page * pageSize + 1}–{Math.min(sorted.length, (page + 1) * pageSize)} of {sorted.length}</span>
          <div className="flex gap-1">
            <Button variant="ghost" aria-label="Previous page" disabled={page === 0} onClick={() => setPage(page - 1)}><ChevronLeft size={16} /></Button>
            <Button variant="ghost" aria-label="Next page" disabled={page >= pages - 1} onClick={() => setPage(page + 1)}><ChevronRight size={16} /></Button>
          </div>
        </div>
      )}
    </div>
  )
}

export const confTone = (c: string): Tone => (c === 'high' ? 'green' : c === 'low' ? 'amber' : 'slate')
export const statusTone = (s: string): Tone => (s === 'Matched' ? 'green' : s === 'Possible match' ? 'amber' : 'red')
export const sevTone = (s: string): Tone => (s === 'High' ? 'red' : s === 'Medium' ? 'amber' : 'slate')
