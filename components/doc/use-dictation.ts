"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"

import { useT } from "@/lib/i18n/client"
import { N_ } from "@/lib/i18n/config"
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

type Vocabulary = {
  /** «nuovo paragrafo» e «a capo», nelle parole di chi detta */
  paragraph: string[]
  line: string[]
  /** l'ordine conta: «punto e virgola» prima di «punto» */
  punctuation: [string, string][]
}

/**
 * I comandi a voce di ogni lingua: la punteggiatura si detta a parole, come
 * nei programmi di videoscrittura.
 */
const VOCABULARY: Record<string, Vocabulary> = {
  it: {
    paragraph: ["nuovo paragrafo"],
    line: ["a capo", "nuova riga"],
    punctuation: [
      ["punto e virgola", ";"],
      ["punto interrogativo", "?"],
      ["punto esclamativo", "!"],
      ["puntini di sospensione", "…"],
      ["due punti", ":"],
      ["virgola", ","],
      ["punto", "."],
      ["apri parentesi", "("],
      ["chiudi parentesi", ")"],
      ["apri virgolette", "«"],
      ["chiudi virgolette", "»"],
      ["trattino", "-"],
    ],
  },
  en: {
    paragraph: ["new paragraph"],
    line: ["new line"],
    punctuation: [
      ["semicolon", ";"],
      ["question mark", "?"],
      ["exclamation mark", "!"],
      ["exclamation point", "!"],
      ["ellipsis", "…"],
      ["colon", ":"],
      ["comma", ","],
      ["full stop", "."],
      ["period", "."],
      ["open parenthesis", "("],
      ["close parenthesis", ")"],
      ["open quote", "“"],
      ["close quote", "”"],
      ["hyphen", "-"],
      ["dash", "-"],
    ],
  },
  es: {
    paragraph: ["nuevo párrafo", "punto y aparte"],
    line: ["nueva línea"],
    punctuation: [
      ["punto y coma", ";"],
      ["signo de interrogación", "?"],
      ["signo de exclamación", "!"],
      ["puntos suspensivos", "…"],
      ["dos puntos", ":"],
      ["coma", ","],
      ["punto", "."],
      ["abrir paréntesis", "("],
      ["cerrar paréntesis", ")"],
      ["abrir comillas", "«"],
      ["cerrar comillas", "»"],
      ["guion", "-"],
    ],
  },
  fr: {
    paragraph: ["nouveau paragraphe"],
    line: ["à la ligne", "nouvelle ligne"],
    punctuation: [
      ["point-virgule", ";"],
      ["point virgule", ";"],
      ["point d'interrogation", "?"],
      ["point d'exclamation", "!"],
      ["points de suspension", "…"],
      ["deux-points", ":"],
      ["deux points", ":"],
      ["virgule", ","],
      ["point", "."],
      ["ouvrir la parenthèse", "("],
      ["fermer la parenthèse", ")"],
      ["ouvrir les guillemets", "«"],
      ["fermer les guillemets", "»"],
      ["tiret", "-"],
    ],
  },
  de: {
    paragraph: ["neuer Absatz"],
    line: ["neue Zeile"],
    punctuation: [
      ["Semikolon", ";"],
      ["Fragezeichen", "?"],
      ["Ausrufezeichen", "!"],
      ["Auslassungspunkte", "…"],
      ["Doppelpunkt", ":"],
      ["Komma", ","],
      ["Punkt", "."],
      ["Klammer auf", "("],
      ["Klammer zu", ")"],
      ["Anführungszeichen unten", "„"],
      ["Anführungszeichen oben", "“"],
      ["Bindestrich", "-"],
    ],
  },
  pt: {
    paragraph: ["novo parágrafo"],
    line: ["nova linha"],
    punctuation: [
      ["ponto e vírgula", ";"],
      ["ponto de interrogação", "?"],
      ["ponto de exclamação", "!"],
      ["reticências", "…"],
      ["dois pontos", ":"],
      ["vírgula", ","],
      ["ponto final", "."],
      ["ponto", "."],
      ["abre parênteses", "("],
      ["fecha parênteses", ")"],
      ["abre aspas", "“"],
      ["fecha aspas", "”"],
      ["hífen", "-"],
    ],
  },
}

const escape = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
/** una parola intera anche con le lettere accentate */
const word = (phrase: string) =>
  `(?<![\\p{L}])${escape(phrase).replace(/ /g, "\\s+")}(?![\\p{L}])`

type Piece = { text: string } | { command: "paragraph" | "line" }

/** Trasforma una frase dettata in testo e comandi */
function parseDictation(raw: string, language: string): Piece[] {
  const vocabulary = VOCABULARY[language.slice(0, 2)] ?? VOCABULARY.en!
  const out: Piece[] = []
  const commands = [...vocabulary.paragraph, ...vocabulary.line]
  const splitter = new RegExp(`(${commands.map(word).join("|")})`, "giu")
  for (const part of raw.split(splitter)) {
    const lower = part.trim().toLocaleLowerCase()
    if (vocabulary.paragraph.some((c) => c.toLocaleLowerCase() === lower)) {
      out.push({ command: "paragraph" })
      continue
    }
    if (vocabulary.line.some((c) => c.toLocaleLowerCase() === lower)) {
      out.push({ command: "line" })
      continue
    }
    let text = part
    for (const [phrase, symbol] of vocabulary.punctuation) {
      text = text.replace(new RegExp(word(phrase), "giu"), symbol)
    }
    text = text
      // niente spazio prima della punteggiatura e dopo le aperture
      .replace(/\s+([,.;:!?…)»”])/g, "$1")
      .replace(/([(«“„])\s+/g, "$1")
      .replace(/\s{2,}/g, " ")
      .trim()
    if (text) out.push({ text })
  }
  return out
}

const MESSAGES: Record<string, string> = {
  "not-allowed": N_(
    "Il browser non ha il permesso di usare il microfono: consentilo dall'icona accanto all'indirizzo della pagina."
  ),
  "service-not-allowed": N_(
    "Il browser non permette la dettatura su questa pagina."
  ),
  "audio-capture": N_("Nessun microfono trovato."),
  network: N_(
    "La dettatura del browser ha bisogno di internet su questo dispositivo."
  ),
  "language-not-supported": N_(
    "La lingua del documento non è disponibile per la dettatura."
  ),
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
  onInfo?: (message: string) => void,
  /** la lingua del documento, «it-IT», «en-US»… */
  language = "it-IT"
): Dictation {
  const t = useT()
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
  // si sta chiedendo al browser se la lingua è sul dispositivo: un secondo
  // clic in quel momento annulla, invece di aprire due sessioni insieme
  const starting = React.useRef(false)

  React.useEffect(
    () => () => {
      wanted.current = false
      starting.current = false
      rec.current?.abort()
    },
    []
  )

  const insert = React.useCallback(
    (transcript: string) => {
      if (!editor || editor.isDestroyed) return
      for (const piece of parseDictation(transcript, language)) {
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
        // come testo: una stringa passata a insertContent si legge come HTML,
        // e «a <b» detto a voce diventava un grassetto
        editor
          .chain()
          .focus()
          .insertContent({ type: "text", text: glue + text })
          .run()
      }
    },
    [editor, language]
  )

  const toggle = React.useCallback(() => {
    if (starting.current) {
      starting.current = false
      return
    }
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
      starting.current = false
      const r = new Ctor()
      r.lang = language
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
        onError?.(
          MESSAGES[e.error] ? t(MESSAGES[e.error]!) : t("Dettatura interrotta.")
        )
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
        onError?.(t("La dettatura non è partita: riprova."))
      }
    }

    // sul dispositivo quando c'è; se si può scaricare lo si fa per la
    // prossima volta e intanto si usa quello del browser
    if (typeof Ctor.available === "function") {
      starting.current = true
      Ctor.available({ langs: [language], processLocally: true })
        .then((status) => {
          // annullata con un secondo clic mentre si aspettava la risposta
          if (!starting.current) return
          if (status === "available") return begin(true)
          if (status === "downloadable" && typeof Ctor.install === "function") {
            onInfo?.(
              t(
                "Scarico la lingua del documento per dettare anche senza internet: servirà dalla prossima volta."
              )
            )
            Ctor.install({ langs: [language], processLocally: true }).catch(
              () => {}
            )
          }
          begin(false)
        })
        .catch(() => starting.current && begin(false))
      return
    }
    begin(false)
  }, [editor, listening, insert, onError, onInfo, t, language])

  return { supported, listening, interim, local, toggle }
}
