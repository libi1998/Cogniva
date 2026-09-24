import {
  Extension,
  Mark,
  Node,
  mergeAttributes,
  type JSONContent,
  type SingleCommands,
} from "@tiptap/core"
import type { Mark as PMMark } from "@tiptap/pm/model"
import {
  NodeSelection,
  Plugin,
  PluginKey,
  TextSelection,
} from "@tiptap/pm/state"
import type { EditorState } from "@tiptap/pm/state"
import type { Node as PMNode } from "@tiptap/pm/model"
import { ReplaceStep } from "@tiptap/pm/transform"
import {
  Table,
  TableCell,
  TableHeader,
  TableView,
} from "@tiptap/extension-table"
import { Image } from "@tiptap/extension-image"
import { cssColor, cssLength, cssValue } from "./css"
import { cellFormatAttributes } from "./table-format"

import { tr as translate } from "@/lib/i18n/client"
declare module "@tiptap/core" {
  interface Storage {
    blockStyle: { resolveNext: NextStyleResolver | null }
  }
  interface Commands<ReturnType> {
    fontSize: {
      setFontSize: (size: string) => ReturnType
      unsetFontSize: () => ReturnType
    }
    lineHeight: {
      setLineHeight: (value: string) => ReturnType
      unsetLineHeight: () => ReturnType
    }
    indent: {
      indent: () => ReturnType
      outdent: () => ReturnType
      setFirstLineIndent: (value: number) => ReturnType
      setIndentLeft: (px: number) => ReturnType
      setIndentRight: (px: number) => ReturnType
    }
    letterSpacing: {
      setLetterSpacing: (px: number | null) => ReturnType
    }
    paragraphStyle: {
      setShading: (color: string | null) => ReturnType
      setParagraphBorder: (border: ParagraphBorder) => ReturnType
    }
    columnBreak: {
      setColumnBreak: () => ReturnType
    }
    tableStyle: {
      setTableStyle: (attrs: Partial<TableStyle>) => ReturnType
    }
    footnote: {
      insertFootnote: (text?: string, kind?: NoteKind) => ReturnType
    }
    spacing: {
      setSpaceBefore: (value: number) => ReturnType
      setSpaceAfter: (value: number) => ReturnType
    }
    cellStyle: {
      setCellBackground: (color: string | null) => ReturnType
    }
    pageBreak: {
      setPageBreak: () => ReturnType
    }
    docTitle: {
      setDocTitle: () => ReturnType
    }
    blockStyle: {
      /** l'id dello stile sul blocco del cursore (null = predefinito) */
      setBlockStyleId: (styleId: string | null) => ReturnType
    }
    tableOfContents: {
      setTableOfContents: (attrs?: {
        variant?: TocVariant
        levels?: number
        title?: string | null
      }) => ReturnType
    }
    moveBlock: {
      moveBlock: (direction: "up" | "down") => ReturnType
    }
    textCase: {
      changeCase: (mode: CaseMode) => ReturnType
    }
  }
}

export type CaseMode = "upper" | "lower" | "title" | "toggle" | "sentence"
export type ParagraphBorder = "none" | "bottom" | "top" | "left" | "box"
type TableBorderStyle = "solid" | "dashed" | "dotted" | "double" | "none"
const BORDER_LINE_STYLES: TableBorderStyle[] = [
  "solid",
  "dashed",
  "dotted",
  "double",
  "none",
]
type TableStyle = {
  borderWidth: number
  borderColor: string | null
  borderStyle: TableBorderStyle
  banded: boolean
}

/* ------------------------------ dimensione ------------------------------ */

export const FontSize = Extension.create({
  name: "fontSize",
  addOptions() {
    return { types: ["textStyle"] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: (el) => el.style.fontSize || null,
            renderHTML: (attrs) => {
              const size = cssLength(attrs.fontSize)
              return size ? { style: `font-size:${size}` } : {}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setFontSize:
        (size) =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: size }).run(),
      unsetFontSize:
        () =>
        ({ chain }) =>
          chain().setMark("textStyle", { fontSize: null }).run(),
    }
  },
})

/**
 * Applica un comando a ogni tipo di blocco e riesce se almeno uno cambia. Con
 * «every» il primo tipo assente dalla selezione (per esempio il titolo) in
 * Tiptap 3 fermava tutto e il comando non faceva nulla.
 */
function applyToTypes(types: string[], run: (type: string) => boolean) {
  return types.map(run).some(Boolean)
}

/* ------------------------ interlinea e spaziatura ----------------------- */

const BLOCKS = ["docTitle", "paragraph", "heading", "listItem", "blockquote"]

export const LineHeight = Extension.create({
  name: "lineHeight",
  addOptions() {
    return { types: BLOCKS }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          lineHeight: {
            default: null,
            parseHTML: (el) => el.style.lineHeight || null,
            renderHTML: (attrs) => {
              const value = cssLength(attrs.lineHeight)
              return value ? { style: `line-height:${value}` } : {}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setLineHeight:
        (value) =>
        ({ commands }) =>
          applyToTypes(this.options.types, (t: string) =>
            commands.updateAttributes(t, { lineHeight: value })
          ),
      unsetLineHeight:
        () =>
        ({ commands }) =>
          applyToTypes(this.options.types, (t: string) =>
            commands.resetAttributes(t, "lineHeight")
          ),
    }
  },
})

export const Spacing = Extension.create({
  name: "spacing",
  addOptions() {
    return { types: ["docTitle", "paragraph", "heading"] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          spaceBefore: {
            default: null,
            parseHTML: (el) => el.style.marginTop || null,
            renderHTML: (attrs) => {
              const value = cssLength(attrs.spaceBefore)
              return value ? { style: `margin-top:${value}` } : {}
            },
          },
          spaceAfter: {
            default: null,
            parseHTML: (el) => el.style.marginBottom || null,
            renderHTML: (attrs) => {
              const value = cssLength(attrs.spaceAfter)
              return value ? { style: `margin-bottom:${value}` } : {}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setSpaceBefore:
        (value) =>
        ({ commands }) =>
          applyToTypes(this.options.types, (t: string) =>
            commands.updateAttributes(t, { spaceBefore: `${value}px` })
          ),
      setSpaceAfter:
        (value) =>
        ({ commands }) =>
          applyToTypes(this.options.types, (t: string) =>
            commands.updateAttributes(t, { spaceAfter: `${value}px` })
          ),
    }
  },
})

/* -------------------------------- rientri ------------------------------- */

const INDENT_STEP = 32
const INDENTABLE = ["paragraph", "heading", "blockquote"]

/**
 * Il blocco rientrabile più vicino alla selezione.
 *
 * Si legge dallo stato passato al comando: `editor.isActive` guarda lo stato
 * già applicato, e in una catena come `focus(pos).indent()` la selezione nuova
 * non c'è ancora — il rientro finiva ignorato.
 */
function indentable(state: EditorState) {
  const { $from } = state.selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (INDENTABLE.includes(node.type.name)) return node
  }
  return null
}
const MAX_INDENT = 320

export const Indent = Extension.create({
  name: "indent",
  addOptions() {
    return { types: ["paragraph", "heading", "blockquote"] }
  },
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: (el) => parseInt(el.style.marginLeft || "0", 10) || 0,
            renderHTML: (attrs) => {
              const value = Number(attrs.indent)
              return value ? { style: `margin-left:${value}px` } : {}
            },
          },
          firstLine: {
            default: 0,
            parseHTML: (el) => parseInt(el.style.textIndent || "0", 10) || 0,
            renderHTML: (attrs) => {
              const value = Number(attrs.firstLine)
              return value ? { style: `text-indent:${value}px` } : {}
            },
          },
          indentRight: {
            default: 0,
            parseHTML: (el) => parseInt(el.style.marginRight || "0", 10) || 0,
            renderHTML: (attrs) => {
              const value = Number(attrs.indentRight)
              return value ? { style: `margin-right:${value}px` } : {}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    const shift =
      (delta: number) =>
      ({
        state,
        commands,
      }: {
        state: EditorState
        commands: SingleCommands
      }) => {
        const block = indentable(state)
        if (!block) return false
        const current = Number(block.attrs.indent ?? 0)
        const next = Math.max(0, Math.min(MAX_INDENT, current + delta))
        return commands.updateAttributes(block.type.name, { indent: next })
      }
    return {
      indent: () => shift(INDENT_STEP),
      outdent: () => shift(-INDENT_STEP),
      // rientri precisi dalla scheda Layout, in pixel
      setIndentLeft:
        (px) =>
        ({ state, commands }) => {
          const block = indentable(state)
          if (!block) return false
          return commands.updateAttributes(block.type.name, {
            indent: Math.max(0, Math.min(MAX_INDENT, Math.round(px))),
          })
        },
      setIndentRight:
        (px) =>
        ({ state, commands }) => {
          const block = indentable(state)
          if (!block) return false
          return commands.updateAttributes(block.type.name, {
            indentRight: Math.max(0, Math.min(MAX_INDENT, Math.round(px))),
          })
        },
      // rientro della sola prima riga, come il «rientro speciale» di Word
      setFirstLineIndent:
        (value) =>
        ({ state, commands }) => {
          const block = indentable(state)
          if (!block) return false
          return commands.updateAttributes(block.type.name, {
            firstLine: value,
          })
        },
    }
  },
  addKeyboardShortcuts() {
    return {
      Tab: () => {
        // dentro una lista o una tabella vincono i comportamenti nativi
        if (
          this.editor.isActive("listItem") ||
          this.editor.isActive("taskItem") ||
          this.editor.isActive("table")
        ) {
          return false
        }
        return this.editor.commands.indent()
      },
      "Shift-Tab": () => {
        if (
          this.editor.isActive("listItem") ||
          this.editor.isActive("taskItem") ||
          this.editor.isActive("table")
        ) {
          return false
        }
        return this.editor.commands.outdent()
      },
    }
  },
})

/* --------------------------- titolo del documento ----------------------- */

/**
 * «Titolo doc»: uno stile di paragrafo come «Titolo» in Word.
 *
 * Il titolo fa parte del testo, non è un campo a parte, quindi accetta tutti i
 * marchi (grassetto, colore, evidenziatore…) e il cursore resta dov'è. Non è
 * più obbligatorio in cima: la prima riga si può rendere «Normale», cancellare
 * o spostare, e lo stile si può dare a qualunque riga. Se il documento comincia
 * con un titolo, il nome del file lo segue (vedi docTitleText).
 */
export const DocTitle = Node.create({
  name: "docTitle",
  group: "block",
  content: "inline*",
  marks: "_",
  // come i titoli: incollando dentro un titolo resta un titolo
  defining: true,
  parseHTML() {
    // prima delle regole generiche dei titoli (priorità 50)
    return [{ tag: "h1[data-doc-title]", priority: 60 }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["h1", mergeAttributes(HTMLAttributes, { "data-doc-title": "" }), 0]
  },
  addCommands() {
    return {
      setDocTitle:
        () =>
        ({ commands }) =>
          commands.setNode(this.name),
    }
  },
})

/**
 * Nodo radice: qualunque sequenza di blocchi. Il paragrafo resta il blocco
 * predefinito (priorità più alta del titolo): Invio in fondo a un titolo
 * continua con un paragrafo «Normale», come in Word.
 */
export const DocumentWithTitle = Node.create({
  name: "doc",
  topNode: true,
  content: "block+",
})

/**
 * Prepara il contenuto salvato per l'editor. Un documento nuovo (o vuoto)
 * comincia con il titolo preso dal nome del file; uno con del contenuto si
 * apre com'è, anche se non ha più un titolo in cima.
 */
export function withDocTitle(
  content: unknown,
  title: string
): Record<string, unknown> {
  const doc = (content ?? null) as JSONContent | null
  const nodes = Array.isArray(doc?.content) ? doc.content.map(migrateNode) : []
  if (nodes.length) return { type: "doc", content: nodes }
  const titleNode: JSONContent = {
    type: "docTitle",
    ...(title ? { content: [{ type: "text", text: title }] } : {}),
  }
  return { type: "doc", content: [titleNode, { type: "paragraph" }] }
}

/**
 * Porta i nodi salvati con le versioni precedenti al formato attuale. Oggi
 * riguarda le immagini, che avevano solo un allineamento e ora hanno una
 * disposizione rispetto al testo.
 */
function migrateNode(node: JSONContent): JSONContent {
  let next = node
  if (node.type === "image" && node.attrs) {
    const attrs = { ...(node.attrs as Record<string, unknown>) }
    const legacy = (attrs.wrap as string | undefined) ?? attrs.align
    if (!IMAGE_WRAPS.some((w) => w.value === attrs.wrap)) {
      Object.assign(attrs, legacyWrap(legacy as string | undefined))
    }
    next = { ...node, attrs }
  }
  return Array.isArray(next.content)
    ? { ...next, content: next.content.map(migrateNode) }
    : next
}

/** Le disposizioni delle versioni precedenti tradotte in quelle di Word */
function legacyWrap(value: string | undefined): Partial<ImageAttrs> {
  switch (value) {
    case "left":
      return { wrap: "square", side: "left" }
    case "right":
      return { wrap: "square", side: "right" }
    case "center":
      return { wrap: "topBottom", align: "center" }
    case "wide":
      return { wrap: "topBottom", align: "center", width: "100%" }
    default:
      return { wrap: "inline", align: "left" }
  }
}

/**
 * Il testo del titolo, per tenere allineato il nome del file: vale solo se il
 * documento comincia con un titolo, altrimenti il nome resta indipendente
 */
export function docTitleText(doc: {
  firstChild: { type: { name: string }; textContent: string } | null
}): string | null {
  const first = doc.firstChild
  if (!first || first.type.name !== "docTitle") return null
  return first.textContent
}

/* ------------------------- interruzione di pagina ----------------------- */

export const PageBreak = Node.create({
  name: "pageBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-page-break]" }]
  },
  renderHTML() {
    return ["div", { "data-page-break": "", class: "doc-page-break" }]
  },
  addCommands() {
    return {
      setPageBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    }
  },
})

/* ----------------------- selezione degli oggetti ------------------------ */

/**
 * Cambiare un attributo di un oggetto selezionato (il testo di una nota, la
 * didascalia di un'immagine, il titolo di un grafico) lo riscrive per intero:
 * per ProseMirror l'oggetto selezionato sparisce e la selezione diventa un
 * cursore. Il pannello dell'oggetto si chiudeva alla prima battuta, e di una
 * nota si riusciva a scrivere una lettera sola. Qui l'oggetto riscritto resta
 * selezionato.
 */
export const KeepNodeSelection = Extension.create({
  name: "keepNodeSelection",
  addProseMirrorPlugins() {
    return [
      new Plugin({
        key: new PluginKey("keepNodeSelection"),
        appendTransaction(transactions, oldState, newState) {
          const old = oldState.selection
          if (!(old instanceof NodeSelection) || !old.node.isLeaf) return null
          if (newState.selection instanceof NodeSelection) return null
          let pos = old.from
          let rewritten = false
          for (const tr of transactions) {
            // chi sposta la selezione di proposito ha l'ultima parola
            if (tr.selectionSet) return null
            tr.steps.forEach((step, i) => {
              if (
                step instanceof ReplaceStep &&
                step.from === pos &&
                step.to === pos + old.node.nodeSize &&
                step.slice.content.childCount === 1 &&
                step.slice.content.firstChild?.type === old.node.type
              ) {
                rewritten = true
              }
              pos = tr.mapping.maps[i].map(pos, -1)
            })
          }
          if (!rewritten) return null
          if (newState.doc.nodeAt(pos)?.type !== old.node.type) return null
          return newState.tr.setSelection(
            NodeSelection.create(newState.doc, pos)
          )
        },
      }),
    ]
  },
})

/* ---------------------------- sposta blocchi ---------------------------- */

/**
 * Sposta su o giù il blocco in cui si trova la selezione — un paragrafo,
 * un'immagine, una tabella, anche il titolo — scambiandolo col vicino. La
 * selezione segue il blocco.
 */
export const MoveBlock = Extension.create({
  name: "moveBlock",
  addCommands() {
    return {
      moveBlock:
        (direction) =>
        ({ state, dispatch }) => {
          const { selection, doc } = state
          const isNode = selection instanceof NodeSelection
          const index = selection.$from.index(0)
          // una selezione a cavallo di più blocchi non si sposta
          const lastIndex = isNode ? index : selection.$to.index(0)
          if (lastIndex !== index || index >= doc.childCount) return false
          const node = doc.child(index)
          const target = direction === "up" ? index - 1 : index + 1
          if (target < 0 || target >= doc.childCount) return false

          let start = 0
          for (let i = 0; i < index; i += 1) start += doc.child(i).nodeSize
          const end = start + node.nodeSize
          const neighbour = doc.child(target)
          const newStart =
            direction === "up"
              ? start - neighbour.nodeSize
              : start + neighbour.nodeSize

          if (dispatch) {
            const tr = state.tr.delete(start, end).insert(newStart, node)
            if (isNode) {
              tr.setSelection(NodeSelection.create(tr.doc, newStart))
            } else {
              const from = newStart + (selection.from - start)
              const to = newStart + (selection.to - start)
              tr.setSelection(TextSelection.create(tr.doc, from, to))
            }
            dispatch(tr.scrollIntoView())
          }
          return true
        },
    }
  },
  addKeyboardShortcuts() {
    return {
      "Alt-ArrowUp": () => this.editor.commands.moveBlock("up"),
      "Alt-ArrowDown": () => this.editor.commands.moveBlock("down"),
    }
  },
})

/* ------------------------------- sommario ------------------------------- */

/**
 * Indice dei titoli, come il sommario di Word: il contenuto non è salvato ma
 * ricostruito dai titoli del documento a ogni apertura, così resta aggiornato.
 */
export type TocVariant = "card" | "classic" | "simple"

export const TableOfContents = Node.create({
  name: "toc",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,
  addAttributes() {
    return {
      // «Automatico 1» a riquadro, «Automatico 2» con puntini e pagine,
      // «Semplice» senza numeri
      variant: {
        default: "card",
        parseHTML: (el) => el.getAttribute("data-variant") ?? "card",
        renderHTML: (a) => ({ "data-variant": a.variant }),
      },
      levels: {
        default: 3,
        parseHTML: (el) => Number(el.getAttribute("data-levels")) || 3,
        renderHTML: (a) => ({ "data-levels": a.levels }),
      },
      // il titolo scritto a mano; null = «Sommario» nella lingua dell'app
      title: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-title"),
        renderHTML: (a) => (a.title == null ? {} : { "data-title": a.title }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-toc]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes({ "data-toc": "", class: "doc-toc" }, HTMLAttributes),
    ]
  },
  addCommands() {
    return {
      setTableOfContents:
        (attrs = {}) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs }),
    }
  },
})

/* --------------------------- maiuscole/minuscole ------------------------ */

function applyCase(text: string, mode: CaseMode, before = ""): string {
  switch (mode) {
    case "sentence": {
      // «Normale frase.»: minuscolo, maiuscola a inizio frase
      let start = before.trim() === "" || /[.!?…]\s*$/.test(before)
      return text.toLocaleLowerCase("it").replace(/[\p{L}.!?…]/gu, (c) => {
        if (/[.!?…]/.test(c)) {
          start = true
          return c
        }
        if (start) {
          start = false
          return c.toLocaleUpperCase("it")
        }
        return c
      })
    }
    case "upper":
      return text.toLocaleUpperCase("it")
    case "lower":
      return text.toLocaleLowerCase("it")
    case "title":
      return text.replace(
        /(^|[^\p{L}\p{N}'’])(\p{L})/gu,
        (_m, before: string, letter: string) =>
          before + letter.toLocaleUpperCase("it")
      )
    default:
      return text.replace(/\p{L}/gu, (c) =>
        c === c.toLocaleUpperCase("it")
          ? c.toLocaleLowerCase("it")
          : c.toLocaleUpperCase("it")
      )
  }
}

export const TextCase = Extension.create({
  name: "textCase",
  addCommands() {
    return {
      changeCase:
        (mode) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection
          if (from === to) return false
          const edits: {
            from: number
            to: number
            text: string
            marks: readonly PMMark[]
            before: string
          }[] = []
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!node.isText || !node.text) return
            const start = Math.max(from, pos)
            const end = Math.min(to, pos + node.nodeSize)
            if (end <= start) return
            const $start = state.doc.resolve(start)
            edits.push({
              from: start,
              to: end,
              text: node.text.slice(start - pos, end - pos),
              marks: node.marks,
              // il testo del paragrafo prima del pezzo: dice se è inizio frase
              before:
                mode === "sentence"
                  ? state.doc.textBetween($start.start(), start, " ")
                  : "",
            })
          })
          if (!edits.length) return false
          if (dispatch) {
            // dall'ultimo al primo: gli intervalli precedenti restano validi
            for (let i = edits.length - 1; i >= 0; i -= 1) {
              const edit = edits[i]
              const next = applyCase(edit.text, mode, edit.before)
              if (next === edit.text) continue
              tr.replaceWith(
                edit.from,
                edit.to,
                state.schema.text(next, [...edit.marks])
              )
            }
            tr.setSelection(TextSelection.create(tr.doc, from, to))
            dispatch(tr)
          }
          return true
        },
    }
  },
})

/* --------------------------- celle colorate ----------------------------- */

const cellAttributes = {
  verticalAlign: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.style.verticalAlign || null,
    renderHTML: (attrs: Record<string, unknown>) => {
      const value = cssValue(attrs.verticalAlign)
      return value ? { style: `vertical-align:${value}` } : {}
    },
  },
  backgroundColor: {
    default: null as string | null,
    parseHTML: (el: HTMLElement) => el.getAttribute("data-bg") || null,
    renderHTML: (attrs: Record<string, unknown>) => {
      const color = cssColor(attrs.backgroundColor)
      return color
        ? { "data-bg": color, style: `background-color:${color}` }
        : {}
    },
  },
}

export const StyledTableCell = TableCell.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes, ...cellFormatAttributes }
  },
  renderHTML({ HTMLAttributes }) {
    return ["td", mergeAttributes(HTMLAttributes), 0]
  },
})

export const StyledTableHeader = TableHeader.extend({
  addAttributes() {
    return { ...this.parent?.(), ...cellAttributes, ...cellFormatAttributes }
  },
  renderHTML({ HTMLAttributes }) {
    return ["th", mergeAttributes(HTMLAttributes), 0]
  },
})

export const CellStyle = Extension.create({
  name: "cellStyle",
  addCommands() {
    return {
      setCellBackground:
        (color) =>
        ({ commands }) =>
          commands.setCellAttribute("backgroundColor", color),
    }
  },
})

/* ------------------------- tabelle: stile delle linee -------------------- */

function applyTableStyle(table: HTMLElement, node: PMNode) {
  const { borderWidth, borderColor, borderStyle, banded } = node.attrs
  table.style.setProperty("--tb-w", `${Number(borderWidth ?? 1)}px`)
  table.style.setProperty("--tb-s", String(borderStyle ?? "solid"))
  if (borderColor) table.style.setProperty("--tb-c", String(borderColor))
  else table.style.removeProperty("--tb-c")
  if (banded) table.setAttribute("data-banded", "")
  else table.removeAttribute("data-banded")
}

/**
 * La vista della tabella ridimensionabile ignora gli attributi del nodo:
 * spessore, colore e tipo delle linee vanno applicati a mano sul `<table>`.
 */
export class StyledTableView extends TableView {
  constructor(
    node: PMNode,
    cellMinWidth: number,
    view: ConstructorParameters<typeof TableView>[2],
    HTMLAttributes?: Record<string, unknown>
  ) {
    super(node, cellMinWidth, view, HTMLAttributes)
    applyTableStyle(this.table, node)
  }
  update(node: PMNode) {
    const ok = super.update(node)
    if (ok) applyTableStyle(this.table, node)
    return ok
  }
}

export const StyledTable = Table.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      borderWidth: {
        default: 1,
        parseHTML: (el) => Number(el.getAttribute("data-border-width") ?? 1),
        renderHTML: (attrs) => ({
          "data-border-width": attrs.borderWidth,
          style: `--tb-w:${Number(attrs.borderWidth ?? 1)}px`,
        }),
      },
      borderColor: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-border-color"),
        renderHTML: (attrs) => {
          const color = cssColor(attrs.borderColor)
          return color
            ? { "data-border-color": color, style: `--tb-c:${color}` }
            : {}
        },
      },
      borderStyle: {
        default: "solid",
        parseHTML: (el) => el.getAttribute("data-border-style") ?? "solid",
        renderHTML: (attrs) => {
          const style = BORDER_LINE_STYLES.includes(
            String(attrs.borderStyle) as TableBorderStyle
          )
            ? String(attrs.borderStyle)
            : "solid"
          return { "data-border-style": style, style: `--tb-s:${style}` }
        },
      },
      banded: {
        default: false,
        parseHTML: (el) => el.hasAttribute("data-banded"),
        renderHTML: (attrs) => (attrs.banded ? { "data-banded": "" } : {}),
      },
      // altezza fissa delle righe in millimetri: fogli di etichette
      rowHeight: {
        default: null,
        parseHTML: (el) => Number(el.getAttribute("data-row-height")) || null,
        renderHTML: (attrs) =>
          attrs.rowHeight
            ? {
                "data-row-height": attrs.rowHeight,
                style: `--tb-row-h:${Number(attrs.rowHeight)}mm`,
              }
            : {},
      },
    }
  },
  addCommands() {
    return {
      ...this.parent?.(),
      setTableStyle:
        (attrs) =>
        ({ state, dispatch }) => {
          const { $from } = state.selection
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth)
            if (node.type.name !== "table") continue
            if (dispatch) {
              dispatch(
                state.tr.setNodeMarkup($from.before(depth), undefined, {
                  ...node.attrs,
                  ...attrs,
                })
              )
            }
            return true
          }
          return false
        },
    }
  },
})

/* -------------------------- paragrafo e carattere ------------------------ */

const BORDER_STYLES: Record<ParagraphBorder, string> = {
  none: "",
  bottom:
    "border-bottom:1px solid color-mix(in srgb, currentColor 50%, transparent);padding-bottom:3px",
  top: "border-top:1px solid color-mix(in srgb, currentColor 50%, transparent);padding-top:3px",
  left: "border-left:3px solid var(--doc-accent);padding-left:12px",
  box: "border:1px solid color-mix(in srgb, currentColor 45%, transparent);padding:6px 10px;border-radius:4px",
}

const STYLED_BLOCKS = ["docTitle", "paragraph", "heading", "blockquote"]

/* ------------------------------ stili --------------------------------- */

const STYLE_BLOCKS = [
  "paragraph",
  "heading",
  "docTitle",
  "blockquote",
  "codeBlock",
]

/** Lo stile successivo di uno stile, letto dagli stili del documento */
export type NextStyleResolver = (styleId: string) => {
  next: string
  kind: "paragraph" | "title" | "heading" | "quote" | "code"
  level?: number
} | null

/** Collega all'editor gli stili del documento, per «Stile successivo» */
export function setNextStyleResolver(
  editor: {
    storage: { blockStyle?: { resolveNext: NextStyleResolver | null } }
  },
  resolve: NextStyleResolver
) {
  if (editor.storage.blockStyle) editor.storage.blockStyle.resolveNext = resolve
}

/**
 * Lo stile di ogni blocco (vedi lib/doc-styles.ts): il nodo porta solo l'id,
 * l'aspetto lo dà il CSS del documento. Premendo Invio in fondo a un blocco
 * il paragrafo nuovo prende lo «stile successivo», come in Word: dopo un
 * «Sottotitolo» si torna a «Normale», dopo «Nessuna spaziatura» si resta lì.
 */
export const BlockStyle = Extension.create<
  Record<string, never>,
  { resolveNext: NextStyleResolver | null }
>({
  name: "blockStyle",
  addStorage() {
    return { resolveNext: null }
  },
  addGlobalAttributes() {
    return [
      {
        types: STYLE_BLOCKS,
        attributes: {
          styleId: {
            default: null,
            // lo stile passa al paragrafo nuovo solo tramite lo stile
            // successivo (vedi Invio qui sotto)
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute("data-style") || null,
            renderHTML: (attrs) =>
              attrs.styleId ? { "data-style": attrs.styleId } : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setBlockStyleId:
        (styleId) =>
        ({ state, tr, dispatch }) => {
          const { from, to } = state.selection
          let changed = false
          state.doc.nodesBetween(from, to, (node, pos) => {
            if (!STYLE_BLOCKS.includes(node.type.name)) return true
            // i paragrafi dentro una citazione seguono la citazione
            if (node.type.name === "paragraph") {
              const $pos = state.doc.resolve(pos)
              if ($pos.parent.type.name === "blockquote") return false
            }
            if ((node.attrs.styleId ?? null) !== styleId) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, styleId })
              changed = true
            }
            return node.type.name === "blockquote"
          })
          if (changed && dispatch) dispatch(tr)
          return true
        },
    }
  },
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const resolve = this.storage.resolveNext
        const { state } = this.editor
        const { selection } = state
        const { $from } = selection
        if (!resolve || !selection.empty || $from.depth !== 1) return false
        const block = $from.parent
        if (!block.isTextblock) return false
        if ($from.parentOffset !== block.content.size) return false
        const id =
          (block.attrs.styleId as string | null) ??
          (block.type.name === "docTitle"
            ? "title"
            : block.type.name === "heading"
              ? `heading${block.attrs.level ?? 1}`
              : block.type.name === "paragraph"
                ? "normal"
                : null)
        if (!id) return false
        const info = resolve(id)
        if (!info) return false
        // «Normale» dopo un titolo è già il comportamento di ProseMirror
        if (info.next === "normal" && block.type.name !== "paragraph") {
          return false
        }
        if (info.next === id && !block.attrs.styleId) return false
        const next = resolve(info.next)
        if (!next || next.kind === "code") return false
        const typeName =
          next.kind === "title"
            ? "docTitle"
            : next.kind === "heading"
              ? "heading"
              : next.kind === "quote"
                ? null
                : "paragraph"
        if (!typeName) return false
        const defaultId =
          next.kind === "title"
            ? "title"
            : next.kind === "heading"
              ? `heading${next.level ?? 1}`
              : "normal"
        return this.editor
          .chain()
          .splitBlock()
          .command(({ tr, state: st }) => {
            const pos = tr.selection.$from.before(1)
            const node = tr.doc.nodeAt(pos)
            const type = st.schema.nodes[typeName]
            if (!node || !type) return false
            tr.setNodeMarkup(pos, type, {
              ...(typeName === "heading" ? { level: next.level ?? 1 } : {}),
              styleId: info.next === defaultId ? null : info.next,
            })
            return true
          })
          .run()
      },
    }
  },
})

/** Sfondo e bordi del paragrafo, i pulsanti accanto all'interlinea di Word */
export const ParagraphStyle = Extension.create({
  name: "paragraphStyle",
  addGlobalAttributes() {
    return [
      {
        types: STYLED_BLOCKS,
        attributes: {
          shading: {
            default: null,
            parseHTML: (el) => el.getAttribute("data-shading"),
            renderHTML: (attrs) => {
              const color = cssColor(attrs.shading)
              return color
                ? {
                    "data-shading": color,
                    style: `background-color:${color}`,
                  }
                : {}
            },
          },
          border: {
            default: "none",
            parseHTML: (el) => el.getAttribute("data-border") ?? "none",
            renderHTML: (attrs) =>
              attrs.border && attrs.border !== "none"
                ? {
                    "data-border": attrs.border,
                    style: BORDER_STYLES[attrs.border as ParagraphBorder],
                  }
                : {},
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setShading:
        (color) =>
        ({ commands }) =>
          STYLED_BLOCKS.map((t) =>
            commands.updateAttributes(t, { shading: color })
          ).some(Boolean),
      setParagraphBorder:
        (border) =>
        ({ commands }) =>
          STYLED_BLOCKS.map((t) =>
            commands.updateAttributes(t, { border })
          ).some(Boolean),
    }
  },
})

/** Spaziatura fra i caratteri, come in «Carattere › Avanzate» di Word */
export const LetterSpacing = Extension.create({
  name: "letterSpacing",
  addGlobalAttributes() {
    return [
      {
        types: ["textStyle"],
        attributes: {
          letterSpacing: {
            default: null,
            parseHTML: (el) => el.style.letterSpacing || null,
            renderHTML: (attrs) => {
              const value = cssLength(attrs.letterSpacing)
              return value ? { style: `letter-spacing:${value}` } : {}
            },
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setLetterSpacing:
        (px) =>
        ({ chain }) =>
          chain()
            .setMark("textStyle", {
              letterSpacing: px ? `${px}px` : null,
            })
            .removeEmptyTextStyle()
            .run(),
    }
  },
})

/* ------------------------- interruzione di colonna ---------------------- */

export const ColumnBreak = Node.create({
  name: "columnBreak",
  group: "block",
  atom: true,
  selectable: true,
  parseHTML() {
    return [{ tag: "div[data-column-break]" }]
  },
  renderHTML() {
    return ["div", { "data-column-break": "", class: "doc-column-break" }]
  },
  addCommands() {
    return {
      setColumnBreak:
        () =>
        ({ commands }) =>
          commands.insertContent({ type: this.name }),
    }
  },
})

/* ---------------------------- note di chiusura --------------------------- */

export const footnoteKey = new PluginKey<number[]>("footnotes")

function footnotePositions(doc: PMNode): number[] {
  const out: number[] = []
  doc.descendants((node, pos) => {
    if (node.type.name === "footnote") out.push(pos)
    return true
  })
  return out
}

/** Nota a piè di pagina o nota di chiusura, come in Word */
export type NoteKind = "footnote" | "endnote"

export const noteKind = (node: PMNode | null | undefined): NoteKind =>
  node?.attrs.kind === "endnote" ? "endnote" : "footnote"

/**
 * Numero della nota alla posizione data, 1 per la prima. Le note a piè di
 * pagina e quelle di chiusura hanno numerazioni separate.
 */
export function footnoteNumber(state: EditorState, pos: number): number {
  const list = footnoteKey.getState(state) ?? []
  const kind = noteKind(state.doc.nodeAt(pos))
  let n = 0
  for (const p of list) {
    if (noteKind(state.doc.nodeAt(p)) === kind) n++
    if (p === pos) return n
  }
  return 0
}

const ROMAN: [number, string][] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
]

/** Le note di chiusura si numerano i, ii, iii come in Word */
export function noteLabel(kind: NoteKind, n: number) {
  if (kind === "footnote" || n <= 0) return String(n)
  let rest = n
  let out = ""
  for (const [value, sym] of ROMAN) {
    while (rest >= value) {
      out += sym
      rest -= value
    }
  }
  return out
}

/**
 * Nota: un numerino nel testo e il testo della nota in fondo alla sua pagina
 * (nota a piè di pagina) o in fondo al documento (nota di chiusura). Le
 * posizioni si ricalcolano solo quando il documento cambia, così ogni numero
 * costa una ricerca in un elenco.
 */
export const Footnote = Node.create({
  name: "footnote",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      text: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-text") ?? "",
        renderHTML: (attrs) => ({ "data-text": attrs.text ?? "" }),
      },
      kind: {
        default: "footnote" as NoteKind,
        parseHTML: (el) =>
          el.getAttribute("data-kind") === "endnote" ? "endnote" : "footnote",
        renderHTML: (attrs) => ({ "data-kind": attrs.kind ?? "footnote" }),
      },
    }
  },
  parseHTML() {
    // prima delle regole generiche di titoli, apici ed evidenziatori
    return [{ tag: "sup[data-footnote]", priority: 60 }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "sup",
      mergeAttributes(HTMLAttributes, { "data-footnote": "" }),
      "*",
    ]
  },
  renderText() {
    return ""
  },
  addCommands() {
    return {
      insertFootnote:
        (text = "", kind = "footnote") =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs: { text, kind } })
            // la nota appena inserita resta selezionata: il pannello apre
            // subito il campo per scriverla
            .command(({ tr }) => {
              const pos = tr.selection.from - 1
              if (tr.doc.nodeAt(pos)?.type.name === this.name) {
                tr.setSelection(NodeSelection.create(tr.doc, pos))
              }
              return true
            })
            .run(),
    }
  },
  addKeyboardShortcuts() {
    // le scorciatoie di Word
    return {
      "Mod-Alt-f": () => this.editor.commands.insertFootnote("", "footnote"),
      "Mod-Alt-d": () => this.editor.commands.insertFootnote("", "endnote"),
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<number[]>({
        key: footnoteKey,
        state: {
          init: (_config, state) => footnotePositions(state.doc),
          apply: (tr, value) => {
            if (!tr.docChanged) return value
            // una battuta qualunque non tocca le note: si spostano le posizioni
            // note invece di rileggere tutto il documento
            let added = false
            for (const step of tr.steps) {
              const slice = (
                step as unknown as { slice?: { content: PMNode["content"] } }
              ).slice
              slice?.content.descendants((n) => {
                if (n.type.name === "footnote") added = true
                return !added
              })
              if (added) break
            }
            if (added) return footnotePositions(tr.doc)
            const mapped: number[] = []
            for (const pos of value) {
              const result = tr.mapping.mapResult(pos)
              if (result.deleted) return footnotePositions(tr.doc)
              if (tr.doc.nodeAt(result.pos)?.type.name !== "footnote") {
                return footnotePositions(tr.doc)
              }
              mapped.push(result.pos)
            }
            return mapped
          },
        },
      }),
    ]
  },
})

/* -------------------------------- commenti ------------------------------- */

/**
 * Il testo commentato. Più commenti possono coprire lo stesso testo: il
 * marchio non esclude sé stesso. La conversazione sta nei dati del file.
 */
export const CommentMark = Mark.create({
  name: "comment",
  inclusive: false,
  excludes: "",
  spanning: true,
  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-comment"),
        renderHTML: (attrs) => ({ "data-comment": attrs.id }),
      },
    }
  },
  parseHTML() {
    // prima delle regole generiche di titoli, apici ed evidenziatori
    return [{ tag: "span[data-comment]", priority: 60 }]
  },
  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes(HTMLAttributes, { class: "doc-comment" }),
      0,
    ]
  },
})

/** Dove si trova ogni commento nel documento: id → primo e ultimo punto */
export function commentRanges(doc: PMNode) {
  const out = new Map<string, { from: number; to: number }>()
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    for (const mark of node.marks) {
      if (mark.type.name !== "comment" || !mark.attrs.id) continue
      const id = String(mark.attrs.id)
      const range = out.get(id)
      const end = pos + node.nodeSize
      if (range) range.to = Math.max(range.to, end)
      else out.set(id, { from: pos, to: end })
    }
    return false
  })
  return out
}

/* ------------------------- marcatore evidenziato ------------------------ */

/* -------------------------- immagini ridimensionabili -------------------- */

/** Come l'immagine sta rispetto al testo: le sette opzioni di Word */
export type ImageWrap =
  "inline" | "square" | "tight" | "through" | "topBottom" | "behind" | "front"

export const IMAGE_WRAPS: { value: ImageWrap; label: string; hint: string }[] =
  [
    {
      value: "inline",
      get label() {
        return translate("In linea con il testo")
      },
      get hint() {
        return translate("Su una riga sua")
      },
    },
    {
      value: "square",
      get label() {
        return translate("Quadrato")
      },
      get hint() {
        return translate("Il testo le gira intorno")
      },
    },
    {
      value: "tight",
      get label() {
        return translate("Ravvicinato")
      },
      get hint() {
        return translate("Testo più vicino")
      },
    },
    {
      value: "through",
      get label() {
        return translate("All'interno")
      },
      get hint() {
        return translate("Testo quasi a contatto")
      },
    },
    {
      value: "topBottom",
      get label() {
        return translate("Sopra e sotto")
      },
      get hint() {
        return translate("Niente testo ai lati")
      },
    },
    {
      value: "behind",
      get label() {
        return translate("Dietro al testo")
      },
      get hint() {
        return translate("Posizione libera")
      },
    },
    {
      value: "front",
      get label() {
        return translate("Davanti al testo")
      },
      get hint() {
        return translate("Posizione libera")
      },
    },
  ]

export const isFloatWrap = (w: string) =>
  w === "square" || w === "tight" || w === "through"
export const isFreeWrap = (w: string) => w === "behind" || w === "front"

export type ImageAttrs = {
  width: string
  wrap: ImageWrap
  side: "left" | "right"
  align: "left" | "center" | "right"
  /** libere: coordinate sul foglio (l'altezza è quella sulla carta) */
  x: number | null
  y: number | null
  /** col testo intorno: distanza dal margine e dall'inizio del paragrafo */
  dx: number
  dy: number
  rotate: number
  borderWidth: number
  borderColor: string | null
  shadow: boolean
}

const dataAttr = <T>(
  name: string,
  fallback: T,
  parse: (v: string) => T = (v) => v as unknown as T
) => ({
  default: fallback,
  parseHTML: (el: HTMLElement) => {
    const v = el.getAttribute(`data-${name}`)
    return v === null ? fallback : parse(v)
  },
  renderHTML: (attrs: Record<string, unknown>) => {
    const key = name.replace(/-([a-z])/g, (_m, c: string) => c.toUpperCase())
    const v = attrs[key]
    return v === null || v === undefined || v === fallback
      ? {}
      : { [`data-${name}`]: String(v) }
  },
})

export const StyledImage = Image.extend({
  draggable: true,
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: "100%",
        parseHTML: (el) => {
          // l'attributo `width` dell'HTML è in pixel senza unità: senza
          // aggiungerla la regola non vale niente e l'immagine usciva grande
          // quanto l'originale
          const raw = el.getAttribute("width")
          const attr = raw && /^\d+$/.test(raw.trim()) ? `${raw.trim()}px` : raw
          return cssLength(el.style.width || attr) ?? "100%"
        },
        renderHTML: (attrs) => {
          const width = cssLength(attrs.width)
          return width ? { style: `width:${width}` } : {}
        },
      },
      wrap: {
        default: "inline" as ImageWrap,
        parseHTML: (el) => {
          const v =
            el.getAttribute("data-wrap") ?? el.getAttribute("data-align")
          return IMAGE_WRAPS.some((w) => w.value === v)
            ? v
            : (legacyWrap(v ?? undefined).wrap ?? "inline")
        },
        renderHTML: (attrs) => ({ "data-wrap": attrs.wrap ?? "inline" }),
      },
      side: dataAttr("side", "left"),
      align: dataAttr("align", "left"),
      x: dataAttr<number | null>("x", null, Number),
      y: dataAttr<number | null>("y", null, Number),
      dx: dataAttr("dx", 0, Number),
      dy: dataAttr("dy", 0, Number),
      rotate: dataAttr("rotate", 0, Number),
      borderWidth: dataAttr("border-width", 0, Number),
      borderColor: dataAttr<string | null>("border-color", null),
      shadow: dataAttr("shadow", false, (v) => v === "true"),
      // una forma (Inserisci › Forme): il disegno si rifà da questi valori,
      // `src` ne è sempre la copia aggiornata per stampa ed esportazioni
      shape: dataAttr<string | null>("shape", null),
      fill: dataAttr<string | null>("fill", null),
      stroke: dataAttr<string | null>("stroke", null),
      strokeWidth: dataAttr("stroke-width", 3, Number),
      ratio: dataAttr<number | null>("ratio", null, Number),
      label: dataAttr("label", ""),
    }
  },
})
