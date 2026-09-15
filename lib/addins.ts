"use client"

import * as React from "react"
import { STORAGE, readStorage } from "./storage"

/**
 * I componenti aggiuntivi di Cogniva. Come in Word si aggiungono da una
 * raccolta e si aprono in un riquadro accanto al documento, ma sono tutti
 * scritti e verificati qui: nessun codice di terzi gira nella pagina. Quelli
 * che usano internet lo dicono e partono disattivati.
 */

export type AddinId =
  "qr" | "readability" | "placeholder" | "signature" | "wikipedia" | "openverse"

export type AddinInfo = {
  id: AddinId
  name: string
  tagline: string
  description: string
  category: "Contenuti" | "Scrittura" | "Ricerca"
  /** cosa può fare con il documento */
  permissions: string[]
  /** i servizi a cui si collega; nessuno = funziona offline */
  network: string[]
}

export const ADDINS: AddinInfo[] = [
  {
    id: "qr",
    name: "Codice QR",
    tagline: "Link, Wi-Fi, e-mail e telefono in un codice da inquadrare",
    description:
      "Crea codici QR a partire dal testo selezionato o da un indirizzo, con colori e correzione degli errori regolabili, e li inserisce come immagine.",
    category: "Contenuti",
    permissions: ["Legge la selezione", "Inserisce immagini"],
    network: [],
  },
  {
    id: "readability",
    name: "Leggibilità",
    tagline: "Indice Gulpease, Flesch e frasi da semplificare",
    description:
      "Misura quanto è facile leggere il documento con l'indice adatto alla lingua (Gulpease per l'italiano, Flesch per l'inglese…) e indica le frasi troppo lunghe.",
    category: "Scrittura",
    permissions: ["Legge il documento", "Seleziona il testo"],
    network: [],
  },
  {
    id: "placeholder",
    name: "Testo segnaposto",
    tagline: "Paragrafi di prova, come =lorem() in Word",
    description:
      "Genera testo di prova in italiano o lorem ipsum, anche con titoli ed elenchi, per impaginare prima di avere i contenuti.",
    category: "Scrittura",
    permissions: ["Inserisce testo"],
    network: [],
  },
  {
    id: "signature",
    name: "Firma",
    tagline: "Firma a mano con mouse, dito o penna",
    description:
      "Disegna una firma e la inserisce come immagine trasparente, ritagliata sul tratto.",
    category: "Contenuti",
    permissions: ["Inserisce immagini"],
    network: [],
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    tagline: "Cerca una voce e inserisci il riassunto con la fonte",
    description:
      "Cerca su Wikipedia nella lingua del documento e inserisce il riassunto della voce con l'attribuzione richiesta dalla licenza CC BY-SA.",
    category: "Ricerca",
    permissions: ["Legge la selezione", "Inserisce testo e collegamenti"],
    network: ["wikipedia.org"],
  },
  {
    id: "openverse",
    name: "Immagini libere",
    tagline: "Milioni di immagini Creative Commons da Openverse",
    description:
      "Cerca immagini con licenza Creative Commons o di pubblico dominio e le inserisce con autore e licenza nella didascalia.",
    category: "Ricerca",
    permissions: ["Inserisce immagini e didascalie"],
    network: ["api.openverse.org", "siti delle immagini"],
  },
]

export const addinInfo = (id: string) => ADDINS.find((a) => a.id === id) ?? null

const DEFAULT_ENABLED: AddinId[] = [
  "qr",
  "readability",
  "placeholder",
  "signature",
]

let cache: AddinId[] | null = null
const listeners = new Set<() => void>()

function read(): AddinId[] {
  if (cache) return cache
  try {
    const raw = readStorage(STORAGE.addins)
    const parsed = raw ? (JSON.parse(raw) as unknown) : null
    cache = Array.isArray(parsed)
      ? parsed.filter((id): id is AddinId => ADDINS.some((a) => a.id === id))
      : DEFAULT_ENABLED
  } catch {
    cache = DEFAULT_ENABLED
  }
  return cache
}

export function setAddinEnabled(id: AddinId, enabled: boolean) {
  const current = read()
  const next = enabled
    ? current.includes(id)
      ? current
      : [...current, id]
    : current.filter((x) => x !== id)
  cache = next
  try {
    localStorage.setItem(STORAGE.addins, JSON.stringify(next))
  } catch {
    // la scelta vale per questa sessione
  }
  listeners.forEach((l) => l())
}

export function useEnabledAddins() {
  return React.useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    read,
    () => DEFAULT_ENABLED
  )
}
