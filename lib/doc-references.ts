import { Mark, Node, mergeAttributes } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { NodeSelection, type EditorState } from "@tiptap/pm/state"
import { textWithFields } from "./doc-fields"

import { tr as translate, currentLocale } from "@/lib/i18n/client"
/**
 * Scheda Riferimenti: didascalie numerate, indice delle figure, voci
 * dell'indice analitico e delle autorità con i loro indici. Tutto si calcola
 * dal documento: gli indici non vanno mai «aggiornati» a mano.
 */

/* ------------------------------ didascalie ------------------------------- */

export type CaptionOptions = {
  label: string
  text: string
  position: "above" | "below"
  format: string
  /** «Escludi etichetta dalla didascalia»: solo il numero */
  excludeLabel: boolean
}

const BLOCK_OBJECTS = new Set([
  "image",
  "chart",
  "boardEmbed",
  "video",
  "table",
  "mathBlock",
])

/** Dove mettere la didascalia: accanto all'oggetto selezionato o al cursore */
export function captionTarget(state: EditorState) {
  const { selection } = state
  if (
    selection instanceof NodeSelection &&
    BLOCK_OBJECTS.has(selection.node.type.name)
  ) {
    return {
      pos: selection.from,
      end: selection.to,
      kind: selection.node.type.name,
    }
  }
  const { $from } = selection
  for (let depth = $from.depth; depth > 0; depth -= 1) {
    const node = $from.node(depth)
    if (BLOCK_OBJECTS.has(node.type.name)) {
      const pos = $from.before(depth)
      return { pos, end: pos + node.nodeSize, kind: node.type.name }
    }
  }
  // il blocco di primo livello del cursore
  const index = $from.index(0)
  let pos = 0
  for (let i = 0; i < index; i += 1) pos += state.doc.child(i).nodeSize
  const node = state.doc.maybeChild(index)
  return { pos, end: pos + (node?.nodeSize ?? 0), kind: node?.type.name ?? "" }
}

/** Il paragrafo «Didascalia»: etichetta, numero automatico e testo */
export function captionContent(options: CaptionOptions, target: string) {
  const content: Record<string, unknown>[] = []
  if (!options.excludeLabel) {
    content.push({ type: "text", text: `${options.label} ` })
  }
  content.push({
    type: "field",
    attrs: {
      kind: "seq",
      label: options.label,
      format: options.format,
      target,
    },
  })
  const text = options.text.trim()
  if (text) content.push({ type: "text", text: `: ${text}` })
  return {
    type: "paragraph",
    attrs: { styleId: "caption" },
    content,
  }
}

/** Le didascalie di un'etichetta, nell'ordine del documento */
export function captionEntries(state: EditorState, label: string) {
  const out: { pos: number; n: number; text: string }[] = []
  let n = 0
  state.doc.descendants((node, pos) => {
    if (
      node.type.name === "field" &&
      node.attrs.kind === "seq" &&
      node.attrs.label === label
    ) {
      n += 1
      const $pos = state.doc.resolve(pos)
      out.push({
        pos,
        n,
        text: textWithFields(state, $pos.parent, $pos.before()),
      })
    }
    return true
  })
  return out
}

/* -------------------------- voci degli indici ---------------------------- */

export type IndexKind = "index" | "authority"

export const authorityCategories = () => [
  translate("Casi"),
  translate("Leggi"),
  translate("Regolamenti"),
  translate("Trattati"),
  translate("Altre fonti"),
]

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    indexEntry: {
      markIndexEntry: (options: {
        entry: string
        sub?: string
        kind?: IndexKind
        category?: string
        /** tutte le occorrenze del testo selezionato */
        all?: boolean
      }) => ReturnType
      removeIndexEntries: (kind: IndexKind) => ReturnType
    }
    referenceIndexes: {
      insertFigureIndex: (label: string) => ReturnType
      insertDocIndex: (kind: IndexKind) => ReturnType
    }
  }
}

export const IndexEntry = Mark.create({
  name: "indexEntry",
  inclusive: false,
  excludes: "",

  addAttributes() {
    return {
      entry: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-xe") ?? "",
        renderHTML: (a) => ({ "data-xe": a.entry }),
      },
      sub: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-xe-sub") ?? "",
        renderHTML: (a) => (a.sub ? { "data-xe-sub": a.sub } : {}),
      },
      kind: {
        default: "index",
        parseHTML: (el) => el.getAttribute("data-xe-kind") ?? "index",
        renderHTML: (a) =>
          a.kind && a.kind !== "index" ? { "data-xe-kind": a.kind } : {},
      },
      category: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-xe-category") ?? "",
        renderHTML: (a) =>
          a.category ? { "data-xe-category": a.category } : {},
      },
    }
  },

  parseHTML() {
    return [{ tag: "span[data-xe]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "span",
      mergeAttributes({ class: "doc-index-entry" }, HTMLAttributes),
      0,
    ]
  },

  addCommands() {
    return {
      markIndexEntry:
        ({ entry, sub = "", kind = "index", category = "", all = false }) =>
        ({ state, tr, dispatch }) => {
          const name = entry.trim()
          if (!name) return false
          const { from, to } = state.selection
          if (from === to) return false
          const type = state.schema.marks.indexEntry
          const mark = type.create({
            entry: name,
            sub: sub.trim(),
            kind,
            category,
          })
          if (!dispatch) return true
          if (!all) {
            tr.addMark(from, to, mark)
            return true
          }
          // «Segna tutto»: ogni occorrenza della stessa parola, maiuscole comprese
          const needle = state.doc.textBetween(from, to, " ")
          if (!needle.trim()) return false
          state.doc.descendants((node, pos) => {
            if (!node.isText || !node.text) return true
            let index = node.text.indexOf(needle)
            while (index >= 0) {
              tr.addMark(pos + index, pos + index + needle.length, mark)
              index = node.text.indexOf(needle, index + needle.length)
            }
            return true
          })
          return true
        },
      removeIndexEntries:
        (kind) =>
        ({ state, tr, dispatch }) => {
          const type = state.schema.marks.indexEntry
          let found = false
          state.doc.descendants((node, pos) => {
            if (!node.isText) return true
            for (const m of node.marks) {
              if (m.type === type && (m.attrs.kind ?? "index") === kind) {
                found = true
                if (dispatch) tr.removeMark(pos, pos + node.nodeSize, m)
              }
            }
            return true
          })
          return found
        },
    }
  },
})

export type IndexItem = {
  entry: string
  subs: { sub: string; positions: number[] }[]
  positions: number[]
  category: string
}

/** Le voci dell'indice, ordinate e raggruppate, con le loro posizioni */
export function indexItems(doc: PMNode, kind: IndexKind): IndexItem[] {
  const map = new Map<string, IndexItem>()
  doc.descendants((node, pos) => {
    if (!node.isText) return true
    for (const mark of node.marks) {
      if (mark.type.name !== "indexEntry") continue
      if ((mark.attrs.kind ?? "index") !== kind) continue
      const entry = String(mark.attrs.entry ?? "").trim()
      if (!entry) continue
      const key = entry.toLocaleLowerCase("it")
      const item =
        map.get(key) ??
        ({
          entry,
          subs: [],
          positions: [],
          category: String(mark.attrs.category ?? ""),
        } as IndexItem)
      const sub = String(mark.attrs.sub ?? "").trim()
      if (sub) {
        let group = item.subs.find(
          (s) => s.sub.toLocaleLowerCase("it") === sub.toLocaleLowerCase("it")
        )
        if (!group) {
          group = { sub, positions: [] }
          item.subs.push(group)
        }
        group.positions.push(pos)
      } else {
        item.positions.push(pos)
      }
      map.set(key, item)
    }
    return true
  })
  const collator = new Intl.Collator(currentLocale(), {
    sensitivity: "base",
    numeric: true,
  })
  const items = [...map.values()].sort((a, b) =>
    collator.compare(a.entry, b.entry)
  )
  for (const item of items)
    item.subs.sort((a, b) => collator.compare(a.sub, b.sub))
  return items
}

/* ------------------------------ indici ---------------------------------- */

export const FigureIndex = Node.create({
  name: "figureIndex",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      label: {
        default: translate("Figura"),
        parseHTML: (el) => el.getAttribute("data-label") ?? translate("Figura"),
        renderHTML: (a) => ({ "data-label": a.label }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-figure-index]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-figure-index": "", class: "doc-toc" },
        HTMLAttributes
      ),
    ]
  },

  addCommands() {
    return {
      insertFigureIndex:
        (label) =>
        ({ commands }) =>
          commands.insertContent({ type: this.name, attrs: { label } }),
      insertDocIndex:
        (kind) =>
        ({ commands }) =>
          commands.insertContent({ type: "docIndex", attrs: { kind } }),
    }
  },
})

export const DocIndex = Node.create({
  name: "docIndex",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      kind: {
        default: "index",
        parseHTML: (el) => el.getAttribute("data-kind") ?? "index",
        renderHTML: (a) => ({ "data-kind": a.kind }),
      },
      columns: {
        default: 2,
        parseHTML: (el) => Number(el.getAttribute("data-columns")) || 2,
        renderHTML: (a) => ({ "data-columns": a.columns }),
      },
    }
  },

  parseHTML() {
    return [{ tag: "div[data-doc-index]" }]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      "div",
      mergeAttributes(
        { "data-doc-index": "", class: "doc-toc" },
        HTMLAttributes
      ),
    ]
  },
})
