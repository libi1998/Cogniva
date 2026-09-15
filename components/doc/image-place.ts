"use client"

import type { Editor } from "@tiptap/react"
import { NodeSelection } from "@tiptap/pm/state"
import { isFloatWrap, isFreeWrap } from "@/lib/tiptap-extensions"
import type { DocTheme } from "@/lib/types"

/** Il foglio, con zoom, altezza di pagina e stacco fra i fogli attuali */
export type SheetGeometry = {
  sheet: HTMLElement
  box: DOMRect
  scale: number
  /** 0 se il documento non è impaginato */
  pageHeight: number
  gap: number
}

export function sheetGeometry(from?: Element | null): SheetGeometry | null {
  // il foglio visibile: documenti rimasti montati ma nascosti hanno lo
  // stesso id e larghezza zero
  const sheet =
    from?.closest<HTMLElement>("#doc-sheet") ??
    Array.from(document.querySelectorAll<HTMLElement>("#doc-sheet")).find(
      (el) => el.offsetWidth > 0
    ) ??
    null
  if (!sheet || !sheet.offsetWidth) return null
  const box = sheet.getBoundingClientRect()
  const style = getComputedStyle(sheet)
  const paginated = sheet.classList.contains("doc-paginated")
  return {
    sheet,
    box,
    scale: box.width / sheet.offsetWidth || 1,
    pageHeight: paginated
      ? parseFloat(style.getPropertyValue("--page-h")) || 0
      : 0,
    gap: paginated ? parseFloat(style.getPropertyValue("--page-gap")) || 0 : 0,
  }
}

/** Da coordinate del client a coordinate del foglio (a schermo) */
export function toSheet(g: SheetGeometry, clientX: number, clientY: number) {
  return {
    x: (clientX - g.box.left) / g.scale,
    y: (clientY - g.box.top) / g.scale,
  }
}

/** Altezza a schermo → altezza sulla carta, senza gli stacchi fra i fogli */
export function toPaperY(g: SheetGeometry, y: number) {
  if (!g.pageHeight) return y
  const k = Math.max(0, Math.floor(y / (g.pageHeight + g.gap)))
  return y - k * g.gap
}

/** Altezza sulla carta → altezza a schermo */
export function toScreenY(g: SheetGeometry, y: number) {
  if (!g.pageHeight) return y
  return y + Math.max(0, Math.floor(y / g.pageHeight)) * g.gap
}

/** Inizio a schermo della pagina che contiene l'altezza data */
export function pageTopAt(g: SheetGeometry, y: number) {
  if (!g.pageHeight) return 0
  const step = g.pageHeight + g.gap
  return Math.max(0, Math.floor(y / step)) * step
}

/** Il riquadro dell'immagine alla posizione data, dentro alla vista React */
export function imageBox(editor: Editor, pos: number): HTMLElement | null {
  const dom = editor.view.nodeDOM(pos)
  if (!(dom instanceof HTMLElement)) return null
  return dom.querySelector<HTMLElement>(".doc-image-box")
}

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v))

/**
 * Sposta un'immagine con il testo intorno (quadrato, ravvicinato, all'interno,
 * sopra e sotto) nel punto del foglio dato, come in Word: l'immagine si
 * aggancia al paragrafo che si trova a quell'altezza e ne ricorda la distanza
 * dal margine e dall'inizio del paragrafo, così il testo le scorre intorno lì
 * dove è stata messa e la segue quando il paragrafo si sposta.
 *
 * `target` è l'angolo in alto a sinistra dell'immagine, in coordinate del
 * foglio a schermo.
 */
export function placeFlowImage(
  editor: Editor,
  pos: number,
  target: { x: number; y: number }
) {
  const g = sheetGeometry(editor.view.dom)
  const { state, view } = editor
  const node = state.doc.nodeAt(pos)
  const box = imageBox(editor, pos)
  if (!g || !node || node.type.name !== "image" || !box) return false

  const wrap = String(node.attrs.wrap)
  const content = view.dom.getBoundingClientRect()
  const left = (content.left - g.box.left) / g.scale
  const width = content.width / g.scale
  const w = box.getBoundingClientRect().width / g.scale

  // il paragrafo di aggancio: l'ultimo blocco del corpo che comincia sopra
  // al punto di arrivo (mai il titolo, mai un'altra immagine)
  let anchor: { pos: number; top: number } | null = null
  let first: { pos: number; top: number } | null = null
  state.doc.forEach((child, offset, index) => {
    if (index === 0 || offset === pos || child.type.name === "image") return
    const dom = view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) return
    const top = (dom.getBoundingClientRect().top - g.box.top) / g.scale
    first ??= { pos: offset, top }
    if (top <= target.y + 1) anchor = { pos: offset, top }
  })
  const chosen = (anchor ?? first) as { pos: number; top: number } | null
  if (!chosen) return false

  const wrapper = box.closest<HTMLElement>(".doc-image")
  const marginTop = wrapper
    ? parseFloat(getComputedStyle(wrapper).marginTop) || 0
    : 0
  const dy = Math.round(Math.max(0, target.y - chosen.top - marginTop))
  const attrs: Record<string, unknown> = { ...node.attrs, dy }
  if (isFloatWrap(wrap)) {
    // il testo scorre sul lato più largo, come «Lato più largo» in Word
    const side = target.x + w / 2 - left < width / 2 ? "left" : "right"
    const dx = side === "left" ? target.x - left : left + width - (target.x + w)
    attrs.side = side
    attrs.dx = Math.round(clamp(dx, 0, Math.max(0, width - w)))
  } else {
    attrs.align = "left"
    attrs.dx = Math.round(clamp(target.x - left, 0, Math.max(0, width - w)))
  }

  const tr = state.tr
  // l'immagine va subito prima del suo paragrafo: se c'è già, cambiano solo
  // le distanze
  const next = pos + node.nodeSize
  if (chosen.pos === next) {
    tr.setNodeMarkup(pos, undefined, attrs)
    tr.setSelection(NodeSelection.create(tr.doc, pos))
  } else {
    tr.delete(pos, next)
    const at = tr.mapping.map(chosen.pos)
    tr.insert(at, node.type.create(attrs))
    tr.setSelection(NodeSelection.create(tr.doc, at))
  }
  view.dispatch(tr)

  // il margine del blocco e del paragrafo non si conoscono prima: dopo il
  // disegno si misura dov'è finita davvero e si corregge la differenza
  const at = tr.selection.from
  window.setTimeout(() => {
    if (editor.isDestroyed) return
    const moved = imageBox(editor, at)
    const g2 = sheetGeometry(editor.view.dom)
    const current = editor.state.doc.nodeAt(at)
    if (!moved || !g2 || current?.type.name !== "image") return
    const top = (moved.getBoundingClientRect().top - g2.box.top) / g2.scale
    const diff = Math.round(target.y - top)
    if (Math.abs(diff) < 2) return
    const fixed = Math.max(0, Number(current.attrs.dy ?? 0) + diff)
    editor.view.dispatch(
      editor.state.tr.setNodeMarkup(at, undefined, {
        ...current.attrs,
        dy: fixed,
      })
    )
  }, 40)
  return true
}

export type HAlign = "left" | "center" | "right"
export type VAlign = "top" | "middle" | "bottom"

/**
 * Coordinate (a schermo, in pixel del foglio senza zoom) dell'angolo in alto a
 * sinistra dell'immagine allineata ai margini o alla pagina, sulla pagina in
 * cui si trova ora.
 */
export function alignedPosition(
  editor: Editor,
  theme: DocTheme,
  relative: "margin" | "page",
  h: HAlign | null,
  v: VAlign | null
) {
  const pos = editor.state.selection.from
  const img = imageBox(editor, pos)
  const g = sheetGeometry(img)
  if (!img || !g) return null
  const r = img.getBoundingClientRect()
  const here = toSheet(g, r.left, r.top)
  const w = r.width / g.scale
  const hgt = r.height / g.scale
  const W = g.sheet.offsetWidth
  const H = g.pageHeight || g.sheet.offsetHeight
  const m =
    relative === "margin"
      ? theme.margins
      : { top: 0, right: 0, bottom: 0, left: 0 }
  const pageTop = pageTopAt(g, Math.max(0, here.y))

  const left = m.left
  const right = W - m.right
  const top = pageTop + m.top
  const bottom = pageTop + H - m.bottom

  const x =
    h === "left"
      ? left
      : h === "center"
        ? (left + right - w) / 2
        : h === "right"
          ? right - w
          : here.x
  const y =
    v === "top"
      ? top
      : v === "middle"
        ? (top + bottom - hgt) / 2
        : v === "bottom"
          ? bottom - hgt
          : here.y
  return { x: Math.round(x), y: Math.round(y), g }
}

/**
 * «Posizione» di Word: porta l'immagine selezionata in uno dei nove punti dei
 * margini o della pagina. Un'immagine in linea diventa «quadrato».
 */
export function positionImage(
  editor: Editor,
  theme: DocTheme,
  relative: "margin" | "page",
  h: HAlign | null,
  v: VAlign | null
) {
  const target = alignedPosition(editor, theme, relative, h, v)
  if (!target) return false
  const pos = editor.state.selection.from
  const wrap = String(editor.getAttributes("image").wrap ?? "inline")
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("image", attrs).run()
  if (isFreeWrap(wrap)) {
    set({ x: target.x, y: Math.round(toPaperY(target.g, target.y)) })
    return true
  }
  if (wrap === "inline") {
    set({ wrap: "square", x: null, y: null })
    window.setTimeout(() => placeFlowImage(editor, pos, target), 30)
    return true
  }
  return placeFlowImage(editor, pos, target)
}
