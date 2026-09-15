"use client"

import { Node, mergeAttributes, type Editor } from "@tiptap/core"
import { NodeSelection } from "@tiptap/pm/state"
import type { Node as PMNode } from "@tiptap/pm/model"
import {
  BIBLIOGRAPHY_TITLES,
  inTextCitation,
  referenceEntry,
  sortSources,
} from "@/lib/citations"
import type { CitationStyle, DocSource } from "@/lib/types"

declare module "@tiptap/core" {
  interface Storage {
    citation: CitationStorage
  }
  interface Commands<ReturnType> {
    citation: {
      insertCitation: (sourceId: string, pages?: string) => ReturnType
      insertBibliography: () => ReturnType
    }
  }
}

/**
 * Fonti e stile del documento arrivano da React e stanno nella memoria
 * dell'estensione: citazioni e bibliografia sono viste senza React che si
 * ridisegnano quando cambiano.
 */
type CitationStorage = {
  sources: DocSource[]
  style: CitationStyle
  listeners: Set<() => void>
}

function storageOf(editor: Editor): CitationStorage {
  return editor.storage.citation as CitationStorage
}

export function setCitationData(
  editor: Editor,
  sources: DocSource[],
  style: CitationStyle
) {
  const store = storageOf(editor)
  if (!store || (store.sources === sources && store.style === style)) return
  store.sources = sources
  store.style = style
  store.listeners.forEach((l) => l())
}

/** Le fonti citate nel documento, nell'ordine in cui compaiono */
function citedSourceIds(doc: PMNode) {
  const ids: string[] = []
  doc.descendants((node) => {
    if (node.type.name === "citation" && node.attrs.sourceId) {
      const id = String(node.attrs.sourceId)
      if (!ids.includes(id)) ids.push(id)
    }
    return node.isBlock
  })
  return ids
}

export const Citation = Node.create({
  name: "citation",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,

  addStorage(): CitationStorage {
    return { sources: [], style: "apa", listeners: new Set() }
  },

  addAttributes() {
    return {
      sourceId: {
        default: null,
        parseHTML: (el) => el.getAttribute("data-source"),
        renderHTML: (attrs) => ({ "data-source": attrs.sourceId }),
      },
      pages: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-pages") ?? "",
        renderHTML: (attrs) => ({ "data-pages": attrs.pages }),
      },
    }
  },
  parseHTML() {
    // prima delle regole generiche di titoli, apici ed evidenziatori
    return [{ tag: "span[data-citation]", priority: 60 }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["span", mergeAttributes(HTMLAttributes, { "data-citation": "" })]
  },
  renderText({ node }) {
    if (!this.editor) return ""
    const store = storageOf(this.editor)
    return inTextCitation(
      store.style,
      store.sources.find((s) => s.id === node.attrs.sourceId),
      String(node.attrs.pages ?? "")
    )
  },

  addNodeView() {
    return ({ node, editor }) => {
      const store = storageOf(editor as Editor)
      const dom = document.createElement("span")
      dom.className = "doc-citation"
      dom.contentEditable = "false"
      let current = node
      const draw = () => {
        const source = store.sources.find(
          (s) => s.id === current.attrs.sourceId
        )
        dom.textContent = inTextCitation(
          store.style,
          source,
          String(current.attrs.pages ?? "")
        )
        dom.classList.toggle("is-missing", !source)
      }
      draw()
      store.listeners.add(draw)
      return {
        dom,
        update: (next) => {
          if (next.type !== current.type) return false
          current = next
          draw()
          return true
        },
        selectNode: () => dom.classList.add("is-selected"),
        deselectNode: () => dom.classList.remove("is-selected"),
        ignoreMutation: () => true,
        destroy: () => store.listeners.delete(draw),
      }
    }
  },

  addCommands() {
    return {
      insertCitation:
        (sourceId, pages = "") =>
        ({ chain }) =>
          chain()
            .insertContent([
              { type: this.name, attrs: { sourceId, pages } },
              { type: "text", text: " " },
            ])
            .run(),
      insertBibliography:
        () =>
        ({ chain }) =>
          chain()
            .insertContent({ type: "bibliography" })
            .command(({ tr }) => {
              const $from = tr.selection.$from
              if (!$from.depth) return true
              const start = $from.before(1)
              const prev = tr.doc.resolve(start).nodeBefore
              if (prev?.type.name === "bibliography") {
                tr.setSelection(
                  NodeSelection.create(tr.doc, start - prev.nodeSize)
                )
              }
              return true
            })
            .run(),
    }
  },
})

/**
 * Bibliografia: le fonti citate nel documento (o tutte, se non ne è citata
 * nessuna), ordinate e formattate nello stile scelto. Si aggiorna da sola.
 */
export const Bibliography = Node.create({
  name: "bibliography",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      title: {
        default: "",
        parseHTML: (el) => el.getAttribute("data-title") ?? "",
        renderHTML: (attrs) => ({ "data-title": attrs.title }),
      },
    }
  },
  parseHTML() {
    return [{ tag: "div[data-bibliography]" }]
  },
  renderHTML({ HTMLAttributes }) {
    return ["div", mergeAttributes(HTMLAttributes, { "data-bibliography": "" })]
  },

  addNodeView() {
    return ({ node, editor }) => {
      const ed = editor as Editor
      const store = storageOf(ed)
      const dom = document.createElement("div")
      dom.className = "doc-bibliography"
      dom.contentEditable = "false"
      // l'impaginazione può spezzarla fra le voci
      dom.setAttribute("data-gap-host", "")
      let current = node
      let signature = ""
      let timer: ReturnType<typeof setTimeout> | null = null

      const draw = () => {
        timer = null
        if (ed.isDestroyed) return
        const cited = citedSourceIds(ed.state.doc)
        const pool = cited.length
          ? store.sources.filter((s) => cited.includes(s.id))
          : store.sources
        const list = sortSources(pool)
        const title =
          String(current.attrs.title ?? "") || BIBLIOGRAPHY_TITLES[store.style]
        const next = JSON.stringify([store.style, title, list])
        if (next === signature) return
        signature = next

        const head = document.createElement("p")
        head.className = "doc-bib-title"
        head.setAttribute("data-gap-item", "")
        head.textContent = title
        const items = list.length
          ? list.map((source) => {
              const p = document.createElement("p")
              p.className = "doc-bib-entry"
              p.setAttribute("data-gap-item", "")
              for (const piece of referenceEntry(store.style, source)) {
                if (piece.italic) {
                  const em = document.createElement("em")
                  em.textContent = piece.text
                  p.appendChild(em)
                } else p.appendChild(document.createTextNode(piece.text))
              }
              return p
            })
          : [
              Object.assign(document.createElement("p"), {
                className: "doc-bib-empty",
                textContent:
                  "Nessuna fonte: aggiungile da Riferimenti › Gestisci fonti.",
              }),
            ]
        dom.removeAttribute("data-gaps")
        dom.replaceChildren(head, ...items)
      }
      const later = () => {
        if (!timer) timer = setTimeout(draw, 250)
      }
      draw()
      store.listeners.add(draw)
      // le citazioni cambiano scrivendo: la bibliografia le segue con calma
      ed.on("update", later)

      return {
        dom,
        update: (next) => {
          if (next.type !== current.type) return false
          current = next
          draw()
          return true
        },
        selectNode: () => dom.classList.add("is-selected"),
        deselectNode: () => dom.classList.remove("is-selected"),
        ignoreMutation: () => true,
        destroy: () => {
          if (timer) clearTimeout(timer)
          store.listeners.delete(draw)
          ed.off("update", later)
        },
      }
    }
  },
})
