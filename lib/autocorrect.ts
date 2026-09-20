"use client"

import * as React from "react"
import { Extension, InputRule } from "@tiptap/core"
import { STORAGE, readStorage, writeStorage } from "./storage"

/**
 * Correzione automatica, come «Opzioni correzione automatica» di Word.
 *
 * Mentre si scrive, le virgolette diventano tipografiche, i trattini doppi
 * diventano lineette, «(c)» diventa ©, la prima lettera della frase diventa
 * maiuscola e le parole della tabella si sostituiscono da sole. Tutto passa
 * dalle regole di input di Tiptap, che il browser applica solo sul testo
 * appena battuto: blocchi di codice e testo `codice` restano intatti perché
 * Tiptap li salta da sé.
 *
 * Le preferenze sono di chi scrive, non del documento: vivono nel browser
 * come il nome dell'autore (vedi author.ts). Le regole le leggono dalla
 * memoria dell'editor a ogni battuta, così cambiarle ha effetto subito senza
 * ricreare l'editor.
 */

export type AutoCorrectSettings = {
  /** interruttore generale: spento, non si tocca niente */
  enabled: boolean
  /** virgolette tipografiche, nella forma della lingua del documento */
  quotes: boolean
  /** `--` → –, `---` → — */
  dashes: boolean
  /** `...` → … */
  ellipsis: boolean
  /** `(c)` → ©, `-->` → →, `:)` → 🙂 */
  symbols: boolean
  /** `1/2` → ½ */
  fractions: boolean
  /** `1st` → 1ˢᵗ (inglese), `1o` → 1º (italiano, spagnolo, portoghese) */
  ordinals: boolean
  /** prima lettera della frase maiuscola */
  sentenceCase: boolean
  /** «DUe iniziali maiuscole» → «Due iniziali maiuscole» */
  twoInitials: boolean
  /** la tabella «sostituisci → con» */
  replaceText: boolean
  replacements: Record<string, string>
  /** la lingua del documento: decide virgolette, ordinali e abbreviazioni */
  language: string
}

/* ------------------------------ virgolette ------------------------------- */

type QuoteSet = { open: string; close: string; sOpen: string; sClose: string }

/**
 * Le virgolette che usa ogni lingua, come fa Word: alte quasi ovunque,
 * caporali con lo spazio unificatore in francese, basse in tedesco.
 */
const QUOTES: Record<string, QuoteSet> = {
  default: { open: "“", close: "”", sOpen: "‘", sClose: "’" },
  fr: { open: "« ", close: " »", sOpen: "‹ ", sClose: " ›" },
  de: { open: "„", close: "“", sOpen: "‚", sClose: "‘" },
}

const langOf = (language: string) => language.slice(0, 2).toLowerCase()

export const quoteSet = (language: string): QuoteSet =>
  QUOTES[langOf(language)] ?? QUOTES.default

/* -------------------------------- simboli -------------------------------- */

/** Le sostituzioni immediate: valgono appena si batte l'ultimo carattere */
const SYMBOLS: Record<string, string> = {
  "(c)": "©",
  "(C)": "©",
  "(r)": "®",
  "(R)": "®",
  "(tm)": "™",
  "(TM)": "™",
  "(e)": "€",
  "-->": "→",
  "<--": "←",
  "<->": "↔",
  "==>": "⇒",
  "<==": "⇐",
  "<=>": "⇔",
  ":)": "🙂",
  ":-)": "🙂",
  ":(": "🙁",
  ":-(": "🙁",
  ";)": "😉",
  ":D": "😃",
}

const FRACTIONS: Record<string, string> = {
  "1/2": "½",
  "1/3": "⅓",
  "2/3": "⅔",
  "1/4": "¼",
  "3/4": "¾",
}

/* ----------------------------- abbreviazioni ----------------------------- */

/**
 * Parole che finiscono con il punto senza chiudere la frase: dopo di loro la
 * maiuscola automatica non scatta, come le «Eccezioni» di Word.
 */
const ABBREVIATIONS: Record<string, string[]> = {
  it: [
    "ecc",
    "es",
    "cfr",
    "pag",
    "pagg",
    "sig",
    "sigg",
    "dott",
    "prof",
    "avv",
    "ing",
    "arch",
    "art",
    "artt",
    "fig",
    "tab",
    "vol",
    "cap",
    "n",
    "nn",
    "p",
    "pp",
    "sec",
    "ca",
    "circa",
    "etc",
    "ad",
    "op",
    "cit",
    "vs",
    "a",
    "c",
    "d",
    "s",
    "v",
  ],
  en: [
    "etc",
    "e.g",
    "eg",
    "i.e",
    "ie",
    "mr",
    "mrs",
    "ms",
    "dr",
    "prof",
    "st",
    "jr",
    "sr",
    "vs",
    "fig",
    "no",
    "vol",
    "p",
    "pp",
    "ca",
    "approx",
    "inc",
    "ltd",
    "dept",
    "cf",
    "al",
  ],
  es: [
    "etc",
    "ej",
    "p.ej",
    "sr",
    "sra",
    "srta",
    "dr",
    "dra",
    "prof",
    "pág",
    "pag",
    "núm",
    "num",
    "vol",
    "fig",
    "cap",
    "art",
  ],
  fr: [
    "etc",
    "ex",
    "p.ex",
    "m",
    "mme",
    "mlle",
    "dr",
    "prof",
    "cf",
    "fig",
    "vol",
    "chap",
    "art",
    "env",
    "p",
    "pp",
  ],
  de: [
    "bzw",
    "ca",
    "d.h",
    "dh",
    "etc",
    "evtl",
    "ggf",
    "inkl",
    "usw",
    "u.a",
    "ua",
    "vgl",
    "z.b",
    "zb",
    "nr",
    "abb",
    "kap",
    "s",
    "bd",
  ],
  pt: [
    "etc",
    "ex",
    "p.ex",
    "sr",
    "sra",
    "dr",
    "dra",
    "prof",
    "pág",
    "pag",
    "núm",
    "num",
    "vol",
    "fig",
    "cap",
    "art",
  ],
}

const abbreviations = (language: string) =>
  ABBREVIATIONS[langOf(language)] ?? ABBREVIATIONS.en

/* ---------------------------- tabella iniziale --------------------------- */

/**
 * La tabella «sostituisci → con» che l'app propone per ogni lingua: gli errori
 * di battitura più comuni e le parole scritte senza accento.
 */
export const DEFAULT_REPLACEMENTS: Record<string, Record<string, string>> = {
  it: {
    perche: "perché",
    poiche: "poiché",
    benche: "benché",
    finche: "finché",
    affinche: "affinché",
    piu: "più",
    cioe: "cioè",
    gia: "già",
    cosi: "così",
    percio: "perciò",
    puo: "può",
    "qual'è": "qual è",
    "un'altro": "un altro",
    pò: "po'",
    anhce: "anche",
    qeusto: "questo",
    prechè: "perché",
  },
  en: {
    teh: "the",
    adn: "and",
    taht: "that",
    thier: "their",
    recieve: "receive",
    seperate: "separate",
    occured: "occurred",
    definately: "definitely",
    accomodate: "accommodate",
    wich: "which",
    becuase: "because",
    i: "I",
  },
  es: {
    aqui: "aquí",
    asi: "así",
    tambien: "también",
    despues: "después",
    ademas: "además",
    facil: "fácil",
    dificil: "difícil",
    qeu: "que",
    porqeu: "porque",
  },
  fr: {
    etre: "être",
    meme: "même",
    tres: "très",
    deja: "déjà",
    apres: "après",
    problme: "problème",
    qund: "quand",
    aprés: "après",
  },
  de: {
    fuer: "für",
    ueber: "über",
    koennen: "können",
    moechte: "möchte",
    gruesse: "Grüße",
    waehrend: "während",
    natuerlich: "natürlich",
    dei: "die",
  },
  pt: {
    nao: "não",
    voce: "você",
    tambem: "também",
    entao: "então",
    portugues: "português",
    alguem: "alguém",
    porem: "porém",
    qeu: "que",
  },
}

export const defaultReplacements = (language: string) => ({
  ...(DEFAULT_REPLACEMENTS[langOf(language)] ?? {}),
})

/* ------------------------------ preferenze ------------------------------- */

const KEY = STORAGE.autocorrect

export const defaultAutoCorrect = (language: string): AutoCorrectSettings => ({
  enabled: true,
  quotes: true,
  dashes: true,
  ellipsis: true,
  symbols: true,
  fractions: true,
  ordinals: true,
  sentenceCase: true,
  twoInitials: true,
  replaceText: true,
  replacements: defaultReplacements(language),
  language,
})

let cache: AutoCorrectSettings | null = null
const listeners = new Set<() => void>()

/** Quello che è stato salvato, completato con i valori predefiniti */
function read(): AutoCorrectSettings {
  if (cache) return cache
  const base = defaultAutoCorrect("it")
  try {
    const raw = readStorage(KEY)
    const saved = raw ? (JSON.parse(raw) as Partial<AutoCorrectSettings>) : null
    cache = saved
      ? {
          ...base,
          ...saved,
          replacements:
            saved.replacements && typeof saved.replacements === "object"
              ? saved.replacements
              : base.replacements,
        }
      : base
  } catch {
    cache = base
  }
  return cache
}

export function getAutoCorrect() {
  return read()
}

export function setAutoCorrect(patch: Partial<AutoCorrectSettings>) {
  cache = { ...read(), ...patch }
  writeStorage(KEY, JSON.stringify(cache))
  listeners.forEach((l) => l())
}

const SERVER = defaultAutoCorrect("it")

export function useAutoCorrect() {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => SERVER
  )
}

/* ------------------------------- estensione ------------------------------ */

declare module "@tiptap/core" {
  interface Storage {
    autoCorrect: AutoCorrectSettings
  }
}

/** Le impostazioni che vede l'editor: la lingua la mette il documento */
export function setAutoCorrectSettings(
  editor: {
    storage: { autoCorrect?: AutoCorrectSettings }
    isDestroyed: boolean
  },
  next: AutoCorrectSettings
) {
  if (editor.isDestroyed || !editor.storage.autoCorrect) return
  Object.assign(editor.storage.autoCorrect, next)
}

/* -------------------------------- regole --------------------------------- */

/**
 * Caratteri che chiudono una parola e fanno scattare le correzioni. L'a capo
 * resta fuori di proposito: Tiptap prova le regole anche con Invio, e una che
 * scatta si mangia il tasto — il paragrafo non si dividerebbe più e al suo
 * posto finirebbe un a capo dentro al testo. Una parola che finisce con Invio
 * e senza punteggiatura resta quindi com'è.
 */
const WORD_END = "[ \\t.,;:!?)\\]}»”’…\"']"

/** Prima di una virgoletta che apre non c'è una lettera */
const OPENS = "[\\s([{<‘“«„–—/ ]"

const upperFirst = (s: string) => s.slice(0, 1).toLocaleUpperCase() + s.slice(1)

/** La parola prima del punto è un'abbreviazione (o una sola iniziale)? */
function afterAbbreviation(before: string, language: string) {
  const m = /([\p{L}.]{1,9})\.["'”’»)]?\s+$/u.exec(before)
  if (!m) return false
  const word = m[1].toLocaleLowerCase().replace(/\.$/, "")
  if (word.length <= 1) return true
  return abbreviations(language).includes(word)
}

/**
 * La parola nella tabella, oppure null. La tabella arriva da quello che si è
 * salvato nel browser, quindi si leggono solo le chiavi che ha davvero: senza
 * questo controllo «constructor» o «toString» risponderebbero con qualcosa che
 * viene da Object.prototype.
 */
function replacementFor(table: Record<string, string>, word: string) {
  for (const key of [word, word.toLocaleLowerCase()]) {
    const value = Object.hasOwn(table, key) ? table[key] : undefined
    if (typeof value === "string" && value && value !== word) return value
  }
  return null
}

/** Il suffisso giusto per un numero ordinale inglese */
function englishOrdinal(n: string) {
  const last2 = Number(n.slice(-2))
  if (last2 >= 11 && last2 <= 13) return "th"
  const last = n.slice(-1)
  return last === "1" ? "st" : last === "2" ? "nd" : last === "3" ? "rd" : "th"
}

type Get = () => AutoCorrectSettings

/**
 * Le correzioni che scattano quando la parola finisce (spazio, punteggiatura,
 * Invio). Stanno in una regola sola perché Tiptap ne applica una per battuta:
 * «perche» a inizio frase deve diventare «Perché», cioè tabella e maiuscola
 * insieme, come fa Word.
 */
function wordRule(get: Get) {
  return new InputRule({
    find: new RegExp(`(\\S{1,60})(${WORD_END})$`, "u"),
    handler: ({ state, range, match }) => {
      const s = get()
      if (!s.enabled) return null
      const raw = match[1]
      const term = match[2]
      const rawAt = range.from + (match[0].length - term.length - raw.length)
      // la parola senza la punteggiatura che la apre: «(perche» → «perche»
      const lead = /^[^\p{L}\p{N}]*/u.exec(raw)?.[0] ?? ""
      const start = rawAt + lead.length
      let word = raw.slice(lead.length)
      if (!word) return null
      const before = (match.input ?? "").slice(
        0,
        (match.index ?? 0) + (match[0].length - term.length - raw.length)
      )
      const original = word
      let superscript = false

      /* tabella «sostituisci → con» */
      if (s.replaceText) {
        const hit = replacementFor(s.replacements, word)
        if (hit) {
          // «Perche» scritto con la maiuscola resta con la maiuscola
          word =
            word[0] !== word[0].toLocaleLowerCase() &&
            word !== word.toLocaleUpperCase()
              ? upperFirst(hit)
              : hit
        }
      }

      /* DUe iniziali maiuscole */
      if (s.twoInitials) {
        const m = /^(\p{Lu})(\p{Lu})(\p{Ll}{2,})$/u.exec(word)
        if (m) word = m[1] + m[2].toLocaleLowerCase() + m[3]
      }

      /* ordinali */
      if (s.ordinals) {
        const lang = langOf(s.language)
        const m = /^(\d+)(st|nd|rd|th|o|a)$/.exec(word)
        if (m && lang === "en" && m[2].length === 2) {
          superscript = m[2] === englishOrdinal(m[1])
        } else if (m && (lang === "it" || lang === "es" || lang === "pt")) {
          if (m[2] === "o") word = `${m[1]}º`
          else if (m[2] === "a") word = `${m[1]}ª`
        }
      }

      /* prima lettera della frase maiuscola: dopo «…» la frase continua */
      if (s.sentenceCase && /^\p{Ll}/u.test(word)) {
        const opensSentence = /(?:^|[.!?]["'”’»)]?\s+)$/u.test(before)
        if (
          opensSentence &&
          !(before.trim() && afterAbbreviation(before, s.language))
        ) {
          word = upperFirst(word)
        }
      }

      if (word === original && !superscript) return null
      const tr = state.tr
      // il carattere appena battuto non è ancora nel documento: una regola che
      // scatta lo deve riscrivere insieme alla correzione, altrimenti sparisce
      tr.insertText(word + term, start, range.to)
      if (superscript) {
        const mark = state.schema.marks.superscript
        const digits = word.length - 2
        if (mark) tr.addMark(start + digits, start + word.length, mark.create())
      }
      return undefined
    },
  })
}

/** Una regola che sostituisce un pezzo della corrispondenza appena si batte */
function instantRule(
  get: Get,
  on: (s: AutoCorrectSettings) => boolean,
  find: RegExp,
  pick: (
    match: RegExpMatchArray,
    s: AutoCorrectSettings
  ) => { offset: number; length: number; text: string } | null
) {
  return new InputRule({
    find,
    handler: ({ state, range, match }) => {
      const s = get()
      if (!s.enabled || !on(s)) return null
      const edit = pick(match, s)
      if (!edit) return null
      // quello che segue il pezzo sostituito (di solito il carattere appena
      // battuto, che nel documento non c'è ancora) va riscritto anche lui
      const rest = match[0].slice(edit.offset + edit.length)
      state.tr.insertText(edit.text + rest, range.from + edit.offset, range.to)
      return undefined
    },
  })
}

export function autoCorrectRules(get: Get) {
  const tail = (match: RegExpMatchArray, part: string, text: string) => ({
    offset: match[0].length - part.length,
    length: part.length,
    text,
  })
  // Tiptap applica una regola sola per battuta: prima le sostituzioni precise
  // (che riconoscono anche «)» o «"»), in fondo quella che guarda la parola
  return [
    /* puntini di sospensione */
    instantRule(
      get,
      (s) => s.ellipsis,
      /(?:^|[^.])\.\.\.$/,
      (m) => tail(m, "...", "…")
    ),

    /* lineette: «---» diventa —, «-- » diventa – */
    instantRule(
      get,
      (s) => s.dashes,
      /(?:^|[^-])---$/,
      (m) => tail(m, "---", "—")
    ),
    instantRule(
      get,
      (s) => s.dashes,
      // lo spazio, non un a capo: vedi WORD_END
      /(?:^|[^-])--[ \t]$/,
      (m) => ({
        offset: m[0].length - 3,
        length: 2,
        text: "–",
      })
    ),

    /* frazioni: solo a parola finita, così «1/2/2026» resta una data */
    instantRule(
      get,
      (s) => s.fractions,
      /(?:^|\s)(\d\/\d)[ \t]$/,
      (m) => {
        const glyph = FRACTIONS[m[1]]
        return glyph
          ? { offset: m[0].length - 4, length: 3, text: glyph }
          : null
      }
    ),

    /* simboli, frecce e faccine */
    instantRule(
      get,
      (s) => s.symbols,
      /(\([cCrRe]\)|\(tm\)|\(TM\)|-->|<--|<->|==>|<==|<=>|:-?\)|:-?\(|;\)|:D)$/,
      (m) => {
        const glyph = SYMBOLS[m[1]]
        return glyph ? tail(m, m[1], glyph) : null
      }
    ),

    /* virgolette: prima quelle che aprono, poi quelle che chiudono */
    instantRule(
      get,
      (s) => s.quotes,
      new RegExp(`(?:^|${OPENS})"$`, "u"),
      (m, s) => tail(m, '"', quoteSet(s.language).open)
    ),
    instantRule(
      get,
      (s) => s.quotes,
      /"$/,
      (m, s) => tail(m, '"', quoteSet(s.language).close)
    ),
    instantRule(
      get,
      (s) => s.quotes,
      new RegExp(`(?:^|${OPENS})'$`, "u"),
      (m, s) => tail(m, "'", quoteSet(s.language).sOpen)
    ),
    instantRule(
      get,
      (s) => s.quotes,
      /'$/,
      (m, s) => tail(m, "'", quoteSet(s.language).sClose)
    ),

    /* correzioni a parola finita */
    wordRule(get),
  ]
}

export const AutoCorrect = Extension.create<
  Record<string, never>,
  AutoCorrectSettings
>({
  name: "autoCorrect",
  // dopo le regole di Markdown dello starter kit: «1. » resta un elenco
  priority: 50,

  addStorage() {
    return defaultAutoCorrect("it")
  },

  addInputRules() {
    return autoCorrectRules(() => this.editor.storage.autoCorrect)
  },
})
