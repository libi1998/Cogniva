import type { WFile } from "./types"

type TextNode = { text?: string; content?: TextNode[] }

/** Testo senza accenti e in minuscolo: «perché» si trova cercando «perche» */
export function normalizeSearch(text: string) {
  return text
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
}

const cache = new WeakMap<WFile, string>()
const LIMIT = 40_000

function collect(
  node: TextNode | undefined,
  out: string[],
  size: { n: number }
) {
  if (!node || size.n > LIMIT) return
  if (node.text) {
    out.push(node.text)
    size.n += node.text.length
  }
  node.content?.forEach((child) => collect(child, out, size))
}

/**
 * Tutto il testo cercabile di un file: titolo e contenuto dei documenti,
 * testi di forme, tabelle e grafici delle board. Si calcola una volta per
 * versione del file.
 */
export function searchText(file: WFile): string {
  const cached = cache.get(file)
  if (cached !== undefined) return cached
  const out: string[] = [file.title]
  const size = { n: 0 }
  if (file.kind === "doc") {
    collect(file.data.content as TextNode, out, size)
  } else {
    for (const node of file.data.nodes) {
      if (size.n > LIMIT) break
      const text = node.text ?? ""
      if (text) out.push(text)
      // tabelle e grafici arrivano anche da file importati: un campo mancante
      // non deve far fallire la ricerca di tutta la home
      if (Array.isArray(node.table?.cells)) out.push(...node.table.cells)
      if (node.chart) {
        out.push(node.chart.title ?? "")
        if (Array.isArray(node.chart.categories))
          out.push(...node.chart.categories)
      }
      size.n += text.length
    }
    for (const edge of file.data.edges) if (edge.label) out.push(edge.label)
  }
  const text = normalizeSearch(out.join(" "))
  cache.set(file, text)
  return text
}

/** Il pezzo di testo intorno alla prima corrispondenza, per le anteprime */
export function searchSnippet(file: WFile, query: string, radius = 48) {
  const q = normalizeSearch(query.trim())
  if (!q) return ""
  const text = searchText(file)
  const at = text.indexOf(q)
  if (at < 0 || at < file.title.length) return ""
  const start = Math.max(0, at - radius)
  const end = Math.min(text.length, at + q.length + radius)
  return `${start > 0 ? "…" : ""}${text.slice(start, end)}${end < text.length ? "…" : ""}`
}
