"use client"

import * as React from "react"
import {
  NodeViewWrapper,
  ReactNodeViewRenderer,
  type NodeViewProps,
} from "@tiptap/react"
import {
  StyledImage,
  isFloatWrap,
  isFreeWrap,
  type ImageAttrs,
} from "@/lib/tiptap-extensions"
import { cn } from "@/lib/utils"
import {
  isLineShape,
  shapeImageAttrs,
  type DocShapeKind,
} from "@/lib/shape-svg"
import { DocPageContext } from "./render-theme"
import {
  placeFlowImage,
  sheetGeometry,
  toPaperY,
  toScreenY,
  toSheet,
} from "./image-place"

const CORNERS = ["nw", "ne", "sw", "se"] as const
type Corner = (typeof CORNERS)[number]

/** Margine fra testo e immagine per ogni disposizione, come in Word */
const SHAPE_MARGIN: Record<string, string> = {
  square: "1.3em",
  tight: "0.6em",
  through: "0.3em",
}

/** Rapporto fra pixel a schermo e pixel del foglio: lo zoom della vista */
function viewScale(el: HTMLElement) {
  const w = el.offsetWidth
  return w ? el.getBoundingClientRect().width / w : 1
}

/**
 * Immagine come su Word.
 *
 * - In linea: è un blocco del testo e si trascina in un altro punto del testo.
 * - Col testo intorno (quadrato, ravvicinato, all'interno, sopra e sotto): si
 *   trascina dove si vuole sul foglio; si aggancia al paragrafo che trova a
 *   quell'altezza e il testo le scorre intorno lì.
 * - Dietro e davanti al testo: fuori dal flusso, coordinate libere sul foglio.
 */
function ImageView({
  node,
  updateAttributes,
  selected,
  editor,
  getPos,
}: NodeViewProps) {
  const a = node.attrs as ImageAttrs & {
    src?: string
    alt?: string
    shape?: string | null
    fill?: string | null
    stroke?: string | null
    strokeWidth?: number
    label?: string
  }
  const pageHeight = React.useContext(DocPageContext)
  const free = isFreeWrap(a.wrap)
  const float = isFloatWrap(a.wrap)
  const flow = float || a.wrap === "topBottom"
  const pct = Math.min(100, Math.max(5, parseFloat(a.width) || 100))
  const dx = Math.max(0, Number(a.dx) || 0)
  const dy = Math.max(0, Number(a.dy) || 0)
  const wrapper = React.useRef<HTMLDivElement>(null)
  const box = React.useRef<HTMLDivElement>(null)

  // passando a una disposizione libera l'immagine parte da dove si trovava
  React.useEffect(() => {
    if (!free || (a.x !== null && a.y !== null)) return
    const el = wrapper.current
    const g = sheetGeometry(el)
    if (!el || !g) return
    const r = el.getBoundingClientRect()
    const p = toSheet(g, r.left, r.top)
    updateAttributes({ x: Math.round(p.x), y: Math.round(toPaperY(g, p.y)) })
  }, [free, a.x, a.y, updateAttributes])

  const position = () => (typeof getPos === "function" ? getPos() : null)
  const select = () => {
    const pos = position()
    if (typeof pos === "number") editor.commands.setNodeSelection(pos)
  }

  /** trascinamento: libero per dietro/davanti, con aggancio per gli altri */
  const startMove = (e: React.PointerEvent) => {
    if (!(free || flow) || !editor.isEditable || e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    select()
    const el = wrapper.current
    const g = sheetGeometry(el)
    if (!el || !g) return
    const startX = e.clientX
    const startY = e.clientY
    const origin = (box.current ?? el).getBoundingClientRect()
    let frame = 0
    let moved = false
    let delta = { x: 0, y: 0 }

    const paint = () => {
      frame = 0
      if (free) {
        el.style.left = `${(a.x ?? 0) + delta.x}px`
        el.style.top = `${toScreenY(g, a.y ?? 0) + delta.y}px`
      } else {
        // col testo intorno si sposta solo l'anteprima: il testo si
        // risistema quando si lascia
        el.style.transform = `translate(${delta.x}px, ${delta.y}px)`
      }
    }
    const move = (ev: PointerEvent) => {
      const ddx = (ev.clientX - startX) / g.scale
      const ddy = (ev.clientY - startY) / g.scale
      if (!moved && Math.hypot(ddx, ddy) < 3) return
      if (!moved) {
        moved = true
        el.classList.add("is-dragging")
      }
      delta = { x: Math.round(ddx), y: Math.round(ddy) }
      // durante il trascinamento si muove solo il DOM: una transazione per
      // fotogramma riscriverebbe il documento a ogni pixel
      if (!frame) frame = requestAnimationFrame(paint)
    }
    const up = () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      el.classList.remove("is-dragging")
      if (!moved) return
      if (free) {
        const screenY = toScreenY(g, a.y ?? 0) + delta.y
        updateAttributes({
          x: (a.x ?? 0) + delta.x,
          y: Math.round(toPaperY(g, screenY)),
        })
        return
      }
      el.style.transform = ""
      const pos = position()
      if (typeof pos !== "number") return
      const target = toSheet(
        g,
        origin.left + delta.x * g.scale,
        origin.top + delta.y * g.scale
      )
      placeFlowImage(editor, pos, target)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  const resize = (corner: Corner) => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = box.current
    const column = el?.closest<HTMLElement>(".ProseMirror")
    if (!el || !column) return
    const s = viewScale(column)
    const full = column.clientWidth
    const startX = e.clientX
    const startW = el.getBoundingClientRect().width / s
    const west = corner === "nw" || corner === "sw"
    const x0 = a.x ?? 0
    let frame = 0
    let pending: { width: string; x?: number } | null = null

    const commit = () => {
      frame = 0
      if (pending) updateAttributes(pending)
    }
    const move = (ev: PointerEvent) => {
      if (!full) return
      const d = (ev.clientX - startX) / s
      const w = Math.min(full, Math.max(24, startW + (west ? -d : d)))
      pending = { width: `${Math.round((w / full) * 100)}%` }
      // allargando da sinistra un'immagine libera deve spostarsi a sinistra
      if (free && west) pending.x = Math.round(x0 + (startW - w))
      if (!frame) frame = requestAnimationFrame(commit)
    }
    const up = () => {
      if (frame) cancelAnimationFrame(frame)
      commit()
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }

  /**
   * Le maniglie ai lati di una forma: la allungano solo in larghezza (e) o
   * solo in altezza (s), come in Word. Lasciando, il disegno si rifà con le
   * proporzioni nuove.
   */
  const stretch = (side: "e" | "s") => (e: React.PointerEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const el = box.current
    const img = el?.querySelector("img")
    const column = el?.closest<HTMLElement>(".ProseMirror")
    if (!el || !img || !column || !a.shape) return
    const s = viewScale(column)
    const full = column.clientWidth
    const rect = img.getBoundingClientRect()
    const w0 = rect.width / s
    const h0 = rect.height / s
    const startX = e.clientX
    const startY = e.clientY
    let w = w0
    let h = h0
    const move = (ev: PointerEvent) => {
      if (side === "e") {
        w = Math.min(full, Math.max(16, w0 + (ev.clientX - startX) / s))
        img.style.width = `${w}px`
      } else {
        h = Math.max(8, h0 + (ev.clientY - startY) / s)
      }
      img.style.height = `${h}px`
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      img.style.width = ""
      img.style.height = ""
      if (Math.abs(w - w0) < 1 && Math.abs(h - h0) < 1) return
      updateAttributes({
        ...shapeImageAttrs(a.shape as DocShapeKind, {
          fill: String(a.fill ?? "none"),
          stroke: String(a.stroke ?? "#000000"),
          strokeWidth: Number(a.strokeWidth ?? 3),
          ratio: h / w,
          text: String(a.label ?? ""),
        }),
        width: `${Math.round((w / full) * 100)}%`,
      })
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
  }
  const stretchable = Boolean(a.shape) && !isLineShape(String(a.shape))

  let wrapperStyle: React.CSSProperties = {}
  if (free) {
    // l'altezza salvata è quella sulla carta: a schermo si aggiungono gli
    // stacchi fra i fogli che stanno sopra
    const k = pageHeight && a.y !== null ? Math.floor(a.y / pageHeight) : 0
    wrapperStyle = {
      left: a.x ?? undefined,
      top:
        a.y === null
          ? undefined
          : k
            ? `calc(${a.y}px + ${k} * var(--page-gap, 0px))`
            : a.y,
      width: `calc(var(--doc-content-w, 640px) * ${pct / 100})`,
    }
  } else if (float) {
    wrapperStyle = {
      width: `${pct}%`,
      ...(a.side === "right"
        ? { marginRight: dx || undefined }
        : { marginLeft: dx || undefined }),
      paddingTop: dy || undefined,
      // lo spazio sopra l'immagine non allontana il testo: la forma intorno
      // a cui scorre comincia dall'immagine
      shapeOutside: dy ? `inset(${dy}px 0 0 0) padding-box` : undefined,
      shapeMargin: dy ? SHAPE_MARGIN[a.wrap] : undefined,
    }
  } else if (a.wrap === "topBottom") {
    wrapperStyle = { paddingTop: dy || undefined }
  }

  return (
    <NodeViewWrapper
      ref={wrapper}
      as="div"
      className={cn(
        "doc-image",
        `doc-image-${a.wrap}`,
        free && "doc-image-free",
        float && "doc-image-float",
        float && `doc-image-side-${a.side}`,
        !free && !float && `doc-image-align-${a.align}`,
        flow && "doc-image-movable",
        selected && "is-selected"
      )}
      style={wrapperStyle}
    >
      <div
        ref={box}
        className="doc-image-box"
        style={{
          width: free || float ? "100%" : `${pct}%`,
          marginLeft:
            a.wrap === "topBottom" && a.align === "left" && dx ? dx : undefined,
          transform: a.rotate ? `rotate(${a.rotate}deg)` : undefined,
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- immagini
            incollate dall'utente, spesso data URI: next/image non le serve */}
        <img
          src={String(a.src ?? "")}
          alt={String(a.alt ?? "")}
          {...(free || flow ? {} : { "data-drag-handle": "" })}
          draggable={!(free || flow)}
          onPointerDown={startMove}
          style={{
            border: a.borderWidth
              ? `${a.borderWidth}px solid ${a.borderColor ?? "currentColor"}`
              : undefined,
            boxShadow: a.shadow
              ? "0 10px 28px -8px rgba(15, 1, 26, 0.45)"
              : undefined,
          }}
        />
        {editor.isEditable && selected
          ? CORNERS.map((c) => (
              <span
                key={c}
                role="presentation"
                className={`doc-image-handle doc-image-handle-${c}`}
                onPointerDown={resize(c)}
              />
            ))
          : null}
        {editor.isEditable && selected && stretchable
          ? (["e", "s"] as const).map((side) => (
              <span
                key={side}
                role="presentation"
                className={`doc-image-handle doc-image-handle-${side}`}
                onPointerDown={stretch(side)}
              />
            ))
          : null}
      </div>
    </NodeViewWrapper>
  )
}

/** L'immagine del documento, con la sua vista React */
export const DocImage = StyledImage.extend({
  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },
})
