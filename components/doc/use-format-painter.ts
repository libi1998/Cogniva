"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import type { Mark as PMMark } from "@tiptap/pm/model"
import { isFormatMark, unsetFormatMarks } from "./style-actions"

export type FormatPainter = {
  armed: boolean
  copy: () => void
  cancel: () => void
}

/**
 * Copia formato, come il pennello di Word: si prendono i marchi dal punto in
 * cui è il cursore e si applicano alla prima selezione fatta dopo. Il pennello
 * si spegne da solo quando ha finito, o con Esc.
 */
export function useFormatPainter(editor: Editor | null): FormatPainter {
  const [armed, setArmed] = React.useState(false)
  const marks = React.useRef<readonly PMMark[]>([])

  const cancel = React.useCallback(() => setArmed(false), [])

  const copy = React.useCallback(() => {
    if (!editor || editor.isDestroyed) return
    const { state } = editor
    const { empty, from, $from } = state.selection
    // a cursore fermo valgono i marchi del punto, altrimenti quelli del primo
    // carattere selezionato
    marks.current = (
      empty
        ? $from.marks()
        : state.doc.resolve(Math.min(from + 1, state.doc.content.size)).marks()
    )
      // commenti, revisioni e collegamenti non sono formattazione: restano
      // dove sono, sia da dove si copia sia dove si dipinge
      .filter((m) => isFormatMark(m.type.name))
    setArmed(true)
  }, [editor])

  React.useEffect(() => {
    if (!editor || editor.isDestroyed || !armed) return
    const dom = editor.view.dom as HTMLElement
    dom.classList.add("doc-painting")

    const apply = () => {
      const { from, to } = editor.state.selection
      if (from === to) return
      const chain = unsetFormatMarks(editor)
      marks.current.forEach((m) => chain.setMark(m.type.name, m.attrs))
      chain.run()
      setArmed(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setArmed(false)
    }

    dom.addEventListener("mouseup", apply)
    window.addEventListener("keydown", onKey)
    return () => {
      dom.classList.remove("doc-painting")
      dom.removeEventListener("mouseup", apply)
      window.removeEventListener("keydown", onKey)
    }
  }, [editor, armed])

  return { armed, copy, cancel }
}
