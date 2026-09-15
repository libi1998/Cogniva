"use client"

import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  useEditorState,
  type Editor,
  type NodeViewProps,
} from "@tiptap/react"
import {
  Footnote,
  footnoteKey,
  footnoteNumber,
  noteKind,
  noteLabel,
  type NoteKind,
} from "@/lib/tiptap-extensions"
import { cn } from "@/lib/utils"

function FootnoteView({ editor, getPos, selected, node }: NodeViewProps) {
  const number =
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        const pos = typeof getPos === "function" ? getPos() : null
        return typeof pos === "number" ? footnoteNumber(e.state, pos) : 0
      },
    }) ?? 0
  const kind = noteKind(node)

  return (
    <NodeViewWrapper
      as="sup"
      className={cn("doc-fn", selected && "is-selected")}
      data-kind={kind}
      title={String(node.attrs.text || "Nota vuota")}
      contentEditable={false}
    >
      {number ? noteLabel(kind, number) : "*"}
    </NodeViewWrapper>
  )
}

/** Nota a piè di pagina o di chiusura, con il suo numero */
export const DocFootnote = Footnote.extend({
  addNodeView() {
    return ReactNodeViewRenderer(FootnoteView, { as: "span" })
  },
})

type Note = { pos: number; text: string; kind: NoteKind; label: string }

/** Tutte le note del documento in ordine, con la loro etichetta */
export function useNotes(editor: Editor | null): Note[] {
  return (
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        if (!e) return [] as Note[]
        const counters = { footnote: 0, endnote: 0 }
        // le posizioni arrivano dal plugin: niente scansione del documento
        return (footnoteKey.getState(e.state) ?? []).map((pos) => {
          const node = e.state.doc.nodeAt(pos)
          const kind = noteKind(node)
          counters[kind]++
          return {
            pos,
            kind,
            text: String(node?.attrs.text ?? ""),
            label: noteLabel(kind, counters[kind]),
          }
        })
      },
    }) ?? []
  )
}
