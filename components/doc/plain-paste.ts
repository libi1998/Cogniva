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

/** Un'immagine degli appunti inserita come la inserisce ⌘V */
function insertImageBlob(editor: Editor, blob: Blob) {
  const reader = new FileReader()
  reader.onload = () => {
    if (editor.isDestroyed) return
    editor
      .chain()
      .focus()
      .setImage({ src: String(reader.result) })
      .run()
  }
  reader.readAsDataURL(blob)
}

/**
 * «Incolla» dai pulsanti e dai menu, con la formattazione: gli appunti fanno
 * la stessa strada di ⌘V. Prima il menu contestuale incollava solo il testo
 * (come «Incolla senza formattazione»), e il pulsante della scheda Home
 * scavalcava l'incolla dell'editor: una parte di elenco copiata diventava
 * un elenco nuovo e gli elementi copiati da una board arrivavano come testo.
 */
export async function pasteFromClipboard(editor: Editor | null) {
  // un documento in sola lettura non riceve niente, come con ⌘V
  if (!editor || editor.isDestroyed || !editor.isEditable) return
  let html = ""
  let text = ""
  let image: Blob | null = null
  try {
    for (const item of await navigator.clipboard.read()) {
      if (!html && item.types.includes("text/html"))
        html = await (await item.getType("text/html")).text()
      if (!text && item.types.includes("text/plain"))
        text = await (await item.getType("text/plain")).text()
      const type = item.types.find((t) => t.startsWith("image/"))
      if (!image && type) image = await item.getType(type)
    }
  } catch {
    // senza `clipboard.read` (o senza permesso) resta almeno il testo
    try {
      text = await navigator.clipboard.readText()
    } catch {
      // senza permesso di lettura resta la scorciatoia ⌘V
      editor.commands.focus()
      return
    }
  }
  if (editor.isDestroyed) return
  editor.view.focus()
  if (!html && !text) {
    if (image) insertImageBlob(editor, image)
    return
  }
  // l'evento porta gli appunti veri: così l'editor riconosce gli elementi di
  // una board e le immagini come quando si preme ⌘V
  let event: ClipboardEvent
  try {
    const data = new DataTransfer()
    if (text) data.setData("text/plain", text)
    if (html) data.setData("text/html", html)
    if (image) data.items.add(new File([image], "image", { type: image.type }))
    event = new ClipboardEvent("paste", { clipboardData: data })
  } catch {
    event = new ClipboardEvent("paste")
  }
  if (html) editor.view.pasteHTML(html, event)
  else editor.view.pasteText(text, event)
}
