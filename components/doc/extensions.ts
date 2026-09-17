"use client"

import { getSchema, type AnyExtension, type JSONContent } from "@tiptap/core"
import type { Schema } from "@tiptap/pm/model"
import { StarterKit } from "@tiptap/starter-kit"
import { CharacterCount, Placeholder } from "@tiptap/extensions"
import { TaskItem, TaskList } from "@tiptap/extension-list"
import { Highlight } from "@tiptap/extension-highlight"
import { TextAlign } from "@tiptap/extension-text-align"
import { Color, FontFamily, TextStyle } from "@tiptap/extension-text-style"
import { Subscript } from "@tiptap/extension-subscript"
import { Superscript } from "@tiptap/extension-superscript"
import { TableRow } from "@tiptap/extension-table"
import { FindReplace } from "@/lib/find-replace"
import { ReadAloudHighlight } from "@/lib/read-aloud/highlight"
import { Pagination } from "@/lib/pagination"
import { ListStyles, SortBlocks, TextEffects } from "@/lib/doc-typography"
import { Bookmark, CoverPart, DropCap, Field, TextBox } from "@/lib/doc-fields"
import {
  BlockStyle,
  CellStyle,
  ColumnBreak,
  CommentMark,
  DocTitle,
  DocumentWithTitle,
  FontSize,
  Indent,
  LetterSpacing,
  LineHeight,
  MoveBlock,
  PageBreak,
  ParagraphStyle,
  Spacing,
  StyledTable,
  StyledTableCell,
  StyledTableHeader,
  StyledTableView,
  TextCase,
} from "@/lib/tiptap-extensions"
import { BoardEmbed } from "./board-embed"
import { DocChart } from "./chart-node"
import { Bibliography, Citation } from "./citation-node"
import { DocFootnote } from "./footnote-node"
import { DocImage } from "./image-node"
import { MathBlock, MathInline } from "./math-node"
import { DocFigureIndex, DocIndexNode, DocToc } from "./toc-node"
import { IndexEntry } from "@/lib/doc-references"
import { MergeField, MergeIf } from "@/lib/doc-merge"
import { TrackChanges } from "@/lib/track-changes"
import { DocVideo } from "./video-node"
import { Model3D } from "./model3d-node"

import { tr } from "@/lib/i18n/client"
/**
 * Tutte le estensioni del documento. Le usano l'editor e, senza editor, le
 * importazioni (Word, Markdown) e le esportazioni: lo schema è uno solo.
 */
export function createDocExtensions(): AnyExtension[] {
  return [
    // Tiptap 3: collegamenti e sottolineato fanno parte dello starter kit; il
    // documento ha il titolo come primo nodo, quindi la radice è sostituita
    StarterKit.configure({
      document: false,
      heading: { levels: [1, 2, 3] },
      link: { openOnClick: false, autolink: true },
    }),
    DocumentWithTitle,
    DocTitle,
    Highlight.configure({ multicolor: true }),
    TextAlign.configure({
      types: ["docTitle", "heading", "paragraph"],
      alignments: ["left", "center", "right", "justify"],
    }),
    TextStyle,
    Color,
    FontFamily,
    FontSize,
    LetterSpacing,
    TextEffects,
    LineHeight,
    Spacing,
    Indent,
    ParagraphStyle,
    BlockStyle,
    Subscript,
    Superscript,
    TaskList,
    TaskItem.configure({
      nested: true,
      // l'etichetta che leggono i lettori di schermo, nella lingua dell'app
      a11y: {
        checkboxLabel: (node) =>
          node.textContent
            ? tr("Casella di {task}", { task: node.textContent })
            : tr("Casella da spuntare, vuota"),
      },
    }),
    ListStyles,
    SortBlocks,
    Field,
    Bookmark,
    TextBox,
    DropCap,
    CoverPart,
    StyledTable.configure({
      resizable: true,
      allowTableNodeSelection: true,
      View: StyledTableView,
    }),
    TableRow,
    StyledTableHeader,
    StyledTableCell,
    CellStyle,
    DocImage.configure({ allowBase64: true, inline: false }),
    CharacterCount,
    BoardEmbed,
    PageBreak,
    ColumnBreak,
    MoveBlock,
    DocToc,
    DocFigureIndex,
    DocIndexNode,
    IndexEntry,
    MergeField,
    MergeIf,
    TrackChanges,
    DocFootnote,
    TextCase,
    FindReplace,
    ReadAloudHighlight,
    Pagination,
    CommentMark,
    MathInline,
    MathBlock,
    DocVideo,
    Model3D,
    Citation,
    Bibliography,
    DocChart,
    Placeholder.configure({
      showOnlyCurrent: false,
      // un documento nuovo è una pagina bianca: nessun suggerimento nel
      // titolo né nel corpo, solo sul titolo di sezione dove si sta scrivendo
      placeholder: ({ node, hasAnchor }) =>
        node.type.name === "heading" && hasAnchor ? tr("Titolo…") : "",
    }),
  ]
}

let schema: Schema | null = null

/** Lo schema del documento, uno solo per pagina: costruirlo non è gratis */
export function docSchema(): Schema {
  schema ??= getSchema(createDocExtensions())
  return schema
}

/**
 * Ripara il contenuto di un documento salvato.
 *
 * Un file può venire da una versione futura dell'app o da uno spazio di
 * lavoro scritto a mano: basta un nodo che lo schema non conosce perché
 * Tiptap consideri illeggibile tutto il documento e apra una pagina bianca —
 * e la prima battuta scriverebbe quella pagina bianca sopra al testo vero.
 * Qui i nodi sconosciuti si buttano tenendo quello che contengono, e i
 * blocchi che restano illeggibili cadono uno a uno invece di portarsi via
 * anche gli altri.
 */
export function repairDocContent(content: unknown): unknown {
  if (!content || typeof content !== "object") return content
  const doc = content as JSONContent
  if (!Array.isArray(doc.content)) return content
  const s = docSchema()
  // il caso normale è un documento sano: si evita di ricopiarlo tutto
  let touched = false
  const known = (node: JSONContent): JSONContent[] => {
    const children = Array.isArray(node.content)
      ? node.content.flatMap(known)
      : undefined
    if (node.type && !s.nodes[node.type]) {
      touched = true
      if (!children?.length) return []
      // il testo che c'era dentro non si butta: diventa un paragrafo
      const inline = children.every(
        (c) => !c.type || s.nodes[c.type]?.isInline !== false
      )
      return inline ? [{ type: "paragraph", content: children }] : children
    }
    const marks = Array.isArray(node.marks)
      ? node.marks.filter((m) => m.type && s.marks[m.type])
      : undefined
    if (marks && marks.length !== node.marks?.length) touched = true
    if (!touched) return [node]
    return [
      {
        ...node,
        ...(children ? { content: children } : {}),
        ...(marks ? { marks } : {}),
      },
    ]
  }
  const blocks = doc.content.flatMap(known)
  // un documento sano (titolo in cima, nessun nodo sconosciuto) non si tocca:
  // niente copie e niente controlli a ogni apertura
  if (!touched && blocks[0]?.type === "docTitle") return content
  const readable = (nodes: JSONContent[]) => {
    try {
      s.nodeFromJSON({ ...doc, content: nodes }).check()
      return true
    } catch {
      return false
    }
  }
  if (readable(blocks)) return { ...doc, content: blocks }
  // il documento comincia dal titolo: se se n'è andato, si rimette vuoto (lo
  // riempie il nome del file) invece di buttare tutto il resto
  const titled: JSONContent[] =
    blocks[0]?.type === "docTitle" ? blocks : [{ type: "docTitle" }, ...blocks]
  if (titled !== blocks && readable(titled)) return { ...doc, content: titled }
  // un blocco alla volta: si tiene tutto quello che si riesce a leggere
  const kept: JSONContent[] = titled === blocks ? [] : [titled[0]]
  for (const block of blocks) {
    if (readable([...kept, block])) kept.push(block)
    else console.warn("Blocco del documento illeggibile, ignorato", block.type)
  }
  // se non se n'è salvato nessuno meglio lasciar decidere a Tiptap: questa
  // funzione può solo migliorare le cose, non peggiorarle
  return kept.some((b) => b.type !== "docTitle")
    ? { ...doc, content: kept }
    : content
}
