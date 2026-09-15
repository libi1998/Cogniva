"use client"

import type { Editor } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"

/**
 * Inserisce testo e basta.
 *
 * `insertContent` con una stringa la interpreta come HTML: incollando da una
 * pagina web o da un file di codice, `<b>` e compagnia tornavano a essere
 * formattazione. Qui ogni riga diventa testo puro.
 */
export function insertPlainText(editor: Editor | null, text: string) {
  if (!editor || editor.isDestroyed || !text) return
  const lines = text.replace(/\r\n?/g, "\n").split("\n")
  const content: JSONContent[] =
    lines.length === 1
      ? [{ type: "text", text: lines[0] }]
      : lines.map((line) =>
          line
            ? { type: "paragraph", content: [{ type: "text", text: line }] }
            : { type: "paragraph" }
        )
  editor.chain().focus().insertContent(content).run()
}
