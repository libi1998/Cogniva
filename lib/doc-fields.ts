import { Extension, Mark, Node, mergeAttributes } from "@tiptap/core"
import type { Editor } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { TextSelection, type EditorState } from "@tiptap/pm/state"
import { getAuthor } from "./author"
import { formatPageNumber } from "./header-footer"
import { getPagination, pageAt } from "./pagination"
import { docTitleText } from "./tiptap-extensions"
import type { PageNumberFormat } from "./types"

import { tr as translate, currentRegion } from "@/lib/i18n/client"
/**
 * Campi, segnalibri, caselle di testo, capolettera e frontespizio: le parti
 * della scheda Inserisci che nel documento hanno bisogno di un nodo o di un
 * attributo. I campi (data, pagina, riferimenti, numeri delle didascalie) si
 * calcolano dal documento ogni volta che cambia, come «Aggiorna campi» di Word
 * fatto da solo.
 */

/* --------------------------------- campi --------------------------------- */

export type FieldKind =
  | "date"
  | "time"
  | "page"
  | "pages"
  | "title"
  | "author"
  | "words"
  | "ref"
  | "seq"

export type FieldAttrs = {
  kind: FieldKind
  /** formato: data, numero o, per i riferimenti, cosa mostrare */
  format: string
  /** riferimenti: «bm:nome» o «seq:id»; didascalie: il loro id */
  target: string | null
  /** didascalie: l'etichetta («Figura», «Tabella», «Equazione») */
  label: string | null
}

export const DATE_FORMATS: {
  id: string
  kind: "date" | "time"
  render: (d: Date) => string
}[] = [
  {
    id: "long",
    kind: "date",
    render: (d) =>
      d.toLocaleDateString(currentRegion(), {
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
  },
  {
    id: "weekday",
    kind: "date",
    render: (d) =>
      d.toLocaleDateString(currentRegion(), {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      }),
  },
  {
    id: "short",
    kind: "date",
    render: (d) =>
      d.toLocaleDateString(currentRegion(), {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      }),
  },
  {
    id: "short2",
    kind: "date",
    render: (d) =>
      d.toLocaleDateString(currentRegion(), {
        day: "numeric",
        month: "numeric",
        year: "2-digit",
      }),
  },
  { id: "iso", kind: "date", render: (d) => d.toISOString().slice(0, 10) },
  {
    id: "month",
    kind: "date",
    render: (d) =>
      d.toLocaleDateString(currentRegion(), { month: "long", year: "numeric" }),
  },
  {
    id: "abbr",
    kind: "date",
    render: (d) =>
      d.toLocaleDateString(currentRegion(), {
        day: "numeric",
        month: "short",
        year: "numeric",
      }),
  },
  {
    id: "time",
    kind: "time",
    render: (d) =>
      d.toLocaleTimeString(currentRegion(), {
        hour: "2-digit",
        minute: "2-digit",
      }),
  },
  {
    id: "time-seconds",
    kind: "time",
    render: (d) => d.toLocaleTimeString(currentRegion()),
  },
  {
    id: "datetime",
    kind: "time",
    render: (d) =>
      `${d.toLocaleDateString(currentRegion())} ${d.toLocaleTimeString(
        currentRegion(),
        {
          hour: "2-digit",
          minute: "2-digit",
        }
      )}`,
  },
]

export const REF_FORMATS: {
  id: string
  label: string
  for: "bm" | "seq" | "any"
}[] = [
  {
    id: "text",
    get label() {
      return translate("Testo")
    },
    for: "any",
  },
  {
    id: "page",
    get label() {
      return translate("Numero di pagina")
    },
    for: "any",
  },
  {
    id: "position",
    get label() {
      return translate("Sopra/sotto")
    },
    for: "any",
  },
  {
    id: "label",
    get label() {
      return translate("Etichetta e numero")
    },
    for: "seq",
  },
  {
    id: "number",
    get label() {
      return translate("Solo il numero")
    },
    for: "seq",
  },
]

export const captionLabels = () => [
  translate("Figura"),
  translate("Tabella"),
  translate("Equazione"),
]

type FieldContext = {
  /** posizione → valore di ogni didascalia numerata */
  seq: Map<string, { n: number; label: string; pos: number; format: string }>
  /** il numero di ogni didascalia per posizione (gli id copiati si ripetono) */
  seqAt: Map<number, number>
  bookmarks: Map<string, { from: number; to: number }>
  words: number
  title: string
}

// dipende solo dal documento: spostare il cursore non ricalcola niente
const contexts = new WeakMap<PMNode, FieldContext>()

function fieldContext(state: EditorState): FieldContext {
  const hit = contexts.get(state.doc)
  if (hit) return hit
  const seq: FieldContext["seq"] = new Map()
  const seqAt: FieldContext["seqAt"] = new Map()
  const counters = new Map<string, number>()
  const bookmarks: FieldContext["bookmarks"] = new Map()
  state.doc.descendants((node, pos) => {
    if (node.type.name === "field" && node.attrs.kind === "seq") {
      const label = String(node.attrs.label ?? translate("Figura"))
      const n = (counters.get(label) ?? 0) + 1
      counters.set(label, n)
      seqAt.set(pos, n)
      if (node.attrs.target && !seq.has(String(node.attrs.target))) {
        seq.set(String(node.attrs.target), {
          n,
          label,
          pos,
          format: String(node.attrs.format || "arabic"),
        })
      }
    }
    if (node.isText) {
      for (const mark of node.marks) {
        if (mark.type.name !== "bookmark") continue
        const name = String(mark.attrs.name ?? "")
        const range = bookmarks.get(name)
        bookmarks.set(name, {
          from: range ? Math.min(range.from, pos) : pos,
          to: range
            ? Math.max(range.to, pos + node.nodeSize)
            : pos + node.nodeSize,
        })
      }
    }
    return true
  })
  const text = state.doc.textBetween(0, state.doc.content.size, " ", " ")
  const ctx: FieldContext = {
    seq,
    seqAt,
    bookmarks,
    words: text.split(/\s+/).filter(Boolean).length,
    title: docTitleText(state.doc) ?? "",
  }
  contexts.set(state.doc, ctx)
  return ctx
}

/** Il testo di un blocco con il valore dei suoi campi (per gli indici) */
export function textWithFields(
  state: EditorState,
  block: PMNode,
  blockPos: number
) {
  let out = ""
  block.forEach((child, offset) => {
    if (child.type.name === "field") {
      // un riferimento dentro un riferimento girerebbe all'infinito
      if (child.attrs.kind !== "ref") {
        out += fieldText(state, child, blockPos + 1 + offset)
      }
    } else {
      out += child.textContent
    }
  })
  return out.trim()
}

/** Il valore di un campo, calcolato dallo stato attuale */
export function fieldText(
  state: EditorState,
  node: PMNode,
  pos: number,
  pageFormat: PageNumberFormat = "arabic",
  pageStart = 1
): string {
  const a = node.attrs as FieldAttrs
  const ctx = fieldContext(state)
  switch (a.kind) {
    case "date":
    case "time": {
      const f =
        DATE_FORMATS.find((x) => x.id === a.format) ??
        DATE_FORMATS[a.kind === "time" ? 7 : 0]
      return f.render(new Date())
    }
    case "page":
      return formatPageNumber(pageAt(state, pos) + pageStart - 1, pageFormat)
    case "pages":
      return String(getPagination(state).pages + pageStart - 1)
    case "title":
      return ctx.title || translate("Senza titolo")
    case "author":
      return getAuthor() || translate("Autore")
    case "words":
      return String(ctx.words)
    case "seq": {
      return formatPageNumber(
        ctx.seqAt.get(pos) ?? 1,
        (a.format || "arabic") as PageNumberFormat
      )
    }
    case "ref": {
      const target = a.target ?? ""
      if (target.startsWith("seq:")) {
        const item = ctx.seq.get(target.slice(4))
        if (!item) return translate("Errore! Riferimento non trovato.")
        const number = formatPageNumber(item.n, item.format as PageNumberFormat)
        if (a.format === "number") return number
        if (a.format === "page")
          return formatPageNumber(
            pageAt(state, item.pos) + pageStart - 1,
            pageFormat
          )
        if (a.format === "position")
          return item.pos < pos ? translate("sopra") : translate("sotto")
        if (a.format === "text") {
          const $item = state.doc.resolve(item.pos)
          return textWithFields(state, $item.parent, $item.before())
        }
        return `${item.label} ${number}`
      }
      const range = ctx.bookmarks.get(target.replace(/^bm:/, ""))
      if (!range) return translate("Errore! Segnalibro non definito.")
      if (a.format === "page")
        return formatPageNumber(
          pageAt(state, range.from) + pageStart - 1,
          pageFormat
        )
      if (a.format === "position")
        return range.from < pos ? translate("sopra") : translate("sotto")
      return state.doc.textBetween(range.from, range.to, " ").trim()
    }
    default:
      return ""
  }
}

export const FIELD_LABELS: Record<FieldKind, string> = {
  get date() {
    return translate("Data")
  },
  get time() {
    return translate("Ora")
  },
  get page() {
    return translate("Numero di pagina")
  },
  get pages() {
    return translate("Numero di pagine")
  },
  get title() {
    return translate("Titolo")
  },
  get author() {
    return translate("Autore")
  },
  get words() {
    return translate("Numero di parole")
  },
  get ref() {
    return translate("Riferimento")
  },
  get seq() {
    return translate("Numero didascalia")
  },
}

/** Formato dei numeri di pagina del documento, nella memoria dell'editor */
export type FieldSettings = {
  pageFormat: PageNumberFormat
  pageStart: number
}

declare module "@tiptap/core" {
  interface Storage {
    field: FieldSettings
  }
  interface Commands<ReturnType> {
    field: {
      insertField: (attrs: Partial<FieldAttrs>) => ReturnType
    }
    bookmark: {
      setBookmark: (name: string) => ReturnType
      removeBookmark: (name: string) => ReturnType
    }
    textBox: {
      insertTextBox: (
        attrs?: Partial<TextBoxAttrs>,
        text?: string
      ) => ReturnType
      updateTextBox: (attrs: Partial<TextBoxAttrs>) => ReturnType
      removeTextBox: () => ReturnType
    }
    dropCap: {
      setDropCap: (
        mode: "drop" | "margin" | null,
        lines?: number,
        font?: string | null
      ) => ReturnType
    }
    cover: {
      removeCover: () => ReturnType
    }
  }
}

export const Field = Node.create<Record<string, never>, FieldSettings>({
  name: "field",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addStorage() {
    return { pageFormat: "arabic", pageStart: 1 }
  },

  addAttributes() {
    return {
      kind: {
        default: "date",
        parseHTML: (el) => el.getAttribute("data-field"),
        renderHTML: (a) => ({ "data-field": a.kind }),
      },
      format: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-format") ?? "",
        renderHTML: (a) => (a.format ? { "data-format": a.format } : {}),
      },
      target: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-target"),
        renderHTML: (a) => (a.target ? { "data-target": a.target } : {}),
      },
      label: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-label"),
        renderHTML: (a) => (a.label ? { "data-label": a.label } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-field]" }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      "span",
      mergeAttributes({ class: "doc-field" }, HTMLAttributes),
      FIELD_LABELS[node.attrs.kind as FieldKind] ?? "",
    ]
  },

  renderText({ node }) {
    return FIELD_LABELS[node.attrs.kind as FieldKind] ?? ""
  },

  addNodeView() {
    return ({ node, editor, getPos }) => {
      const dom = document.createElement("span")
      dom.className = "doc-field"
      dom.contentEditable = "false"
      dom.setAttribute("data-field", String(node.attrs.kind))
      let current = node
      const render = () => {
        if (editor.isDestroyed) return
        const pos = typeof getPos === "function" ? getPos() : undefined
        if (pos === undefined) return
        const settings = editor.storage.field
        const value = fieldText(
          editor.state,
          current,
          pos,
          settings?.pageFormat ?? "arabic",
          settings?.pageStart ?? 1
        )
        if (dom.textContent !== value) dom.textContent = value
        dom.title =
          FIELD_LABELS[current.attrs.kind as FieldKind] ?? translate("Campo")
      }
      // i campi di pagina cambiano quando si sposta il testo prima di loro
      const onTransaction = () => render()
      render()
      editor.on("transaction", onTransaction)
      return {
        dom,
        update: (next) => {
          if (next.type !== current.type) return false
          current = next
          render()
          return true
        },
        ignoreMutation: () => true,
        destroy: () => {
          editor.off("transaction", onTransaction)
        },
      }
    }
  },

  addCommands() {
    return {
      insertField:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs: {
                kind: attrs.kind ?? "date",
                format: attrs.format ?? "",
                target:
                  attrs.target ??
                  (attrs.kind === "seq"
                    ? Math.random().toString(36).slice(2, 10)
                    : null),
                label: attrs.label ?? null,
              },
            })
            .run(),
    }
  },
})

/** Il valore di tutti i campi del documento, per le esportazioni */
export function fieldsOf(editor: Editor) {
  const out = new Map<PMNode, string>()
  const settings = editor.storage.field
  editor.state.doc.descendants((node, pos) => {
    if (node.type.name === "field") {
      out.set(
        node,
        fieldText(
          editor.state,
          node,
          pos,
          settings?.pageFormat ?? "arabic",
          settings?.pageStart ?? 1
        )
      )
    }
    return true
  })
  return out
}

/**
 * Il formato dei numeri di pagina viene dal tema del documento: cambiandolo
 * i campi si ridisegnano con una transazione vuota
 */
export function setFieldSettings(editor: Editor, next: FieldSettings) {
  const storage = editor.storage.field
  if (!storage || editor.isDestroyed) return
  if (
    storage.pageFormat === next.pageFormat &&
    storage.pageStart === next.pageStart
  ) {
    return
  }
  storage.pageFormat = next.pageFormat
  storage.pageStart = next.pageStart
  editor.view.dispatch(
    editor.state.tr
      .setMeta("addToHistory", false)
      .setMeta("fieldSettings", true)
  )
}

/* ------------------------------ segnalibri ------------------------------- */

export const BOOKMARK_NAME = /^[A-Za-z_][A-Za-z0-9_]{0,39}$/

/** Il nome di un segnalibro nascosto, come quelli che Word mette sui titoli */
export function hiddenBookmarkName() {
  return `_Ref${Math.random().toString(36).slice(2, 10)}`
}

export const Bookmark = Mark.create({
  name: "bookmark",
  inclusive: false,
  excludes: "",
  spanning: true,

  addAttributes() {
    return {
      name: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-bookmark"),
        renderHTML: (a) =>
          a.name ? { "data-bookmark": a.name, id: `bm-${String(a.name)}` } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-bookmark]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ class: "doc-bookmark" }, HTMLAttributes),
      0,
    ]
  },

  addCommands() {
    return {
      setBookmark:
        (name) =>
        ({ state, tr, dispatch }) => {
          if (!BOOKMARK_NAME.test(name)) return false
          let { from, to } = state.selection
          if (from === to) {
            // senza selezione: la parola del cursore, o tutto il paragrafo
            const $from = state.selection.$from
            const text = $from.parent.textContent
            const offset = $from.parentOffset
            let start = offset
            let end = offset
            while (start > 0 && /[\p{L}\p{N}_]/u.test(text[start - 1])) start--
            while (end < text.length && /[\p{L}\p{N}_]/u.test(text[end])) end++
            if (start === end) {
              start = 0
              end = text.length
            }
            from = $from.start() + start
            to = $from.start() + end
          }
          if (from === to) return false
          if (dispatch) {
            const type = state.schema.marks.bookmark
            // un nome vale per un solo punto del documento
            state.doc.descendants((node, pos) => {
              if (
                node.isText &&
                node.marks.some((m) => m.type === type && m.attrs.name === name)
              ) {
                tr.removeMark(pos, pos + node.nodeSize, type.create({ name }))
              }
              return true
            })
            tr.addMark(from, to, type.create({ name }))
          }
          return true
        },
      removeBookmark:
        (name) =>
        ({ state, tr, dispatch }) => {
          const type = state.schema.marks.bookmark
          let found = false
          state.doc.descendants((node, pos) => {
            if (!node.isText) return true
            const mark = node.marks.find(
              (m) => m.type === type && m.attrs.name === name
            )
            if (mark) {
              found = true
              if (dispatch) tr.removeMark(pos, pos + node.nodeSize, mark)
            }
            return true
          })
          return found
        },
    }
  },
})

export type BookmarkInfo = {
  name: string
  from: number
  to: number
  text: string
}

export function listBookmarks(
  state: EditorState,
  hidden = false
): BookmarkInfo[] {
  const ctx = fieldContext(state)
  return [...ctx.bookmarks]
    .filter(([name]) => hidden || !name.startsWith("_"))
    .map(([name, range]) => ({
      name,
      ...range,
      text: state.doc.textBetween(range.from, range.to, " ").trim(),
    }))
    .sort((a, b) => a.from - b.from)
}

/** Porta il cursore su un segnalibro e lo mostra */
export function goToBookmark(editor: Editor, name: string) {
  const range = fieldContext(editor.state).bookmarks.get(name)
  if (!range) return false
  editor
    .chain()
    .focus()
    .command(({ tr }) => {
      tr.setSelection(TextSelection.create(tr.doc, range.from, range.to))
      return true
    })
    .scrollIntoView()
    .run()
  return true
}

/* --------------------------- casella di testo ---------------------------- */

export type TextBoxAttrs = {
  layout: "inline" | "left" | "right" | "center"
  /** larghezza in percentuale del testo */
  width: number
  fill: string | null
  border: "none" | "thin" | "accent" | "dashed" | "left"
  shadow: boolean
}

export const TEXT_BOX_PRESETS: {
  id: string
  label: string
  hint: string
  attrs: TextBoxAttrs
  text: string
}[] = [
  {
    id: "simple",
    get label() {
      return translate("Casella semplice")
    },
    get hint() {
      return translate("Bordo sottile, nel testo")
    },
    attrs: {
      layout: "inline",
      width: 100,
      fill: null,
      border: "thin",
      shadow: false,
    },
    get text() {
      return translate("Scrivi qui il testo della casella.")
    },
  },
  {
    id: "sidebar",
    get label() {
      return translate("Barra laterale")
    },
    get hint() {
      return translate("A destra, il testo le scorre accanto")
    },
    attrs: {
      layout: "right",
      width: 38,
      fill: "accent-soft",
      border: "none",
      shadow: false,
    },
    get text() {
      return translate(
        "Una nota a lato: un approfondimento, una definizione, un dato."
      )
    },
  },
  {
    id: "pull-quote",
    get label() {
      return translate("Citazione in evidenza")
    },
    get hint() {
      return translate("A sinistra, con la barra dell'accento")
    },
    attrs: {
      layout: "left",
      width: 42,
      fill: null,
      border: "left",
      shadow: false,
    },
    get text() {
      return translate("«Una frase da mettere in risalto.»")
    },
  },
  {
    id: "callout",
    get label() {
      return translate("Riquadro evidenziato")
    },
    get hint() {
      return translate("Centrato, con ombra")
    },
    attrs: {
      layout: "center",
      width: 80,
      fill: "accent-soft",
      border: "accent",
      shadow: true,
    },
    get text() {
      return translate("Importante: un'informazione da non perdere.")
    },
  },
  {
    id: "dashed",
    get label() {
      return translate("Promemoria")
    },
    get hint() {
      return translate("Bordo tratteggiato")
    },
    attrs: {
      layout: "inline",
      width: 100,
      fill: null,
      border: "dashed",
      shadow: false,
    },
    get text() {
      return translate("Da completare…")
    },
  },
]

export const TextBox = Node.create({
  name: "textBox",
  group: "block",
  content: "block+",
  defining: true,
  isolating: true,
  draggable: true,

  addAttributes() {
    return {
      layout: {
        default: "inline",
        parseHTML: (el) => el.getAttribute("data-layout") ?? "inline",
        renderHTML: (a) => ({ "data-layout": a.layout }),
      },
      width: {
        default: 100,
        parseHTML: (el) => Number(el.getAttribute("data-width")) || 100,
        renderHTML: (a) => ({
          "data-width": a.width,
          style: `width:${Math.max(15, Math.min(100, Number(a.width) || 100))}%`,
        }),
      },
      fill: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-fill"),
        renderHTML: (a) => {
          if (!a.fill) return {}
          const fill = String(a.fill).replace(/[;{}<>"\\]/g, "")
          return {
            "data-fill": fill,
            style: `background:${fill === "accent-soft" ? "var(--doc-accent-soft)" : fill}`,
          }
        },
      },
      border: {
        default: "thin",
        parseHTML: (el) => el.getAttribute("data-border") ?? "thin",
        renderHTML: (a) => ({ "data-border": a.border }),
      },
      shadow: {
        default: false,
        parseHTML: (el) => el.hasAttribute("data-shadow"),
        renderHTML: (a) => (a.shadow ? { "data-shadow": "" } : {}),
      },
    }
  },

  parseHTML() {
    return [{ tag: "aside[data-textbox]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "aside",
      mergeAttributes(
        { "data-textbox": "", class: "doc-textbox" },
        HTMLAttributes
      ),
      0,
    ]
  },

  addCommands() {
    return {
      insertTextBox:
        (attrs = {}, text = "") =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: this.name,
              attrs,
              content: [
                {
                  type: "paragraph",
                  content: text ? [{ type: "text", text }] : undefined,
                },
              ],
            })
            .run(),
      updateTextBox:
        (attrs) =>
        ({ commands }) =>
          commands.updateAttributes(this.name, attrs),
      removeTextBox:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection
          for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth)
            if (node.type.name !== this.name) continue
            if (dispatch) {
              const pos = $from.before(depth)
              tr.replaceWith(pos, pos + node.nodeSize, node.content)
            }
            return true
          }
          return false
        },
    }
  },
})

/* ------------------------ capolettera e frontespizio --------------------- */

export const DropCap = Extension.create({
  name: "dropCap",
  addGlobalAttributes() {
    return [
      {
        types: ["paragraph"],
        attributes: {
          dropCap: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) => el.getAttribute("data-dropcap"),
            renderHTML: (a) => {
              if (!a.dropCap) return {}
              const lines = Math.max(2, Math.min(6, Number(a.dropLines) || 3))
              return {
                "data-dropcap": a.dropCap,
                style: `--drop-lines:${lines}${a.dropFont ? `;--drop-font:${String(a.dropFont).replace(/[;{}<>"\\]/g, "")}` : ""}`,
              }
            },
          },
          dropLines: {
            default: 3,
            keepOnSplit: false,
            parseHTML: (el) =>
              Number(el.style.getPropertyValue("--drop-lines")) || 3,
            renderHTML: () => ({}),
          },
          dropFont: {
            default: null,
            keepOnSplit: false,
            parseHTML: (el) =>
              el.style.getPropertyValue("--drop-font").trim() || null,
            renderHTML: () => ({}),
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      setDropCap:
        (mode, lines = 3, font = null) =>
        ({ commands }) =>
          commands.updateAttributes("paragraph", {
            dropCap: mode,
            dropLines: lines,
            dropFont: font,
          }),
    }
  },
})

export const CoverPart = Extension.create({
  name: "cover",
  addGlobalAttributes() {
    return [
      {
        types: ["docTitle", "paragraph", "heading", "pageBreak"],
        attributes: {
          cover: {
            default: false,
            keepOnSplit: false,
            parseHTML: (el) => el.hasAttribute("data-cover"),
            renderHTML: (a) => (a.cover ? { "data-cover": "" } : {}),
          },
        },
      },
    ]
  },
  addCommands() {
    return {
      removeCover:
        () =>
        ({ state, tr, dispatch }) => {
          const parts: { pos: number; node: PMNode }[] = []
          state.doc.forEach((node, pos) => {
            if (node.attrs.cover) parts.push({ pos, node })
          })
          if (!parts.length) return false
          if (dispatch) {
            for (const { pos, node } of parts.reverse()) {
              if (node.type.name === "docTitle") {
                tr.setNodeMarkup(pos, undefined, {
                  ...node.attrs,
                  cover: false,
                  spaceBefore: null,
                  textAlign: null,
                  border: "none",
                  shading: null,
                  styleId: null,
                })
              } else {
                tr.delete(pos, pos + node.nodeSize)
              }
            }
          }
          return true
        },
    }
  },
})

export function hasCover(state: EditorState) {
  let found = false
  state.doc.forEach((node) => {
    if (node.attrs.cover) found = true
  })
  return found
}
