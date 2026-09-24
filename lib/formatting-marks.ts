import { Extension } from "@tiptap/core"
import type { Node as PMNode } from "@tiptap/pm/model"
import { Plugin, PluginKey, type Transaction } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

import { tr as translate } from "@/lib/i18n/client"

/**
 * Segni di formattazione, come «Mostra tutto ¶» di Word: un puntino per ogni
 * spazio, ° per lo spazio unificatore, → per la tabulazione, ↵ per l'a capo,
 * ¶ alla fine di ogni paragrafo e ¤ alla fine di ogni cella.
 *
 * Sono decorazioni, non testo: non finiscono nel file né negli appunti. Non
 * occupano spazio (stanno fuori dal flusso), così il testo non va a capo in un
 * altro punto quando si accendono. Le etichette dei salti di pagina e di
 * colonna ci sono sempre, nella lingua dell'app: prima erano scritte in
 * italiano nel foglio di stile.
 */

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    formattingMarks: {
      setFormattingMarks: (visible: boolean) => ReturnType
    }
  }
}

type MarksState = { visible: boolean; deco: DecorationSet }

export const formattingMarksKey = new PluginKey<MarksState>("formattingMarks")

const CELLS = new Set(["tableCell", "tableHeader"])

// niente «doc-mark» qui: quella classe nasconde, e nasconderebbe lo spazio
const SPACE_CLASS: Record<string, string> = {
  " ": "doc-mark-space",
  "\u00a0": "doc-mark-nbsp",
  "\t": "doc-mark-tab",
}

function glyph(text: string, className: string) {
  return () => {
    const el = document.createElement("span")
    el.className = className
    el.textContent = text
    el.contentEditable = "false"
    el.setAttribute("aria-hidden", "true")
    return el
  }
}

/** I segni di un blocco di testo, che comincia a `pos` */
function blockMarks(node: PMNode, pos: number, parent: PMNode | null) {
  const out: Decoration[] = []
  node.forEach((child, offset) => {
    const at = pos + 1 + offset
    if (child.isText) {
      const text = child.text ?? ""
      for (let i = 0; i < text.length; i += 1) {
        const cls = SPACE_CLASS[text[i]]
        if (cls) out.push(Decoration.inline(at + i, at + i + 1, { class: cls }))
      }
    } else if (child.type.name === "hardBreak") {
      out.push(
        Decoration.widget(at, glyph("↵", "doc-mark doc-mark-break"), {
          side: -1,
          key: "mark-br",
        })
      )
    }
  })
  // in una cella l'ultimo paragrafo chiude la cella: ¤ come in Word
  const endOfCell =
    parent !== null && CELLS.has(parent.type.name) && parent.lastChild === node
  out.push(
    Decoration.widget(
      pos + node.nodeSize - 1,
      glyph(
        endOfCell ? "¤" : "¶",
        "doc-mark doc-mark-pilcrow" + (endOfCell ? " doc-mark-cell" : "")
      ),
      { side: 1, key: endOfCell ? "mark-cell" : "mark-p" }
    )
  )
  return out
}

/** Le etichette dei salti: ci sono anche a segni spenti */
function breakLabel(node: PMNode, pos: number) {
  const label =
    node.type.name === "pageBreak"
      ? translate("Interruzione di pagina")
      : translate("Interruzione di colonna")
  return Decoration.node(pos, pos + node.nodeSize, { "data-label": label })
}

function collect(doc: PMNode, from: number, to: number, visible: boolean) {
  const out: Decoration[] = []
  doc.nodesBetween(from, to, (node, pos, parent) => {
    const name = node.type.name
    if (name === "pageBreak" || name === "columnBreak") {
      out.push(breakLabel(node, pos))
      return false
    }
    if (node.isTextblock) {
      if (visible) out.push(...blockMarks(node, pos, parent))
      return false
    }
    return true
  })
  return out
}

function build(doc: PMNode, visible: boolean) {
  return DecorationSet.create(doc, collect(doc, 0, doc.content.size, visible))
}

/**
 * Dopo una modifica si rifanno solo i blocchi toccati: in un documento lungo
 * i segni sono migliaia, e ricalcolarli tutti a ogni lettera rallenterebbe
 * la scrittura.
 */
function update(state: MarksState, tr: Transaction, doc: PMNode) {
  let deco = state.deco.map(tr.mapping, doc)
  let from = Infinity
  let to = -Infinity
  tr.mapping.maps.forEach((map, i) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      // posizioni nel documento finale
      const rest = tr.mapping.slice(i + 1)
      from = Math.min(from, rest.map(newStart, -1))
      to = Math.max(to, rest.map(newEnd, 1))
    })
  })
  if (from > to) return deco
  // si allarga ai blocchi interi che contengono i punti modificati
  const size = doc.content.size
  const $from = doc.resolve(Math.max(0, Math.min(size, from)))
  const $to = doc.resolve(Math.max(0, Math.min(size, to)))
  const start = $from.depth ? $from.before(1) : $from.pos
  const end = $to.depth ? $to.after(1) : $to.pos
  // solo i segni dentro ai blocchi rifatti: quello di un salto che comincia
  // proprio a `end` appartiene al blocco dopo e resta
  deco = deco.remove(
    deco.find(start, end).filter((d) => d.from >= start && d.to <= end)
  )
  return deco.add(doc, collect(doc, start, end, state.visible))
}

export const FormattingMarks = Extension.create({
  name: "formattingMarks",
  addCommands() {
    return {
      setFormattingMarks:
        (visible) =>
        ({ tr, dispatch }) => {
          if (dispatch) tr.setMeta(formattingMarksKey, { visible })
          return true
        },
    }
  },
  addProseMirrorPlugins() {
    return [
      new Plugin<MarksState>({
        key: formattingMarksKey,
        state: {
          init: (_config, state) => ({
            visible: false,
            deco: build(state.doc, false),
          }),
          apply(tr, value, _old, next) {
            const meta = tr.getMeta(formattingMarksKey) as
              { visible: boolean } | undefined
            if (meta && meta.visible !== value.visible) {
              return {
                visible: meta.visible,
                deco: build(next.doc, meta.visible),
              }
            }
            if (!tr.docChanged) return value
            return { ...value, deco: update(value, tr, next.doc) }
          },
        },
        props: {
          decorations: (state) => formattingMarksKey.getState(state)?.deco,
        },
      }),
    ]
  },
})
