import type { Mark, Node as PMNode } from "@tiptap/pm/model"
import {
  BIBLIOGRAPHY_TITLES,
  inTextCitation,
  referenceEntry,
  sortSources,
} from "./citations"
import { parseChartAttr } from "./chart"
import { tr } from "@/lib/i18n/client"
import type { CitationStyle, DocSource } from "./types"

/**
 * Esportazione in Markdown (GitHub Flavored): titoli, enfasi, collegamenti,
 * elenchi anche annidati e di controllo, tabelle, formule in $…$, note
 * [^1] e bibliografia. I grafici diventano la tabella dei loro dati.
 */

type Ctx = {
  notes: string[]
  sources: DocSource[]
  style: CitationStyle
  /** il valore attuale dei campi (data, pagina, riferimenti…) */
  fields: Map<PMNode, string>
}

const escapeText = (text: string) =>
  text
    .replace(/([\\`*_[\]<>])/g, "\\$1")
    .replace(/^(\s*)([#+-]|\d+\.)(\s)/, "$1\\$2$3")

const escapeCell = (text: string) =>
  text.replace(/\|/g, "\\|").replace(/\n/g, " ")

/** Marchi in ordine stabile: così l'apertura e la chiusura si annidano bene */
const MARK_ORDER = [
  "highlight",
  "link",
  "bold",
  "italic",
  "strike",
  "code",
  "superscript",
  "subscript",
  "underline",
]

function wrap(mark: Mark): [string, string] {
  switch (mark.type.name) {
    case "bold":
      return ["**", "**"]
    case "italic":
      return ["_", "_"]
    case "strike":
      return ["~~", "~~"]
    case "superscript":
      return ["<sup>", "</sup>"]
    case "subscript":
      return ["<sub>", "</sub>"]
    case "underline":
      return ["<u>", "</u>"]
    case "highlight":
      return ["<mark>", "</mark>"]
    case "link":
      return ["[", `](${String(mark.attrs.href ?? "").replace(/\)/g, "%29")})`]
    default:
      return ["", ""]
  }
}

function inline(node: PMNode, ctx: Ctx): string {
  let out = ""
  const open: Mark[] = []
  // gli spazi ai bordi di un testo formattato stanno fuori dai delimitatori:
  // «**parola **» non è grassetto in Markdown
  let pendingSpace = ""

  const closeUntil = (keep: number) => {
    while (open.length > keep) out += wrap(open.pop()!)[1]
  }

  node.forEach((child) => {
    // il Markdown è il testo finale: le parti eliminate nelle revisioni no
    if (child.marks.some((m) => m.type.name === "deletion")) return
    const marks = child.isText
      ? child.marks
          .filter((m) => MARK_ORDER.includes(m.type.name))
          .sort(
            (a, b) =>
              MARK_ORDER.indexOf(a.type.name) - MARK_ORDER.indexOf(b.type.name)
          )
      : []
    // i marchi aperti restano finché il testo successivo li porta ancora
    let keep = 0
    while (keep < open.length && marks.some((m) => m.eq(open[keep]))) keep++
    closeUntil(keep)

    if (child.isText) {
      const raw = child.text ?? ""
      const code = marks.some((m) => m.type.name === "code")
      const lead = code ? "" : (raw.match(/^\s+/)?.[0] ?? "")
      const trail = code ? "" : (raw.match(/\s+$/)?.[0] ?? "")
      const body = raw.slice(lead.length, raw.length - trail.length)
      const opening = marks.filter(
        (m) => m.type.name !== "code" && !open.some((o) => o.eq(m))
      )
      if (!body) {
        pendingSpace += raw
        return
      }
      out += pendingSpace + lead
      pendingSpace = ""
      for (const mark of opening) {
        out += wrap(mark)[0]
        open.push(mark)
      }
      out += code ? `\`${body.replace(/`/g, "\u200b`")}\`` : escapeText(body)
      pendingSpace = trail
      return
    }

    closeUntil(0)
    out += pendingSpace
    pendingSpace = ""
    switch (child.type.name) {
      case "hardBreak":
        out += "  \n"
        break
      case "mathInline":
        out += `$${String(child.attrs.latex ?? "")}$`
        break
      case "field":
        out += escapeText(ctx.fields.get(child) ?? "")
        break
      case "footnote":
        ctx.notes.push(String(child.attrs.text ?? ""))
        out += `[^${ctx.notes.length}]`
        break
      case "citation": {
        const source = ctx.sources.find((s) => s.id === child.attrs.sourceId)
        out += source
          ? inTextCitation(ctx.style, source, String(child.attrs.pages ?? ""))
          : ""
        break
      }
      default:
        out += escapeText(child.textContent)
    }
  })
  closeUntil(0)
  return out + pendingSpace
}

function table(node: PMNode, ctx: Ctx): string {
  const rows: string[][] = []
  node.forEach((row) => {
    const cells: string[] = []
    row.forEach((cell) => {
      const parts: string[] = []
      cell.forEach((child) =>
        parts.push(child.isTextblock ? inline(child, ctx) : child.textContent)
      )
      cells.push(escapeCell(parts.join(" ")))
      for (let i = 1; i < Number(cell.attrs.colspan ?? 1); i++) cells.push("")
    })
    rows.push(cells)
  })
  if (!rows.length) return ""
  const width = Math.max(...rows.map((r) => r.length))
  const line = (cells: string[]) =>
    `| ${Array.from({ length: width }, (_, i) => cells[i] ?? "").join(" | ")} |`
  return [
    line(rows[0]),
    `| ${Array(width).fill("---").join(" | ")} |`,
    ...rows.slice(1).map(line),
  ].join("\n")
}

function blocks(parent: PMNode, ctx: Ctx, indent = ""): string[] {
  const out: string[] = []
  parent.forEach((node) => {
    const md = block(node, ctx, indent)
    if (md !== null) out.push(md)
  })
  return out
}

function listItems(node: PMNode, ctx: Ctx, indent: string): string {
  const ordered = node.type.name === "orderedList"
  const task = node.type.name === "taskList"
  let n = Number(node.attrs.start ?? 1) || 1
  const items: string[] = []
  node.forEach((item) => {
    const marker = ordered ? `${n++}.` : "-"
    const box = task ? (item.attrs.checked ? "[x] " : "[ ] ") : ""
    const pad = `${indent}${" ".repeat(marker.length + 1)}`
    const parts = blocks(item, ctx, pad)
    const [first = "", ...rest] = parts
    items.push(
      `${indent}${marker} ${box}${first.trimStart()}${rest.length ? `\n${rest.join("\n")}` : ""}`
    )
  })
  return items.join("\n")
}

function block(node: PMNode, ctx: Ctx, indent: string): string | null {
  const prefix = (text: string) =>
    text
      .split("\n")
      .map((line) => indent + line)
      .join("\n")

  switch (node.type.name) {
    case "docTitle":
      return node.textContent.trim() ? `# ${inline(node, ctx)}` : null
    case "heading":
      // il titolo del documento è l'unico di livello 1: i titoli scendono di uno
      return prefix(
        `${"#".repeat(Math.min(6, Number(node.attrs.level) + 1))} ${inline(node, ctx)}`
      )
    case "paragraph": {
      const text = inline(node, ctx)
      return text ? prefix(text) : ""
    }
    case "blockquote":
      return blocks(node, ctx)
        .join("\n\n")
        .split("\n")
        .map((line) => `${indent}> ${line}`.trimEnd())
        .join("\n")
    case "codeBlock":
      return prefix(
        `\`\`\`${node.attrs.language ?? ""}\n${node.textContent}\n\`\`\``
      )
    case "bulletList":
    case "orderedList":
    case "taskList":
      return listItems(node, ctx, indent)
    case "table":
      return prefix(table(node, ctx))
    case "horizontalRule":
      return prefix("---")
    case "pageBreak":
      return prefix('<div style="page-break-after: always"></div>')
    case "columnBreak":
      return null
    case "mathBlock":
      return prefix(`$$\n${String(node.attrs.latex ?? "")}\n$$`)
    case "image": {
      const alt = String(node.attrs.alt ?? "").replace(/[[\]]/g, "")
      return prefix(`![${alt}](${String(node.attrs.src ?? "")})`)
    }
    case "video": {
      const src = String(node.attrs.src ?? "")
      return prefix(`[▶ Video](${src})`)
    }
    case "model3d": {
      const alt = String(
        node.attrs.alt || node.attrs.name || tr("Modello 3D")
      ).replace(/[[\]]/g, "")
      const poster = String(node.attrs.poster ?? "")
      return prefix(
        poster
          ? `![${alt}](${poster})`
          : `_${tr("Modello 3D: {name}", { name: alt })}_`
      )
    }
    case "boardEmbed":
      return prefix(
        `_${tr("Board: {caption}", { caption: String(node.attrs.caption || tr("incorporata||board nel documento")) })}_`
      )
    case "chart": {
      const spec = parseChartAttr(node.attrs.spec)
      const head = `| ${["", ...spec.series.map((s) => escapeCell(s.name))].join(" | ")} |`
      const sep = `| ${Array(spec.series.length + 1)
        .fill("---")
        .join(" | ")} |`
      const rows = spec.categories.map(
        (c, i) =>
          `| ${[escapeCell(c), ...spec.series.map((s) => String(s.values[i] ?? ""))].join(" | ")} |`
      )
      const title = spec.title ? `**${escapeText(spec.title)}**\n\n` : ""
      return prefix(`${title}${[head, sep, ...rows].join("\n")}`)
    }
    case "toc":
      // il sommario si scrive in docToMarkdown, che vede tutti i titoli
      return null
    case "bibliography": {
      return prefix(
        `## ${BIBLIOGRAPHY_TITLES[ctx.style]}\n\n${sortSources(ctx.sources)
          .map((s) =>
            referenceEntry(ctx.style, s)
              .map((p) =>
                p.italic ? `_${escapeText(p.text)}_` : escapeText(p.text)
              )
              .join("")
          )
          .join("\n\n")}`
      )
    }
    default:
      return node.isTextblock
        ? prefix(inline(node, ctx))
        : blocks(node, ctx, indent).join("\n\n")
  }
}

export function docToMarkdown(
  doc: PMNode,
  sources: DocSource[],
  style: CitationStyle,
  fields: Map<PMNode, string> = new Map()
): string {
  // la bibliografia elenca solo le fonti citate davvero
  const citedIds = new Set<string>()
  doc.descendants((n) => {
    if (n.type.name === "citation" && n.attrs.sourceId)
      citedIds.add(String(n.attrs.sourceId))
  })
  const ctx: Ctx = {
    notes: [],
    sources: sources.filter((s) => citedIds.has(s.id)),
    style,
    fields,
  }

  const parts: string[] = []
  doc.forEach((node) => {
    if (node.type.name === "toc") {
      const lines: string[] = [`**${tr("Sommario")}**`, ""]
      let top = 3
      doc.descendants((n) => {
        if (n.type.name === "heading")
          top = Math.min(top, Number(n.attrs.level))
        return n.type.name !== "heading"
      })
      doc.descendants((n) => {
        if (n.type.name !== "heading") return true
        const level = Number(n.attrs.level) - top + 1
        const slug = n.textContent
          .toLowerCase()
          .normalize("NFD")
          .replace(/\p{Diacritic}/gu, "")
          .replace(/[^\p{L}\p{N}\s-]/gu, "")
          .trim()
          .replace(/\s+/g, "-")
        lines.push(
          `${"  ".repeat(level - 1)}- [${escapeText(n.textContent)}](#${slug})`
        )
        return false
      })
      parts.push(lines.join("\n"))
      return
    }
    const md = block(node, ctx, "")
    if (md !== null) parts.push(md)
  })
  if (ctx.notes.length) {
    parts.push(
      ctx.notes.map((text, i) => `[^${i + 1}]: ${escapeText(text)}`).join("\n")
    )
  }
  return `${parts
    .join("\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()}\n`
}
