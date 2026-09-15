import type { Editor } from "@tiptap/core"

/**
 * La parola su cui lavorare: la selezione, se è breve e sta in un paragrafo,
 * altrimenti la parola sotto il cursore (anche con il cursore subito dopo).
 */
export function wordAtSelection(editor: Editor) {
  const { state } = editor
  const { from, to, empty, $from } = state.selection
  if (!empty) {
    const text = state.doc.textBetween(from, to, " ").trim()
    if (text && text.length <= 80 && $from.sameParent(state.doc.resolve(to))) {
      return { text, from, to }
    }
    return null
  }
  const parent = $from.parent
  if (!parent.isTextblock) return null
  const start = $from.start()
  let text = ""
  const map: number[] = []
  parent.forEach((child, offset) => {
    if (!child.isText) {
      text += " "
      map.push(start + offset)
      return
    }
    for (let i = 0; i < child.text!.length; i += 1) {
      text += child.text![i]
      map.push(start + offset + i)
    }
  })
  const at = $from.pos - start
  const isWord = (ch: string | undefined) =>
    Boolean(ch && /[\p{L}\p{N}'’-]/u.test(ch))
  let a = at
  let b = at
  while (a > 0 && isWord(text[a - 1])) a -= 1
  while (b < text.length && isWord(text[b])) b += 1
  // niente apostrofi o trattini ai bordi: «l'acqua» → «acqua» se il cursore è lì
  while (a < b && /['’-]/.test(text[a]!)) a += 1
  while (b > a && /['’-]/.test(text[b - 1]!)) b -= 1
  if (a === b) return null
  return { text: text.slice(a, b), from: map[a]!, to: map[b - 1]! + 1 }
}
