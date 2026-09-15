"use client"

import * as React from "react"
import { useEditorState } from "@tiptap/react"
import type { Editor } from "@tiptap/react"
import { styleIdOfNode } from "@/lib/doc-styles"

/**
 * Fotografia dello stato dell'editor.
 *
 * Serve perché con il React Compiler attivo l'istanza dell'editor non cambia
 * mai identità: leggere `editor.isActive(...)` direttamente dentro il JSX
 * lascerebbe barra e pannello congelati sul primo render. `useEditorState`
 * restituisce invece un oggetto nuovo a ogni cambio reale, e quello sì che
 * fa ridisegnare i componenti.
 */
export type DocState = {
  canUndo: boolean
  canRedo: boolean

  bold: boolean
  italic: boolean
  underline: boolean
  strike: boolean
  code: boolean
  link: boolean
  highlight: boolean
  highlightColor: string
  superscript: boolean
  subscript: boolean
  /** il cursore è su una revisione (inserimento o eliminazione) */
  onChange: boolean

  inTitle: boolean
  /** lo stile del blocco del cursore (vedi lib/doc-styles.ts) */
  styleId: string
  heading1: boolean
  heading2: boolean
  heading3: boolean
  blockquote: boolean
  codeBlock: boolean

  bulletList: boolean
  orderedList: boolean
  taskList: boolean

  align: "left" | "center" | "right" | "justify"

  fontFamily: string
  fontSize: string
  color: string
  letterSpacing: number
  /** effetti del testo (lib/doc-typography.ts) */
  textShadow: string
  textStroke: string
  textFill: string
  decoration: string
  smallCaps: boolean
  numeric: string
  ligatures: string
  stylistic: string

  /** stile dell'elenco del cursore e livelli dell'elenco più esterno */
  listStyle: string
  listLevels: string
  listStart: number

  blockType: "docTitle" | "paragraph" | "heading" | "blockquote"
  lineHeight: string
  spaceBefore: number
  spaceAfter: number
  /** spazi dati a mano al paragrafo (anche zero), invece di quelli dello stile */
  spaceBeforeSet: boolean
  spaceAfterSet: boolean
  firstLine: number
  indentLeft: number
  indentRight: number
  shading: string
  paragraphBorder: string

  inTable: boolean
  canMerge: boolean
  canSplit: boolean
  cellBackground: string
  cellVAlign: string
  tableBorderWidth: number
  tableBorderColor: string
  tableBorderStyle: string
  tableBanded: boolean

  onImage: boolean
  imageWidth: number
  imageWrap: string
  imageSide: string
  imageAlign: string
  imageX: number | null
  imageY: number | null
  imageDx: number
  imageDy: number
  imageRotate: number
  imageBorderWidth: number
  imageBorderColor: string
  imageShadow: boolean
  imageAlt: string

  onEmbed: boolean
  embedHeight: number
  embedCaption: string
  embedBoardId: string | null

  onChart: boolean
  chartSpec: string
  chartWidth: number
  chartHeight: number
  chartAlign: string

  onCitation: boolean
  citationSourceId: string | null
  citationPages: string
  onBibliography: boolean
  bibliographyTitle: string

  onVideo: boolean
  videoSrc: string
  videoWidth: number
  videoAlign: string

  onModel3d: boolean
  model3dShape: string
  model3dColor: string
  model3dName: string
  model3dAlt: string
  model3dWidth: number
  model3dHeight: number
  model3dAlign: string
  model3dYaw: number
  model3dPitch: number
  model3dZoom: number
  model3dAutoRotate: boolean
  model3dBackground: string

  onMath: boolean
  mathLatex: string
  mathDisplay: boolean

  onFootnote: boolean
  footnoteText: string
  footnoteKind: "footnote" | "endnote"
}

const EMPTY: DocState = {
  canUndo: false,
  canRedo: false,
  bold: false,
  italic: false,
  underline: false,
  strike: false,
  code: false,
  link: false,
  highlight: false,
  highlightColor: "",
  superscript: false,
  subscript: false,
  onChange: false,
  inTitle: false,
  styleId: "normal",
  heading1: false,
  heading2: false,
  heading3: false,
  blockquote: false,
  codeBlock: false,
  bulletList: false,
  orderedList: false,
  taskList: false,
  align: "left",
  fontFamily: "",
  fontSize: "",
  color: "",
  letterSpacing: 0,
  textShadow: "",
  textStroke: "",
  textFill: "",
  decoration: "",
  smallCaps: false,
  numeric: "",
  ligatures: "",
  stylistic: "",
  listStyle: "",
  listLevels: "",
  listStart: 1,
  blockType: "paragraph",
  lineHeight: "",
  spaceBefore: 0,
  spaceAfter: 0,
  spaceBeforeSet: false,
  spaceAfterSet: false,
  firstLine: 0,
  indentLeft: 0,
  indentRight: 0,
  shading: "",
  paragraphBorder: "none",
  inTable: false,
  canMerge: false,
  canSplit: false,
  cellBackground: "",
  cellVAlign: "top",
  tableBorderWidth: 1,
  tableBorderColor: "",
  tableBorderStyle: "solid",
  tableBanded: false,
  onImage: false,
  imageWidth: 100,
  imageWrap: "inline",
  imageSide: "left",
  imageAlign: "left",
  imageX: null,
  imageY: null,
  imageDx: 0,
  imageDy: 0,
  imageRotate: 0,
  imageBorderWidth: 0,
  imageBorderColor: "",
  imageShadow: false,
  imageAlt: "",
  onEmbed: false,
  embedHeight: 320,
  embedCaption: "",
  embedBoardId: null,
  onChart: false,
  chartSpec: "",
  chartWidth: 100,
  chartHeight: 320,
  chartAlign: "center",
  onCitation: false,
  citationSourceId: null,
  citationPages: "",
  onBibliography: false,
  bibliographyTitle: "",
  onVideo: false,
  videoSrc: "",
  videoWidth: 100,
  videoAlign: "center",
  onModel3d: false,
  model3dShape: "",
  model3dColor: "",
  model3dName: "",
  model3dAlt: "",
  model3dWidth: 60,
  model3dHeight: 320,
  model3dAlign: "center",
  model3dYaw: 0,
  model3dPitch: 0,
  model3dZoom: 1,
  model3dAutoRotate: false,
  model3dBackground: "",
  onMath: false,
  mathLatex: "",
  mathDisplay: false,
  onFootnote: false,
  footnoteText: "",
  footnoteKind: "footnote",
}

const px = (v: unknown) => parseFloat(String(v ?? "0")) || 0
const num = (v: unknown) =>
  v === null || v === undefined || v === "" ? null : Number(v)
const EMPTY_ATTRS: Record<string, unknown> = {}

/**
 * Parole e caratteri. Contarli vuol dire rileggere tutto il testo, quindi si
 * aggiornano quando si smette di scrivere per un attimo invece che a ogni
 * tasto: su un documento lungo era il lavoro più caro di ogni battuta.
 */
export function useDocCounts(editor: Editor | null) {
  const [counts, setCounts] = React.useState({ words: 0, characters: 0 })

  React.useEffect(() => {
    if (!editor) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const count = () => {
      timer = null
      if (editor.isDestroyed) return
      const counter = editor.storage.characterCount as
        { words?: () => number; characters?: () => number } | undefined
      const next = {
        words: counter?.words?.() ?? 0,
        characters: counter?.characters?.() ?? 0,
      }
      setCounts((prev) =>
        prev.words === next.words && prev.characters === next.characters
          ? prev
          : next
      )
    }
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(count, 250)
    }
    timer = setTimeout(count, 0)
    editor.on("update", schedule)
    return () => {
      if (timer) clearTimeout(timer)
      editor.off("update", schedule)
    }
  }, [editor])

  return counts
}

export function useDocState(editor: Editor | null): DocState {
  return (
    useEditorState({
      editor,
      selector: ({ editor: e }) => {
        if (!e) return EMPTY
        const style = e.getAttributes("textStyle")
        const inTitle = e.isActive("docTitle")
        const blockType = inTitle
          ? "docTitle"
          : e.isActive("heading")
            ? "heading"
            : e.isActive("blockquote")
              ? "blockquote"
              : "paragraph"
        const block = e.getAttributes(blockType)
        // gli attributi si leggono solo quando servono: sono la parte cara
        // di questa fotografia, e vale a ogni battuta
        const inTable = e.isActive("table")
        const onImage = e.isActive("image")
        const onEmbed = e.isActive("boardEmbed")
        const onFootnote = e.isActive("footnote")
        const mathDisplay = e.isActive("mathBlock")
        const onVideo = e.isActive("video")
        const onChart = e.isActive("chart")
        const chart = onChart ? e.getAttributes("chart") : EMPTY_ATTRS
        const onCitation = e.isActive("citation")
        const citation = onCitation ? e.getAttributes("citation") : EMPTY_ATTRS
        const onBibliography = e.isActive("bibliography")
        const video = onVideo ? e.getAttributes("video") : EMPTY_ATTRS
        const onModel3d = e.isActive("model3d")
        const model3d = onModel3d ? e.getAttributes("model3d") : EMPTY_ATTRS
        const onMath = mathDisplay || e.isActive("mathInline")
        const image = onImage ? e.getAttributes("image") : EMPTY_ATTRS
        const embed = onEmbed ? e.getAttributes("boardEmbed") : EMPTY_ATTRS
        const table = inTable ? e.getAttributes("table") : EMPTY_ATTRS
        const cell = inTable
          ? e.isActive("tableHeader")
            ? e.getAttributes("tableHeader")
            : e.getAttributes("tableCell")
          : EMPTY_ATTRS
        const highlight = e.isActive("highlight")
        // lo stile: quello della citazione per i suoi paragrafi, altrimenti
        // quello del blocco di testo del cursore
        const $from = e.state.selection.$from
        let styleId = "normal"
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth)
          if (node.type.name === "blockquote" || node.isTextblock) {
            styleId = styleIdOfNode(node)
            if (node.type.name === "blockquote") break
          }
        }
        // l'elenco del cursore e quello più esterno (i livelli)
        let listStyle = ""
        let listLevels = ""
        let listStart = 1
        let innerList = false
        for (let depth = $from.depth; depth > 0; depth -= 1) {
          const node = $from.node(depth)
          const name = node.type.name
          if (name !== "bulletList" && name !== "orderedList") continue
          if (!innerList) {
            innerList = true
            listStyle = String(node.attrs.listStyle ?? "")
            listStart = Number(node.attrs.start ?? 1)
          }
          listLevels = String(node.attrs.levels ?? "")
        }

        return {
          canUndo: e.can().undo(),
          canRedo: e.can().redo(),

          bold: e.isActive("bold"),
          italic: e.isActive("italic"),
          underline: e.isActive("underline"),
          strike: e.isActive("strike"),
          code: e.isActive("code"),
          link: e.isActive("link"),
          highlight,
          highlightColor: highlight
            ? String(e.getAttributes("highlight").color ?? "")
            : "",
          superscript: e.isActive("superscript"),
          subscript: e.isActive("subscript"),
          onChange: e.isActive("insertion") || e.isActive("deletion"),

          inTitle,
          styleId,
          heading1: e.isActive("heading", { level: 1 }),
          heading2: e.isActive("heading", { level: 2 }),
          heading3: e.isActive("heading", { level: 3 }),
          blockquote: e.isActive("blockquote"),
          codeBlock: e.isActive("codeBlock"),

          bulletList: e.isActive("bulletList"),
          orderedList: e.isActive("orderedList"),
          taskList: e.isActive("taskList"),

          align: (["center", "right", "justify"].find((a) =>
            e.isActive({ textAlign: a })
          ) ?? "left") as DocState["align"],

          fontFamily: String(style.fontFamily ?? ""),
          fontSize: String(style.fontSize ?? ""),
          color: String(style.color ?? ""),
          letterSpacing: px(style.letterSpacing),
          textShadow: String(style.textShadow ?? ""),
          textStroke: String(style.textStroke ?? ""),
          textFill: String(style.textFill ?? ""),
          decoration: String(style.decoration ?? ""),
          smallCaps: Boolean(style.smallCaps),
          numeric: String(style.numeric ?? ""),
          ligatures: String(style.ligatures ?? ""),
          stylistic: String(style.stylistic ?? ""),

          listStyle,
          listLevels,
          listStart,

          blockType: blockType as DocState["blockType"],
          lineHeight: String(block.lineHeight ?? ""),
          spaceBefore: px(block.spaceBefore),
          spaceAfter: px(block.spaceAfter),
          spaceBeforeSet: Boolean(block.spaceBefore),
          spaceAfterSet: Boolean(block.spaceAfter),
          firstLine: px(block.firstLine),
          indentLeft: px(block.indent),
          indentRight: px(block.indentRight),
          shading: String(block.shading ?? ""),
          paragraphBorder: String(block.border ?? "none"),

          inTable,
          canMerge: inTable && e.can().mergeCells(),
          canSplit: inTable && e.can().splitCell(),
          cellBackground: String(cell.backgroundColor ?? ""),
          cellVAlign: String(cell.verticalAlign ?? "top"),
          tableBorderWidth: Number(table.borderWidth ?? 1),
          tableBorderColor: String(table.borderColor ?? ""),
          tableBorderStyle: String(table.borderStyle ?? "solid"),
          tableBanded: Boolean(table.banded),

          onImage,
          imageWidth: parseFloat(String(image.width ?? "100")) || 100,
          imageWrap: String(image.wrap ?? "inline"),
          imageSide: String(image.side ?? "left"),
          imageAlign: String(image.align ?? "left"),
          imageX: num(image.x),
          imageY: num(image.y),
          imageDx: Number(image.dx ?? 0),
          imageDy: Number(image.dy ?? 0),
          imageRotate: Number(image.rotate ?? 0),
          imageBorderWidth: Number(image.borderWidth ?? 0),
          imageBorderColor: String(image.borderColor ?? ""),
          imageShadow: Boolean(image.shadow),
          imageAlt: String(image.alt ?? ""),

          onEmbed,
          embedHeight: Number(embed.height ?? 320),
          embedCaption: String(embed.caption ?? ""),
          embedBoardId: (embed.boardId as string | null) ?? null,

          onChart,
          chartSpec: String(chart.spec ?? ""),
          chartWidth: Number(chart.width ?? 100),
          chartHeight: Number(chart.height ?? 320),
          chartAlign: String(chart.align ?? "center"),

          onCitation,
          citationSourceId: (citation.sourceId as string | null) ?? null,
          citationPages: String(citation.pages ?? ""),
          onBibliography,
          bibliographyTitle: onBibliography
            ? String(e.getAttributes("bibliography").title ?? "")
            : "",

          onVideo,
          videoSrc: String(video.src ?? ""),
          videoWidth: Number(video.width ?? 100),
          videoAlign: String(video.align ?? "center"),

          onModel3d,
          model3dShape: String(model3d.shape ?? ""),
          model3dColor: String(model3d.color ?? ""),
          model3dName: String(model3d.name ?? ""),
          model3dAlt: String(model3d.alt ?? ""),
          model3dWidth: Number(model3d.width ?? 60),
          model3dHeight: Number(model3d.height ?? 320),
          model3dAlign: String(model3d.align ?? "center"),
          model3dYaw: Number(model3d.yaw ?? 0),
          model3dPitch: Number(model3d.pitch ?? 0),
          model3dZoom: Number(model3d.zoom ?? 1),
          model3dAutoRotate: model3d.autoRotate === true,
          model3dBackground: String(model3d.background ?? ""),

          onMath,
          mathDisplay,
          mathLatex: onMath
            ? String(
                e.getAttributes(mathDisplay ? "mathBlock" : "mathInline")
                  .latex ?? ""
              )
            : "",

          onFootnote,
          footnoteText: onFootnote
            ? String(e.getAttributes("footnote").text ?? "")
            : "",
          footnoteKind:
            onFootnote && e.getAttributes("footnote").kind === "endnote"
              ? "endnote"
              : "footnote",
        }
      },
    }) ?? EMPTY
  )
}
