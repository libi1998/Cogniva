"use client"

import { DB_FILES, DB_NAME, DB_VERSION } from "./boot-script"
import type { WFile } from "./types"

/**
 * Salvataggio in IndexedDB, un record per file.
 *
 * localStorage tiene pochi megabyte e obbliga a riscrivere tutto lo spazio di
 * lavoro a ogni battuta: con qualche immagine incollata il salvataggio
 * falliva. Qui ogni file è un record a sé, si scrivono solo quelli cambiati e
 * lo spazio disponibile è quello del disco.
 *
 * La prima lettura la comincia già lo script in testa alla pagina
 * (boot-script.ts): qui si riusano la sua connessione e i suoi risultati.
 */

type Boot = Promise<{ db: IDBDatabase; files: WFile[] }>

declare global {
  interface Window {
    __cogniva?: Boot
  }
}

const FILES = DB_FILES

let dbPromise: Promise<IDBDatabase> | null = null

/** La lettura cominciata dallo script di avvio, consumata una volta sola */
function takeBoot(): Boot | null {
  if (typeof window === "undefined" || !window.__cogniva) return null
  const boot = window.__cogniva
  window.__cogniva = undefined
  return boot
}

/**
 * Se il browser chiude la connessione (dati del sito cancellati, un'altra
 * scheda che aggiorna il database) la si riapre alla scrittura successiva,
 * invece di fallire per sempre.
 */
function track(db: IDBDatabase) {
  const reset = () => {
    dbPromise = null
  }
  db.onclose = reset
  db.onversionchange = () => {
    db.close()
    reset()
  }
  return db
}

function openDb(): Promise<IDBDatabase> {
  dbPromise ??= new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)
    request.onupgradeneeded = () => {
      const db = request.result
      if (!db.objectStoreNames.contains(FILES)) {
        db.createObjectStore(FILES, { keyPath: "id" })
      }
    }
    request.onsuccess = () => resolve(track(request.result))
    request.onerror = () => {
      dbPromise = null
      reject(request.error)
    }
    request.onblocked = () => {
      dbPromise = null
      reject(new Error("Database bloccato"))
    }
  })
  return dbPromise
}

function done(tx: IDBTransaction) {
  return new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve()
    tx.onerror = () => reject(tx.error)
    tx.onabort = () => reject(tx.error ?? new Error("Salvataggio interrotto"))
  })
}

export function persistenceAvailable() {
  return typeof indexedDB !== "undefined"
}

/** Tutti i file salvati, oppure null se il database è ancora vuoto */
export async function loadFiles(): Promise<WFile[] | null> {
  const boot = takeBoot()
  if (boot) {
    try {
      const { db, files } = await boot
      dbPromise ??= Promise.resolve(track(db))
      return files.length ? files : null
    } catch {
      // lo script di avvio non ce l'ha fatta (modalità privata, database
      // bloccato): si riprova per la strada normale
    }
  }
  const db = await openDb()
  const tx = db.transaction(FILES, "readonly")
  const request = tx.objectStore(FILES).getAll()
  await done(tx)
  const files = request.result as WFile[]
  return files.length ? files : null
}

/** Scrive i file cambiati e toglie quelli eliminati, in un'unica transazione */
export async function saveFiles(changed: WFile[], removed: string[]) {
  if (!changed.length && !removed.length) return
  const db = await openDb()
  const tx = db.transaction(FILES, "readwrite")
  const store = tx.objectStore(FILES)
  for (const file of changed) store.put(file)
  for (const id of removed) store.delete(id)
  await done(tx)
}

/**
 * Chiede al browser di non cancellare i dati quando lo spazio scarseggia:
 * senza, uno spazio di lavoro può sparire dopo settimane di inattività.
 */
export async function requestPersistence() {
  try {
    if (
      navigator.storage?.persisted &&
      !(await navigator.storage.persisted())
    ) {
      await navigator.storage.persist?.()
    }
  } catch {
    // non tutti i browser lo permettono: si continua lo stesso
  }
}
