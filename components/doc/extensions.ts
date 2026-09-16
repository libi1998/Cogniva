"use client"

import type { AnyExtension } from "@tiptap/core"
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
      placeholder: ({ editor, node, hasAnchor }) => {
        if (node.type.name === "docTitle") return tr("Senza titolo")
        if (node.type.name === "heading") return hasAnchor ? tr("Titolo…") : ""
        // il corpo suggerisce solo dove si sta scrivendo o se è tutto vuoto
        return hasAnchor || editor.state.doc.childCount <= 2
          ? tr("Scrivi, oppure incolla degli elementi da una board…")
          : ""
      },
    }),
  ]
}
