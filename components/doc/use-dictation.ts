"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"

export type Dictation = {
  supported: boolean
  listening: boolean
  /** quello che si sta dicendo, prima che il browser lo confermi */
  interim: string
  /** il riconoscimento avviene sul dispositivo, senza internet */
  local: boolean
  toggle: () => void
}

type RecognitionResult = { isFinal: boolean; 0: { transcript: string } }

type Recognition = {
  lang: string
  continuous: boolean
  interimResults: boolean
  processLocally?: boolean
  start: () => void
  stop: () => void
  abort: () => void
  onresult:
    | ((e: {
        resultIndex: number
        results: ArrayLike<RecognitionResult>
      }) => void)
    | null
  onend: (() => void) | null
  onerror: ((e: { error: string }) => void) | null
}

type RecognitionCtor = (new () => Recognition) & {
  /** Chrome: riconoscimento sul dispositivo */
  available?: (options: {
    langs: string[]
    processLocally: boolean
  }) => Promise<"available" | "downloadable" | "downloading" | "unavailable">
  install?: (options: {
    langs: string[]
    processLocally: boolean
  }) => Promise<boolean>
}

function recognitionClass(): RecognitionCtor | null {
  if (typeof window === "undefined") return null
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

const subscribeNever = () => () => {}

/**
 * Comandi a voce di Word in italiano: la punteggiatura si detta a parole.
 * L'ordine conta: «punto e virgola» prima di «punto».
 */
const PUNCTUATION: [RegExp, string][] = [
  [/\bpunto e virgola\b/gi, ";"],
  [/\bpunto interrogativo\b/gi, "?"],
  [/\bpunto esclamativo\b/gi, "!"],
  [/\bpuntini di sospensione\b/gi, "…"],
  [/\bdue punti\b/gi, ":"],
  [/\bvirgola\b/gi, ","],
  [/\bpunto\b/gi, "."],
  [/\bapri parentesi\b/gi, "("],
  [/\bchiudi parentesi\b/gi, ")"],
  [/\bapri virgolette\b/gi, "«"],
  [/\bchiudi virgolette\b/gi, "»"],
  [/\btrattino\b/gi, "-"],
]

type Piece = { text: string } | { command: "paragraph" | "line" }

/** Trasforma una frase dettata in testo e comandi */
function parseDictation(raw: string): Piece[] {
  const out: Piece[] = []
  const parts = raw.split(/\b(nuovo paragrafo|a capo|nuova riga)\b/i)
  for (const part of parts) {
    const lower = part.trim().toLowerCase()
    if (lower === "nuovo paragrafo") {
      out.push({ command: "paragraph" })
      continue
    }
    if (lower === "a capo" || lower === "nuova riga") {
      out.push({ command: "line" })
      continue
    }
    let text = part
    for (const [re, symbol] of PUNCTUATION) text = text.replace(re, symbol)
    text = text
      // niente spazio prima della punteggiatura e dopo le aperture
      .replace(/\s+([,.;:!?…)»])/g, "$1")
      .replace(/([(«])\s+/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
    if (text) out.push({ text })
  }
  return out
}

const MESSAGES: Record<string, string> = {
  "not-allowed":
    "Il browser non ha il permesso di usare il microfono: consentilo dall'icona accanto all'indirizzo della pagina.",
  "service-not-allowed":
    "Il browser non permette la dettatura su questa pagina.",
  "audio-capture": "Nessun microfono trovato.",
  network:
    "La dettatura del browser ha bisogno di internet su questo dispositivo.",
  "language-not-supported": "L'italiano non è disponibile per la dettatura.",
}

/**
 * Dettatura come in Word: si parla e il testo compare dove c'è il cursore.
 *
 * Usa il riconoscimento vocale del browser in italiano. Dove il browser lo
 * permette (Chrome recente) il riconoscimento avviene sul dispositivo, senza
 * mandare l'audio in rete. La sessione riparte da sola dopo le pause, e la
 * punteggiatura si detta a parole («virgola», «punto», «a capo»).
 */
export function useDictation(
  editor: Editor | null,
  onError?: (message: string) => void,
  onInfo?: (message: string) => void
): Dictation {
  const supported = React.useSyncExternalStore(
    subscribeNever,
    () => recognitionClass() !== null,
    () => false
  )
  const [listening, setListening] = React.useState(false)
  const [interim, setInterim] = React.useState("")
  const [local, setLocal] = React.useState(false)
  const rec = React.useRef<Recognition | null>(null)
  // l'utente vuole ascoltare: il browser chiude le sessioni dopo una pausa e
  // qui si riaprono
  const wanted = React.useRef(false)

  React.useEffect(
    () => () => {
      wanted.current = false
      rec.current?.abort()
    },
    []
  )

  const insert = React.useCallback(
    (transcript: string) => {
      if (!editor || editor.isDestroyed) return
      for (const piece of parseDictation(transcript)) {
        if ("command" in piece) {
          const chain = editor.chain().focus()
          if (piece.command === "paragraph") chain.splitBlock().run()
          else chain.setHardBreak().run()
          continue
        }
        const { state } = editor
        const { from, $from } = state.selection
        const before = state.doc.textBetween(
          Math.max($from.start(), from - 2),
          from
        )
        let text = piece.text
        // maiuscola a inizio paragrafo e dopo un punto
        if (!before.trim() || /[.!?…]\s*$/.test(before)) {
          text = text.charAt(0).toUpperCase() + text.slice(1)
        }
        const glue =
          before && !/\s$/.test(before) && !/^[,.;:!?…)»]/.test(text) ? " " : ""
        editor
          .chain()
          .focus()
          .insertContent(glue + text)
          .run()
      }
    },
    [editor]
  )

  const toggle = React.useCallback(() => {
    if (wanted.current || listening) {
      wanted.current = false
      rec.current?.stop()
      setListening(false)
      setInterim("")
      return
    }
    const Ctor = recognitionClass()
    if (!Ctor || !editor) return

    const begin = (processLocally: boolean) => {
      const r = new Ctor()
      r.lang = "it-IT"
      r.continuous = true
      r.interimResults = true
      if (processLocally && "processLocally" in r) r.processLocally = true
      r.onresult = (e) => {
        let pending = ""
        for (let i = e.resultIndex; i < e.results.length; i += 1) {
          const result = e.results[i]
          const text = result[0].transcript
          if (result.isFinal) insert(text)
          else pending += text
        }
        setInterim(pending.trim())
      }
      r.onerror = (e) => {
        if (e.error === "aborted" || e.error === "no-speech") return
        wanted.current = false
        onError?.(MESSAGES[e.error] ?? "Dettatura interrotta.")
      }
      r.onend = () => {
        setInterim("")
        if (wanted.current) {
          try {
            r.start()
            return
          } catch {
            // se non riparte si chiude
          }
        }
        wanted.current = false
        setListening(false)
      }
      rec.current = r
      wanted.current = true
      setLocal(processLocally)
      try {
        r.start()
        setListening(true)
      } catch {
        wanted.current = false
        onError?.("La dettatura non è partita: riprova.")
      }
    }

    // sul dispositivo quando c'è; se si può scaricare lo si fa per la
    // prossima volta e intanto si usa quello del browser
    if (typeof Ctor.available === "function") {
      Ctor.available({ langs: ["it-IT"], processLocally: true })
        .then((status) => {
          if (status === "available") return begin(true)
          if (status === "downloadable" && typeof Ctor.install === "function") {
            onInfo?.(
              "Scarico l'italiano per dettare anche senza internet: servirà dalla prossima volta."
            )
            Ctor.install({ langs: ["it-IT"], processLocally: true }).catch(
              () => {}
            )
          }
          begin(false)
        })
        .catch(() => begin(false))
      return
    }
    begin(false)
  }, [editor, listening, insert, onError, onInfo])

  return { supported, listening, interim, local, toggle }
}
