/**
 * Chiavi del salvataggio nel browser. Cogniva nasce da un progetto che si
 * chiamava Whimsy: se nello stesso browser ci sono ancora i suoi dati, alla
 * prima lettura vengono copiati sotto le chiavi nuove.
 */
export const STORAGE = {
  workspace: "cogniva.workspace.v1",
  ribbon: "cogniva.doc.ribbon",
  author: "cogniva.author",
  recentFonts: "cogniva.fonts.recent",
  clipboard: "cogniva.clipboard",
  commands: "cogniva.commands.recent",
  /** i file d'esempio sono già stati creati una volta in questo browser */
  seeded: "cogniva.seeded",
  /** «Imposta come predefinito» della scheda Progettazione */
  docDefaults: "cogniva.doc.defaults",
  /** i componenti aggiuntivi attivati */
  addins: "cogniva.doc.addins",
  /** «Correzione automatica»: opzioni e tabella delle sostituzioni */
  autocorrect: "cogniva.doc.autocorrect",
  /** «Riprendi la lettura»: dove si era arrivati in ogni documento */
  resume: "cogniva.doc.resume",
  /** le cartelle della home create e ancora vuote */
  folders: "cogniva.folders",
} as const

const LEGACY: Partial<Record<string, string>> = {
  [STORAGE.workspace]: "whimsy.workspace.v1",
  [STORAGE.ribbon]: "whimsy.doc.ribbon",
  [STORAGE.author]: "whimsy.author",
  [STORAGE.recentFonts]: "whimsy.fonts.recent",
}

/** Legge una chiave, recuperando il valore della vecchia app se serve */
export function readStorage(key: string): string | null {
  try {
    const value = localStorage.getItem(key)
    if (value !== null) return value
    const legacy = LEGACY[key]
    const old = legacy ? localStorage.getItem(legacy) : null
    if (old !== null) localStorage.setItem(key, old)
    return old
  } catch {
    // modalità privata o spazio pieno: si parte da zero
    return null
  }
}

export function writeStorage(key: string, value: string) {
  try {
    localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}
