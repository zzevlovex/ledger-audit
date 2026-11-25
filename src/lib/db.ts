// Minimal IndexedDB wrapper. Data stays in this browser only; nothing is sent anywhere.
import type { Engagement, Entry, Finding, Payment } from './types'

export interface Stores {
  engagements: Engagement
  ledgers: { id: string; entries: Entry[]; fileName: string; importedAt: string }
  payments: Payment
  findings: Finding
}
type Name = keyof Stores
const NAMES: Name[] = ['engagements', 'ledgers', 'payments', 'findings']

let dbp: Promise<IDBDatabase> | null = null
function open(): Promise<IDBDatabase> {
  return (dbp ??= new Promise((res, rej) => {
    const req = indexedDB.open('ledger-audit', 1)
    req.onupgradeneeded = () => NAMES.forEach((n) => req.result.createObjectStore(n, { keyPath: 'id' }))
    req.onsuccess = () => res(req.result)
    req.onerror = () => rej(req.error)
  }))
}

async function tx<T>(name: Name, mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const db = await open()
  return new Promise((res, rej) => {
    const r = fn(db.transaction(name, mode).objectStore(name))
    r.onsuccess = () => res(r.result as T)
    r.onerror = () => rej(r.error)
  })
}

export const db = {
  all: <N extends Name>(n: N) => tx<Stores[N][]>(n, 'readonly', (s) => s.getAll()),
  get: <N extends Name>(n: N, id: string) => tx<Stores[N] | undefined>(n, 'readonly', (s) => s.get(id)),
  put: <N extends Name>(n: N, v: Stores[N]) => tx(n, 'readwrite', (s) => s.put(v)),
  del: (n: Name, id: string) => tx(n, 'readwrite', (s) => s.delete(id)),
  clear: (n: Name) => tx(n, 'readwrite', (s) => s.clear()),
}

export const STORES: Name[] = NAMES
export type StoreName = Name

export const uid = () => crypto.randomUUID()
