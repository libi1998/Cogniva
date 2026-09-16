/// <reference lib="webworker" />
import { THESAURUS_CACHE, type ThesaurusSource } from "./catalog"
import { N_ } from "../i18n/config"

/**
 * Carica e interroga un dizionario MyThes in un thread a parte: i file vanno
 * da 2 a 30 MB e l'indice si costruisce senza bloccare la scrittura.
 *
 * Formato: una riga con la codifica, poi per ogni voce «parola|n» seguita da
 * n righe «(categoria)|sinonimo|sinonimo|…».
 */

export type Meaning = { pos: string; terms: string[]; entry: string }
export type LookupResult = {
  word: string
  /** le voci trovate: la parola stessa o le sue forme base («stili» → «stile», «stilo») */
  entries: string[]
  meanings: Meaning[]
  /** voci vicine in ordine alfabetico, quando la parola non c'è */
  nearby: string[]
}

export type ThesaurusRequest =
  | { id: number; type: "lookup"; source: ThesaurusSource; word: string }
  | { id: number; type: "cached"; source: ThesaurusSource }

export type ThesaurusResponse =
  | { id: number; type: "progress"; fraction: number }
  | { id: number; type: "result"; result: LookupResult }
  | { id: number; type: "cached"; cached: boolean }
  | { id: number; type: "error"; message: string }

type Index = {
  lines: string[]
  /** parola in minuscolo → riga della voce */
  entries: Map<string, number>
  sorted: string[]
}

const indexes = new Map<string, Promise<Index>>()

const post = (message: ThesaurusResponse) => postMessage(message)

async function sha256(bytes: ArrayBuffer) {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)]
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

async function download(source: ThesaurusSource, id: number) {
  const response = await fetch(source.url)
  if (!response.ok || !response.body) {
    throw new Error(N_("Download del dizionario non riuscito"))
  }
  const total = Number(response.headers.get("content-length")) || source.bytes
  const reader = response.body.getReader()
  const chunks: Uint8Array[] = []
  let loaded = 0
  let last = 0
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    chunks.push(value)
    loaded += value.byteLength
    if (performance.now() - last > 100) {
      last = performance.now()
      post({ id, type: "progress", fraction: Math.min(1, loaded / total) })
    }
  }
  const bytes = new Uint8Array(loaded)
  let offset = 0
  for (const chunk of chunks) {
    bytes.set(chunk, offset)
    offset += chunk.byteLength
  }
  return bytes.buffer
}

async function fileBytes(source: ThesaurusSource, id: number) {
  const cache = await caches.open(THESAURUS_CACHE).catch(() => null)
  const hit = await cache?.match(source.url)
  if (hit) {
    const bytes = await hit.arrayBuffer()
    if ((await sha256(bytes)) === source.sha256) return bytes
    await cache?.delete(source.url)
  }
  const bytes = await download(source, id)
  if ((await sha256(bytes)) !== source.sha256) {
    throw new Error(N_("Il dizionario scaricato non è integro: riprova."))
  }
  await cache?.put(source.url, new Response(bytes)).catch(() => undefined)
  return bytes
}

function decode(bytes: ArrayBuffer) {
  const head = new TextDecoder("latin1").decode(bytes.slice(0, 40))
  const label = head.split(/\r?\n/)[0]?.trim().toLowerCase() || "utf-8"
  const encoding =
    label.startsWith("iso8859") || label.startsWith("iso-8859")
      ? `iso-8859-${label.replace(/^iso-?8859-?/, "") || "1"}`
      : label === "koi8-r"
        ? "koi8-r"
        : "utf-8"
  try {
    return new TextDecoder(encoding).decode(bytes)
  } catch {
    return new TextDecoder("utf-8").decode(bytes)
  }
}

function buildIndex(text: string): Index {
  const lines = text.split(/\r?\n/)
  const entries = new Map<string, number>()
  let i = 1
  while (i < lines.length) {
    const line = lines[i]!
    const bar = line.lastIndexOf("|")
    const count = bar > 0 ? Number(line.slice(bar + 1)) : NaN
    if (bar > 0 && Number.isInteger(count) && count > 0) {
      const word = line.slice(0, bar).toLocaleLowerCase()
      if (!entries.has(word)) entries.set(word, i)
      i += count + 1
    } else i += 1
  }
  const collator = new Intl.Collator(undefined, { sensitivity: "base" })
  const sorted = [...entries.keys()].sort(collator.compare)
  return { lines, entries, sorted }
}

function index(source: ThesaurusSource, id: number) {
  let hit = indexes.get(source.lang)
  if (!hit) {
    hit = fileBytes(source, id).then((bytes) => buildIndex(decode(bytes)))
    hit.catch(() => indexes.delete(source.lang))
    indexes.set(source.lang, hit)
  }
  return hit
}

function meaningsAt(idx: Index, line: number): Meaning[] {
  const head = idx.lines[line] ?? ""
  const entry = head.slice(0, head.lastIndexOf("|"))
  const count = Number(head.slice(head.lastIndexOf("|") + 1)) || 0
  const out: Meaning[] = []
  for (let i = 1; i <= count; i += 1) {
    const [pos = "", ...terms] = (idx.lines[line + i] ?? "").split("|")
    const unique = [...new Set(terms.map((t) => t.trim()).filter(Boolean))]
    if (unique.length)
      out.push({
        pos: pos.replace(/^\(|\)$/g, "").trim(),
        terms: unique,
        entry,
      })
  }
  return out
}

/** Forme base da provare quando la parola è flessa (plurali, verbi) */
function variants(word: string, lang: string) {
  const w = word.toLocaleLowerCase()
  const out = new Set<string>([w])
  const swap = (from: RegExp, to: string) => {
    if (from.test(w)) out.add(w.replace(from, to))
  }
  if (lang === "it") {
    swap(/chi$/, "co")
    swap(/ghi$/, "go")
    swap(/che$/, "ca")
    swap(/ghe$/, "ga")
    swap(/i$/, "o")
    swap(/i$/, "e")
    swap(/e$/, "a")
    swap(/a$/, "o")
    swap(/(ando|endo)$/, "are")
    swap(/ato$/, "are")
    swap(/uto$/, "ere")
    swap(/ito$/, "ire")
    swap(/issimo$/, "o")
  } else if (lang === "en") {
    swap(/ies$/, "y")
    swap(/es$/, "")
    swap(/s$/, "")
    swap(/ied$/, "y")
    swap(/ed$/, "")
    swap(/ed$/, "e")
    swap(/ing$/, "")
    swap(/ing$/, "e")
    swap(/er$/, "")
    swap(/est$/, "")
  } else if (lang === "fr" || lang === "es" || lang === "pt") {
    swap(/x$/, "")
    swap(/s$/, "")
    swap(/es$/, "")
    swap(/e$/, "")
    swap(/a$/, "o")
  } else if (lang === "de") {
    swap(/en$/, "")
    swap(/n$/, "")
    swap(/e$/, "")
    swap(/er$/, "")
    swap(/es$/, "")
  }
  return [...out]
}

function nearby(idx: Index, word: string) {
  const collator = new Intl.Collator(undefined, { sensitivity: "base" })
  let lo = 0
  let hi = idx.sorted.length
  while (lo < hi) {
    const mid = (lo + hi) >> 1
    if (collator.compare(idx.sorted[mid]!, word) < 0) lo = mid + 1
    else hi = mid
  }
  return idx.sorted.slice(Math.max(0, lo - 4), lo + 6)
}

addEventListener("message", async (event: MessageEvent<ThesaurusRequest>) => {
  const message = event.data
  try {
    if (message.type === "cached") {
      const cache = await caches.open(THESAURUS_CACHE).catch(() => null)
      const hit = await cache?.match(message.source.url)
      post({ id: message.id, type: "cached", cached: Boolean(hit) })
      return
    }
    const idx = await index(message.source, message.id)
    const word = message.word.trim()
    const entries: string[] = []
    const meanings: Meaning[] = []
    // la parola esatta per prima, poi le possibili forme base (al massimo tre)
    for (const candidate of variants(word, message.source.lang)) {
      const line = idx.entries.get(candidate)
      if (line === undefined) continue
      const found = meaningsAt(idx, line)
      if (!found.length) continue
      entries.push(found[0]!.entry)
      meanings.push(...found)
      if (candidate === word.toLocaleLowerCase() || entries.length === 3) break
    }
    post({
      id: message.id,
      type: "result",
      result: {
        word,
        entries,
        meanings,
        nearby: meanings.length ? [] : nearby(idx, word.toLocaleLowerCase()),
      },
    })
  } catch (error) {
    post({
      id: message.id,
      type: "error",
      message: error instanceof Error ? error.message : String(error),
    })
  }
})
