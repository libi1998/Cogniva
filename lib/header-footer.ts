import type { BandContent, BandNode, DocTheme, PageNumberFormat } from "./types"
import { cssColor, cssLength, cssValue } from "./css"

import { currentLocale, tr } from "@/lib/i18n/client"
import type { Locale } from "@/lib/i18n/config"
/**
 * Intestazione e piè di pagina a testo libero, come in Word: righe con la
 * loro formattazione, due tabulazioni (al centro e a destra), immagini e dei
 * campi che si riempiono pagina per pagina.
 *
 * I documenti di prima avevano una riga sola in tre parti («sinistra |
 * centro | destra»): si leggono ancora, diventando una riga con le
 * tabulazioni, e il testo semplice resta salvato accanto per le versioni
 * precedenti dell'app.
 */

export type BandVars = {
  page: number
  pages: number
  title: string
  author: string
  date: string
}

export type BandField = "page" | "pages" | "title" | "author" | "date"

const BAND_FIELD_KEYS: BandField[] = [
  "page",
  "pages",
  "title",
  "author",
  "date",
]

/**
 * I campi si scrivono nella lingua dell'app ({page}, {Seite}…). Nei documenti
 * si salvano come li si è scritti: al momento di riempirli valgono tutti, così
 * un documento resta giusto anche aperto in un'altra lingua.
 */
const TOKENS: Record<Locale, Record<BandField, string>> = {
  it: {
    page: "{pagina}",
    pages: "{pagine}",
    title: "{titolo}",
    author: "{autore}",
    date: "{data}",
  },
  en: {
    page: "{page}",
    pages: "{pages}",
    title: "{title}",
    author: "{author}",
    date: "{date}",
  },
  es: {
    page: "{pagina}",
    pages: "{paginas}",
    title: "{titulo}",
    author: "{autor}",
    date: "{fecha}",
  },
  fr: {
    page: "{page}",
    pages: "{pages}",
    title: "{titre}",
    author: "{auteur}",
    date: "{date}",
  },
  de: {
    page: "{seite}",
    pages: "{seiten}",
    title: "{titel}",
    author: "{autor}",
    date: "{datum}",
  },
  pt: {
    page: "{pagina}",
    pages: "{paginas}",
    title: "{titulo}",
    author: "{autor}",
    date: "{data}",
  },
}

/** Il campo nella lingua attiva, da inserire nella riga */
export const bandToken = (field: BandField) => TOKENS[currentLocale()][field]

const ALIASES = new Map<string, string>()
for (const tokens of Object.values(TOKENS))
  for (const [field, token] of Object.entries(tokens))
    ALIASES.set(token, TOKENS.it[field as BandField])

/** Porta i campi di ogni lingua alla forma interna ({pagina}, {titolo}…) */
export function normalizeBand(text: string) {
  return text.replace(/\{[a-z]+\}/gi, (m) => ALIASES.get(m.toLowerCase()) ?? m)
}

export const BAND_FIELDS: { token: string; label: string }[] = [
  {
    get token() {
      return bandToken("page")
    },
    get label() {
      return tr("Numero di pagina")
    },
  },
  {
    get token() {
      return bandToken("pages")
    },
    get label() {
      return tr("Numero di pagine")
    },
  },
  {
    get token() {
      return bandToken("title")
    },
    get label() {
      return tr("Titolo del documento")
    },
  },
  {
    get token() {
      return bandToken("author")
    },
    get label() {
      return tr("Autore")
    },
  },
  {
    get token() {
      return bandToken("date")
    },
    get label() {
      return tr("Data")
    },
  },
]

/** Le tre parti di una riga; senza «|» è tutto a sinistra */
export function bandParts(text: string): [string, string, string] {
  if (!text.includes("|")) return [text, "", ""]
  const [left = "", center = "", right = ""] = text.split("|")
  return [left.trim(), center.trim(), right.trim()]
}

export function joinBand(parts: [string, string, string]) {
  const [left, center, right] = parts.map((p) => p.trim())
  return center || right ? `${left} | ${center} | ${right}` : left
}

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
]

function roman(n: number) {
  let out = ""
  let rest = Math.max(1, Math.min(3999, Math.round(n)))
  for (const [value, glyph] of ROMAN) {
    while (rest >= value) {
      out += glyph
      rest -= value
    }
  }
  return out
}

function alpha(n: number) {
  let out = ""
  let rest = Math.max(1, Math.round(n))
  while (rest > 0) {
    rest -= 1
    out = String.fromCharCode(65 + (rest % 26)) + out
    rest = Math.floor(rest / 26)
  }
  return out
}

export function formatPageNumber(n: number, format: PageNumberFormat) {
  switch (format) {
    case "dash":
      return `- ${n} -`
    case "roman":
      return roman(n).toLowerCase()
    case "ROMAN":
      return roman(n)
    case "alpha":
      return alpha(n).toLowerCase()
    case "ALPHA":
      return alpha(n)
    default:
      return String(n)
  }
}

export const PAGE_NUMBER_FORMATS: { value: PageNumberFormat; label: string }[] =
  [
    { value: "arabic", label: "1, 2, 3…" },
    { value: "dash", label: "- 1 -, - 2 -…" },
    {
      value: "roman",
      get label() {
        return tr("i, ii, iii…")
      },
    },
    {
      value: "ROMAN",
      get label() {
        return tr("I, II, III…")
      },
    },
    {
      value: "alpha",
      get label() {
        return tr("a, b, c…")
      },
    },
    {
      value: "ALPHA",
      get label() {
        return tr("A, B, C…")
      },
    },
  ]

export function fillBand(text: string, vars: BandVars, theme: DocTheme) {
  return normalizeBand(text)
    .replaceAll(
      "{pagina}",
      formatPageNumber(vars.page, theme.pageNumberFormat ?? "arabic")
    )
    .replaceAll("{pagine}", String(vars.pages))
    .replaceAll("{titolo}", vars.title)
    .replaceAll("{autore}", vars.author)
    .replaceAll("{data}", vars.date)
}

export const HEADER_PRESETS: { label: string; hint: string; value: string }[] =
  [
    {
      get label() {
        return tr("Vuota")
      },
      get hint() {
        return tr("Solo testo a sinistra")
      },
      get value() {
        return tr("Intestazione")
      },
    },
    {
      get label() {
        return tr("Tre colonne")
      },
      get hint() {
        return tr("Sinistra, centro, destra")
      },
      get value() {
        return `${bandToken("title")} | | ${bandToken("date")}`
      },
    },
    {
      get label() {
        return tr("Titolo")
      },
      get hint() {
        return tr("Il titolo al centro")
      },
      get value() {
        return ` | ${bandToken("title")} | `
      },
    },
    {
      get label() {
        return tr("Autore e data")
      },
      get hint() {
        return tr("Autore a sinistra, data a destra")
      },
      get value() {
        return `${bandToken("author")} | | ${bandToken("date")}`
      },
    },
    {
      get label() {
        return tr("Riservato")
      },
      get hint() {
        return tr("Etichetta e titolo")
      },
      get value() {
        return `${tr("RISERVATO")} | | ${bandToken("title")}`
      },
    },
  ]

export const FOOTER_PRESETS: { label: string; hint: string; value: string }[] =
  [
    {
      get label() {
        return tr("Vuoto")
      },
      get hint() {
        return tr("Solo testo a sinistra")
      },
      get value() {
        return tr("Piè di pagina")
      },
    },
    {
      get label() {
        return tr("Pagina X di Y")
      },
      get hint() {
        return tr("Al centro")
      },
      get value() {
        return ` | ${tr("Pagina {page} di {total}", { page: bandToken("page"), total: bandToken("pages") })} | `
      },
    },
    {
      get label() {
        return tr("Titolo e pagina")
      },
      get hint() {
        return tr("Titolo a sinistra, numero a destra")
      },
      get value() {
        return `${bandToken("title")} | | ${bandToken("page")}`
      },
    },
    {
      get label() {
        return tr("Autore, data e pagina")
      },
      get hint() {
        return tr("Tre colonne")
      },
      get value() {
        return `${bandToken("author")} | ${bandToken("date")} | ${bandToken("page")}`
      },
    },
  ]

/* --------------------------- testo libero -------------------------------- */

/** Il campo di un segnaposto interno ({pagina} → page) */
const FIELD_OF: Record<string, BandField> = Object.fromEntries(
  BAND_FIELD_KEYS.map((field) => [TOKENS.it[field], field])
)

/** Testo e campi di un pezzo di riga scritta a mano («Pagina {pagina}») */
function inlineFromText(text: string): BandNode[] {
  return text
    .split(/(\{[a-z]+\})/i)
    .filter(Boolean)
    .map((piece) => {
      const field = FIELD_OF[piece]
      return field
        ? { type: "bandField", attrs: { field } }
        : { type: "text", text: piece }
    })
}

/**
 * Una riga del vecchio formato («sinistra | centro | destra») come testo
 * libero: una riga con le tabulazioni, che mettono le parti al centro e a
 * destra come le tabulazioni predefinite di Word.
 */
export function bandFromText(text: string): BandContent | null {
  const clean = normalizeBand(text)
  if (!clean.trim()) return null
  const [left, center, right] = bandParts(clean)
  const content: BandNode[] = inlineFromText(left)
  if (center || right) {
    content.push({ type: "bandTab" }, ...inlineFromText(center))
    if (right) content.push({ type: "bandTab" }, ...inlineFromText(right))
  }
  return { type: "doc", content: [{ type: "paragraph", content }] }
}

const ALIGNS = new Set(["left", "center", "right", "justify"])
const BORDERS = new Set(["top", "bottom"])
const SIMPLE_MARKS = new Set([
  "bold",
  "italic",
  "underline",
  "strike",
  "subscript",
  "superscript",
])
/** immagini salvate nel documento: solo quelle dentro al file, mai indirizzi */
const IMAGE_SRC =
  /^data:image\/(?:png|jpe?g|gif|webp|svg\+xml);base64,[a-z0-9+/=\s]+$/i

/** Le formattazioni che un'intestazione può portare, con valori puliti */
function cleanMarks(marks: unknown): BandNode["marks"] {
  if (!Array.isArray(marks)) return undefined
  const out: NonNullable<BandNode["marks"]> = []
  for (const mark of marks) {
    const type = (mark as { type?: unknown })?.type
    const attrs = ((mark as { attrs?: unknown })?.attrs ?? {}) as Record<
      string,
      unknown
    >
    if (typeof type !== "string") continue
    if (SIMPLE_MARKS.has(type)) out.push({ type })
    else if (type === "highlight") {
      const color = cssColor(attrs.color)
      out.push(color ? { type, attrs: { color } } : { type })
    } else if (type === "textStyle") {
      const size = cssLength(attrs.fontSize)
      const clean = {
        color: cssColor(attrs.color),
        // un corpo esagerato coprirebbe mezza pagina
        fontSize:
          size && parseFloat(size) > 0 && parseFloat(size) <= 96 ? size : null,
        fontFamily: cssValue(attrs.fontFamily),
      }
      if (clean.color || clean.fontSize || clean.fontFamily) {
        out.push({ type, attrs: clean })
      }
    }
  }
  return out.length ? out : undefined
}

function cleanInline(node: BandNode): BandNode | null {
  switch (node.type) {
    case "text": {
      if (typeof node.text !== "string" || !node.text) return null
      const marks = cleanMarks(node.marks)
      return {
        type: "text",
        text: node.text.slice(0, 2000),
        ...(marks ? { marks } : {}),
      }
    }
    case "hardBreak":
    case "bandTab":
      return { type: node.type }
    case "bandField": {
      const field = node.attrs?.field
      return BAND_FIELD_KEYS.includes(field as BandField)
        ? { type: "bandField", attrs: { field } }
        : null
    }
    case "bandImage": {
      const src = node.attrs?.src
      if (
        typeof src !== "string" ||
        src.length > 4_000_000 ||
        !IMAGE_SRC.test(src)
      )
        return null
      const height = Math.min(
        400,
        Math.max(6, Number(node.attrs?.height) || 40)
      )
      const alt =
        typeof node.attrs?.alt === "string" ? node.attrs.alt.slice(0, 200) : ""
      return {
        type: "bandImage",
        attrs: { src, height: Math.round(height), alt },
      }
    }
    default:
      return null
  }
}

/**
 * Un'intestazione salvata, ripulita: solo righe, testo con le sue
 * formattazioni, tabulazioni, immagini dentro al file e campi. Un file
 * arrivato da fuori non può portare altro (vedi la sicurezza del README).
 */
export function sanitizeBand(raw: unknown): BandContent | null {
  if (!raw || typeof raw !== "object") return null
  const doc = raw as { type?: unknown; content?: unknown }
  if (doc.type !== "doc" || !Array.isArray(doc.content)) return null
  const blocks: BandNode[] = []
  for (const block of doc.content.slice(0, 40) as BandNode[]) {
    if (block?.type !== "paragraph") continue
    const align = block.attrs?.textAlign
    const border = block.attrs?.border
    const content = (Array.isArray(block.content) ? block.content : [])
      .slice(0, 400)
      .map((n) => cleanInline(n))
      .filter((n): n is BandNode => n !== null)
    blocks.push({
      type: "paragraph",
      attrs: {
        textAlign: ALIGNS.has(String(align)) ? align : null,
        border: BORDERS.has(String(border)) ? border : null,
      },
      ...(content.length ? { content } : {}),
    })
  }
  return blocks.length ? { type: "doc", content: blocks } : null
}

const sanitized = new WeakMap<object, BandContent | null>()

/**
 * L'intestazione o il piè di pagina di un documento, a testo libero: quello
 * scritto con il testo libero, oppure la riga del vecchio formato
 */
export function bandContent(
  theme: DocTheme,
  where: "header" | "footer"
): BandContent | null {
  const raw = where === "header" ? theme.headerContent : theme.footerContent
  if (raw && typeof raw === "object") {
    if (!sanitized.has(raw)) sanitized.set(raw, sanitizeBand(raw))
    return sanitized.get(raw) ?? null
  }
  const text = where === "header" ? theme.header : theme.footer
  return text ? bandFromText(text) : null
}

/** C'è qualcosa da mostrare: testo, un campo, un'immagine o una linea */
export function bandHasContent(content: BandContent | null): boolean {
  return Boolean(
    content?.content?.some(
      (p) =>
        Boolean(p.attrs?.border) ||
        p.content?.some(
          (n) =>
            n.type === "bandField" ||
            n.type === "bandImage" ||
            (n.type === "text" && Boolean(n.text?.trim()))
        )
    )
  )
}

export function hasBand(theme: DocTheme, where: "header" | "footer") {
  return bandHasContent(bandContent(theme, where))
}

/** Le parti di una riga separate dalle tabulazioni */
export function bandSegments(paragraph: BandNode): BandNode[][] {
  const segments: BandNode[][] = [[]]
  for (const node of paragraph.content ?? []) {
    if (node.type === "bandTab") segments.push([])
    else segments[segments.length - 1].push(node)
  }
  return segments
}

const hasPageField = (content: BandContent | null) =>
  Boolean(
    content?.content?.some((p) =>
      p.content?.some(
        (n) => n.type === "bandField" && n.attrs?.field === "page"
      )
    )
  )

/**
 * Il riassunto in testo semplice («sinistra | centro | destra») della prima
 * riga: resta salvato accanto al testo libero per le versioni precedenti
 */
export function bandText(content: BandContent | null): string {
  const first = content?.content?.find((p) =>
    p.content?.some((n) => n.type !== "hardBreak")
  )
  if (!first) return ""
  const text = (nodes: BandNode[]) =>
    nodes
      .map((n) =>
        n.type === "text"
          ? (n.text ?? "").replace(/\|/g, "")
          : n.type === "bandField"
            ? (TOKENS.it[n.attrs?.field as BandField] ?? "")
            : n.type === "hardBreak"
              ? " "
              : ""
      )
      .join("")
  const [left = [], center = [], ...rest] = bandSegments(first)
  return joinBand([text(left), text(center), text(rest.flat())])
}

/**
 * Il numero di pagina nella posizione scelta (Inserisci › Numero di pagina),
 * se l'intestazione non lo contiene già: nella parte a sinistra, al centro o
 * a destra della prima riga, come faceva la riga in tre parti
 */
function withPageNumber(
  content: BandContent | null,
  column: "left" | "center" | "right"
): BandContent {
  const paragraphs = content?.content?.length
    ? content.content
    : [{ type: "paragraph" }]
  const [first, ...rest] = paragraphs
  const segments = bandSegments(first)
  const index = column === "left" ? 0 : column === "center" ? 1 : 2
  while (segments.length <= index) segments.push([])
  const target = segments[index]
  if (target.length) target.push({ type: "text", text: "  " })
  target.push({ type: "bandField", attrs: { field: "page" } })
  const joined: BandNode[] = segments.flatMap((segment, i) =>
    i ? [{ type: "bandTab" }, ...segment] : segment
  )
  return {
    type: "doc",
    content: [{ ...first, content: joined }, ...rest],
  }
}

/**
 * L'intestazione o il piè di pagina di ogni pagina, prima di riempire i
 * campi: con il numero di pagina dove lo si è chiesto
 */
export function bandLayout(
  where: "header" | "footer",
  theme: DocTheme
): BandContent | null {
  let content = bandContent(theme, where)
  const position = theme.pageNumbers ?? "none"
  const [row, col] = position.split("-") as [string, string | undefined]
  if (
    position !== "none" &&
    row === (where === "header" ? "top" : "bottom") &&
    !hasPageField(content)
  ) {
    content = withPageNumber(
      content,
      col === "left" ? "left" : col === "center" ? "center" : "right"
    )
  }
  return bandHasContent(content) ? content : null
}

/** Come `bandLayout`, e niente sulla prima pagina «diversa» */
export function bandForPage(
  where: "header" | "footer",
  theme: DocTheme,
  page: number
): BandContent | null {
  if (theme.differentFirstPage && page === (theme.pageNumberStart ?? 1)) {
    return null
  }
  return bandLayout(where, theme)
}

/** Il valore di un campo su una pagina */
export function bandFieldValue(
  field: BandField,
  vars: BandVars,
  theme: DocTheme
): string {
  switch (field) {
    case "page":
      return formatPageNumber(vars.page, theme.pageNumberFormat ?? "arabic")
    case "pages":
      return String(vars.pages)
    case "title":
      return vars.title
    case "author":
      return vars.author
    case "date":
      return vars.date
  }
}
