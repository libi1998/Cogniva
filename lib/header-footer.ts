import type { DocTheme, PageNumberFormat } from "./types"

import { currentLocale, tr } from "@/lib/i18n/client"
import type { Locale } from "@/lib/i18n/config"
/**
 * Intestazione e piè di pagina: una riga in tre parti («sinistra | centro |
 * destra») con dei campi che si riempiono pagina per pagina.
 */

export type BandVars = {
  page: number
  pages: number
  title: string
  author: string
  date: string
}

type BandField = "page" | "pages" | "title" | "author" | "date"

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

/**
 * Le tre parti già riempite per una pagina, con il numero di pagina nella
 * posizione scelta (se la riga non lo contiene già)
 */
export function bandForPage(
  where: "header" | "footer",
  theme: DocTheme,
  vars: BandVars
): [string, string, string] | null {
  if (theme.differentFirstPage && vars.page === (theme.pageNumberStart ?? 1)) {
    return null
  }
  const parts = bandParts(
    normalizeBand(where === "header" ? theme.header : theme.footer)
  )
  const position = theme.pageNumbers ?? "none"
  const [row, col] = position.split("-") as [string, string | undefined]
  if (
    position !== "none" &&
    row === (where === "header" ? "top" : "bottom") &&
    !parts.some((p) => p.includes("{pagina}"))
  ) {
    const index = col === "left" ? 0 : col === "center" ? 1 : 2
    parts[index] = [parts[index], "{pagina}"].filter(Boolean).join("  ")
  }
  const filled = parts.map((p) => fillBand(p, vars, theme)) as [
    string,
    string,
    string,
  ]
  return filled.some(Boolean) ? filled : null
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
