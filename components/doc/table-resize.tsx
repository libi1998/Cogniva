"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { useT } from "@/lib/i18n/client"
import { formatDecimal } from "@/lib/numbers"
import {
  measureTable,
  resizeTable,
  scaleColumns,
  scaleRows,
  selectedTable,
  type TableBox,
} from "@/lib/table-size"

/**
 * Le maniglie per ridimensionare una tabella intera, come l'angolo delle
 * tabelle di Word: a destra la larghezza, in basso l'altezza, nell'angolo
 * tutte e due. Compaiono passando sopra alla tabella o con il cursore dentro;
 * mentre si trascina un contorno tratteggiato mostra la misura nuova, che si
 * applica lasciando, in un solo passo da annullare.
 *
 * Il bordo destro della tabella resta a quello di ProseMirror, che allarga
 * l'ultima colonna: queste maniglie stanno appena fuori.
 */

type Kind = "width" | "height" | "both"
type Target = {
  pos: number
  top: number
  left: number
  width: number
  height: number
}

/** pixel CSS in un centimetro */
const CM = 96 / 2.54
/** passo delle frecce sulla maniglia */
const STEP = CM / 4

/** La posizione del nodo tabella disegnato da `table` */
function tablePos(editor: Editor, table: HTMLTableElement) {
  const cell = table.querySelector("td, th")
  if (!cell) return null
  try {
    const $pos = editor.state.doc.resolve(editor.view.posAtDOM(cell, 0))
    for (let depth = $pos.depth; depth > 0; depth -= 1) {
      if ($pos.node(depth).type.name === "table") return $pos.before(depth)
    }
  } catch {
    // una tabella appena tolta dal documento
  }
  return null
}

const cm = (px: number) => formatDecimal(Number((px / CM).toFixed(1)))

export function TableResize({
  editor,
  sheet,
}: {
  editor: Editor | null
  sheet: React.RefObject<HTMLElement | null>
}) {
  const t = useT()
  const [target, setTarget] = React.useState<Target | null>(null)
  const [preview, setPreview] = React.useState<{
    width: number
    height: number
  } | null>(null)
  const dragging = React.useRef(false)

  // coordinate del foglio (senza zoom) da coordinate dello schermo
  const toSheet = React.useCallback(
    (rect: DOMRect) => {
      const el = sheet.current
      if (!el) return null
      const box = el.getBoundingClientRect()
      const scale = box.width / (el.offsetWidth || 1) || 1
      return {
        top: (rect.top - box.top) / scale,
        left: (rect.left - box.left) / scale,
        width: rect.width / scale,
        height: rect.height / scale,
      }
    },
    [sheet]
  )

  React.useEffect(() => {
    const el = sheet.current
    if (!editor || !el) return
    let frame = 0
    let pointer: { x: number; y: number } | null = null

    const place = () => {
      frame = 0
      if (dragging.current || editor.isDestroyed) return
      if (!editor.isEditable) {
        setTarget(null)
        return
      }
      let table: HTMLTableElement | null = null
      let pos: number | null = null
      // la tabella sotto al puntatore, anche appena fuori dai bordi destro e
      // basso, dove stanno le maniglie
      if (pointer) {
        for (const candidate of editor.view.dom.querySelectorAll("table")) {
          const r = candidate.getBoundingClientRect()
          if (
            pointer.x >= r.left &&
            pointer.x <= r.right + 18 &&
            pointer.y >= r.top &&
            pointer.y <= r.bottom + 18
          ) {
            table = candidate
            pos = tablePos(editor, candidate)
            break
          }
        }
      }
      // altrimenti quella con il cursore dentro
      if (pos === null) {
        const sel = selectedTable(editor.state)
        if (sel) {
          const dom = editor.view.nodeDOM(sel.pos)
          table = dom instanceof HTMLElement ? dom.querySelector("table") : null
          pos = table ? sel.pos : null
        }
      }
      if (!table || pos === null) {
        setTarget(null)
        return
      }
      const box = toSheet(table.getBoundingClientRect())
      if (!box) return
      const next = { pos, ...box }
      setTarget((prev) =>
        prev &&
        prev.pos === next.pos &&
        Math.abs(prev.top - next.top) < 0.5 &&
        Math.abs(prev.left - next.left) < 0.5 &&
        Math.abs(prev.width - next.width) < 0.5 &&
        Math.abs(prev.height - next.height) < 0.5
          ? prev
          : next
      )
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(place)
    }
    const onMove = (e: PointerEvent) => {
      pointer = { x: e.clientX, y: e.clientY }
      schedule()
    }
    const onLeave = () => {
      pointer = null
      schedule()
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerleave", onLeave)
    // il documento cambia (si scrive in una cella, si aggiunge una riga):
    // la tabella cambia misura e le maniglie la seguono
    editor.on("transaction", schedule)
    window.addEventListener("resize", schedule)
    schedule()
    return () => {
      if (frame) cancelAnimationFrame(frame)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerleave", onLeave)
      editor.off("transaction", schedule)
      window.removeEventListener("resize", schedule)
    }
  }, [editor, sheet, toSheet])

  if (!editor || !target) return null

  /** fin dove arriva: la tabella non esce dalla colonna di testo */
  const room = (pos: number) => {
    const dom = editor.view.nodeDOM(pos)
    return dom instanceof HTMLElement ? dom.offsetWidth : Infinity
  }

  const clampSize = (box: TableBox, width: number, height: number) => ({
    width: Math.min(
      room(box.pos),
      scaleColumns(box.columns, width - box.border).reduce(
        (s, w) => s + w,
        box.border
      )
    ),
    height: scaleRows(box.rows, height - box.borderY).reduce(
      (s, h) => s + h,
      box.borderY
    ),
  })

  const start = (kind: Kind, e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const box = measureTable(editor.view, target.pos)
    const el = sheet.current
    if (!box || !el) return
    const bounds = el.getBoundingClientRect()
    const scale = bounds.width / (el.offsetWidth || 1) || 1
    const x0 = e.clientX
    const y0 = e.clientY
    let size = { width: box.width, height: box.height }
    let frame = 0
    let last = { x: x0, y: y0 }
    dragging.current = true
    setPreview(size)

    const update = () => {
      frame = 0
      const dx = (last.x - x0) / scale
      const dy = (last.y - y0) / scale
      size = clampSize(
        box,
        kind === "height" ? box.width : box.width + dx,
        kind === "width" ? box.height : box.height + dy
      )
      setPreview(size)
    }
    const move = (ev: PointerEvent) => {
      last = { x: ev.clientX, y: ev.clientY }
      if (!frame) frame = requestAnimationFrame(update)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      if (frame) {
        cancelAnimationFrame(frame)
        update()
      }
      dragging.current = false
      setPreview(null)
      resizeTable(
        editor,
        box.pos,
        {
          width: kind === "height" ? undefined : size.width,
          height: kind === "width" ? undefined : size.height,
        },
        box
      )
      editor.view.focus()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  /** con la tastiera: frecce sulla maniglia, un quarto di centimetro */
  const nudge = (kind: Kind, e: React.KeyboardEvent) => {
    const dx =
      kind === "height"
        ? 0
        : e.key === "ArrowRight"
          ? STEP
          : e.key === "ArrowLeft"
            ? -STEP
            : 0
    const dy =
      kind === "width"
        ? 0
        : e.key === "ArrowDown"
          ? STEP
          : e.key === "ArrowUp"
            ? -STEP
            : 0
    if (!dx && !dy) return
    e.preventDefault()
    const box = measureTable(editor.view, target.pos)
    if (!box) return
    const size = clampSize(box, box.width + dx, box.height + dy)
    resizeTable(
      editor,
      box.pos,
      {
        width: dx ? size.width : undefined,
        height: dy ? size.height : undefined,
      },
      box
    )
  }

  const handles: { kind: Kind; label: string; style: React.CSSProperties }[] = [
    {
      kind: "width",
      label: t("Larghezza della tabella · trascina"),
      style: {
        top: target.top + target.height / 2 - 14,
        left: target.left + target.width + 3,
        width: 7,
        height: 28,
        cursor: "ew-resize",
      },
    },
    {
      kind: "height",
      label: t("Altezza della tabella · trascina"),
      style: {
        top: target.top + target.height + 3,
        left: target.left + target.width / 2 - 14,
        width: 28,
        height: 7,
        cursor: "ns-resize",
      },
    },
    {
      kind: "both",
      label: t("Dimensioni della tabella · trascina"),
      style: {
        top: target.top + target.height + 3,
        left: target.left + target.width + 3,
        width: 9,
        height: 9,
        cursor: "nwse-resize",
      },
    },
  ]

  return (
    <>
      {handles.map((h) => (
        <button
          key={h.kind}
          type="button"
          contentEditable={false}
          data-block-handle=""
          data-table-resize={h.kind}
          title={h.label}
          aria-label={h.label}
          onPointerDown={(e) => start(h.kind, e)}
          onKeyDown={(e) => nudge(h.kind, e)}
          className="doc-table-resize"
          style={h.style}
        />
      ))}
      {preview ? (
        <div
          aria-hidden
          data-block-handle=""
          className="doc-table-resize-preview"
          style={{
            top: target.top,
            left: target.left,
            width: preview.width,
            height: preview.height,
          }}
        >
          <span>
            {cm(preview.width)} × {cm(preview.height)} cm
          </span>
        </div>
      ) : null}
    </>
  )
}
