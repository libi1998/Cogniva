import { tr } from "@/lib/i18n/client"
/**
 * Dal testo ai fonemi con espeak-ng (piper-phonemize compilato in
 * WebAssembly). Il codice arriva dalla sua CDN pubblica, a una versione
 * fissa e con l'impronta SRI: il browser lo rifiuta se cambia anche di un byte.
 */

export const PHONEMIZER_BASE =
  "https://cdn.jsdelivr.net/npm/@diffusionstudio/piper-wasm@1.0.0/build/"
const SCRIPT = `${PHONEMIZER_BASE}piper_phonemize.js`
const INTEGRITY =
  "sha384-PMufGRTCTqKC0tPjOTp2UFXycN+yWWjDareOeoy106zJZAHPijaeHDAX/4Pi0I5S"

type PhonemizeModule = { callMain: (args: string[]) => number }
type CreatePhonemize = (options: {
  print: (line: string) => void
  printErr: (line: string) => void
  locateFile: (file: string) => string
}) => Promise<PhonemizeModule>

let ready: Promise<PhonemizeModule> | null = null
let listener: ((line: string) => void) | null = null

function loadScript() {
  return new Promise<CreatePhonemize>((resolve, reject) => {
    const existing = (
      window as unknown as { createPiperPhonemize?: CreatePhonemize }
    ).createPiperPhonemize
    if (existing) return resolve(existing)
    const script = document.createElement("script")
    script.src = SCRIPT
    script.integrity = INTEGRITY
    script.crossOrigin = "anonymous"
    script.async = true
    script.onload = () => {
      const create = (
        window as unknown as { createPiperPhonemize?: CreatePhonemize }
      ).createPiperPhonemize
      if (create) resolve(create)
      else reject(new Error(tr("Fonetizzatore non disponibile")))
    }
    script.onerror = () =>
      reject(
        new Error(
          tr(
            "Non riesco a scaricare il fonetizzatore: serve la rete la prima volta."
          )
        )
      )
    document.head.append(script)
  })
}

export function loadPhonemizer() {
  if (!ready) {
    ready = loadScript()
      .then((create) =>
        create({
          print: (line) => listener?.(line),
          printErr: () => {
            // espeak avvisa per parole che non conosce: non è un errore
          },
          locateFile: (file) => `${PHONEMIZER_BASE}${file}`,
        })
      )
      .catch((error: unknown) => {
        ready = null
        throw error
      })
  }
  return ready
}

/** Gli identificativi dei fonemi di una frase, per il modello della voce */
export async function phonemize(text: string, espeakVoice: string) {
  const phonemizer = await loadPhonemizer()
  const ids: number[] = []
  listener = (line) => {
    try {
      const parsed = JSON.parse(line) as { phoneme_ids?: number[] }
      if (parsed.phoneme_ids) ids.push(...parsed.phoneme_ids)
    } catch {
      // righe che non sono il risultato
    }
  }
  try {
    phonemizer.callMain([
      "-l",
      espeakVoice,
      "--input",
      JSON.stringify([{ text }]),
      "--espeak_data",
      "/espeak-ng-data",
    ])
  } finally {
    listener = null
  }
  return ids
}
