import type { JSONContent } from "@tiptap/core"
import type { Editor } from "@tiptap/react"
import { atBody } from "../ribbon/shared"

/**
 * Quello che un componente aggiuntivo può fare con il documento: poco e
 * dichiarato. Tutto passa dall'editor, quindi annulla, revisioni e
 * salvataggio funzionano come per ogni altra modifica.
 */
export type AddinApi = {
  editor: Editor
  language: string
  accent: string
  selectionText: () => string
  insertImage: (src: string, alt: string, width?: string) => void
  insertContent: (content: JSONContent | JSONContent[]) => void
}

export function createAddinApi(
  editor: Editor,
  language: string,
  accent: string
): AddinApi {
  return {
    editor,
    language,
    accent,
    selectionText: () => {
      const { from, to } = editor.state.selection
      return editor.state.doc.textBetween(from, to, "\n").trim()
    },
    insertImage: (src, alt, width = "40%") => {
      atBody(editor)
        .insertContent({ type: "image", attrs: { src, alt, width } })
        .run()
    },
    insertContent: (content) => {
      atBody(editor).insertContent(content).run()
    },
  }
}

/** Un paragrafo con testo e, se servono, collegamenti */
export function paragraph(
  parts: (string | { text: string; href?: string; italic?: boolean })[]
): JSONContent {
  return {
    type: "paragraph",
    content: parts
      .map((part) => (typeof part === "string" ? { text: part } : part))
      .filter((part) => part.text)
      .map((part) => {
        const marks: NonNullable<JSONContent["marks"]> = []
        if ("href" in part && part.href && /^https:\/\//.test(part.href)) {
          marks.push({ type: "link", attrs: { href: part.href } })
        }
        if ("italic" in part && part.italic) marks.push({ type: "italic" })
        return {
          type: "text",
          text: part.text,
          ...(marks.length ? { marks } : {}),
        }
      }),
  }
}
