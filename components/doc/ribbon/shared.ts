"use client"

import type { Editor } from "@tiptap/react"
import type { DocSource, DocTheme, MergeData } from "@/lib/types"
import { SWATCHES, whim } from "@/lib/palette"
import type { DocState } from "../use-doc-state"
import type { FormatPainter } from "../use-format-painter"
import type { Dictation } from "../use-dictation"
import type { CommentsController } from "../comments"
import type { StyleDialogRequest } from "../style-dialog"
import type { InkController } from "../ink-layer"
import type { DocMode } from "../view-modes"

import { tr } from "@/lib/i18n/client"
/** Il riquadro attività nella colonna di destra */
export type TaskPane =
  | { kind: "thesaurus"; word: string; nonce: number }
  | { kind: "versions" }
  | { kind: "addin"; id: string }

export type RibbonCtx = {
  editor: Editor
  st: DocState
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  onFind: (mode: "find" | "replace") => void
  onInsertBoard: (boardId: string) => void
  pickImage: () => void
  outline: boolean
  setOutline: (value: boolean) => void
  zoom: number
  setZoom: (value: number) => void
  fitWidth: () => void
  /** «Una pagina» o, con un numero, «Più pagine» */
  fitPage: (count?: number) => void
  painter: FormatPainter
  dictation: Dictation
  comments: CommentsController
  /** pagine del documento impaginato (1 senza formato di carta) */
  pages: number
  /**
   * apre la scheda dell'oggetto (Formato immagine, Tabella…): gli oggetti
   * appena inseriti si sistemano da lì
   */
  openPanel: () => void
  /** altezza esatta della pagina se il documento è impaginato, altrimenti 0 */
  pageHeight: number
  sources: DocSource[]
  /** «Gestisci fonti»; con `cite` il pulsante inserisce la fonte nel testo */
  openSources: (id?: string | null, cite?: boolean) => void
  /** «Modifica stile» e «Crea stile» */
  openStyleDialog: (request: StyleDialogRequest) => void
  /** il riquadro Stili nella colonna di destra */
  stylesPane: boolean
  setStylesPane: (open: boolean) => void
  /** Thesaurus e componenti aggiuntivi */
  taskPane: TaskPane | null
  openTaskPane: (pane: TaskPane) => void
  closeTaskPane: () => void
  /** penne, gomma e disegni (scheda Disegno) */
  ink: InkController
  /** il file del documento e il suo titolo (buste, confronti, unioni) */
  fileId: string
  /** modalità focus, lettura e lettura immersiva (scheda Visualizza) */
  mode: DocMode
  setMode: (mode: DocMode) => void
  /** visualizzazione Struttura: livello massimo mostrato, 0 = tutti */
  outlineLevel: number
  setOutlineLevel: (level: number) => void
  title: string
  /** stampa unione (scheda Corrispondenza) */
  merge: MergeData | undefined
  setMerge: (merge: MergeData | undefined) => void
}

export const CM = 96 / 2.54
export const PT = 96 / 72

export const TEXT_COLORS = [
  {
    get label() {
      return tr("Automatico")
    },
    value: "",
  },
  ...SWATCHES.filter((s) => s.key !== "white").map((s) => ({
    label: s.label,
    value: s.solid,
  })),
  {
    get label() {
      return tr("Nero")
    },
    value: whim.base[900],
  },
]

export const HIGHLIGHTS = [
  {
    get label() {
      return tr("Nessuno")
    },
    value: "",
  },
  ...SWATCHES.filter((s) => s.key !== "white" && s.key !== "gray").map((s) => ({
    label: s.label,
    value: s.fill,
  })),
]

export const SHADINGS = [
  {
    get label() {
      return tr("Nessuno")
    },
    value: "",
  },
  ...SWATCHES.map((s) => ({ label: s.label, value: s.fill })),
]

export const LINE_HEIGHTS = [
  { label: "1,0", value: "1" },
  { label: "1,15", value: "1.15" },
  { label: "1,5", value: "1.5" },
  { label: "2,0", value: "2" },
  { label: "2,5", value: "2.5" },
  { label: "3,0", value: "3" },
]

export const SYMBOLS =
  "© ® ™ € £ $ ¥ ° ± × ÷ ≠ ≈ ≤ ≥ ∞ √ ∑ ∫ π Ω α β γ δ λ μ σ ½ ¼ ¾ ‰ § ¶ † • … – — « » „ “ ” ‘ ’ ← → ↑ ↓ ↔ ⇒ ⇔ ✓ ✗ ★ ☆ ♥ ♦ ♣ ♠ ☎ ✉ ⌘ ⌥ ⇧".split(
    " "
  )

export const EMOJI = [
  "😀",
  "😂",
  "😊",
  "😍",
  "🤔",
  "😎",
  "🥳",
  "😅",
  "🙏",
  "👍",
  "👎",
  "👏",
  "🙌",
  "💪",
  "👀",
  "🎉",
  "✨",
  "🔥",
  "💡",
  "✅",
  "❌",
  "⚠️",
  "📌",
  "📎",
  "📝",
  "📅",
  "⏰",
  "📈",
  "📉",
  "💰",
  "🚀",
  "🎯",
  "🏆",
  "⭐",
  "❤️",
  "💬",
  "📣",
  "🔒",
  "🔑",
  "🧠",
  "🛠️",
  "⚙️",
  "📦",
  "🌍",
  "☀️",
  "🌙",
  "☕",
  "🍕",
  "⚽",
  "🎵",
]

/**
 * Mette (o toglie) un collegamento sul testo del cursore.
 *
 * L'indirizzo si completa come nel browser («cogniva.app» → «https://…») e
 * vale solo se porta davvero da qualche parte: un «javascript:…» arrivato da
 * un incolla o scritto per prova non diventa un collegamento. Restituisce
 * false quando l'indirizzo non va bene, così chi chiama può dirlo.
 */
export function applyLink(editor: Editor, raw: string) {
  const href = raw.trim()
  if (!href) {
    return editor.chain().focus().extendMarkRange("link").unsetLink().run()
  }
  // senza schema è un sito: «/pagina» e «#segnalibro» restano come sono
  const full = /^[a-z][\w+.-]*:|^\/|^#/i.test(href) ? href : `https://${href}`
  // senza testo selezionato (e fuori da un collegamento) si scrive
  // l'indirizzo, come in Word: prima il collegamento restava «in sospeso» sul
  // cursore e non si vedeva niente
  if (editor.state.selection.empty && !editor.isActive("link")) {
    if (!editor.can().setLink({ href: full })) return false
    const text = full.startsWith("#bm-") ? full.slice(4) : href
    return editor
      .chain()
      .focus()
      .insertContent({
        type: "text",
        text,
        marks: [{ type: "link", attrs: { href: full } }],
      })
      .unsetMark("link")
      .run()
  }
  return editor
    .chain()
    .focus()
    .extendMarkRange("link")
    .setLink({ href: full })
    .run()
}

/**
 * Catena per inserire un blocco (tabella, immagine, grafico): se il cursore è
 * in un titolo, l'inserimento scivola all'inizio del blocco successivo invece
 * di spezzare il titolo a metà.
 */
export function atBody(editor: Editor, st?: DocState) {
  const { $from } = editor.state.selection
  const inTitle = st ? st.inTitle : $from.parent.type.name === "docTitle"
  if (!inTitle || $from.parent.type.name !== "docTitle") {
    return editor.chain().focus()
  }
  const after = $from.after($from.depth)
  // un titolo in fondo al documento: si aggiunge un paragrafo su cui atterrare
  if (after >= editor.state.doc.content.size) {
    return editor
      .chain()
      .insertContentAt(after, { type: "paragraph" })
      .focus(after + 1)
  }
  return editor.chain().focus(after + 1)
}
