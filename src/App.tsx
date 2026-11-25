import { useState } from 'react'
import { BookOpenText, FileBarChart2, FileText, LayoutDashboard, AlertTriangle, Download, LayoutGrid, ScanSearch, ShieldCheck, Upload, ShieldAlert, Wallet, X, type LucideIcon } from 'lucide-react'
import { exportAll, importAll, lastBackup, markBackedUp } from './lib/backup'
import { useApp, type Page } from './store'
import { cx } from './ui'
import Dashboard from './pages/Dashboard'
import Ledger from './pages/Ledger'
import Payments from './pages/Payments'
import Testing from './pages/Testing'
import Findings from './pages/Findings'
import Statements from './pages/Statements'
import Reports from './pages/Reports'

const ICONS: Record<Page, LucideIcon> = {
  Dashboard: LayoutDashboard, Ledger: BookOpenText, Payments: Wallet, Testing: ScanSearch,
  Findings: ShieldAlert, Statements: FileText, Reports: FileBarChart2,
}

const GROUPS: { title: string; pages: Page[] }[] = [
  { title: 'Overview', pages: ['Dashboard'] },
  { title: 'Records', pages: ['Ledger', 'Payments'] },
  { title: 'Audit', pages: ['Testing', 'Findings'] },
  { title: 'Output', pages: ['Statements', 'Reports'] },
]

// Bottom tabs on phones; the rest live under "More".
const TABS: Page[] = ['Dashboard', 'Ledger', 'Payments', 'Testing']

const PAGES: Record<Page, () => React.JSX.Element> = { Dashboard, Ledger, Payments, Testing, Findings, Statements, Reports }

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sage-300 via-sage-400 to-sage-500 text-sm font-extrabold text-sage-950 shadow-lg shadow-sage-500/40">LA</span>
      <span className="text-base font-extrabold tracking-tight text-white">Ledger Audit</span>
    </div>
  )
}

function NavList({ onPick }: { onPick: (p: Page) => void }) {
  const { page } = useApp()
  return (
    <nav className="space-y-5" aria-label="Main">
      {GROUPS.map((g) => (
        <div key={g.title}>
          <p className="mb-1.5 px-3 text-[11px] font-bold uppercase tracking-widest text-sage-300/70">{g.title}</p>
          <div className="space-y-0.5">
            {g.pages.map((p) => {
              const Icon = ICONS[p]
              const on = page === p
              return (
                <button key={p} onClick={() => onPick(p)} aria-current={on ? 'page' : undefined}
                  className={cx('flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition',
                    on ? 'bg-white/12 text-white shadow-inner ring-1 ring-white/15' : 'text-sage-100/80 hover:bg-white/8 hover:text-white')}>
                  <span className={cx('grid h-7 w-7 place-items-center rounded-lg', on ? 'bg-gradient-to-br from-sage-300 to-sage-400 text-sage-950' : 'text-sage-200/80')}>
                    <Icon size={16} strokeWidth={2.2} />
                  </span>
                  {p}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </nav>
  )
}

const daysAgo = (iso: string) => Math.floor((Date.now() - +new Date(iso)) / 86400000)

/** Back up = download one file with everything. Restore = load that file back (on any device). */
function BackupPanel() {
  const [last, setLast] = useState(lastBackup())
  const [busy, setBusy] = useState(false)
  const age = last ? daysAgo(last) : null
  const overdue = age === null || age >= 7

  const backUp = async () => {
    setBusy(true)
    try {
      const a = document.createElement('a')
      a.href = URL.createObjectURL(await exportAll())
      a.download = `ledger-audit-backup-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(a.href)
      markBackedUp(); setLast(lastBackup())
    } finally { setBusy(false) }
  }

  const restore = async (file: File) => {
    const text = await file.text()
    try {
      const when = JSON.parse(text)?.exportedAt?.slice(0, 10) ?? 'unknown date'
      if (!confirm(`Replace everything in this app with the backup from ${when}? Your current data here will be overwritten.`)) return
      await importAll(text)
      location.reload()
    } catch (e) {
      alert((e as Error).message.startsWith('Unexpected') ? 'This file is not a Ledger Audit backup.' : (e as Error).message)
    }
  }

  return (
    <div className="space-y-2">
      <p className={cx('flex items-center gap-1.5 text-xs font-semibold', overdue ? 'text-amber-300' : 'text-sage-200')}>
        {overdue ? <AlertTriangle size={14} /> : <ShieldCheck size={14} />}
        {age === null ? 'Not backed up yet' : age === 0 ? 'Backed up today' : `Last backup ${age} day${age > 1 ? 's' : ''} ago`}
      </p>
      <div className="grid grid-cols-2 gap-2">
        <button onClick={backUp} disabled={busy} className="inline-flex min-h-9 items-center justify-center gap-1.5 rounded-lg bg-white/15 px-2 text-xs font-bold text-white ring-1 ring-white/20 hover:bg-white/25 disabled:opacity-50">
          <Download size={14} /> {busy ? 'Saving…' : 'Back up'}
        </button>
        <label className="inline-flex min-h-9 cursor-pointer items-center justify-center gap-1.5 rounded-lg px-2 text-xs font-bold text-sage-100 ring-1 ring-white/20 hover:bg-white/10">
          <Upload size={14} /> Restore
          <input type="file" accept=".json,application/json" className="sr-only" onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) restore(f) }} />
        </label>
      </div>
    </div>
  )
}

export default function App() {
  const { page, setPage, eng } = useApp()
  const [more, setMore] = useState(false)
  const Current = PAGES[page]
  const last = lastBackup()
  const backupDue = !last || daysAgo(last) >= 7
  const go = (p: Page) => { setPage(p); setMore(false); window.scrollTo(0, 0) }
  const bg = 'bg-gradient-to-b from-sage-900 via-sage-950 to-sage-950'

  return (
    <div className="min-h-screen lg:flex">
      {/* Desktop sidebar */}
      <aside className={cx('no-print fixed inset-y-0 left-0 hidden w-64 flex-col px-3 py-5 lg:flex', bg)}>
        <div className="px-3 pb-6"><Logo /></div>
        <NavList onPick={go} />
        <div className="mt-auto space-y-2 rounded-xl bg-white/5 p-3 text-xs text-sage-200/80 ring-1 ring-white/10">
          <p className="font-bold text-white">{eng.client}</p>
          <BackupPanel />
        </div>
      </aside>

      {/* Phone top bar */}
      <header className={cx('no-print sticky top-0 z-30 flex items-center justify-between px-4 pb-3 pt-[calc(.75rem+env(safe-area-inset-top))] lg:hidden', bg)}>
        <Logo />
        <span className="max-w-[45%] truncate rounded-full bg-white/10 px-3 py-1 text-xs font-semibold text-sage-100">{eng.client}</span>
      </header>

      <main className="w-full px-4 pb-28 pt-5 md:px-8 md:pt-8 lg:ml-64 lg:max-w-[1400px] lg:pb-10">
        <Current />
      </main>

      {/* Phone bottom tabs */}
      <nav className="no-print fixed inset-x-0 bottom-0 z-50 border-t border-slate-200/80 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:hidden" aria-label="Quick">
        <div className="grid grid-cols-5">
          {[...TABS, 'More' as const].map((p) => {
            const on = p === 'More' ? more || !TABS.includes(page) : page === p && !more
            const Icon = p === 'More' ? LayoutGrid : ICONS[p]
            return (
              <button key={p} onClick={() => (p === 'More' ? setMore(!more) : go(p))} aria-current={on ? 'page' : undefined}
                className={cx('flex flex-col items-center gap-0.5 py-2 text-[11px] font-bold', on ? 'text-sage-600' : 'text-slate-500')}>
                <span className={cx('grid h-8 w-12 place-items-center rounded-full transition', on && 'bg-gradient-to-r from-sage-100 to-sage-100')}>
                  <Icon size={20} strokeWidth={on ? 2.5 : 2} />
                  {p === 'More' && backupDue && <span className="absolute ml-5 -mt-4 h-2.5 w-2.5 rounded-full bg-amber-400 ring-2 ring-white" aria-label="Backup due" />}
                </span>
                {p === 'Dashboard' ? 'Home' : p}
              </button>
            )
          })}
        </div>
      </nav>

      {/* Phone "More" sheet with all sections */}
      {more && (
        <div className="no-print fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="All sections">
          <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm" onClick={() => setMore(false)} />
          <div className={cx('absolute inset-x-0 bottom-0 rounded-t-3xl px-4 pb-[calc(5.5rem+env(safe-area-inset-bottom))] pt-4', bg)}>
            <div className="mb-4 flex items-center justify-between px-3">
              <p className="text-sm font-bold text-white">All sections</p>
              <button onClick={() => setMore(false)} aria-label="Close" className="rounded-full p-1.5 text-sage-200 hover:bg-white/10"><X size={20} /></button>
            </div>
            <NavList onPick={go} />
            <div className="mt-5 border-t border-white/10 px-3 pt-4"><BackupPanel /></div>
          </div>
        </div>
      )}
    </div>
  )
}
