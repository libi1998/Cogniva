"use client"

import type { Editor } from "@tiptap/react"
import type { Mark, Node as PMNode } from "@tiptap/pm/model"
import type * as Docx from "docx"
import {
  BIBLIOGRAPHY_TITLES,
  inTextCitation,
  referenceEntry,
  sortSources,
} from "./citations"
import { fontMap } from "./fonts"
import { getAuthor } from "./author"
import { bandParts } from "./header-footer"
import { fieldText } from "./doc-fields"
import { renderWatermark } from "./watermark-image"
import { captionEntries, indexItems } from "./doc-references"
import {
  listStyles,
  resolveStyle,
  styleIdOfNode,
  type DocStyle,
  type StyleProps,
} from "./doc-styles"
import { docAccent } from "./palette"
import {
  PAGE_FORMATS,
  type DocComment,
  type DocSource,
  type DocTheme,
} from "./types"

/**
 * Esportazione in Word (.docx), vera e modificabile: titoli come stili di
 * Word, elenchi numerati, tabelle con colori e bordi, note a piè di pagina e
 * di chiusura, commenti, intestazione, numeri di pagina e di riga.
 *
 * Grafici, formule e board non hanno un equivalente diretto: si esportano come
 * immagini ad alta risoluzione ricavate dal documento aperto.
 */

type DocxModule = typeof Docx
type Child = Docx.ParagraphChild
type Block = Docx.Paragraph | Docx.Table

const TWIP = 15 // twip per pixel CSS (1 px = 1/96 di pollice)
const MM_TO_TWIP = 1440 / 25.4

export type DocxInput = {
  editor: Editor
  title: string
  theme: DocTheme
  comments: DocComment[]
  sources: DocSource[]
}

/* -------------------------------- colori --------------------------------- */

let colorCtx: CanvasRenderingContext2D | null = null

/** Qualsiasi colore CSS in «RRGGBB»; la trasparenza si fonde sul bianco */
function hex(color: unknown): string | undefined {
  if (typeof color !== "string" || !color || color === "auto") return undefined
  colorCtx ??= document.createElement("canvas").getContext("2d")
  if (!colorCtx) return undefined
  colorCtx.fillStyle = "#000000"
  colorCtx.fillStyle = color
  const value = String(colorCtx.fillStyle)
  if (value.startsWith("#")) return value.slice(1).toUpperCase()
  const m = value.match(/rgba?\(([^)]+)\)/)
  if (!m) return undefined
  const [r, g, b, a = 1] = m[1].split(",").map((v) => parseFloat(v))
  const mix = (c: number) =>
    Math.round(c * a + 255 * (1 - a))
      .toString(16)
      .padStart(2, "0")
  return `${mix(r)}${mix(g)}${mix(b)}`.toUpperCase()
}

const px = (value: unknown) => parseFloat(String(value ?? "")) || 0

/** Un corpo CSS («16px», «12pt») in mezzi punti, l'unità di Word */
function halfPoints(value: unknown): number | undefined {
  if (typeof value !== "string" || !value) return undefined
  const n = parseFloat(value)
  if (!Number.isFinite(n)) return undefined
  return Math.round(value.endsWith("pt") ? n * 2 : n * 1.5)
}

/* -------------------------------- immagini ------------------------------- */

type Picture = {
  data: Uint8Array
  type: "png" | "jpg" | "gif"
  w: number
  h: number
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Immagine non disponibile"))
    img.src = src
  })
}

async function canvasToPng(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  const blob = await new Promise<Blob | null>((r) =>
    canvas.toBlob(r, "image/png")
  )
  if (!blob) throw new Error("Conversione non riuscita")
  return new Uint8Array(await blob.arrayBuffer())
}

/** Immagine del documento: png, jpg e gif passano così, il resto diventa png */
async function pictureFromSrc(src: string): Promise<Picture> {
  const img = await loadImage(src)
  const w = img.naturalWidth || 400
  const h = img.naturalHeight || 300
  const mime = src.match(/^data:([^;,]+)/)?.[1] ?? ""
  const direct =
    mime === "image/png"
      ? "png"
      : mime === "image/jpeg"
        ? "jpg"
        : mime === "image/gif"
          ? "gif"
          : null
  if (direct) {
    const res = await fetch(src)
    return { data: new Uint8Array(await res.arrayBuffer()), type: direct, w, h }
  }
  const canvas = document.createElement("canvas")
  canvas.width = w
  canvas.height = h
  canvas.getContext("2d")?.drawImage(img, 0, 0, w, h)
  return { data: await canvasToPng(canvas), type: "png", w, h }
}

/** Un SVG del documento (i grafici) disegnato su canvas al doppio */
async function pictureFromSvg(svg: SVGSVGElement): Promise<Picture> {
  const rect = svg.getBoundingClientRect()
  const w = svg.width.baseVal.value || rect.width
  const h = svg.height.baseVal.value || rect.height
  const clone = svg.cloneNode(true) as SVGSVGElement
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg")
  clone.setAttribute("width", String(w))
  clone.setAttribute("height", String(h))
  const url = URL.createObjectURL(
    new Blob([new XMLSerializer().serializeToString(clone)], {
      type: "image/svg+xml",
    })
  )
  try {
    const img = await loadImage(url)
    const scale = 2
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(w * scale)
    canvas.height = Math.round(h * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error("Canvas non disponibile")
    ctx.fillStyle = "#ffffff"
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
    return { data: await canvasToPng(canvas), type: "png", w, h }
  } finally {
    URL.revokeObjectURL(url)
  }
}

/** Formule e board: si fotografa il pezzo di documento già disegnato */
async function pictureFromElement(el: HTMLElement): Promise<Picture> {
  const { default: html2canvas } = await import("html2canvas-pro")
  const w = el.offsetWidth
  const h = el.offsetHeight
  const canvas = await html2canvas(el, {
    backgroundColor: null,
    scale: 3,
    logging: false,
    useCORS: true,
  })
  return { data: await canvasToPng(canvas), type: "png", w, h }
}

/* ------------------------------ conversione ------------------------------ */

export async function buildDocx({
  editor,
  title,
  theme,
  comments,
  sources,
}: DocxInput): Promise<Blob> {
  const d: DocxModule = await import("docx")
  const doc = editor.state.doc
  const view = editor.view

  const font = fontMap[theme.font]?.label ?? "Calibri"
  const baseSize = Math.round(theme.fontSize * 1.5)
  const page = PAGE_FORMATS[theme.format]?.mm ?? [210, 297]
  const [pageW, pageH] =
    theme.orientation === "landscape" ? [page[1], page[0]] : [page[0], page[1]]
  const contentPx = Math.max(
    200,
    (pageW * 96) / 25.4 - theme.margins.left - theme.margins.right
  )

  const footnotes: Record<string, { children: Docx.Paragraph[] }> = {}
  const endnotes: Record<string, { children: Docx.Paragraph[] }> = {}
  let noteId = 1
  let endnoteId = 1

  // commenti: dove inizia e dove finisce il testo commentato
  const commentIds = new Map<string, number>()
  const commentStart = new Map<string, number>()
  const commentEnd = new Map<string, number>()
  doc.descendants((node, pos) => {
    if (!node.isText) return
    for (const mark of node.marks) {
      if (mark.type.name !== "comment") continue
      const id = String(mark.attrs.id)
      if (!comments.some((c) => c.id === id)) continue
      if (!commentIds.has(id)) commentIds.set(id, commentIds.size + 1)
      if (!commentStart.has(id)) commentStart.set(id, pos)
      commentEnd.set(id, pos + node.nodeSize)
    }
  })

  let orderedInstance = 0
  let revisionId = 1
  /** gli elenchi usati: ognuno con i suoi segni diventa una numerazione Word */
  const listRefs = new Map<
    string,
    { kind: "bullet" | "ordered"; levels: string; style: string; start: number }
  >()
  const listRef = (
    kind: "bullet" | "ordered",
    levels: string,
    style: string,
    start: number
  ) => {
    const key = `cogniva-${kind}-${levels || "std"}-${style || "std"}-${start}`
    if (!listRefs.has(key)) listRefs.set(key, { kind, levels, style, start })
    return key
  }
  const cited = sortSources(
    sources.filter((s) => {
      let used = false
      doc.descendants((n) => {
        if (used) return false
        if (n.type.name === "citation" && n.attrs.sourceId === s.id) used = true
        return !used
      })
      return used
    })
  )

  /* ---- testo ---- */

  const runOptions = (marks: readonly Mark[]): Docx.IRunOptions => {
    const o: {
      -readonly [K in keyof Docx.IRunOptions]?: Docx.IRunOptions[K]
    } = {}
    for (const mark of marks) {
      const a = mark.attrs
      switch (mark.type.name) {
        case "bold":
          o.bold = true
          break
        case "italic":
          o.italics = true
          break
        case "underline":
          o.underline = {}
          break
        case "strike":
          o.strike = true
          break
        case "code":
          o.font = "Consolas"
          o.shading = {
            type: d.ShadingType.CLEAR,
            color: "auto",
            fill: "F1F1F4",
          }
          break
        case "superscript":
          o.superScript = true
          break
        case "subscript":
          o.subScript = true
          break
        case "highlight":
          o.shading = {
            type: d.ShadingType.CLEAR,
            color: "auto",
            fill: hex(a.color) ?? "FFF3A3",
          }
          break
        case "textStyle": {
          const color = hex(a.color)
          if (color) o.color = color
          const size = halfPoints(a.fontSize)
          if (size) o.size = size
          if (a.fontFamily) {
            const family = String(a.fontFamily)
              .split(",")[0]
              .replace(/["']/g, "")
              .trim()
            const known = Object.values(fontMap).find((f) =>
              String(a.fontFamily).includes(f.stack.split(",")[0])
            )
            o.font =
              known?.label ?? (family.startsWith("var(") ? undefined : family)
          }
          if (a.letterSpacing)
            o.characterSpacing = Math.round(px(a.letterSpacing) * TWIP)
          if (a.smallCaps) o.smallCaps = true
          if (typeof a.decoration === "string" && a.decoration) {
            const deco = a.decoration
            if (deco.startsWith("line-through")) {
              o.doubleStrike = deco.includes("double")
              o.strike = !deco.includes("double")
            } else {
              o.underline = {
                type: deco.includes("double")
                  ? d.UnderlineType.DOUBLE
                  : deco.includes("wavy")
                    ? d.UnderlineType.WAVE
                    : deco.includes("dotted")
                      ? d.UnderlineType.DOTTED
                      : deco.includes("dashed")
                        ? d.UnderlineType.DASH
                        : /\d/.test(deco)
                          ? d.UnderlineType.THICK
                          : d.UnderlineType.SINGLE,
                color: hex(/#[0-9a-f]{3,8}$/i.exec(deco)?.[0]),
              }
            }
          }
          if (typeof a.textShadow === "string" && a.textShadow) {
            // Word ha rilievo e incisione; le altre ombre non hanno un equivalente
            if (a.textShadow.startsWith("0 -1px 0 rgba(0,0,0")) o.emboss = true
            else if (a.textShadow.startsWith("0 1px 0 rgba(255"))
              o.imprint = true
          }
          break
        }
      }
    }
    return o
  }

  const inline = async (
    block: PMNode,
    blockPos: number,
    extra: Docx.IRunOptions = {}
  ): Promise<Child[]> => {
    const out: Child[] = []
    const jobs: Promise<void>[] = []
    let link: { href: string; runs: Child[] } | null = null

    const flushLink = () => {
      if (!link) return
      out.push(
        new d.ExternalHyperlink({ link: link.href, children: link.runs })
      )
      link = null
    }
    const push = (child: Child, href?: string) => {
      if (href) {
        if (link && link.href !== href) flushLink()
        link ??= { href, runs: [] }
        link.runs.push(child)
      } else {
        flushLink()
        out.push(child)
      }
    }

    block.forEach((node, offset) => {
      const pos = blockPos + 1 + offset
      const linkMark = node.marks.find((m) => m.type.name === "link")
      const href = linkMark ? String(linkMark.attrs.href ?? "") : undefined
      const base = { ...extra, ...runOptions(node.marks) }
      const linkStyle = href ? { style: "Hyperlink" } : {}

      // commenti che iniziano qui
      for (const [id, start] of commentStart) {
        if (start === pos) push(new d.CommentRangeStart(commentIds.get(id)!))
      }

      // revisioni: restano revisioni anche in Word, da accettare o rifiutare
      const tracked = node.marks.find(
        (m) => m.type.name === "insertion" || m.type.name === "deletion"
      )
      switch (node.type.name) {
        case "text":
          if (tracked) {
            const change = {
              ...base,
              text: node.text ?? "",
              id: revisionId++,
              author: String(tracked.attrs.author || "Autore"),
              date: new Date(
                Number(tracked.attrs.date) || Date.now()
              ).toISOString(),
            }
            push(
              tracked.type.name === "insertion"
                ? new d.InsertedTextRun(change)
                : new d.DeletedTextRun(change)
            )
            break
          }
          push(
            new d.TextRun({ ...base, ...linkStyle, text: node.text ?? "" }),
            href
          )
          break
        case "hardBreak":
          push(new d.TextRun({ break: 1 }))
          break
        case "field": {
          // pagina e pagine restano campi di Word; il resto si scrive com'è ora
          const kind = String(node.attrs.kind)
          if (kind === "page" || kind === "pages") {
            push(
              new d.TextRun({
                ...base,
                children: [
                  kind === "page"
                    ? d.PageNumber.CURRENT
                    : d.PageNumber.TOTAL_PAGES,
                ],
              })
            )
          } else {
            push(
              new d.TextRun({
                ...base,
                text: fieldText(
                  editor.state,
                  node,
                  pos,
                  theme.pageNumberFormat,
                  theme.pageNumberStart
                ),
              }),
              href
            )
          }
          break
        }
        case "footnote": {
          const text = String(node.attrs.text ?? "")
          const note = [new d.Paragraph({ children: [new d.TextRun(text)] })]
          if (node.attrs.kind === "endnote") {
            endnotes[endnoteId] = { children: note }
            push(new d.EndnoteReferenceRun(endnoteId++))
          } else {
            footnotes[noteId] = { children: note }
            push(new d.FootnoteReferenceRun(noteId++))
          }
          break
        }
        case "citation": {
          const source = sources.find((s) => s.id === node.attrs.sourceId)
          const text = source
            ? inTextCitation(
                theme.citationStyle,
                source,
                String(node.attrs.pages ?? "")
              )
            : "(fonte mancante)"
          push(new d.TextRun({ ...base, text }))
          break
        }
        case "mathInline": {
          const index = out.length
          out.push(
            new d.TextRun({
              text: String(node.attrs.latex ?? ""),
              italics: true,
            })
          )
          const el = view.nodeDOM(pos)
          if (el instanceof HTMLElement) {
            jobs.push(
              pictureFromElement(el)
                .then((pic) => {
                  out[index] = new d.ImageRun({
                    type: pic.type,
                    data: pic.data,
                    transformation: { width: pic.w, height: pic.h },
                  })
                })
                .catch(() => undefined)
            )
          }
          break
        }
        default:
          if (node.isText)
            push(new d.TextRun({ ...base, text: node.text ?? "" }))
      }

      // commenti che finiscono qui
      for (const [id, end] of commentEnd) {
        if (end === pos + node.nodeSize) {
          flushLink()
          const n = commentIds.get(id)!
          out.push(new d.CommentRangeEnd(n))
          out.push(new d.TextRun({ children: [new d.CommentReference(n)] }))
        }
      }
    })
    flushLink()
    await Promise.all(jobs)
    return out
  }

  const paragraphProps = (node: PMNode): Docx.IParagraphOptions => {
    const a = node.attrs
    const align =
      a.textAlign === "center"
        ? d.AlignmentType.CENTER
        : a.textAlign === "right"
          ? d.AlignmentType.RIGHT
          : a.textAlign === "justify"
            ? d.AlignmentType.JUSTIFIED
            : undefined
    const firstLine = px(a.firstLine)
    const lineHeight = parseFloat(String(a.lineHeight ?? ""))
    const border = String(a.border ?? "none")
    const line = {
      style: d.BorderStyle.SINGLE,
      size: 6,
      color: "A1A1AA",
      space: 4,
    }
    const shading = hex(a.shading)
    return {
      alignment: align,
      indent:
        px(a.indent) || firstLine || px(a.indentRight)
          ? {
              left: Math.round(px(a.indent) * TWIP) || undefined,
              right: Math.round(px(a.indentRight) * TWIP) || undefined,
              firstLine:
                firstLine > 0 ? Math.round(firstLine * TWIP) : undefined,
              hanging:
                firstLine < 0 ? Math.round(-firstLine * TWIP) : undefined,
            }
          : undefined,
      spacing: {
        before: a.spaceBefore
          ? Math.round(px(a.spaceBefore) * TWIP)
          : undefined,
        after: a.spaceAfter ? Math.round(px(a.spaceAfter) * TWIP) : undefined,
        line: Number.isFinite(lineHeight)
          ? Math.round(lineHeight * 240)
          : undefined,
        lineRule: Number.isFinite(lineHeight) ? d.LineRuleType.AUTO : undefined,
      },
      border:
        border === "box"
          ? { top: line, bottom: line, left: line, right: line }
          : border === "bottom"
            ? { bottom: line }
            : border === "top"
              ? { top: line }
              : border === "left"
                ? { left: line }
                : undefined,
      shading: shading
        ? { type: d.ShadingType.CLEAR, color: "auto", fill: shading }
        : undefined,
    }
  }

  /* ---- blocchi ---- */

  const imageBlock = async (node: PMNode, pos: number): Promise<Block[]> => {
    const a = node.attrs
    let pic: Picture
    try {
      if (node.type.name === "image") {
        pic = await pictureFromSrc(String(a.src ?? ""))
      } else if (node.type.name === "model3d") {
        // del modello 3D va la vista salvata, come fa Word con la sua immagine
        const poster = String(a.poster ?? "")
        if (!poster) throw new Error("modello senza anteprima")
        pic = await pictureFromSrc(poster)
      } else {
        const el = view.nodeDOM(pos)
        if (!(el instanceof HTMLElement)) return []
        const svg = node.type.name === "chart" ? el.querySelector("svg") : null
        // della board si prende solo l'anteprima: la didascalia è testo vero
        const preview =
          node.type.name === "boardEmbed"
            ? (el.querySelector<HTMLElement>(".doc-embed > div") ?? el)
            : el
        pic = svg
          ? await pictureFromSvg(svg)
          : await pictureFromElement(preview)
      }
    } catch {
      return [
        new d.Paragraph({
          children: [
            new d.TextRun({
              text: "[immagine non disponibile]",
              italics: true,
            }),
          ],
        }),
      ]
    }
    const pct = Math.min(
      100,
      Math.max(5, parseFloat(String(a.width ?? "100")) || 100)
    )
    const target =
      node.type.name === "image" || node.type.name === "model3d"
        ? Math.min(contentPx * (pct / 100), pic.w)
        : Math.min(contentPx, pic.w)
    const ratio = pic.h / pic.w
    const transformation = {
      width: Math.round(target),
      height: Math.round(target * ratio),
      rotation: Number(a.rotate) || undefined,
    }
    const wrap = String(a.wrap ?? "inline")
    const side = String(a.side ?? "left")
    const align = String(a.align ?? "left")
    const floating: Docx.IFloating | undefined =
      node.type.name === "image" && wrap !== "inline" && wrap !== "topBottom"
        ? {
            horizontalPosition: {
              relative: d.HorizontalPositionRelativeFrom.MARGIN,
              align:
                wrap === "behind" || wrap === "front"
                  ? align === "center"
                    ? d.HorizontalPositionAlign.CENTER
                    : align === "right"
                      ? d.HorizontalPositionAlign.RIGHT
                      : d.HorizontalPositionAlign.LEFT
                  : side === "right"
                    ? d.HorizontalPositionAlign.RIGHT
                    : d.HorizontalPositionAlign.LEFT,
            },
            verticalPosition: {
              relative: d.VerticalPositionRelativeFrom.PARAGRAPH,
              offset: 0,
            },
            behindDocument: wrap === "behind",
            allowOverlap: true,
            wrap:
              wrap === "behind" || wrap === "front"
                ? { type: d.TextWrappingType.NONE }
                : {
                    type:
                      wrap === "square"
                        ? d.TextWrappingType.SQUARE
                        : d.TextWrappingType.TIGHT,
                    side: d.TextWrappingSide.BOTH_SIDES,
                  },
            margins: { top: 91440, bottom: 91440, left: 114300, right: 114300 },
          }
        : undefined
    const alt = String(a.alt || a.caption || a.name || "")
    const run = new d.ImageRun({
      type: pic.type,
      data: pic.data,
      transformation,
      floating,
      altText: alt ? { name: alt, description: alt, title: alt } : undefined,
    })
    const alignment =
      align === "center" ||
      (node.type.name !== "image" && node.type.name !== "model3d")
        ? d.AlignmentType.CENTER
        : align === "right"
          ? d.AlignmentType.RIGHT
          : undefined
    const out: Block[] = [new d.Paragraph({ alignment, children: [run] })]
    if (node.type.name === "boardEmbed" && a.caption) {
      out.push(
        new d.Paragraph({
          alignment: d.AlignmentType.CENTER,
          children: [
            new d.TextRun({
              text: String(a.caption),
              italics: true,
              color: "71717A",
              size: baseSize - 4,
            }),
          ],
        })
      )
    }
    return out
  }

  const tableBlock = async (node: PMNode, pos: number): Promise<Block[]> => {
    const a = node.attrs
    const bw = Math.max(0, Number(a.borderWidth ?? 1))
    const style =
      a.borderStyle === "dashed"
        ? d.BorderStyle.DASHED
        : a.borderStyle === "dotted"
          ? d.BorderStyle.DOTTED
          : a.borderStyle === "double"
            ? d.BorderStyle.DOUBLE
            : bw === 0
              ? d.BorderStyle.NONE
              : d.BorderStyle.SINGLE
    const line = {
      style,
      size: Math.max(2, Math.round(bw * 6)),
      color: hex(a.borderColor) ?? "D4D4D8",
    }
    const rows: Docx.TableRow[] = []
    let rowIndex = 0
    const rowJobs: Promise<void>[] = []
    node.forEach((row, rowOffset) => {
      const rowPos = pos + 1 + rowOffset
      const index = rowIndex++
      const cells: Docx.TableCell[] = []
      const cellJobs: Promise<void>[] = []
      row.forEach((cell, cellOffset) => {
        const cellPos = rowPos + 1 + cellOffset
        const ca = cell.attrs
        const header = cell.type.name === "tableHeader"
        const fill =
          hex(ca.backgroundColor) ??
          (header
            ? "F4F4F5"
            : a.banded && index % 2 === 0
              ? "FAFAFA"
              : undefined)
        const slot = cells.length
        cells.push(new d.TableCell({ children: [new d.Paragraph("")] }))
        cellJobs.push(
          blocks(entries(cell, cellPos), { bold: header }).then((children) => {
            const colwidth = Array.isArray(ca.colwidth)
              ? (ca.colwidth as number[])
              : null
            cells[slot] = new d.TableCell({
              children: children.length ? children : [new d.Paragraph("")],
              columnSpan:
                Number(ca.colspan) > 1 ? Number(ca.colspan) : undefined,
              rowSpan: Number(ca.rowspan) > 1 ? Number(ca.rowspan) : undefined,
              shading: fill
                ? { type: d.ShadingType.CLEAR, color: "auto", fill }
                : undefined,
              verticalAlign:
                ca.verticalAlign === "middle"
                  ? d.VerticalAlignTable.CENTER
                  : ca.verticalAlign === "bottom"
                    ? d.VerticalAlignTable.BOTTOM
                    : d.VerticalAlignTable.TOP,
              width: colwidth?.[0]
                ? {
                    size: Math.round(
                      colwidth.reduce((s, w) => s + w, 0) * TWIP
                    ),
                    type: d.WidthType.DXA,
                  }
                : undefined,
              margins: { top: 60, bottom: 60, left: 100, right: 100 },
            })
          })
        )
      })
      rowJobs.push(
        Promise.all(cellJobs).then(() => {
          rows[index] = new d.TableRow({
            children: cells,
            // solo le righe d'intestazione: un «false» esplicito confonde
            // alcuni lettori, che la trattano come intestazione ripetuta
            tableHeader:
              row.firstChild?.type.name === "tableHeader" ? true : undefined,
          })
        })
      )
    })
    await Promise.all(rowJobs)
    return [
      new d.Table({
        rows,
        width: { size: 100, type: d.WidthType.PERCENTAGE },
        borders: {
          top: line,
          bottom: line,
          left: line,
          right: line,
          insideHorizontal: line,
          insideVertical: line,
        },
      }),
      new d.Paragraph({ spacing: { after: 120 }, children: [] }),
    ]
  }

  type ListCtx = {
    kind: "bullet" | "ordered" | "task"
    level: number
    instance: number
    reference: string
  }
  type Entry = { node: PMNode; pos: number }

  /** I figli di un nodo con la loro posizione nel documento */
  const entries = (parent: PMNode, parentPos: number): Entry[] => {
    const list: Entry[] = []
    parent.forEach((node, offset) =>
      list.push({ node, pos: parentPos + 1 + offset })
    )
    return list
  }

  /* ---- stili: gli stessi del documento, come stili di Word ---- */

  const accent = docAccent(theme.accent)
  const WORD_IDS: Record<string, string> = {
    normal: "Normal",
    title: "Title",
    heading1: "Heading1",
    heading2: "Heading2",
    heading3: "Heading3",
  }
  const usedIds = new Map<string, string>()
  /** L'id Word di uno stile: i predefiniti di Word dove esistono */
  const wordId = (id: string) => {
    const known = WORD_IDS[id]
    if (known) return known
    let out = usedIds.get(id)
    if (!out) {
      const base =
        id
          .split(/[^A-Za-z0-9]+/)
          .filter(Boolean)
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join("") || "Stile"
      out = base
      let n = 2
      while ([...usedIds.values()].includes(out)) out = `${base}${n++}`
      usedIds.set(id, out)
    }
    return out
  }
  const styleFontName = (key: string) =>
    key === "+body"
      ? font
      : key === "+heading"
        ? (fontMap[theme.headingFont || theme.font]?.label ?? font)
        : (fontMap[key]?.label ?? font)
  const styleColor = (value: string) =>
    value === "accent"
      ? hex(accent.solid)
      : value === "muted"
        ? "71717A"
        : value === "accent-soft"
          ? hex(accent.fill)
          : hex(value)
  const pt20 = (pt: number) => Math.round(pt * 20)
  const styleRun = (p: StyleProps): Docx.IRunStylePropertiesOptions => ({
    font: styleFontName(p.font),
    size: Math.round(p.size * 2),
    bold: p.bold,
    italics: p.italic,
    underline: p.underline ? {} : undefined,
    smallCaps: p.caps === "small" || undefined,
    allCaps: p.caps === "all" || undefined,
    color: styleColor(p.color) ?? "27272A",
    characterSpacing: p.letterSpacing ? pt20(p.letterSpacing) : undefined,
  })
  const styleParagraph = (
    style: DocStyle
  ): Docx.IParagraphStylePropertiesOptions => {
    const p = style.props
    const accentLine = hex(accent.solid) ?? "6366F1"
    const line = {
      style: d.BorderStyle.SINGLE,
      size: 6,
      color: "A1A1AA",
      space: 4,
    }
    const fill = p.background ? styleColor(p.background) : undefined
    return {
      alignment:
        p.align === "center"
          ? d.AlignmentType.CENTER
          : p.align === "right"
            ? d.AlignmentType.RIGHT
            : p.align === "justify"
              ? d.AlignmentType.JUSTIFIED
              : d.AlignmentType.LEFT,
      spacing: {
        before: pt20(p.spaceBefore),
        after: pt20(p.spaceAfter),
        line: Math.round(p.lineHeight * 240),
        lineRule: d.LineRuleType.AUTO,
      },
      indent:
        p.indentLeft || p.firstLine || p.border === "left"
          ? {
              left:
                pt20(p.indentLeft) || (p.border === "left" ? 360 : undefined),
              firstLine: p.firstLine > 0 ? pt20(p.firstLine) : undefined,
              hanging: p.firstLine < 0 ? pt20(-p.firstLine) : undefined,
            }
          : undefined,
      border:
        p.border === "box"
          ? { top: line, bottom: line, left: line, right: line }
          : p.border === "bottom"
            ? { bottom: line }
            : p.border === "top"
              ? { top: line }
              : p.border === "left"
                ? { left: { ...line, size: 18, color: accentLine, space: 8 } }
                : p.border === "topBottom"
                  ? {
                      top: { ...line, color: accentLine },
                      bottom: { ...line, color: accentLine },
                    }
                  : undefined,
      shading: fill
        ? { type: d.ShadingType.CLEAR, color: "auto", fill }
        : undefined,
      keepNext: style.kind === "title" || style.kind === "heading" || undefined,
      outlineLevel:
        style.kind === "heading" ? (style.level ?? 1) - 1 : undefined,
    }
  }
  const styleOptions = (style: DocStyle) => ({
    name: style.name,
    basedOn: style.basedOn ? wordId(style.basedOn) : undefined,
    next: style.next ? wordId(style.next) : undefined,
    quickFormat: !style.hidden,
    run: styleRun(style.props),
    paragraph: styleParagraph(style),
  })
  const allStyles = listStyles(theme)
  const byId = (id: string) => resolveStyle(theme, id)
  /** Lo stile Word di un blocco, se non è quello implicito del suo tipo */
  const blockStyle = (node: PMNode) => {
    const id = styleIdOfNode(node)
    return { style: wordId(id) }
  }

  /**
   * Converte una sequenza di blocchi. Le conversioni partono tutte insieme
   * (immagini e formule richiedono tempo) ma il risultato resta in ordine.
   */
  async function blocks(
    list: Entry[],
    opts: { bold?: boolean; list?: ListCtx; quote?: string } = {}
  ): Promise<Block[]> {
    const extra: Docx.IRunOptions = opts.bold ? { bold: true } : {}
    const converted = await Promise.all(
      list.map(({ node, pos }) => block(node, pos, extra, opts))
    )
    return converted.flat()
  }

  async function block(
    node: PMNode,
    pos: number,
    extra: Docx.IRunOptions,
    opts: { bold?: boolean; list?: ListCtx; quote?: string }
  ): Promise<Block[]> {
    const name = node.type.name
    switch (name) {
      case "docTitle":
        return [
          new d.Paragraph({
            ...paragraphProps(node),
            ...blockStyle(node),
            children: await inline(node, pos),
          }),
        ]
      case "heading": {
        const level = Number(node.attrs.level)
        return [
          new d.Paragraph({
            ...paragraphProps(node),
            ...(node.attrs.styleId
              ? blockStyle(node)
              : {
                  heading:
                    level === 1
                      ? d.HeadingLevel.HEADING_1
                      : level === 2
                        ? d.HeadingLevel.HEADING_2
                        : d.HeadingLevel.HEADING_3,
                }),
            children: await inline(node, pos, extra),
          }),
        ]
      }
      case "paragraph": {
        const children = await inline(node, pos, extra)
        const props = paragraphProps(node)
        const { list } = opts
        if (list) {
          return [
            new d.Paragraph({
              ...props,
              numbering:
                list.kind === "bullet"
                  ? { reference: list.reference, level: list.level }
                  : list.kind === "ordered"
                    ? {
                        reference: list.reference,
                        level: list.level,
                        instance: list.instance,
                      }
                    : undefined,
              indent:
                list.kind === "task"
                  ? { left: 360 * (list.level + 1) }
                  : undefined,
              spacing: { after: 60 },
              children,
            }),
          ]
        }
        return [
          new d.Paragraph({
            ...props,
            style: wordId(opts.quote ?? styleIdOfNode(node)),
            children,
          }),
        ]
      }
      case "blockquote":
        return blocks(entries(node, pos), {
          ...opts,
          quote: styleIdOfNode(node),
        })
      case "codeBlock":
        return [
          new d.Paragraph({
            shading: {
              type: d.ShadingType.CLEAR,
              color: "auto",
              fill: "F4F4F5",
            },
            spacing: { after: 160 },
            children: node.textContent.split("\n").map(
              (text, i) =>
                new d.TextRun({
                  text,
                  font: "Consolas",
                  size: baseSize - 3,
                  break: i ? 1 : 0,
                })
            ),
          }),
        ]
      case "bulletList":
      case "orderedList":
      case "taskList": {
        const kind: ListCtx["kind"] =
          name === "bulletList"
            ? "bullet"
            : name === "orderedList"
              ? "ordered"
              : "task"
        const nested = opts.list && opts.list.kind === kind
        const ctx: ListCtx = {
          kind,
          level: opts.list ? Math.min(8, opts.list.level + 1) : 0,
          // ogni elenco numerato ricomincia da 1
          instance:
            kind === "ordered" ? ++orderedInstance : (opts.list?.instance ?? 0),
          // un elenco annidato dello stesso tipo segue i livelli di quello
          // esterno; uno con i suoi segni ne ha una numerazione propria
          reference:
            kind === "task"
              ? ""
              : nested && !node.attrs.listStyle
                ? opts.list!.reference
                : listRef(
                    kind,
                    String(node.attrs.levels ?? ""),
                    String(node.attrs.listStyle ?? ""),
                    Number(node.attrs.start ?? 1)
                  ),
        }
        const items = await Promise.all(
          entries(node, pos).map(async (item) => {
            const parts = entries(item.node, item.pos)
            if (kind !== "task") return blocks(parts, { ...opts, list: ctx })
            const [first, ...rest] = parts
            const out: Block[] = []
            if (first?.node.type.name === "paragraph") {
              const box = item.node.attrs.checked ? "☒ " : "☐ "
              out.push(
                new d.Paragraph({
                  indent: { left: 360 * ctx.level },
                  spacing: { after: 60 },
                  children: [
                    new d.TextRun({ text: box, font: "Segoe UI Symbol" }),
                    ...(await inline(first.node, first.pos, extra)),
                  ],
                })
              )
            } else if (first) {
              rest.unshift(first)
            }
            out.push(...(await blocks(rest, { ...opts, list: ctx })))
            return out
          })
        )
        return items.flat()
      }
      case "table":
        return tableBlock(node, pos)
      case "image":
      case "chart":
      case "boardEmbed":
      case "model3d":
        return imageBlock(node, pos)
      case "mathBlock": {
        const el = view.nodeDOM(pos)
        if (el instanceof HTMLElement) {
          try {
            const target =
              (el.querySelector(
                ".katex-display, .katex"
              ) as HTMLElement | null) ?? el
            const pic = await pictureFromElement(target)
            return [
              new d.Paragraph({
                alignment: d.AlignmentType.CENTER,
                children: [
                  new d.ImageRun({
                    type: pic.type,
                    data: pic.data,
                    transformation: { width: pic.w, height: pic.h },
                  }),
                ],
              }),
            ]
          } catch {
            // si ripiega sul testo della formula
          }
        }
        return [
          new d.Paragraph({
            alignment: d.AlignmentType.CENTER,
            children: [
              new d.TextRun({
                text: String(node.attrs.latex ?? ""),
                italics: true,
                font: "Cambria Math",
              }),
            ],
          }),
        ]
      }
      case "video": {
        const src = String(node.attrs.src ?? "")
        return [
          new d.Paragraph({
            children: [
              new d.TextRun({ text: "▶ Video: " }),
              new d.ExternalHyperlink({
                link: src,
                children: [new d.TextRun({ text: src, style: "Hyperlink" })],
              }),
            ],
          }),
        ]
      }
      case "horizontalRule":
        return [
          new d.Paragraph({
            border: {
              bottom: {
                style: d.BorderStyle.SINGLE,
                size: 6,
                color: "D4D4D8",
                space: 1,
              },
            },
            children: [],
          }),
        ]
      case "pageBreak":
        return [new d.Paragraph({ children: [new d.PageBreak()] })]
      case "columnBreak":
        return [new d.Paragraph({ children: [new d.ColumnBreak()] })]
      case "toc": {
        const out: Block[] = [
          new d.Paragraph({
            heading: d.HeadingLevel.HEADING_2,
            text: "Sommario",
          }),
        ]
        doc.descendants((n) => {
          if (n.type.name === "heading") {
            out.push(
              new d.Paragraph({
                indent: { left: (Number(n.attrs.level) - 1) * 360 },
                spacing: { after: 40 },
                children: [new d.TextRun(n.textContent)],
              })
            )
          }
          return n.type.name !== "heading"
        })
        return out
      }
      case "figureIndex": {
        const label = String(node.attrs.label ?? "Figura")
        return [
          new d.Paragraph({
            heading: d.HeadingLevel.HEADING_2,
            text:
              label === "Tabella"
                ? "Indice delle tabelle"
                : label === "Equazione"
                  ? "Indice delle equazioni"
                  : "Indice delle figure",
          }),
          ...captionEntries(editor.state, label).map(
            (entry) =>
              new d.Paragraph({
                spacing: { after: 40 },
                children: [new d.TextRun(entry.text)],
              })
          ),
        ]
      }
      case "docIndex": {
        const kind = node.attrs.kind === "authority" ? "authority" : "index"
        return [
          new d.Paragraph({
            heading: d.HeadingLevel.HEADING_2,
            text:
              kind === "authority"
                ? "Indice delle autorità"
                : "Indice analitico",
          }),
          ...indexItems(doc, kind).flatMap((item) => [
            new d.Paragraph({
              spacing: { after: 20 },
              children: [new d.TextRun(item.entry)],
            }),
            ...item.subs.map(
              (sub) =>
                new d.Paragraph({
                  indent: { left: 360 },
                  spacing: { after: 20 },
                  children: [new d.TextRun(sub.sub)],
                })
            ),
          ]),
        ]
      }
      case "bibliography":
        return [
          new d.Paragraph({
            heading: d.HeadingLevel.HEADING_2,
            text: BIBLIOGRAPHY_TITLES[theme.citationStyle],
          }),
          ...(cited.length
            ? cited.map(
                (s) =>
                  new d.Paragraph({
                    indent: { left: 720, hanging: 720 },
                    spacing: { after: 120 },
                    children: referenceEntry(theme.citationStyle, s).map(
                      (piece) =>
                        new d.TextRun({
                          text: piece.text,
                          italics: piece.italic,
                        })
                    ),
                  })
              )
            : [
                new d.Paragraph({
                  children: [
                    new d.TextRun({
                      text: "Nessuna fonte citata.",
                      italics: true,
                    }),
                  ],
                }),
              ]),
        ]
      default:
        if (node.isTextblock) {
          return [new d.Paragraph({ children: await inline(node, pos, extra) })]
        }
        return node.childCount ? blocks(entries(node, pos), opts) : []
    }
  }

  const children = await blocks(entries(doc, -1))

  /* ---- intestazione, piè di pagina, sezione ---- */

  const small = { size: Math.max(16, baseSize - 6), color: "71717A" }
  const author = getAuthor()
  const today = new Date().toLocaleDateString("it-IT", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })
  /** Una parte della riga: testo e campi di pagina che Word aggiorna da sé */
  const bandRuns = (text: string): Docx.TextRun[] => {
    const filled = text
      .replaceAll("{titolo}", title)
      .replaceAll("{autore}", author)
      .replaceAll("{data}", today)
    return filled
      .split(/(\{pagina\}|\{pagine\})/)
      .filter(Boolean)
      .map((piece) =>
        piece === "{pagina}"
          ? new d.TextRun({ ...small, children: [d.PageNumber.CURRENT] })
          : piece === "{pagine}"
            ? new d.TextRun({
                ...small,
                children: [d.PageNumber.TOTAL_PAGES],
              })
            : new d.TextRun({ ...small, text: piece })
      )
  }
  const band = (where: "header" | "footer") => {
    const parts = bandParts(where === "header" ? theme.header : theme.footer)
    const position = theme.pageNumbers ?? "none"
    const [row, col] = position.split("-")
    if (
      position !== "none" &&
      row === (where === "header" ? "top" : "bottom") &&
      !parts.some((p) => p.includes("{pagina}"))
    ) {
      const index = col === "left" ? 0 : col === "center" ? 1 : 2
      parts[index] = [parts[index], "{pagina}"].filter(Boolean).join("  ")
    }
    if (!parts.some(Boolean)) return null
    return new d.Paragraph({
      tabStops: [
        {
          type: d.TabStopType.CENTER,
          position: Math.round(d.TabStopPosition.MAX / 2),
        },
        { type: d.TabStopType.RIGHT, position: d.TabStopPosition.MAX },
      ],
      children: [
        ...bandRuns(parts[0]),
        new d.TextRun({ ...small, text: "\t" }),
        ...bandRuns(parts[1]),
        new d.TextRun({ ...small, text: "\t" }),
        ...bandRuns(parts[2]),
      ],
    })
  }

  // la filigrana: un'immagine grande quanto la pagina, dietro al testo,
  // nell'intestazione (come fa Word), quindi su ogni pagina
  const pageWpx = (pageW * 96) / 25.4
  const pageHpx = (pageH * 96) / 25.4
  const watermarkPng = theme.watermark
    ? await renderWatermark(theme.watermark, theme, pageWpx, pageHpx).catch(
        () => null
      )
    : null
  const watermarkParagraph = () =>
    watermarkPng
      ? new d.Paragraph({
          children: [
            new d.ImageRun({
              type: "png",
              data: watermarkPng,
              transformation: {
                width: Math.round(pageWpx),
                height: Math.round(pageHpx),
              },
              floating: {
                horizontalPosition: {
                  relative: d.HorizontalPositionRelativeFrom.PAGE,
                  offset: 0,
                },
                verticalPosition: {
                  relative: d.VerticalPositionRelativeFrom.PAGE,
                  offset: 0,
                },
                behindDocument: true,
                allowOverlap: true,
                lockAnchor: true,
                wrap: { type: d.TextWrappingType.NONE },
              },
              altText: {
                name: "Filigrana",
                title: "Filigrana",
                description: theme.watermark?.text || "Filigrana",
              },
            }),
          ],
        })
      : null
  const headerBand = band("header")
  const footerBand = band("footer")
  const headerChildren = [watermarkParagraph(), headerBand].filter(
    (p): p is Docx.Paragraph => p !== null
  )
  const header = headerChildren.length
    ? new d.Header({ children: headerChildren })
    : undefined
  const footer = footerBand
    ? new d.Footer({ children: [footerBand] })
    : undefined
  // la prima pagina diversa perde intestazione e piè, non la filigrana
  const emptyHeader = new d.Header({
    children: [watermarkParagraph() ?? new d.Paragraph({})],
  })
  const emptyFooter = new d.Footer({ children: [new d.Paragraph({})] })
  const PAGE_FORMATS_DOCX = {
    arabic: d.NumberFormat.DECIMAL,
    dash: d.NumberFormat.NUMBER_IN_DASH,
    roman: d.NumberFormat.LOWER_ROMAN,
    ROMAN: d.NumberFormat.UPPER_ROMAN,
    alpha: d.NumberFormat.LOWER_LETTER,
    ALPHA: d.NumberFormat.UPPER_LETTER,
  } as const

  const pageBorder =
    theme.pageBorder === "none"
      ? undefined
      : {
          style:
            theme.pageBorder === "double"
              ? d.BorderStyle.DOUBLE
              : theme.pageBorder === "dashed"
                ? d.BorderStyle.DASHED
                : theme.pageBorder === "dotted"
                  ? d.BorderStyle.DOTTED
                  : d.BorderStyle.SINGLE,
          size: theme.pageBorder === "thick" ? 24 : 6,
          color: hex(theme.pageBorderColor) ?? "71717A",
          space: 24,
        }

  const BULLET_GLYPHS: Record<string, string> = {
    circle: "○",
    square: "▪",
    diamond: "◆",
    arrow: "➢",
    check: "✓",
    dash: "–",
    star: "★",
  }
  const LEVEL_BULLETS: Record<string, string[]> = {
    std: ["•", "◦", "▪"],
    arrows: ["➢", "•", "–"],
    checks: ["✓", "◆", "•"],
  }
  type LevelDef = [(typeof d.LevelFormat)[keyof typeof d.LevelFormat], string]
  const ORDERED_LEVELS: Record<string, LevelDef[]> = {
    std: [
      [d.LevelFormat.DECIMAL, "%1."],
      [d.LevelFormat.LOWER_LETTER, "%2."],
      [d.LevelFormat.LOWER_ROMAN, "%3."],
    ],
    legal: [
      [d.LevelFormat.DECIMAL, "%1."],
      [d.LevelFormat.DECIMAL, "%1.%2."],
      [d.LevelFormat.DECIMAL, "%1.%2.%3."],
    ],
    outline: [
      [d.LevelFormat.UPPER_ROMAN, "%1."],
      [d.LevelFormat.UPPER_LETTER, "%2."],
      [d.LevelFormat.DECIMAL, "%3."],
    ],
    article: [
      [d.LevelFormat.DECIMAL, "Articolo %1"],
      [d.LevelFormat.DECIMAL_ZERO, "Sezione %1.%2"],
      [d.LevelFormat.LOWER_LETTER, "(%3)"],
    ],
    chapter: [
      [d.LevelFormat.DECIMAL, "Capitolo %1"],
      [d.LevelFormat.DECIMAL, "%1.%2"],
      [d.LevelFormat.LOWER_LETTER, "%3)"],
    ],
  }
  const FIRST_LEVEL: Record<string, LevelDef> = {
    "decimal-paren": [d.LevelFormat.DECIMAL, "%1)"],
    "upper-roman": [d.LevelFormat.UPPER_ROMAN, "%1."],
    "lower-roman": [d.LevelFormat.LOWER_ROMAN, "%1."],
    "upper-alpha": [d.LevelFormat.UPPER_LETTER, "%1."],
    "lower-alpha": [d.LevelFormat.LOWER_LETTER, "%1."],
    "alpha-paren": [d.LevelFormat.LOWER_LETTER, "%1)"],
    "leading-zero": [d.LevelFormat.DECIMAL_ZERO, "%1."],
  }
  const levels = (ref: {
    kind: "bullet" | "ordered"
    levels: string
    style: string
    start: number
  }): Docx.ILevelsOptions[] =>
    Array.from({ length: 9 }, (_, level) => {
      const indent = {
        paragraph: { indent: { left: 720 + level * 360, hanging: 360 } },
      }
      if (ref.kind === "bullet") {
        const glyphs = LEVEL_BULLETS[ref.levels] ?? LEVEL_BULLETS.std
        const glyph =
          level === 0 && BULLET_GLYPHS[ref.style]
            ? BULLET_GLYPHS[ref.style]
            : glyphs[level % 3]
        return {
          level,
          format: d.LevelFormat.BULLET,
          text: glyph,
          alignment: d.AlignmentType.LEFT,
          style: indent,
        }
      }
      const defs = ORDERED_LEVELS[ref.levels] ?? ORDERED_LEVELS.std
      const [format, pattern] =
        level === 0 && FIRST_LEVEL[ref.style]
          ? FIRST_LEVEL[ref.style]
          : level < 3
            ? defs[level]
            : // oltre il terzo livello si ripete lo schema di base
              ([ORDERED_LEVELS.std[level % 3][0], `%${level + 1}.`] as LevelDef)
      // i segnaposto «%n» dello schema sono relativi al livello: nel terzo
      // livello «%3» è il livello stesso
      return {
        level,
        format,
        text: pattern,
        start: level === 0 ? Math.max(0, ref.start) : 1,
        alignment: d.AlignmentType.LEFT,
        style: indent,
      }
    })

  const document = new d.Document({
    title,
    creator: "Cogniva",
    description: "Esportato da Cogniva",
    styles: {
      default: {
        document: {
          run: styleRun(byId("normal").props),
          paragraph: styleParagraph(byId("normal")),
        },
        title: styleOptions(byId("title")),
        heading1: styleOptions(byId("heading1")),
        heading2: styleOptions(byId("heading2")),
        heading3: styleOptions(byId("heading3")),
        hyperlink: { run: { color: "2F5EDB", underline: {} } },
      },
      paragraphStyles: allStyles
        .filter((style) => !WORD_IDS[style.id])
        .map((style) => ({ id: wordId(style.id), ...styleOptions(style) })),
    },
    numbering: {
      config: [
        ...[...listRefs].map(([reference, ref]) => ({
          reference,
          levels: levels(ref),
        })),
      ],
    },
    comments: {
      children: [...commentIds].map(([id, n]) => {
        const c = comments.find((x) => x.id === id)!
        return {
          id: n,
          author: c.author || "Cogniva",
          initials: (c.author || "C")
            .split(/\s+/)
            .map((w) => w[0])
            .join("")
            .slice(0, 3)
            .toUpperCase(),
          date: new Date(c.createdAt),
          resolved: c.resolved,
          children: [
            new d.Paragraph({ children: [new d.TextRun(c.text)] }),
            ...c.replies.map(
              (r) =>
                new d.Paragraph({
                  children: [
                    new d.TextRun({ text: `${r.author}: `, bold: true }),
                    new d.TextRun(r.text),
                  ],
                })
            ),
          ],
        }
      }),
    },
    footnotes,
    endnotes,
    sections: [
      {
        headers: header
          ? {
              default: header,
              ...(theme.differentFirstPage ? { first: emptyHeader } : {}),
            }
          : undefined,
        footers: footer
          ? {
              default: footer,
              ...(theme.differentFirstPage ? { first: emptyFooter } : {}),
            }
          : undefined,
        properties: {
          titlePage: theme.differentFirstPage || undefined,
          page: {
            pageNumbers: {
              start: theme.pageNumberStart ?? 1,
              formatType:
                PAGE_FORMATS_DOCX[theme.pageNumberFormat ?? "arabic"] ??
                d.NumberFormat.DECIMAL,
            },
            size: {
              width: Math.round(pageW * MM_TO_TWIP),
              height: Math.round(pageH * MM_TO_TWIP),
              orientation:
                theme.orientation === "landscape"
                  ? d.PageOrientation.LANDSCAPE
                  : d.PageOrientation.PORTRAIT,
            },
            margin: {
              top: Math.round(theme.margins.top * TWIP),
              right: Math.round(theme.margins.right * TWIP),
              bottom: Math.round(theme.margins.bottom * TWIP),
              left: Math.round(theme.margins.left * TWIP),
              header: 480,
              footer: 480,
            },
            borders: pageBorder
              ? {
                  pageBorders: {
                    display: d.PageBorderDisplay.ALL_PAGES,
                    offsetFrom: d.PageBorderOffsetFrom.PAGE,
                  },
                  pageBorderTop: pageBorder,
                  pageBorderRight: pageBorder,
                  pageBorderBottom: pageBorder,
                  pageBorderLeft: pageBorder,
                }
              : undefined,
          },
          column:
            theme.columns > 1
              ? {
                  count: theme.columns,
                  space: Math.round(theme.fontSize * 2.2 * TWIP),
                  equalWidth: true,
                }
              : undefined,
          lineNumbers:
            theme.lineNumbers === "none"
              ? undefined
              : {
                  countBy: 1,
                  restart:
                    theme.lineNumbers === "page"
                      ? d.LineNumberRestartFormat.NEW_PAGE
                      : d.LineNumberRestartFormat.CONTINUOUS,
                },
        },
        children,
      },
    ],
  })

  return d.Packer.toBlob(document)
}
