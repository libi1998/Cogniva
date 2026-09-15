import type { JSONContent } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { isDark } from "./palette"

/**
 * Strumenti della scheda Revisione che non toccano l'editor direttamente:
 * testo per la lettura ad alta voce, verifica accessibilità, confronto fra
 * documenti e traduzione con il traduttore integrato del browser.
 */

/* ------------------------------ leggi ad alta voce ----------------------- */

export type ReadingUnit = {
  text: string
  /** posizione nel documento di ogni carattere di `text` */
  map: number[]
}

/** I paragrafi da leggere, dal blocco del cursore (o solo la selezione) */
export function readingUnits(
  doc: PMNode,
  from: number,
  to: number
): ReadingUnit[] {
  const units: ReadingUnit[] = []
  const onlySelection = to > from
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return true
    const end = pos + node.nodeSize
    if (end < from || (onlySelection && pos > to)) return false
    let text = ""
    const map: number[] = []
    node.forEach((child, offset) => {
      const start = pos + 1 + offset
      if (child.isText) {
        // il testo eliminato con le revisioni non si legge
        if (child.marks.some((m) => m.type.name === "deletion")) return
        const value = child.text ?? ""
        for (let i = 0; i < value.length; i += 1) {
          const at = start + i
          if (onlySelection && (at < from || at >= to)) continue
          if (!onlySelection && at < from && pos < from) continue
          text += value[i]
          map.push(at)
        }
      } else {
        text += " "
        map.push(start)
      }
    })
    if (text.trim()) units.push({ text, map })
    return false
  })
  return units
}

/* ---------------------------- verifica accessibilità --------------------- */

export type A11yIssue = {
  id: string
  level: "error" | "warning" | "tip"
  title: string
  detail: string
  pos: number | null
  /** immagini: si può scrivere il testo alternativo direttamente */
  fix?: "alt"
}

function luminance(hex: string) {
  const h = hex.replace("#", "")
  const full =
    h.length === 3
      ? h
          .split("")
          .map((c) => c + c)
          .join("")
      : h.slice(0, 6)
  const n = parseInt(full, 16)
  const channel = (v: number) => {
    const c = v / 255
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
  }
  return (
    0.2126 * channel((n >> 16) & 255) +
    0.7152 * channel((n >> 8) & 255) +
    0.0722 * channel(n & 255)
  )
}

export function contrastRatio(a: string, b: string) {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p)
  return (x + 0.05) / (y + 0.05)
}

const GENERIC_LINKS =
  /^(qui|clicca qui|clicca|link|questo link|leggi|scopri di più|here|click here|more)$/i

export function checkAccessibility(doc: PMNode, paper: string): A11yIssue[] {
  const issues: A11yIssue[] = []
  const first = doc.firstChild
  if (!first || first.type.name !== "docTitle" || !first.textContent.trim()) {
    issues.push({
      id: "title",
      level: "error",
      title: "Titolo del documento mancante",
      detail:
        "Chi usa un lettore di schermo sente il titolo per primo: aggiungilo in cima.",
      pos: first ? 0 : null,
    })
  }
  let lastLevel = 0
  let empties = 0
  const paperHex = /^#[0-9a-f]{3,8}$/i.test(paper)
    ? paper
    : isDark(paper)
      ? "#000000"
      : "#ffffff"
  doc.descendants((node, pos) => {
    const name = node.type.name
    if (
      name === "paragraph" &&
      !node.textContent.trim() &&
      node.childCount === 0
    ) {
      empties += 1
      if (empties === 3) {
        issues.push({
          id: `empty-${pos}`,
          level: "tip",
          title: "Paragrafi vuoti usati come spazio",
          detail:
            "Usa «Spazio prima» e «Spazio dopo» (scheda Layout): i lettori di schermo annunciano ogni riga vuota.",
          pos,
        })
      }
    } else if (node.isBlock) {
      empties = 0
    }
    if (name === "heading") {
      const level = Number(node.attrs.level ?? 1)
      if (!node.textContent.trim()) {
        issues.push({
          id: `hempty-${pos}`,
          level: "error",
          title: "Titolo vuoto",
          detail: "Scrivi il titolo o riportalo a «Normale».",
          pos,
        })
      }
      if (lastLevel && level > lastLevel + 1) {
        issues.push({
          id: `hskip-${pos}`,
          level: "warning",
          title: `Livello di titolo saltato (da ${lastLevel} a ${level})`,
          detail:
            "I titoli vanno in ordine: dopo un Titolo 1 viene un Titolo 2, non un Titolo 3.",
          pos,
        })
      }
      lastLevel = level
    }
    if (name === "image" && !String(node.attrs.alt ?? "").trim()) {
      issues.push({
        id: `alt-${pos}`,
        level: "error",
        title: "Immagine senza testo alternativo",
        detail: "Descrivi in una frase cosa mostra l'immagine.",
        pos,
        fix: "alt",
      })
    }
    if (
      name === "image" &&
      ["behind", "front"].includes(String(node.attrs.wrap))
    ) {
      issues.push({
        id: `float-${pos}`,
        level: "tip",
        title: "Oggetto non in linea",
        detail:
          "Un'immagine dietro o davanti al testo è difficile da raggiungere con la tastiera.",
        pos,
      })
    }
    if (name === "table") {
      const header = node.firstChild?.firstChild?.type.name === "tableHeader"
      if (!header) {
        issues.push({
          id: `thead-${pos}`,
          level: "warning",
          title: "Tabella senza riga di intestazione",
          detail:
            "Rendi la prima riga un'intestazione: i lettori di schermo la ripetono per ogni cella.",
          pos,
        })
      }
      let merged = false
      node.descendants((cell) => {
        if (
          Number(cell.attrs.colspan ?? 1) > 1 ||
          Number(cell.attrs.rowspan ?? 1) > 1
        )
          merged = true
        return !merged
      })
      if (merged) {
        issues.push({
          id: `merged-${pos}`,
          level: "tip",
          title: "Tabella con celle unite",
          detail:
            "Le celle unite rendono la lettura della tabella difficile da seguire.",
          pos,
        })
      }
    }
    if (node.isText) {
      const link = node.marks.find((m) => m.type.name === "link")
      const text = (node.text ?? "").trim()
      if (link && (GENERIC_LINKS.test(text) || /^https?:\/\//i.test(text))) {
        issues.push({
          id: `link-${pos}`,
          level: "warning",
          title: "Testo del collegamento poco chiaro",
          detail: `«${text.slice(0, 40)}» non dice dove porta: descrivi la destinazione.`,
          pos,
        })
      }
      const style = node.marks.find((m) => m.type.name === "textStyle")
      const color = String(style?.attrs.color ?? "")
      if (
        /^#[0-9a-f]{3,8}$/i.test(color) &&
        contrastRatio(color, paperHex) < 4.5
      ) {
        issues.push({
          id: `contrast-${pos}`,
          level: "warning",
          title: "Contrasto del testo insufficiente",
          detail: `Rapporto ${contrastRatio(color, paperHex).toFixed(1)}:1, ne serve almeno 4,5:1.`,
          pos,
        })
      }
    }
    return true
  })
  return issues
}

/* --------------------------------- confronta ----------------------------- */

type Block = { type: string; attrs?: Record<string, unknown>; text: string }

function blocksOf(content: JSONContent | null | undefined): Block[] {
  const out: Block[] = []
  const walk = (node: JSONContent) => {
    const children = node.content ?? []
    const textblock = [
      "paragraph",
      "heading",
      "docTitle",
      "codeBlock",
    ].includes(node.type ?? "")
    if (textblock) {
      out.push({
        type: node.type === "docTitle" ? "heading" : (node.type ?? "paragraph"),
        attrs:
          node.type === "heading"
            ? { level: node.attrs?.level ?? 1 }
            : node.type === "docTitle"
              ? { level: 1 }
              : undefined,
        text: children
          .map((c) => c.text ?? (c.type === "hardBreak" ? "\n" : ""))
          .join(""),
      })
      return
    }
    children.forEach(walk)
  }
  if (content) walk(content)
  return out
}

/** La sottosequenza comune più lunga (indici delle coppie uguali) */
function lcs<T>(
  a: T[],
  b: T[],
  eq: (x: T, y: T) => boolean
): [number, number][] {
  const n = a.length
  const m = b.length
  // documenti enormi: niente tabella quadratica, si confronta riga per riga
  if (n * m > 4_000_000) {
    return Array.from(
      { length: Math.min(n, m) },
      (_, i) => [i, i] as [number, number]
    ).filter(([i, j]) => eq(a[i], b[j]))
  }
  const dp = Array.from({ length: n + 1 }, () => new Uint32Array(m + 1))
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      dp[i][j] = eq(a[i], b[j])
        ? dp[i + 1][j + 1] + 1
        : Math.max(dp[i + 1][j], dp[i][j + 1])
    }
  }
  const pairs: [number, number][] = []
  let i = 0
  let j = 0
  while (i < n && j < m) {
    if (eq(a[i], b[j])) {
      pairs.push([i, j])
      i += 1
      j += 1
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      i += 1
    } else {
      j += 1
    }
  }
  return pairs
}

const change = (
  kind: "insertion" | "deletion",
  author: string,
  date: number
) => ({
  type: kind,
  attrs: { author, date },
})

function wordDiff(
  a: string,
  b: string,
  author: string,
  date: number
): JSONContent[] {
  const ta = a.split(/(\s+)/).filter(Boolean)
  const tb = b.split(/(\s+)/).filter(Boolean)
  const pairs = lcs(ta, tb, (x, y) => x === y)
  const out: JSONContent[] = []
  const push = (text: string, kind?: "insertion" | "deletion") => {
    if (!text) return
    const last = out[out.length - 1]
    const lastKind = last?.marks?.[0]?.type
    if (last && lastKind === kind) {
      last.text += text
      return
    }
    out.push({
      type: "text",
      text,
      ...(kind ? { marks: [change(kind, author, date)] } : {}),
    })
  }
  let i = 0
  let j = 0
  for (const [pi, pj] of [
    ...pairs,
    [ta.length, tb.length] as [number, number],
  ]) {
    push(ta.slice(i, pi).join(""), "deletion")
    push(tb.slice(j, pj).join(""), "insertion")
    if (pi < ta.length) push(ta[pi])
    i = pi + 1
    j = pj + 1
  }
  return out
}

/**
 * «Confronta»: un documento nuovo con le differenze fra originale e revisione
 * come revisioni da accettare o rifiutare
 */
export function compareDocuments(
  original: JSONContent | null | undefined,
  revised: JSONContent | null | undefined,
  author: string
): JSONContent {
  const a = blocksOf(original)
  const b = blocksOf(revised)
  const date = Date.now()
  // i paragrafi si abbinano se sono uguali o molto simili
  const similar = (x: Block, y: Block) => {
    if (x.text === y.text) return true
    const wx = new Set(x.text.toLowerCase().split(/\s+/).filter(Boolean))
    const wy = y.text.toLowerCase().split(/\s+/).filter(Boolean)
    if (!wx.size || !wy.length) return false
    const common = wy.filter((w) => wx.has(w)).length
    return common / Math.max(wx.size, wy.length) >= 0.5
  }
  const pairs = lcs(a, b, similar)
  const content: JSONContent[] = []
  const block = (source: Block, inner: JSONContent[]): JSONContent => ({
    type: source.type,
    ...(source.attrs ? { attrs: source.attrs } : {}),
    content: inner,
  })
  let i = 0
  let j = 0
  for (const [pi, pj] of [...pairs, [a.length, b.length] as [number, number]]) {
    for (const x of a.slice(i, pi)) {
      content.push(
        block(
          x,
          x.text
            ? [
                {
                  type: "text",
                  text: x.text,
                  marks: [change("deletion", author, date)],
                },
              ]
            : []
        )
      )
    }
    for (const y of b.slice(j, pj)) {
      content.push(
        block(
          y,
          y.text
            ? [
                {
                  type: "text",
                  text: y.text,
                  marks: [change("insertion", author, date)],
                },
              ]
            : []
        )
      )
    }
    if (pi < a.length && pj < b.length) {
      content.push(block(b[pj], wordDiff(a[pi].text, b[pj].text, author, date)))
    }
    i = pi + 1
    j = pj + 1
  }
  return {
    type: "doc",
    content: content.length ? content : [{ type: "paragraph" }],
  }
}

/* --------------------------------- traduci ------------------------------- */

export const TRANSLATE_LANGUAGES: { code: string; label: string }[] = [
  { code: "it", label: "Italiano" },
  { code: "en", label: "Inglese" },
  { code: "fr", label: "Francese" },
  { code: "de", label: "Tedesco" },
  { code: "es", label: "Spagnolo" },
  { code: "pt", label: "Portoghese" },
  { code: "nl", label: "Olandese" },
  { code: "pl", label: "Polacco" },
  { code: "ro", label: "Rumeno" },
  { code: "ja", label: "Giapponese" },
  { code: "zh", label: "Cinese" },
]

export const PROOFING_LANGUAGES: { code: string; label: string }[] = [
  { code: "it-IT", label: "Italiano (Italia)" },
  { code: "it-CH", label: "Italiano (Svizzera)" },
  { code: "en-US", label: "Inglese (Stati Uniti)" },
  { code: "en-GB", label: "Inglese (Regno Unito)" },
  { code: "fr-FR", label: "Francese (Francia)" },
  { code: "de-DE", label: "Tedesco (Germania)" },
  { code: "es-ES", label: "Spagnolo (Spagna)" },
  { code: "pt-PT", label: "Portoghese (Portogallo)" },
  { code: "pt-BR", label: "Portoghese (Brasile)" },
]

type TranslatorApi = {
  availability: (o: {
    sourceLanguage: string
    targetLanguage: string
  }) => Promise<string>
  create: (o: {
    sourceLanguage: string
    targetLanguage: string
    monitor?: (m: EventTarget) => void
  }) => Promise<{
    translate: (text: string) => Promise<string>
    destroy?: () => void
  }>
}

function browserApi() {
  return typeof globalThis === "undefined"
    ? undefined
    : (globalThis as unknown as { Translator?: TranslatorApi }).Translator
}

export function translatorAvailable() {
  return Boolean(browserApi())
}

/**
 * Chi traduce: il traduttore integrato del browser (Chrome, Edge) oppure i
 * modelli OPUS-MT che Cogniva fa girare sul dispositivo, in ogni browser.
 * In entrambi i casi il testo non lascia il computer.
 */
export type TranslateEngine = "auto" | "browser" | "device"

export type BrowserAvailability =
  "available" | "downloadable" | "unavailable" | "missing"

export async function browserTranslation(
  sourceLanguage: string,
  targetLanguage: string
): Promise<BrowserAvailability> {
  const api = browserApi()
  if (!api) return "missing"
  try {
    const state = await api.availability({ sourceLanguage, targetLanguage })
    return state === "available"
      ? "available"
      : state === "unavailable"
        ? "unavailable"
        : "downloadable"
  } catch {
    return "unavailable"
  }
}

export type TranslateProgress =
  | { phase: "download"; fraction: number; model?: string }
  | { phase: "translate"; done: number; total: number }

export type DocTranslator = {
  engine: "browser" | "device"
  translate: (
    texts: string[],
    onProgress?: (progress: TranslateProgress) => void
  ) => Promise<string[]>
  destroy: () => void
}

export async function createTranslator(
  sourceLanguage: string,
  targetLanguage: string,
  {
    engine = "auto",
    onProgress,
  }: {
    engine?: TranslateEngine
    onProgress?: (progress: TranslateProgress) => void
  } = {}
): Promise<DocTranslator> {
  const local = await import("./translate/local")
  if (engine !== "device") {
    const state = await browserTranslation(sourceLanguage, targetLanguage)
    const api = browserApi()
    if (api && (state === "available" || state === "downloadable")) {
      const translator = await api.create({
        sourceLanguage,
        targetLanguage,
        monitor: (m) =>
          m.addEventListener("downloadprogress", (e) =>
            onProgress?.({
              phase: "download",
              fraction: (e as ProgressEvent).loaded,
            })
          ),
      })
      return {
        engine: "browser",
        translate: async (texts, progress) => {
          const out: string[] = []
          for (const text of texts) {
            out.push(await translator.translate(text))
            progress?.({
              phase: "translate",
              done: out.length,
              total: texts.length,
            })
          }
          return out
        },
        destroy: () => translator.destroy?.(),
      }
    }
    if (engine === "browser") {
      throw new Error(
        state === "missing"
          ? "Questo browser non ha un traduttore integrato: scegli il modello sul dispositivo."
          : "Il traduttore del browser non conosce questa coppia di lingue: scegli il modello sul dispositivo."
      )
    }
  }
  if (!local.canTranslateLocally(sourceLanguage, targetLanguage)) {
    throw new Error(
      "Per questa coppia di lingue non c'è un modello sul dispositivo."
    )
  }
  return {
    engine: "device",
    translate: (texts, progress) =>
      local.translateLocally(texts, sourceLanguage, targetLanguage, (p) =>
        progress?.(p)
      ),
    destroy: () => local.cancelLocalTranslation(),
  }
}

/* Il contenuto da tradurre: pezzi di testo continuo con la loro formattazione */

const REVISION_MARKS = new Set(["insertion", "deletion"])
/** Attributi di testo che si leggono nel documento (didascalie, testo alternativo) */
const TEXT_ATTRS = ["caption", "alt"] as const

type Mark = NonNullable<JSONContent["marks"]>[number]
type Segment = { lead: string; core: string; trail: string }

function splitSpaces(text: string): Segment {
  const lead = text.match(/^\s*/)?.[0] ?? ""
  const rest = text.slice(lead.length)
  const trail = rest.match(/\s*$/)?.[0] ?? ""
  return { lead, core: rest.slice(0, rest.length - trail.length), trail }
}

const sameMark = (a: Mark, b: Mark) =>
  a.type === b.type &&
  JSON.stringify(a.attrs ?? {}) === JSON.stringify(b.attrs ?? {})

const contentMarks = (node: JSONContent) =>
  (node.marks ?? []).filter((m) => !REVISION_MARKS.has(m.type ?? ""))

const sameMarks = (a: Mark[], b: Mark[]) =>
  a.length === b.length && a.every((m) => b.some((n) => sameMark(m, n)))

const hasWords = (text: string) => /\p{L}/u.test(text)

/** Cerca `needle` nel testo tradotto senza badare a maiuscole e accenti */
function locate(haystack: string, needle: string, from: number) {
  const fold = (t: string) =>
    t.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase()
  // la normalizzazione non cambia la lunghezza per le lettere latine comuni
  const h = fold(haystack)
  const n = fold(needle)
  if (!n || h.length !== haystack.length) {
    const at = haystack.indexOf(needle, from)
    return at >= 0 ? at : haystack.indexOf(needle)
  }
  const at = h.indexOf(n, from)
  return at >= 0 ? at : h.indexOf(n)
}

type Plan =
  | {
      kind: "node"
      node: JSONContent
      children?: Plan[]
      attrs?: { name: string; index: number }[]
    }
  | {
      kind: "text"
      index: number
      marks: Mark[]
      /** i tratti con una formattazione in più (una parola in grassetto, un link) */
      parts: {
        index: number
        original: string
        marks: Mark[]
        /** se il tratto apre o chiude la frase: aiuta a ritrovarlo */
        edge: "start" | "end" | null
      }[]
    }

/**
 * Traduce un contenuto tenendo struttura e formattazione. Ogni tratto di testo
 * fra due elementi in linea (a capo, campi, note, immagini) si traduce intero,
 * così il traduttore vede la frase completa; le parole con una formattazione
 * propria si traducono anche da sole e si ritrovano nella frase tradotta. Le
 * revisioni si danno per accettate.
 */
export async function translateContent(
  content: JSONContent,
  translate: DocTranslator["translate"],
  onProgress?: (progress: TranslateProgress) => void
): Promise<JSONContent> {
  const segments: Segment[] = []
  const add = (text: string) => {
    segments.push(splitSpaces(text))
    return segments.length - 1
  }

  const plan = (node: JSONContent): Plan => {
    const attrs = TEXT_ATTRS.flatMap((name) => {
      const value = node.attrs?.[name]
      return typeof value === "string" && hasWords(value)
        ? [{ name, index: add(value) }]
        : []
    })
    const children = node.content ?? []
    if (!children.some((c) => c.type === "text")) {
      return {
        kind: "node",
        node,
        attrs,
        children: children.length ? children.map(plan) : undefined,
      }
    }
    const out: Plan[] = []
    let run: JSONContent[] = []
    const flush = () => {
      if (!run.length) return
      const common = contentMarks(run[0]!).filter((mark) =>
        run.every((n) => contentMarks(n).some((m) => sameMark(m, mark)))
      )
      const whole = run.map((c) => c.text ?? "").join("")
      const index = add(whole)
      const parts: Extract<Plan, { kind: "text" }>["parts"] = []
      let offset = 0
      for (const child of run) {
        const raw = child.text ?? ""
        const before = whole.slice(0, offset)
        const after = whole.slice(offset + raw.length)
        offset += raw.length
        const marks = contentMarks(child)
        const text = raw.trim()
        if (sameMarks(marks, common) || !hasWords(text)) continue
        parts.push({
          index: add(text),
          original: text,
          marks,
          edge: !hasWords(before) ? "start" : !hasWords(after) ? "end" : null,
        })
      }
      out.push({ kind: "text", index, marks: common, parts })
      run = []
    }
    for (const child of children) {
      if (child.type === "text") {
        if (child.marks?.some((m) => m.type === "deletion")) continue
        run.push(child)
      } else {
        flush()
        out.push({ kind: "node", node: child })
      }
    }
    flush()
    return { kind: "node", node, attrs, children: out }
  }

  const root = plan(content)
  const pending = segments
    .map((s, index) => ({ index, text: s.core }))
    .filter((s) => hasWords(s.text))
  const translated = pending.length
    ? await translate(
        pending.map((p) => p.text),
        onProgress
      )
    : []
  const results = new Map(
    pending.map((p, i) => {
      let value = translated[i]?.trim() || p.text
      // i traduttori chiudono volentieri con un punto anche una parola sola
      if (!/[.!?…:;]$/.test(p.text)) value = value.replace(/[.。]$/, "")
      return [p.index, value]
    })
  )
  const full = (index: number) => {
    const segment = segments[index]
    return segment
      ? `${segment.lead}${results.get(index) ?? segment.core}${segment.trail}`
      : ""
  }

  const textNodes = (item: Extract<Plan, { kind: "text" }>) => {
    const text = full(item.index)
    if (!text) return []
    // dove cadono, nella frase tradotta, le parole con formattazione propria
    const ranges: { from: number; to: number; marks: Mark[] }[] = []
    let cursor = 0
    const free = (from: number, to: number) =>
      from >= 0 && to > from && !ranges.some((r) => from < r.to && to > r.from)
    for (const part of item.parts) {
      const found = [results.get(part.index), part.original].some((needle) => {
        if (!needle) return false
        const at = locate(text, needle, cursor)
        if (at < 0 || !free(at, at + needle.length)) return false
        ranges.push({ from: at, to: at + needle.length, marks: part.marks })
        cursor = at + needle.length
        return true
      })
      if (found || !part.edge) continue
      // il traduttore ha scelto altre parole: se il tratto apriva o chiudeva
      // la frase, la formattazione va sulle parole corrispondenti
      const count = Math.max(
        1,
        (results.get(part.index) ?? part.original).split(/\s+/).length
      )
      const words = [...text.matchAll(/[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu)]
      const picked =
        part.edge === "start" ? words.slice(0, count) : words.slice(-count)
      const first = picked[0]
      const last = picked[picked.length - 1]
      if (!first || !last || words.length <= count) continue
      const from = first.index
      const to = last.index + last[0].length
      if (free(from, to)) ranges.push({ from, to, marks: part.marks })
    }
    ranges.sort((a, b) => a.from - b.from)
    const nodes: JSONContent[] = []
    const push = (value: string, marks: Mark[]) => {
      if (!value) return
      nodes.push({
        type: "text",
        text: value,
        ...(marks.length ? { marks } : {}),
      })
    }
    let at = 0
    for (const range of ranges) {
      push(text.slice(at, range.from), item.marks)
      push(text.slice(range.from, range.to), range.marks)
      at = range.to
    }
    push(text.slice(at), item.marks)
    return nodes
  }

  const build = (item: Plan): JSONContent[] => {
    if (item.kind === "text") return textNodes(item)
    const node = item.attrs?.length
      ? {
          ...item.node,
          attrs: {
            ...item.node.attrs,
            ...Object.fromEntries(
              item.attrs.map((a) => [a.name, full(a.index)])
            ),
          },
        }
      : item.node
    if (!item.children) return [node]
    const merged: JSONContent[] = []
    for (const child of item.children.flatMap(build)) {
      const last = merged[merged.length - 1]
      if (
        last?.type === "text" &&
        child.type === "text" &&
        sameMarks(last.marks ?? [], child.marks ?? [])
      ) {
        merged[merged.length - 1] = {
          ...last,
          text: `${last.text ?? ""}${child.text ?? ""}`,
        }
      } else merged.push(child)
    }
    return [{ ...node, content: merged }]
  }

  return build(root)[0] ?? content
}
