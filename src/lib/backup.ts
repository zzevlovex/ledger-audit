// Backup file: everything in one JSON file. Receipt images are stored inside it as base64.
import { db, STORES, type StoreName } from './db'

const APP = 'ledger-audit'
const VERSION = 1
type Dump = Record<StoreName, Record<string, unknown>[]>

async function blobToDataUrl(b: Blob): Promise<string> {
  const bytes = new Uint8Array(await b.arrayBuffer())
  let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return `data:${b.type || 'application/octet-stream'};base64,${btoa(bin)}`
}

function dataUrlToBlob(u: string): Blob {
  const m = /^data:([^;,]*);base64,(.*)$/.exec(u)
  if (!m) throw new Error('A receipt image in the backup is damaged.')
  const bin = atob(m[2])
  const bytes = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
  return new Blob([bytes], { type: m[1] })
}

/** Turn stored records into backup-file text. */
export async function makeBackup(dump: Dump): Promise<string> {
  const payments = await Promise.all(dump.payments.map(async (p) => ({ ...p, image: p.image instanceof Blob ? await blobToDataUrl(p.image) : null })))
  return JSON.stringify({ app: APP, version: VERSION, exportedAt: new Date().toISOString(), stores: { ...dump, payments } })
}

/** Check and decode backup-file text. Throws a readable error if the file isn't a valid backup. */
export function readBackup(text: string): Dump {
  let f: { app?: unknown; version?: unknown; stores?: Record<string, unknown> }
  try { f = JSON.parse(text) } catch { throw new Error('This file is not a Ledger Audit backup.') }
  if (f?.app !== APP || !f.stores) throw new Error('This file is not a Ledger Audit backup.')
  if (typeof f.version !== 'number' || f.version > VERSION) throw new Error('This backup was made by a newer version of the app.')
  const dump = {} as Dump
  for (const s of STORES) {
    const rows = f.stores[s]
    if (!Array.isArray(rows) || rows.some((r) => typeof r?.id !== 'string')) throw new Error(`The backup's "${s}" section is damaged.`)
    dump[s] = rows
  }
  if (!dump.engagements.length) throw new Error('The backup has no company in it.')
  dump.payments = dump.payments.map((p) => ({ ...p, image: typeof p.image === 'string' ? dataUrlToBlob(p.image) : null }))
  return dump
}

export async function exportAll(): Promise<Blob> {
  const dump = {} as Dump
  for (const s of STORES) dump[s] = (await db.all(s)) as unknown as Record<string, unknown>[]
  return new Blob([await makeBackup(dump)], { type: 'application/json' })
}

/** Replace everything in this browser with the backup. Validates fully before deleting anything. */
export async function importAll(text: string) {
  const dump = readBackup(text)
  for (const s of STORES) await db.clear(s)
  for (const s of STORES) for (const r of dump[s]) await db.put(s, r as never)
}

const LAST = 'last-backup'
export const lastBackup = () => localStorage.getItem(LAST)
export const markBackedUp = () => localStorage.setItem(LAST, new Date().toISOString())
