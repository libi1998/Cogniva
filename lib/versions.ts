"use client"

import { nanoid } from "nanoid"

/**
 * «Cronologia versioni», come in Word — ma senza cloud: le versioni restano
 * in questo browser, accanto ai file.
 *
 * Stanno in un database loro (`cogniva-versions`) invece che in quello dello
 * spazio di lavoro: la prima lettura dei file parte dallo script in testa alla
 * pagina (boot-script.ts) ed è la cosa più importante che succede all'avvio.
 * Tenere la cronologia separata vuol dire non toccare quella strada, non
 * cambiare la versione di quel database e non rischiare che una cronologia
 * rovinata impedisca di aprire i documenti.
 */

const DB_NAME = "cogniva-versions"
const DB_VERSION = 1
const STORE = "versions"
const BY_FILE = "fileId"

/** Quante versioni si tengono per documento */
const KEEP_AUTO = 20
const KEEP_MANUAL = 40

export type VersionKind = "auto" | "manual"

export type DocVersion = {
  id: string
  fileId: string
  createdAt: number
  kind: VersionKind
  /** il nome dato a mano, vuoto per quelle automatiche */
  label: string
  author: string
  words: number
  /** il contenuto del documento, come lo salva l'editor */
  content: unknown
}

/** Una versione senza il contenuto: per l'elenco basta questa */
export type VersionInfo = Omit<DocVersion, "content">

export const versionsAvailable = () => typeof indexedDB !== "undefined"

let dbPromise: Promise<IDBDatabase> | null = null

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      const store = db.objectStoreNames.contains(STORE)
        ? request.transaction!.objectStore(STORE)
        : db.createObjectStore(STORE, { keyPath: "id" })
      if (!store.indexNames.contains(BY_FILE)) {
        store.createIndex(BY_FILE, BY_FILE, { unique: false })
      }
    }
    request.onsuccess = () => {
      const db = request.result
      // il browser può chiudere la connessione: si riapre alla prossima volta
      db.onclose = () => {
        dbPromise = null
      }
      db.onversionchange = () => {
        db.close()
        dbPromise = null
      }
      resolve(db)
    }
    const fail = (error: unknown) => {
      dbPromise = null
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    request.onerror = () => fail(request.error)
    request.onblocked = () => fail(new Error("blocked"))
  })
  return dbPromise
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("abort"))
  })
}

function strip(v: DocVersion): VersionInfo {
  const { content, ...rest } = v
  void content
  return rest
}

/** Tutte le versioni di un documento, dalla più recente */
export async function listVersions(fileId: string): Promise<VersionInfo[]> {
  if (!versionsAvailable()) return []
  const db = await openDb()
  const tx = db.transaction(STORE, "readonly")
  const request = tx.objectStore(STORE).index(BY_FILE).getAll(fileId)
  await done(tx)
  return (request.result as DocVersion[])
    .map(strip)
    .sort((a, b) => b.createdAt - a.createdAt)
}

export async function getVersion(id: string): Promise<DocVersion | null> {
  if (!versionsAvailable()) return null
  const db = await openDb()
  const tx = db.transaction(STORE, "readonly")
  const request = tx.objectStore(STORE).get(id)
  await done(tx)
  return (request.result as DocVersion | undefined) ?? null
}

/** Conta le parole di un contenuto salvato, come «Conteggio parole» */
export function countWords(content: unknown) {
  let text = ""
  const walk = (node: unknown) => {
    if (!node || typeof node !== "object") return
    if (Array.isArray(node)) {
      node.forEach(walk)
      return
    }
    const n = node as { text?: unknown; content?: unknown }
    if (typeof n.text === "string") text += `${n.text} `
    if (n.content) walk(n.content)
  }
  walk(content)
  return (text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []).length
}

/**
 * Salva una versione e butta le più vecchie. Le versioni con un nome si
 * tengono più a lungo di quelle automatiche: le ha volute qualcuno.
 */
export async function saveVersion(v: {
  fileId: string
  kind: VersionKind
  label?: string
  author: string
  words: number
  content: unknown
}): Promise<VersionInfo | null> {
  if (!versionsAvailable()) return null
  const version: DocVersion = {
    id: nanoid(12),
    fileId: v.fileId,
    createdAt: Date.now(),
    kind: v.kind,
    label: v.label ?? "",
    author: v.author,
    words: v.words,
    content: v.content,
  }
  const db = await openDb()
  const tx = db.transaction(STORE, "readwrite")
  const store = tx.objectStore(STORE)
  store.put(version)
  const existing = store.index(BY_FILE).getAll(v.fileId)
  await done(tx)

  const all = [...(existing.result as DocVersion[]), version].sort(
    (a, b) => b.createdAt - a.createdAt
  )
  const extra = [
    ...all.filter((x) => x.kind === "auto").slice(KEEP_AUTO),
    ...all.filter((x) => x.kind === "manual").slice(KEEP_MANUAL),
  ]
  if (extra.length) await removeVersions(extra.map((x) => x.id))
  return strip(version)
}

export async function renameVersion(id: string, label: string) {
  if (!versionsAvailable()) return
  const db = await openDb()
  const tx = db.transaction(STORE, "readwrite")
  const store = tx.objectStore(STORE)
  const request = store.get(id)
  request.onsuccess = () => {
    const found = request.result as DocVersion | undefined
    if (found) store.put({ ...found, label, kind: "manual" as const })
  }
  await done(tx)
}

async function removeVersions(ids: string[]) {
  if (!ids.length || !versionsAvailable()) return
  const db = await openDb()
  const tx = db.transaction(STORE, "readwrite")
  const store = tx.objectStore(STORE)
  for (const id of ids) store.delete(id)
  await done(tx)
}

export const deleteVersion = (id: string) => removeVersions([id])

/** Quando un file sparisce per sempre, sparisce anche la sua cronologia */
export async function deleteVersionsOf(fileId: string) {
  if (!versionsAvailable()) return
  try {
    const db = await openDb()
    const tx = db.transaction(STORE, "readwrite")
    const store = tx.objectStore(STORE)
    const request = store.index(BY_FILE).getAllKeys(fileId)
    request.onsuccess = () => {
      for (const key of request.result) store.delete(key)
    }
    await done(tx)
  } catch {
    // una cronologia che non si cancella non deve bloccare l'eliminazione
  }
}
