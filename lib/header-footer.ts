import type { DocTheme, PageNumberFormat } from "./types"

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

export const BAND_FIELDS: { token: string; label: string }[] = [
  { token: "{pagina}", label: "Numero di pagina" },
  { token: "{pagine}", label: "Numero di pagine" },
  { token: "{titolo}", label: "Titolo del documento" },
  { token: "{autore}", label: "Autore" },
  { token: "{data}", label: "Data" },
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
    { value: "roman", label: "i, ii, iii…" },
    { value: "ROMAN", label: "I, II, III…" },
    { value: "alpha", label: "a, b, c…" },
    { value: "ALPHA", label: "A, B, C…" },
  ]

export function fillBand(text: string, vars: BandVars, theme: DocTheme) {
  return text
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
  const parts = bandParts(where === "header" ? theme.header : theme.footer)
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
    { label: "Vuota", hint: "Solo testo a sinistra", value: "Intestazione" },
    {
      label: "Tre colonne",
      hint: "Sinistra, centro, destra",
      value: "{titolo} | | {data}",
    },
    { label: "Titolo", hint: "Il titolo al centro", value: " | {titolo} | " },
    {
      label: "Autore e data",
      hint: "Autore a sinistra, data a destra",
      value: "{autore} | | {data}",
    },
    {
      label: "Riservato",
      hint: "Etichetta e titolo",
      value: "RISERVATO | | {titolo}",
    },
  ]

export const FOOTER_PRESETS: { label: string; hint: string; value: string }[] =
  [
    { label: "Vuoto", hint: "Solo testo a sinistra", value: "Piè di pagina" },
    {
      label: "Pagina X di Y",
      hint: "Al centro",
      value: " | Pagina {pagina} di {pagine} | ",
    },
    {
      label: "Titolo e pagina",
      hint: "Titolo a sinistra, numero a destra",
      value: "{titolo} | | {pagina}",
    },
    {
      label: "Autore, data e pagina",
      hint: "Tre colonne",
      value: "{autore} | {data} | {pagina}",
    },
  ]
