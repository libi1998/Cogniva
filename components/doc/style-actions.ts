"use client"

import type { Editor } from "@tiptap/react"
import {
  defaultStyleFor,
  newStyleId,
  resolveStyle,
  stylePropKeys,
  type DocStyleDef,
  type StyleAlign,
  type StyleBorder,
  type StyleProps,
} from "@/lib/doc-styles"
import { fontFromCss } from "@/lib/fonts"
import type { DocTheme } from "@/lib/types"

const PT = 96 / 72

/**
 * Applica uno stile al blocco del cursore (o ai blocchi selezionati):
 * cambia il tipo di nodo quando serve (un titolo, una citazione) e scrive
 * l'id dello stile. La formattazione diretta del paragrafo resta.
 */
export function applyDocStyle(editor: Editor, theme: DocTheme, id: string) {
  const style = resolveStyle(theme, id)
  const inQuote = editor.isActive("blockquote")
  const inCode = editor.isActive("codeBlock")
  const chain = editor.chain().focus()
  if (inQuote && style.kind !== "quote") chain.lift("blockquote")
  if (inCode && style.kind !== "code") chain.setParagraph()
  switch (style.kind) {
    case "title":
      chain.setDocTitle()
      break
    case "heading":
      chain.setNode("heading", { level: style.level ?? 1 })
      break
    case "code":
      chain.setCodeBlock()
      break
    case "quote":
      if (!inQuote) chain.setParagraph().wrapIn("blockquote")
      break
    default:
      chain.setParagraph()
  }
  const fallback = defaultStyleFor(style.kind, style.level)
  chain.setBlockStyleId(id === fallback ? null : id)
  chain.run()
}

/** «Cancella formattazione»: testo e paragrafo tornano «Normale» */
export function clearFormatting(editor: Editor) {
  editor
    .chain()
    .focus()
    .unsetAllMarks()
    .clearNodes()
    .setBlockStyleId(null)
    .run()
}

const ALIGNS: StyleAlign[] = ["left", "center", "right", "justify"]
const BORDERS: StyleBorder[] = ["none", "bottom", "top", "left", "box"]

/**
 * L'aspetto del testo selezionato tradotto in proprietà di stile: serve ad
 * «Aggiorna stile in base alla selezione» e a «Crea stile». Restituisce solo
 * quello che differisce dallo stile di partenza.
 */
export function propsFromSelection(
  editor: Editor,
  theme: DocTheme,
  baseId: string
): Partial<StyleProps> {
  const base = resolveStyle(theme, baseId).props
  const text = editor.getAttributes("textStyle")
  const blockName = editor.isActive("docTitle")
    ? "docTitle"
    : editor.isActive("heading")
      ? "heading"
      : "paragraph"
  const block = editor.getAttributes(blockName)
  const found: Partial<StyleProps> = {}

  const font = fontFromCss(String(text.fontFamily ?? ""))
  if (font) found.font = font.key
  const size = parseFloat(String(text.fontSize ?? ""))
  if (Number.isFinite(size)) {
    found.size = String(text.fontSize).endsWith("pt")
      ? size
      : Math.round((size / PT) * 2) / 2
  }
  if (text.color) found.color = String(text.color)
  if (editor.isActive("bold") !== base.bold)
    found.bold = editor.isActive("bold")
  if (editor.isActive("italic") !== base.italic)
    found.italic = editor.isActive("italic")
  if (editor.isActive("underline") !== base.underline)
    found.underline = editor.isActive("underline")
  const letter = parseFloat(String(text.letterSpacing ?? ""))
  if (Number.isFinite(letter))
    found.letterSpacing = Math.round((letter / PT) * 10) / 10

  const align = ALIGNS.find((a) => editor.isActive({ textAlign: a }))
  if (align) found.align = align
  const line = parseFloat(String(block.lineHeight ?? ""))
  if (Number.isFinite(line)) found.lineHeight = line
  const before = parseFloat(String(block.spaceBefore ?? ""))
  if (Number.isFinite(before)) found.spaceBefore = Math.round(before / PT)
  const after = parseFloat(String(block.spaceAfter ?? ""))
  if (Number.isFinite(after)) found.spaceAfter = Math.round(after / PT)
  const indent = Number(block.indent ?? 0)
  if (indent) found.indentLeft = Math.round(indent / PT)
  const first = Number(block.firstLine ?? 0)
  if (first) found.firstLine = Math.round(first / PT)
  if (block.shading) found.background = String(block.shading)
  const border = String(block.border ?? "none") as StyleBorder
  if (BORDERS.includes(border) && border !== "none") found.border = border

  const out: Partial<StyleProps> = {}
  for (const key of stylePropKeys()) {
    const value = found[key]
    if (value !== undefined && value !== base[key]) {
      ;(out as Record<string, unknown>)[key] = value
    }
  }
  return out
}

/** Un tema con uno stile cambiato (senza toccare gli altri) */
export function withStyle(
  theme: DocTheme,
  id: string,
  patch: DocStyleDef | null
): Pick<DocTheme, "styles"> {
  const styles = { ...(theme.styles ?? {}) }
  if (patch === null) delete styles[id]
  else styles[id] = patch
  return { styles }
}

/**
 * Toglie la formattazione diretta che uno stile ora rende inutile: dopo
 * «Aggiorna in base alla selezione» il paragrafo segue lo stile e cambiarlo
 * di nuovo lo aggiorna davvero.
 */
export function dropDirectFormatting(
  editor: Editor,
  captured: Partial<StyleProps>
) {
  // si toglie solo quello che lo stile ha appena preso dalla selezione: il
  // grassetto di una parola, se lo stile non è in grassetto, resta
  const blockKeys: Record<string, [string, unknown]> = {
    lineHeight: ["lineHeight", null],
    spaceBefore: ["spaceBefore", null],
    spaceAfter: ["spaceAfter", null],
    background: ["shading", null],
    border: ["border", "none"],
    indentLeft: ["indent", 0],
    firstLine: ["firstLine", 0],
    align: ["textAlign", null],
  }
  const textKeys: Record<string, string> = {
    font: "fontFamily",
    size: "fontSize",
    color: "color",
    letterSpacing: "letterSpacing",
  }
  editor
    .chain()
    .focus()
    .command(({ tr, state }) => {
      const { $from } = state.selection
      const depth = $from.depth
      const block = $from.node(depth)
      if (!block.isTextblock) return false
      const pos = $from.before(depth)
      const attrs = { ...block.attrs }
      for (const [prop, [attr, empty]] of Object.entries(blockKeys)) {
        if (prop in captured && attr in attrs) attrs[attr] = empty
      }
      tr.setNodeMarkup(pos, undefined, attrs)
      const start = pos + 1
      const end = pos + block.nodeSize - 1
      const clear = Object.entries(textKeys)
        .filter(([prop]) => prop in captured)
        .map(([, attr]) => attr)
      const textStyle = state.schema.marks.textStyle
      if (textStyle && clear.length) {
        block.forEach((child, offset) => {
          const mark = child.marks.find((m) => m.type === textStyle)
          if (!mark) return
          const from = start + offset
          const to = from + child.nodeSize
          const next = { ...mark.attrs }
          for (const attr of clear) next[attr] = null
          tr.removeMark(from, to, textStyle)
          if (Object.values(next).some((v) => v !== null && v !== undefined)) {
            tr.addMark(from, to, textStyle.create(next))
          }
        })
      }
      for (const name of ["bold", "italic", "underline"] as const) {
        const mark = state.schema.marks[name]
        if (mark && captured[name] === true) tr.removeMark(start, end, mark)
      }
      return true
    })
    .run()
}

/** Id e definizione per uno stile nuovo, basato sul blocco del cursore */
export function createStyleFromSelection(
  editor: Editor,
  theme: DocTheme,
  name: string,
  baseId: string
): { id: string; def: DocStyleDef } {
  const base = resolveStyle(theme, baseId)
  const id = newStyleId(name, theme)
  return {
    id,
    def: {
      name: name.trim() || "Stile",
      kind: base.kind,
      level: base.level,
      basedOn: baseId,
      next: base.kind === "heading" || base.kind === "title" ? "normal" : id,
      ...propsFromSelection(editor, theme, baseId),
    },
  }
}
