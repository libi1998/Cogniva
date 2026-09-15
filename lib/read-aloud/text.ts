import type { Node as PMNode } from "@tiptap/pm/model"
import { readingUnits } from "@/lib/review-tools"

/**
 * Il testo da leggere diviso in frasi: una frase alla volta la lettura parte
 * subito, si riprende dal punto giusto e le voci del sistema non si
 * interrompono sui paragrafi lunghi (Chrome tronca le frasi oltre ~15 secondi).
 */

export type Sentence = {
  text: string
  /** posizione nel documento di ogni carattere di `text` */
  map: number[]
  /** l'indice del paragrafo, per saltare da un paragrafo all'altro */
  paragraph: number
}

export type Word = { start: number; end: number }

const MAX_SENTENCE = 260

function segmenter(lang: string, granularity: "sentence" | "word") {
  if (typeof Intl === "undefined" || !("Segmenter" in Intl)) return null
  try {
    return new Intl.Segmenter(lang, { granularity })
  } catch {
    return new Intl.Segmenter(undefined, { granularity })
  }
}

/** Divide una frase troppo lunga dopo virgole, punti e virgola o spazi */
function splitLong(text: string, start: number): [number, number][] {
  const out: [number, number][] = []
  let from = start
  const end = start + text.length
  while (end - from > MAX_SENTENCE) {
    const slice = text.slice(from - start, from - start + MAX_SENTENCE)
    const cut = Math.max(
      slice.lastIndexOf(", "),
      slice.lastIndexOf("; "),
      slice.lastIndexOf(": "),
      slice.lastIndexOf(" – ")
    )
    const at = cut > 80 ? cut + 2 : slice.lastIndexOf(" ") + 1 || MAX_SENTENCE
    out.push([from, from + at])
    from += at
  }
  out.push([from, end])
  return out
}

export function sentencesOf(
  doc: PMNode,
  from: number,
  to: number,
  lang: string
): Sentence[] {
  const units = readingUnits(doc, from, to)
  const seg = segmenter(lang, "sentence")
  const out: Sentence[] = []
  units.forEach((unit, paragraph) => {
    const bounds: [number, number][] = seg
      ? [...seg.segment(unit.text)].map((s) => [
          s.index,
          s.index + s.segment.length,
        ])
      : [...unit.text.matchAll(/[^.!?…]+[.!?…]*\s*/g)].map((m) => [
          m.index,
          m.index + m[0].length,
        ])
    for (const [start, end] of bounds) {
      const piece = unit.text.slice(start, end)
      if (!/[\p{L}\p{N}]/u.test(piece)) continue
      for (const [a, b] of splitLong(piece, start)) {
        const text = unit.text.slice(a, b)
        if (!/[\p{L}\p{N}]/u.test(text)) continue
        out.push({ text, map: unit.map.slice(a, b), paragraph })
      }
    }
  })
  return out
}

export function wordsOf(text: string, lang: string): Word[] {
  const seg = segmenter(lang, "word")
  if (seg) {
    return [...seg.segment(text)]
      .filter((s) => s.isWordLike)
      .map((s) => ({ start: s.index, end: s.index + s.segment.length }))
  }
  return [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)].map((m) => ({
    start: m.index,
    end: m.index + m[0].length,
  }))
}

/**
 * Quando la voce non dice a che parola è arrivata, si stima dal tempo: ogni
 * parola pesa quanto le sue lettere, la punteggiatura aggiunge una pausa.
 */
export function wordTimeline(text: string, words: Word[]) {
  const weights = words.map((word, i) => {
    const next = words[i + 1]?.start ?? text.length
    const gap = text.slice(word.end, next)
    const pause = /[.!?…]/.test(gap) ? 6 : /[,;:–—]/.test(gap) ? 3 : 0.8
    return word.end - word.start + pause
  })
  const total = weights.reduce((a, b) => a + b, 0) || 1
  let sum = 0
  return weights.map((w) => {
    const start = sum / total
    sum += w
    return start
  })
}

/** L'indice della parola che contiene (o precede) il carattere `index` */
export function wordAt(words: Word[], index: number) {
  let found = 0
  for (let i = 0; i < words.length; i += 1) {
    if (words[i]!.start <= index) found = i
    else break
  }
  return found
}
