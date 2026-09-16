import type { CitationStyle, DocSource, SourceKind } from "./types"

import { tr, currentLocale } from "@/lib/i18n/client"
/**
 * Citazioni e bibliografia negli stili che offre Word. Le funzioni restituiscono
 * pezzi di testo con il corsivo segnato, così le usano sia l'editor (DOM) sia
 * l'anteprima nella finestra delle fonti (React).
 */

export const CITATION_STYLES: { value: CitationStyle; label: string }[] = [
  {
    value: "apa",
    get label() {
      return tr("APA (7ª ed.)")
    },
  },
  {
    value: "mla",
    get label() {
      return tr("MLA (9ª ed.)")
    },
  },
  {
    value: "chicago",
    get label() {
      return tr("Chicago (autore-data)")
    },
  },
  { value: "iso690", label: "ISO 690" },
]

export const SOURCE_KINDS: { value: SourceKind; label: string }[] = [
  {
    value: "book",
    get label() {
      return tr("Libro")
    },
  },
  {
    value: "article",
    get label() {
      return tr("Articolo di rivista")
    },
  },
  {
    value: "web",
    get label() {
      return tr("Sito web")
    },
  },
  {
    value: "report",
    get label() {
      return tr("Rapporto")
    },
  },
]

/** Il titolo della bibliografia che usa ogni stile */
export const BIBLIOGRAPHY_TITLES: Record<CitationStyle, string> = {
  get apa() {
    return tr("Riferimenti bibliografici")
  },
  get mla() {
    return tr("Opere citate")
  },
  get chicago() {
    return tr("Bibliografia")
  },
  get iso690() {
    return tr("Bibliografia")
  },
}

export type Piece = { text: string; italic?: boolean }

type Person = { last: string; first: string }

/** «Rossi, Mario; Bianchi, Luca» oppure «Mario Rossi, Luca Bianchi» */
function parseAuthors(raw: string): Person[] {
  const chunks = raw.includes(";")
    ? raw.split(";")
    : raw.split(/\s+(?:e|and|&)\s+/)
  const out: Person[] = []
  for (const chunk of chunks) {
    const name = chunk.trim()
    if (!name) continue
    if (name.includes(",")) {
      const [last, first] = name.split(",").map((s) => s.trim())
      out.push({ last, first: first ?? "" })
    } else {
      const parts = name.split(/\s+/)
      out.push({
        last: parts[parts.length - 1],
        first: parts.slice(0, -1).join(" "),
      })
    }
  }
  return out
}

const initials = (first: string) =>
  first
    .split(/[\s-]+/)
    .filter(Boolean)
    .map((n) => `${n[0].toUpperCase()}.`)
    .join(" ")

const year = (s: DocSource) => s.year.trim() || "s.d."

function joinNames(names: string[], and: string) {
  if (names.length <= 1) return names.join("")
  if (names.length === 2) return `${names[0]} ${and} ${names[1]}`
  return `${names.slice(0, -1).join(", ")}, ${and} ${names[names.length - 1]}`
}

/** Citazione nel testo, per esempio «(Rossi, 2020, p. 45)» */
export function inTextCitation(
  style: CitationStyle,
  source: DocSource | undefined,
  pages = ""
): string {
  if (!source) return tr("(Fonte mancante)")
  const people = parseAuthors(source.authors)
  const title = source.title.trim() || tr("Senza titolo")
  const p = pages.trim()

  const lead = (and: string, upper = false, etAl = 3) => {
    if (!people.length) return upper ? title.toUpperCase() : title
    const last = people.map((x) => (upper ? x.last.toUpperCase() : x.last))
    if (people.length >= etAl) return `${last[0]} et al.`
    return last.length === 2 ? `${last[0]} ${and} ${last[1]}` : last[0]
  }

  switch (style) {
    case "mla":
      return `(${lead("and")}${p ? ` ${p}` : ""})`
    case "chicago":
      return `(${lead("and", false, 4)} ${year(source)}${p ? `, ${p}` : ""})`
    case "iso690":
      return `(${lead("e", true)}, ${year(source)}${p ? `, p. ${p}` : ""})`
    default:
      return `(${lead("&")}, ${year(source)}${p ? `, p. ${p}` : ""})`
  }
}

/** Voce della bibliografia */
export function referenceEntry(style: CitationStyle, s: DocSource): Piece[] {
  const people = parseAuthors(s.authors)
  const title = s.title.trim() || tr("Senza titolo")
  const y = year(s)
  const pub = s.publisher.trim()
  const city = s.city.trim()
  const vol = s.volume.trim()
  const pages = s.pages.trim()
  const url = s.url.trim()
  const out: Piece[] = []
  const t = (text: string, italic = false) => {
    if (text) out.push({ text, italic })
  }

  if (style === "apa") {
    const names = people.map((x) =>
      x.first ? `${x.last}, ${initials(x.first)}` : x.last
    )
    // APA: «Rossi, M., & Bianchi, L.», con la virgola anche fra due autori
    const apaNames =
      names.length === 2 ? `${names[0]}, & ${names[1]}` : joinNames(names, "&")
    t(names.length ? `${apaNames} ` : "")
    t(`(${y}). `)
    if (s.kind === "article") {
      t(`${title}. `)
      t(pub, true)
      if (vol) t(`, ${vol}`, true)
      t(pages ? `, ${pages}.` : ".")
    } else {
      t(title, true)
      t(". ")
      t(pub ? `${pub}.` : "")
    }
    if (url) t(` ${url}`)
    return out
  }

  if (style === "mla") {
    const names = people.map((x, i) =>
      i === 0 && x.first
        ? `${x.last}, ${x.first}`
        : `${x.first} ${x.last}`.trim()
    )
    const lead =
      people.length >= 3 ? `${names[0]}, et al` : joinNames(names, "and")
    t(lead ? `${lead}. ` : "")
    if (s.kind === "book" || s.kind === "report") {
      t(title, true)
      t(`. ${pub ? `${pub}, ` : ""}${y}.`)
    } else {
      t(`“${title}.” `)
      t(pub, true)
      t(
        `${vol ? `, vol. ${vol}` : ""}, ${y}${pages ? `, pp. ${pages}` : ""}${url ? `, ${url}` : ""}.`
      )
    }
    return out
  }

  if (style === "chicago") {
    const names = people.map((x, i) =>
      i === 0 && x.first
        ? `${x.last}, ${x.first}`
        : `${x.first} ${x.last}`.trim()
    )
    t(names.length ? `${joinNames(names, "and")}. ` : "")
    t(`${y}. `)
    if (s.kind === "article") {
      t(`“${title}.” `)
      t(pub, true)
      t(`${vol ? ` ${vol}` : ""}${pages ? `: ${pages}` : ""}.`)
    } else if (s.kind === "web") {
      t(`“${title}.” `)
      t(pub ? `${pub}. ` : "")
    } else {
      t(title, true)
      t(`. ${city ? `${city}: ` : ""}${pub ? `${pub}.` : ""}`)
    }
    if (url) t(` ${url}.`)
    return out
  }

  // ISO 690
  const names = people.map((x) =>
    x.first ? `${x.last.toUpperCase()}, ${x.first}` : x.last.toUpperCase()
  )
  t(names.length ? `${joinNames(names, tr("e"))}. ` : "")
  if (s.kind === "article") {
    t(`${title}. `)
    t(pub, true)
    t(`. ${y}${vol ? `, vol. ${vol}` : ""}${pages ? `, pp. ${pages}` : ""}.`)
  } else if (s.kind === "web") {
    t(title, true)
    t(" [online]. ")
    t(`${pub ? `${pub}, ` : ""}${y}`)
    t(
      s.accessed.trim()
        ? ` [${tr("consultato il {date}", { date: s.accessed.trim() })}]. `
        : ". "
    )
    t(url ? tr("Disponibile da: {url}", { url }) : "")
  } else {
    t(title, true)
    t(`. ${city ? `${city}: ` : ""}${pub ? `${pub}, ` : ""}${y}.`)
  }
  return out
}

/** Ordine della bibliografia: cognome del primo autore, poi anno */
export function sortSources(list: DocSource[]) {
  const key = (s: DocSource) =>
    (parseAuthors(s.authors)[0]?.last ?? s.title).toLocaleLowerCase("it")
  return [...list].sort(
    (a, b) =>
      key(a).localeCompare(key(b), currentLocale()) ||
      a.year.localeCompare(b.year)
  )
}

export function emptySource(id: string): DocSource {
  return {
    id,
    kind: "book",
    authors: "",
    title: "",
    year: "",
    publisher: "",
    city: "",
    volume: "",
    pages: "",
    url: "",
    accessed: "",
  }
}

/** Etichetta breve di una fonte nei menu */
export function sourceLabel(s: DocSource) {
  const who = parseAuthors(s.authors)[0]?.last
  return `${who ? `${who}, ` : ""}${s.title || tr("Senza titolo")}${s.year ? ` (${s.year})` : ""}`
}
