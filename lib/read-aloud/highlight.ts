import { Extension, type Editor } from "@tiptap/core"
import { Plugin, PluginKey } from "@tiptap/pm/state"
import { Decoration, DecorationSet } from "@tiptap/pm/view"

/**
 * Durante la lettura ad alta voce la frase e la parola lette si evidenziano
 * con decorazioni: la selezione di chi scrive resta dov'è e niente finisce
 * nella cronologia o nelle revisioni.
 */

export type Range = { from: number; to: number }
type Highlight = { sentence: Range | null; word: Range | null }

const key = new PluginKey<DecorationSet>("readAloudHighlight")

function decorations(
  doc: Parameters<typeof DecorationSet.create>[0],
  h: Highlight
) {
  const size = doc.content.size
  const valid = (r: Range | null): r is Range =>
    Boolean(r && r.from >= 0 && r.to <= size && r.to > r.from)
  const list: Decoration[] = []
  if (valid(h.sentence)) {
    list.push(
      Decoration.inline(h.sentence.from, h.sentence.to, {
        class: "read-aloud-sentence",
      })
    )
  }
  if (valid(h.word)) {
    list.push(
      Decoration.inline(h.word.from, h.word.to, { class: "read-aloud-word" })
    )
  }
  return list.length ? DecorationSet.create(doc, list) : DecorationSet.empty
}

export const ReadAloudHighlight = Extension.create({
  name: "readAloudHighlight",
  addProseMirrorPlugins() {
    return [
      new Plugin<DecorationSet>({
        key,
        state: {
          init: () => DecorationSet.empty,
          apply(tr, set) {
            const meta = tr.getMeta(key) as Highlight | undefined
            if (meta) return decorations(tr.doc, meta)
            return tr.docChanged ? set.map(tr.mapping, tr.doc) : set
          },
        },
        props: { decorations: (state) => key.getState(state) },
      }),
    ]
  },
})

/** Porta la parola letta in vista solo se è uscita dallo schermo */
function reveal(editor: Editor, pos: number) {
  try {
    const coords = editor.view.coordsAtPos(pos)
    const margin = 96
    if (coords.top >= margin && coords.bottom <= window.innerHeight - margin)
      return
    const { node } = editor.view.domAtPos(pos)
    const el = node instanceof Element ? node : node.parentElement
    el?.scrollIntoView({ block: "center", behavior: "smooth" })
  } catch {
    // posizione non più valida: la prossima parola rimette a posto
  }
}

let last = ""

export function setReadAloudHighlight(
  editor: Editor | null,
  highlight: Highlight | null
) {
  if (!editor || editor.isDestroyed) return
  const value = highlight ?? { sentence: null, word: null }
  const signature = JSON.stringify(value)
  if (signature === last) return
  last = signature
  editor.view.dispatch(
    editor.state.tr.setMeta(key, value).setMeta("addToHistory", false)
  )
  if (value.word) reveal(editor, value.word.from)
  else if (value.sentence) reveal(editor, value.sentence.from)
}
