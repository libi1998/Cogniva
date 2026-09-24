"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { NodeSelection } from "@tiptap/pm/state"
import { Move } from "lucide-react"
import { useT } from "@/lib/i18n/client"

/**
 * La maniglia degli oggetti a blocco, come il ✥ delle tabelle di Word:
 * compare passando sopra a una tabella, un sommario, un grafico, una board,
 * un video, un'equazione o un modello 3D. Un clic seleziona l'oggetto intero
 * (per copiarlo, eliminarlo o formattarlo dalla sua scheda); trascinandola
 * l'oggetto si sposta fra i paragrafi, con una linea che mostra dove cadrà.
 *
 * È fatta a mano con i puntatori invece del trascinamento del browser: quello
 * partiva solo afferrando certi punti (mai dai grafici, che sono SVG) e con le
 * pagine vere non sapeva dove lasciare l'oggetto.
 */

const MOVABLE = new Set([
  "table",
  "toc",
  "figureIndex",
  "docIndex",
  "bibliography",
  "chart",
  "boardEmbed",
  "video",
  "mathBlock",
  "model3d",
])

type Target = { index: number; pos: number; top: number; left: number }
type Drop = { top: number; left: number; width: number }

/** Il blocco di primo livello: posizione, nodo e riquadro a schermo */
type Block = { index: number; pos: number; size: number; rect: DOMRect }

function blocks(editor: Editor): Block[] {
  const out: Block[] = []
  const { view } = editor
  view.state.doc.forEach((node, offset, index) => {
    const dom = view.nodeDOM(offset)
    if (!(dom instanceof HTMLElement)) return
    out.push({
      index,
      pos: offset,
      size: node.nodeSize,
      rect: dom.getBoundingClientRect(),
    })
  })
  return out
}

/** Il primo antenato che scorre: la scrivania del documento */
function scroller(el: HTMLElement | null) {
  for (let p = el?.parentElement; p; p = p.parentElement) {
    const o = getComputedStyle(p).overflowY
    if ((o === "auto" || o === "scroll") && p.scrollHeight > p.clientHeight) {
      return p
    }
  }
  return null
}

export function BlockHandle({
  editor,
  sheet,
}: {
  editor: Editor | null
  sheet: React.RefObject<HTMLElement | null>
}) {
  const t = useT()
  const [target, setTarget] = React.useState<Target | null>(null)
  const [drop, setDrop] = React.useState<Drop | null>(null)
  const dragging = React.useRef(false)
  const hide = React.useRef<ReturnType<typeof setTimeout> | null>(null)

  // coordinate del foglio (senza zoom) da coordinate dello schermo
  const toSheet = React.useCallback(
    (x: number, y: number) => {
      const el = sheet.current
      if (!el) return null
      const box = el.getBoundingClientRect()
      const scale = box.width / (el.offsetWidth || 1) || 1
      return { x: (x - box.left) / scale, y: (y - box.top) / scale, scale }
    },
    [sheet]
  )

  React.useEffect(() => {
    const el = sheet.current
    if (!editor || !el) return
    let frame = 0
    let last = { x: 0, y: 0 }

    const find = () => {
      frame = 0
      if (dragging.current || editor.isDestroyed || !editor.isEditable) return
      const hit = blocks(editor).find(
        (b) =>
          last.y >= b.rect.top - 4 &&
          last.y <= b.rect.bottom + 4 &&
          // anche nel margine a sinistra, dove sta la maniglia
          last.x >= b.rect.left - 44 &&
          last.x <= b.rect.right + 8
      )
      const node = hit ? editor.state.doc.child(hit.index) : null
      if (!hit || !node || !MOVABLE.has(node.type.name)) {
        if (!hide.current) {
          hide.current = setTimeout(() => {
            hide.current = null
            if (!dragging.current) setTarget(null)
          }, 250)
        }
        return
      }
      if (hide.current) {
        clearTimeout(hide.current)
        hide.current = null
      }
      const p = toSheet(hit.rect.left, hit.rect.top)
      if (!p) return
      setTarget((prev) =>
        prev &&
        prev.pos === hit.pos &&
        Math.abs(prev.top - p.y) < 0.5 &&
        Math.abs(prev.left - p.x) < 0.5
          ? prev
          : { index: hit.index, pos: hit.pos, top: p.y, left: p.x }
      )
    }
    const onMove = (e: PointerEvent) => {
      last = { x: e.clientX, y: e.clientY }
      if (!frame) frame = requestAnimationFrame(find)
    }
    const onLeave = () => {
      if (!dragging.current) setTarget(null)
    }
    // scrivendo la maniglia sparisce: non deve coprire il testo
    const onKey = () => {
      if (!dragging.current) setTarget(null)
    }
    el.addEventListener("pointermove", onMove)
    el.addEventListener("pointerleave", onLeave)
    el.addEventListener("keydown", onKey)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      if (hide.current) clearTimeout(hide.current)
      el.removeEventListener("pointermove", onMove)
      el.removeEventListener("pointerleave", onLeave)
      el.removeEventListener("keydown", onKey)
    }
  }, [editor, sheet, toSheet])

  if (!editor || !target) return null

  const select = (pos: number) => {
    const node = editor.state.doc.nodeAt(pos)
    if (!node) return
    editor
      .chain()
      .command(({ tr }) => {
        tr.setSelection(NodeSelection.create(tr.doc, pos))
        return true
      })
      .run()
    editor.view.focus()
  }

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.button !== 0) return
    e.preventDefault()
    e.stopPropagation()
    const from = target
    const node = editor.state.doc.nodeAt(from.pos)
    if (!node) return
    select(from.pos)
    const startX = e.clientX
    const startY = e.clientY
    const area = scroller(sheet.current)
    let moved = false
    let goal: { pos: number; index: number } | null = null
    let frame = 0
    let pointer = { x: startX, y: startY }
    dragging.current = true

    /** dove cadrebbe l'oggetto: prima del blocco sotto al puntatore */
    const aim = () => {
      frame = 0
      const list = blocks(editor)
      if (!list.length) return
      let chosen = list.length
      for (let i = 0; i < list.length; i += 1) {
        const r = list[i].rect
        if (pointer.y < r.top + r.height / 2) {
          chosen = i
          break
        }
      }
      const after = chosen >= list.length
      const ref = list[Math.min(chosen, list.length - 1)]
      const y = after ? ref.rect.bottom : ref.rect.top
      const p = toSheet(ref.rect.left, y)
      const content = editor.view.dom.getBoundingClientRect()
      const q = toSheet(content.left, y)
      if (!p || !q) return
      goal = {
        index: after ? list.length : ref.index,
        pos: after ? ref.pos + ref.size : ref.pos,
      }
      setDrop({ top: p.y - 2, left: q.x, width: content.width / q.scale })
      // vicino ai bordi la scrivania scorre, per portarlo lontano
      if (area) {
        const box = area.getBoundingClientRect()
        const edge = 48
        if (pointer.y < box.top + edge) area.scrollTop -= 18
        else if (pointer.y > box.bottom - edge) area.scrollTop += 18
      }
    }
    const move = (ev: PointerEvent) => {
      pointer = { x: ev.clientX, y: ev.clientY }
      if (!moved && Math.hypot(ev.clientX - startX, ev.clientY - startY) < 4) {
        return
      }
      moved = true
      if (!frame) frame = requestAnimationFrame(aim)
    }
    const up = () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      if (frame) cancelAnimationFrame(frame)
      dragging.current = false
      setDrop(null)
      setTarget(null)
      if (!moved || !goal) return
      // sopra o sotto a sé stesso non si sposta niente
      if (goal.index === from.index || goal.index === from.index + 1) return
      const current = editor.state.doc.nodeAt(from.pos)
      if (!current) return
      const tr = editor.state.tr
      tr.delete(from.pos, from.pos + current.nodeSize)
      const at = tr.mapping.map(goal.pos)
      tr.insert(at, current)
      tr.setSelection(NodeSelection.create(tr.doc, at))
      editor.view.dispatch(tr.scrollIntoView())
      editor.view.focus()
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
  }

  return (
    <>
      <button
        type="button"
        contentEditable={false}
        data-block-handle=""
        title={t("Seleziona o trascina per spostare")}
        aria-label={t("Seleziona o trascina per spostare")}
        onPointerDown={onPointerDown}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault()
            select(target.pos)
          }
        }}
        className="doc-block-handle"
        style={{ top: target.top, left: target.left - 26 }}
      >
        <Move className="size-3.5" />
      </button>
      {drop ? (
        <div
          aria-hidden
          className="doc-block-drop"
          style={{ top: drop.top, left: drop.left, width: drop.width }}
        />
      ) : null}
    </>
  )
}
