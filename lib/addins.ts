"use client"

import * as React from "react"
import { STORAGE, readStorage } from "./storage"

import { tr } from "@/lib/i18n/client"
/**
 * I componenti aggiuntivi di Cogniva. Come in Word si aggiungono da una
 * raccolta e si aprono in un riquadro accanto al documento, ma sono tutti
 * scritti e verificati qui: nessun codice di terzi gira nella pagina. Quelli
 * che usano internet lo dicono e partono disattivati.
 */

export type AddinId =
  "qr" | "readability" | "placeholder" | "signature" | "wikipedia" | "openverse"

export type AddinCategory = "content" | "writing" | "research"

export const CATEGORY_LABELS: Record<AddinCategory, string> = {
  get content() {
    return tr("Contenuti")
  },
  get writing() {
    return tr("Scrittura")
  },
  get research() {
    return tr("Ricerca")
  },
}

export type AddinInfo = {
  id: AddinId
  name: string
  tagline: string
  description: string
  category: AddinCategory
  /** cosa può fare con il documento */
  permissions: string[]
  /** i servizi a cui si collega; nessuno = funziona offline */
  network: string[]
}

export const ADDINS: AddinInfo[] = [
  {
    id: "qr",
    get name() {
      return tr("Codice QR")
    },
    get tagline() {
      return tr("Link, Wi-Fi, e-mail e telefono in un codice da inquadrare")
    },
    get description() {
      return tr(
        "Crea codici QR a partire dal testo selezionato o da un indirizzo, con colori e correzione degli errori regolabili, e li inserisce come immagine."
      )
    },
    category: "content",
    get permissions() {
      return [tr("Legge la selezione"), tr("Inserisce immagini")]
    },
    network: [],
  },
  {
    id: "readability",
    get name() {
      return tr("Leggibilità")
    },
    get tagline() {
      return tr("Indice Gulpease, Flesch e frasi da semplificare")
    },
    get description() {
      return tr(
        "Misura quanto è facile leggere il documento con l'indice adatto alla lingua (Gulpease per l'italiano, Flesch per l'inglese…) e indica le frasi troppo lunghe."
      )
    },
    category: "writing",
    get permissions() {
      return [tr("Legge il documento"), tr("Seleziona il testo")]
    },
    network: [],
  },
  {
    id: "placeholder",
    get name() {
      return tr("Testo segnaposto")
    },
    get tagline() {
      return tr("Paragrafi di prova, come =lorem() in Word")
    },
    get description() {
      return tr(
        "Genera testo di prova in italiano o lorem ipsum, anche con titoli ed elenchi, per impaginare prima di avere i contenuti."
      )
    },
    category: "writing",
    get permissions() {
      return [tr("Inserisce testo")]
    },
    network: [],
  },
  {
    id: "signature",
    get name() {
      return tr("Firma")
    },
    get tagline() {
      return tr("Firma a mano con mouse, dito o penna")
    },
    get description() {
      return tr(
        "Disegna una firma e la inserisce come immagine trasparente, ritagliata sul tratto."
      )
    },
    category: "content",
    get permissions() {
      return [tr("Inserisce immagini")]
    },
    network: [],
  },
  {
    id: "wikipedia",
    name: "Wikipedia",
    get tagline() {
      return tr("Cerca una voce e inserisci il riassunto con la fonte")
    },
    get description() {
      return tr(
        "Cerca su Wikipedia nella lingua del documento e inserisce il riassunto della voce con l'attribuzione richiesta dalla licenza CC BY-SA."
      )
    },
    category: "research",
    get permissions() {
      return [tr("Legge la selezione"), tr("Inserisce testo e collegamenti")]
    },
    network: ["wikipedia.org"],
  },
  {
    id: "openverse",
    get name() {
      return tr("Immagini libere")
    },
    get tagline() {
      return tr("Milioni di immagini Creative Commons da Openverse")
    },
    get description() {
      return tr(
        "Cerca immagini con licenza Creative Commons o di pubblico dominio e le inserisce con autore e licenza nella didascalia."
      )
    },
    category: "research",
    get permissions() {
      return [tr("Inserisce immagini e didascalie")]
    },
    get network() {
      return ["api.openverse.org", tr("siti delle immagini")]
    },
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
