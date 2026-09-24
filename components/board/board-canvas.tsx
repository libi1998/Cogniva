"use client"

import * as React from "react"
import { NodeView, SELECT_COLOR, drawPath, type ResizeDir } from "./node-view"
import { EdgeView } from "./edge-view"
import { BoardContextMenu, type MenuState } from "./context-menu"
import { placementSpec, type Tool } from "./tools"
import { buildEdgeToPoint } from "@/lib/geometry"
import { isDark as isDarkColor, rgba, whim } from "@/lib/palette"
import { AUTO_CANVAS, resolveColor } from "@/lib/use-theme"
import { formatLabel, formatPx } from "@/lib/page"
import {
  contains,
  hasEditableText,
  isContainer,
  makeItem,
  setTableCell,
  sortedForRender,
  SHAPE_SIZE,
} from "@/lib/items"
import {
  boundsOf,
  clipForPaste,
  readClipFallback,
  writeClip,
} from "@/lib/clipboard"
import { getWorkspace } from "@/lib/store"
import { useStableHandler } from "@/lib/use-stable-handler"
import type { BoardData, BoardEdge, BoardNode, Side } from "@/lib/types"

export type Selection = { nodes: string[]; edges: string[] }

/** Distanza fra un punto e un segmento */
function distToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax
  const dy = by - ay
  const len2 = dx * dx + dy * dy
  if (len2 === 0) return Math.hypot(px - ax, py - ay)
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2))
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}
export type Viewport = { x: number; y: number; zoom: number }

const MIN_ZOOM = 0.05
const MAX_ZOOM = 4
const SNAP = 6
/** un dito fermo così a lungo apre il menu, come il tasto destro */
const LONG_PRESS_MS = 500
const LONG_PRESS_SLOP = 8
/** fin qui (in pixel dello schermo) un trascinamento è ancora un clic */
const CLICK_SLOP = 5

const clampZoom = (z: number) => Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, z))

type Interaction =
  | { kind: "none" }
  | { kind: "pan"; sx: number; sy: number; ox: number; oy: number }
  | {
      kind: "move"
      start: { x: number; y: number }
      orig: Map<string, { x: number; y: number }>
      moved: boolean
    }
  | {
      kind: "resize"
      dir: ResizeDir
      id: string
      orig: { x: number; y: number; w: number; h: number }
      start: { x: number; y: number }
      started: boolean
    }
  | { kind: "marquee"; start: { x: number; y: number }; additive: boolean }
  | {
      kind: "connect"
      from: string
      side: Side
      /** dove è cominciato, sullo schermo: un clic fermo non collega niente */
      sx: number
      sy: number
    }
  | { kind: "place"; start: { x: number; y: number } }
  | { kind: "draw"; points: number[] }
  | { kind: "erase"; started: boolean }
  | {
      /* due dita: si sposta e si ingrandisce la vista */
      kind: "pinch"
      dist: number
      mid: { x: number; y: number }
      vp: Viewport
    }

type Overlay = {
  marquee?: { x: number; y: number; w: number; h: number }
  place?: { x: number; y: number; w: number; h: number }
  stroke?: number[]
  connect?: {
    from: string
    side: Side
    point: { x: number; y: number }
    target: string | null
  }
  guides?: {
    x?: number
    y?: number
    xSpan?: [number, number]
    ySpan?: [number, number]
  }
}

function isTypingTarget(el: Element | null) {
  const node = el as HTMLElement | null
  return (
    !!node &&
    (node.tagName === "INPUT" ||
      node.tagName === "TEXTAREA" ||
      node.tagName === "SELECT" ||
      node.isContentEditable)
  )
}

export function BoardCanvas({
  fileId,
  data,
  tool,
  setTool,
  selection,
  setSelection,
  vp,
  setVp,
  dark,
}: {
  fileId: string
  data: BoardData
  tool: Tool
  setTool: (t: Tool) => void
  selection: Selection
  setSelection: React.Dispatch<React.SetStateAction<Selection>>
  vp: Viewport
  setVp: React.Dispatch<React.SetStateAction<Viewport>>
  dark: boolean
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  // l'ultimo stato visto dai gestori fra un ridisegno e l'altro: più eventi
  // del puntatore possono arrivare prima che React ridisegni
  const vpRef = React.useRef(vp)
  const dataRef = React.useRef(data)
  const selRef = React.useRef(selection)

  React.useLayoutEffect(() => {
    vpRef.current = vp
    dataRef.current = data
    selRef.current = selection
  })

  const interRef = React.useRef<Interaction>({ kind: "none" })
  const [interKind, setInterKind] = React.useState<Interaction["kind"]>("none")
  const [overlay, setOverlay] = React.useState<Overlay>({})
  const [editingNode, setEditingNode] = React.useState<string | null>(null)
  const [editingEdge, setEditingEdge] = React.useState<string | null>(null)
  const [editingCell, setEditingCell] = React.useState<{
    id: string
    index: number
  } | null>(null)
  const [space, setSpace] = React.useState(false)
  const [menu, setMenu] = React.useState<MenuState | null>(null)
  const lastPointer = React.useRef({ x: 0, y: 0 })
  // le dita appoggiate sullo schermo, per il pinch e la pressione prolungata
  const touches = React.useRef(new Map<number, { x: number; y: number }>())
  const longPress = React.useRef<{
    timer: ReturnType<typeof setTimeout>
    x: number
    y: number
  } | null>(null)

  const theme = data.theme
  const background = resolveColor(theme.background, dark, AUTO_CANVAS)
  const page = formatPx(theme.page.format, theme.page.orientation)
  const nodeById = React.useMemo(() => {
    const m = new Map<string, BoardNode>()
    data.nodes.forEach((n) => m.set(n.id, n))
    return m
  }, [data.nodes])
  // i contenitori (sezioni e frame) in uno strato loro, sotto ai connettori
  const [containers, others] = React.useMemo(() => {
    const ordered = sortedForRender(data.nodes)
    return [ordered.filter(isContainer), ordered.filter((n) => !isContainer(n))]
  }, [data.nodes])

  /* --------------------------- coordinate helpers ------------------------ */

  const toWorld = (cx: number, cy: number) => {
    const rect = ref.current?.getBoundingClientRect()
    const v = vpRef.current
    if (!rect) return { x: 0, y: 0 }
    return {
      x: (cx - rect.left - v.x) / v.zoom,
      y: (cy - rect.top - v.y) / v.zoom,
    }
  }

  const zoomAt = (clientX: number, clientY: number, factor: number) => {
    const rect = ref.current?.getBoundingClientRect()
    if (!rect) return
    setVp((v) => {
      const next = clampZoom(v.zoom * factor)
      const mx = clientX - rect.left
      const my = clientY - rect.top
      const wx = (mx - v.x) / v.zoom
      const wy = (my - v.y) / v.zoom
      return { zoom: next, x: mx - wx * next, y: my - wy * next }
    })
  }

  const onWheel = React.useEffectEvent((e: WheelEvent) => {
    e.preventDefault()
    // Firefox misura la rotellina in righe, non in pixel
    const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? 400 : 1
    const dx = e.deltaX * unit
    const dy = e.deltaY * unit
    if (e.ctrlKey || e.metaKey)
      zoomAt(e.clientX, e.clientY, Math.exp(-dy * 0.01))
    else setVp((v) => ({ ...v, x: v.x - dx, y: v.y - dy }))
  })

  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const listener = (e: WheelEvent) => onWheel(e)
    el.addEventListener("wheel", listener, { passive: false })
    return () => el.removeEventListener("wheel", listener)
  }, [])

  /* ------------------------------ helpers -------------------------------- */

  /** true quando il fuoco è su una casella di testo di un elemento del canvas */
  const isEditingFieldFocused = () => {
    const el = document.activeElement as HTMLElement | null
    if (!el) return false
    if (el.tagName !== "TEXTAREA" && el.tagName !== "INPUT") return false
    return !!el.closest(
      '[data-layer="nodes"], [data-layer="containers"], [data-layer="edges"]'
    )
  }

  const begin = (i: Interaction) => {
    interRef.current = i
    setInterKind(i.kind)
  }
  const end = () => {
    interRef.current = { kind: "none" }
    setInterKind("none")
    setOverlay({})
  }

  const hitNode = (world: { x: number; y: number }, skip?: string) => {
    // nell'ordine in cui si vedono: una sezione disegnata dopo gli elementi
    // che contiene sta comunque sotto, e non deve rubare il collegamento
    const list = sortedForRender(dataRef.current.nodes)
    for (let i = list.length - 1; i >= 0; i--) {
      const n = list[i]
      if (n.id === skip || n.kind === "draw") continue
      if (
        world.x >= n.x &&
        world.x <= n.x + n.w &&
        world.y >= n.y &&
        world.y <= n.y + n.h
      )
        return n
    }
    return undefined
  }

  const childrenOf = (container: BoardNode) =>
    dataRef.current.nodes.filter(
      (n) => n.id !== container.id && contains(container, n)
    )

  const copySelection = (cut = false) => {
    const sel = selRef.current
    if (!sel.nodes.length) return
    const ids = new Set(sel.nodes)
    const nodes = dataRef.current.nodes.filter((n) => ids.has(n.id))
    const edges = dataRef.current.edges.filter(
      (e) => ids.has(e.from) && ids.has(e.to)
    )
    const file = getWorkspace().files.find((f) => f.id === fileId)
    writeClip({
      nodes: structuredClone(nodes),
      edges: structuredClone(edges),
      bounds: boundsOf(nodes),
      theme: structuredClone(dataRef.current.theme),
      source: file?.title,
      sourceId: fileId,
    })
    if (cut) {
      const store = getWorkspace()
      store.snapshot(fileId)
      store.removeSelection(fileId, sel.nodes, sel.edges)
      setSelection({ nodes: [], edges: [] })
    }
  }

  const pasteAt = (
    world: { x: number; y: number },
    payload = readClipFallback()
  ) => {
    if (!payload || !payload.nodes.length) return
    const store = getWorkspace()
    store.snapshot(fileId)
    const dx = world.x - payload.bounds.x - payload.bounds.w / 2
    const dy = world.y - payload.bounds.y - payload.bounds.h / 2
    const map = new Map<string, string>()
    const created: string[] = []
    for (const n of payload.nodes) {
      const id = store.addNode(fileId, {
        ...n,
        x: Math.round(n.x + dx),
        y: Math.round(n.y + dy),
      })
      map.set(n.id, id)
      created.push(id)
    }
    for (const e of payload.edges) {
      const from = map.get(e.from)
      const to = map.get(e.to)
      if (from && to) store.addEdge(fileId, { ...e, from, to })
    }
    setSelection({ nodes: created, edges: [] })
  }

  const duplicateSelection = () => {
    const store = getWorkspace()
    const sel = selRef.current
    if (!sel.nodes.length) return
    store.snapshot(fileId)
    const idMap = new Map<string, string>()
    const created: string[] = []
    for (const id of sel.nodes) {
      const n = dataRef.current.nodes.find((x) => x.id === id)
      if (!n) continue
      const newId = store.addNode(fileId, { ...n, x: n.x + 28, y: n.y + 28 })
      idMap.set(id, newId)
      created.push(newId)
    }
    for (const ed of dataRef.current.edges) {
      const from = idMap.get(ed.from)
      const to = idMap.get(ed.to)
      if (from && to) store.addEdge(fileId, { ...ed, from, to })
    }
    setSelection({ nodes: created, edges: [] })
  }

  const createItem = (
    spec: ReturnType<typeof placementSpec>,
    rect: { x: number; y: number; w?: number; h?: number },
    startEditing?: boolean
  ) => {
    if (!spec) return
    const store = getWorkspace()
    store.snapshot(fileId)
    const item = makeItem(spec, dataRef.current.theme)
    const w = rect.w ?? item.w
    const h = rect.h ?? item.h
    const id = store.addNode(fileId, {
      ...item,
      w: Math.round(w),
      h: Math.round(h),
      x: Math.round(rect.x),
      y: Math.round(rect.y),
    })
    setSelection({ nodes: [id], edges: [] })
    if (
      startEditing !== false &&
      (spec.kind === "shape" || spec.kind === "section")
    )
      setEditingNode(id)
    setTool({ t: "select" })
    return id
  }

  const finishStroke = (pts: number[]) => {
    if (pts.length < 4) return
    const mode = tool.t === "draw" ? tool.mode : "pen"
    const width = mode === "highlighter" ? 16 : 3
    let minX = Infinity
    let minY = Infinity
    let maxX = -Infinity
    let maxY = -Infinity
    for (let i = 0; i < pts.length; i += 2) {
      minX = Math.min(minX, pts[i])
      maxX = Math.max(maxX, pts[i])
      minY = Math.min(minY, pts[i + 1])
      maxY = Math.max(maxY, pts[i + 1])
    }
    minX -= width
    minY -= width
    const w = Math.max(maxX + width - minX, 1)
    const h = Math.max(maxY + width - minY, 1)
    const norm: number[] = []
    for (let i = 0; i < pts.length; i += 2) {
      norm.push((pts[i] - minX) / w, (pts[i + 1] - minY) / h)
    }
    const store = getWorkspace()
    store.snapshot(fileId)
    store.addNode(fileId, {
      ...makeItem({ kind: "draw" }, dataRef.current.theme),
      x: Math.round(minX),
      y: Math.round(minY),
      w: Math.round(w),
      h: Math.round(h),
      points: norm,
      strokeWidth: width,
      strokeColor:
        mode === "highlighter"
          ? whim.yellow[400]
          : dataRef.current.theme.arrows.color,
      opacity: mode === "highlighter" ? 0.45 : 1,
    })
  }

  const eraseAt = (world: { x: number; y: number }) => {
    const r = 12 / vpRef.current.zoom
    const hits = dataRef.current.nodes.filter((n) => {
      if (n.kind !== "draw" || !n.points || n.points.length < 2) return false
      // si misura la distanza dai SEGMENTI, non dai soli punti campionati:
      // un tratto veloce ha pochi campioni molto distanti fra loro
      let ax = n.x + n.points[0] * n.w
      let ay = n.y + n.points[1] * n.h
      if (Math.hypot(ax - world.x, ay - world.y) < r) return true
      for (let i = 2; i < n.points.length; i += 2) {
        const bx = n.x + n.points[i] * n.w
        const by = n.y + n.points[i + 1] * n.h
        if (distToSegment(world.x, world.y, ax, ay, bx, by) < r) return true
        ax = bx
        ay = by
      }
      return false
    })
    if (!hits.length) return
    const store = getWorkspace()
    // una passata di gomma = un solo passo di cronologia
    const it = interRef.current
    if (it.kind === "erase" && !it.started) {
      store.snapshot(fileId)
      interRef.current = { kind: "erase", started: true }
    }
    store.removeSelection(
      fileId,
      hits.map((n) => n.id),
      []
    )
    // gli elementi tolti non devono essere colpiti di nuovo prima del
    // prossimo ridisegno
    const gone = new Set(hits.map((n) => n.id))
    dataRef.current = {
      ...dataRef.current,
      nodes: dataRef.current.nodes.filter((n) => !gone.has(n.id)),
    }
  }

  /* ------------------------------- due dita ------------------------------ */

  const cancelLongPress = () => {
    if (longPress.current) clearTimeout(longPress.current.timer)
    longPress.current = null
  }

  /**
   * Il secondo dito annulla quello che il primo aveva cominciato (una
   * selezione, uno spostamento) e passa a pan e zoom.
   */
  const startPinch = () => {
    const [a, b] = [...touches.current.values()]
    if (!a || !b) return
    const it = interRef.current
    if (it.kind === "move" && it.moved) {
      getWorkspace().mutateBoard(fileId, (d) => {
        d.nodes = d.nodes.map((n) => {
          const o = it.orig.get(n.id)
          return o ? { ...n, x: o.x, y: o.y } : n
        })
      })
    }
    cancelLongPress()
    begin({
      kind: "pinch",
      dist: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
      vp: vpRef.current,
    })
    setOverlay({})
  }

  const onRootPointerDownCapture = (e: React.PointerEvent) => {
    if (e.pointerType !== "touch") return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (touches.current.size >= 2) {
      // i gestori degli elementi non devono cominciare niente
      e.stopPropagation()
      e.preventDefault()
      startPinch()
      return
    }
    cancelLongPress()
    const target = e.target as Element
    const x = e.clientX
    const y = e.clientY
    longPress.current = {
      x,
      y,
      timer: setTimeout(() => {
        longPress.current = null
        if (touches.current.size !== 1) return
        const it = interRef.current
        if (it.kind === "move" && it.moved) return
        end()
        const nodeId = target
          .closest("[data-node-id]")
          ?.getAttribute("data-node-id")
        const edgeId = target
          .closest("[data-edge-id]")
          ?.getAttribute("data-edge-id")
        if (nodeId && !selRef.current.nodes.includes(nodeId)) {
          setSelection({ nodes: [nodeId], edges: [] })
        }
        navigator.vibrate?.(10)
        setMenu(
          nodeId
            ? { type: "node", id: nodeId, x, y }
            : edgeId
              ? { type: "edge", id: edgeId, x, y }
              : { type: "canvas", x, y }
        )
      }, LONG_PRESS_MS),
    }
  }

  const onTouchMove = React.useEffectEvent((e: PointerEvent) => {
    if (!touches.current.has(e.pointerId)) return
    touches.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const lp = longPress.current
    if (
      lp &&
      Math.hypot(e.clientX - lp.x, e.clientY - lp.y) > LONG_PRESS_SLOP
    ) {
      cancelLongPress()
    }
  })

  const onTouchEnd = React.useEffectEvent((e: PointerEvent) => {
    if (!touches.current.delete(e.pointerId)) return
    cancelLongPress()
    if (interRef.current.kind === "pinch" && touches.current.size < 2) end()
  })

  // sempre in ascolto: le dita vanno contate anche quando nessuna
  // interazione è in corso, o un tocco perso farebbe scattare un pinch
  React.useEffect(() => {
    const move = (e: PointerEvent) => onTouchMove(e)
    const up = (e: PointerEvent) => onTouchEnd(e)
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
      cancelLongPress()
    }
  }, [])

  /* ------------------------------ interazioni ---------------------------- */

  const onInteractionMove = React.useEffectEvent((e: PointerEvent) => {
    const it = interRef.current
    const store = getWorkspace()
    lastPointer.current = { x: e.clientX, y: e.clientY }

    if (it.kind === "pinch") {
      const [a, b] = [...touches.current.values()]
      const rect = ref.current?.getBoundingClientRect()
      if (!a || !b || !rect) return
      const dist = Math.max(1, Math.hypot(a.x - b.x, a.y - b.y))
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const zoom = clampZoom(it.vp.zoom * (dist / it.dist))
      // il punto del mondo sotto le dita all'inizio resta sotto le dita
      const wx = (it.mid.x - rect.left - it.vp.x) / it.vp.zoom
      const wy = (it.mid.y - rect.top - it.vp.y) / it.vp.zoom
      setVp({
        zoom,
        x: mid.x - rect.left - wx * zoom,
        y: mid.y - rect.top - wy * zoom,
      })
      return
    }

    if (e.pointerType === "touch" && touches.current.size >= 2) return
    const world = toWorld(e.clientX, e.clientY)

    if (it.kind === "pan") {
      setVp((v) => ({
        ...v,
        x: it.ox + (e.clientX - it.sx),
        y: it.oy + (e.clientY - it.sy),
      }))
      return
    }

    if (it.kind === "move") {
      let dx = world.x - it.start.x
      let dy = world.y - it.start.y
      let guides: Overlay["guides"] = undefined

      if (!e.altKey && it.orig.size === 1) {
        const [id] = [...it.orig.keys()]
        const n = dataRef.current.nodes.find((x) => x.id === id)
        const o = it.orig.get(id)!
        if (n) {
          const t = SNAP / vpRef.current.zoom
          const mx = [o.x + dx, o.x + dx + n.w / 2, o.x + dx + n.w]
          const my = [o.y + dy, o.y + dy + n.h / 2, o.y + dy + n.h]
          let bestX: {
            diff: number
            v: number
            span: [number, number]
          } | null = null
          let bestY: {
            diff: number
            v: number
            span: [number, number]
          } | null = null
          for (const other of dataRef.current.nodes) {
            if (it.orig.has(other.id) || other.kind === "draw") continue
            const ox = [other.x, other.x + other.w / 2, other.x + other.w]
            const oy = [other.y, other.y + other.h / 2, other.y + other.h]
            for (const a of mx)
              for (const b of ox) {
                const diff = b - a
                if (
                  Math.abs(diff) < t &&
                  (!bestX || Math.abs(diff) < Math.abs(bestX.diff))
                )
                  bestX = {
                    diff,
                    v: b,
                    span: [
                      Math.min(other.y, o.y + dy),
                      Math.max(other.y + other.h, o.y + dy + n.h),
                    ],
                  }
              }
            for (const a of my)
              for (const b of oy) {
                const diff = b - a
                if (
                  Math.abs(diff) < t &&
                  (!bestY || Math.abs(diff) < Math.abs(bestY.diff))
                )
                  bestY = {
                    diff,
                    v: b,
                    span: [
                      Math.min(other.x, o.x + dx),
                      Math.max(other.x + other.w, o.x + dx + n.w),
                    ],
                  }
              }
          }
          if (bestX) dx += bestX.diff
          if (bestY) dy += bestY.diff
          guides = {
            x: bestX?.v,
            ySpan: bestX?.span,
            y: bestY?.v,
            xSpan: bestY?.span,
          }
        }
      }

      if (!it.moved) {
        // la cronologia si registra solo al primo spostamento reale
        store.snapshot(fileId)
        it.moved = true
      }
      setOverlay((o) => ({ ...o, guides }))
      store.mutateBoard(fileId, (d) => {
        d.nodes = d.nodes.map((n) => {
          const o = it.orig.get(n.id)
          return o
            ? { ...n, x: Math.round(o.x + dx), y: Math.round(o.y + dy) }
            : n
        })
      })
      return
    }

    if (it.kind === "resize") {
      if (!it.started) {
        store.snapshot(fileId)
        it.started = true
      }
      const dx = world.x - it.start.x
      const dy = world.y - it.start.y
      let { x, y, w, h } = it.orig
      if (it.dir.includes("e")) w = it.orig.w + dx
      if (it.dir.includes("s")) h = it.orig.h + dy
      if (it.dir.includes("w")) {
        w = it.orig.w - dx
        x = it.orig.x + dx
      }
      if (it.dir.includes("n")) {
        h = it.orig.h - dy
        y = it.orig.y + dy
      }
      const minW = 20
      const minH = 14
      if (w < minW) {
        if (it.dir.includes("w")) x = it.orig.x + it.orig.w - minW
        w = minW
      }
      if (h < minH) {
        if (it.dir.includes("n")) y = it.orig.y + it.orig.h - minH
        h = minH
      }
      store.updateNode(fileId, it.id, {
        x: Math.round(x),
        y: Math.round(y),
        w: Math.round(w),
        h: Math.round(h),
      })
      return
    }

    if (it.kind === "marquee") {
      setOverlay({
        marquee: {
          x: Math.min(it.start.x, world.x),
          y: Math.min(it.start.y, world.y),
          w: Math.abs(world.x - it.start.x),
          h: Math.abs(world.y - it.start.y),
        },
      })
      return
    }

    if (it.kind === "place") {
      setOverlay({
        place: {
          x: Math.min(it.start.x, world.x),
          y: Math.min(it.start.y, world.y),
          w: Math.abs(world.x - it.start.x),
          h: Math.abs(world.y - it.start.y),
        },
      })
      return
    }

    if (it.kind === "draw") {
      const pts = it.points
      const n = pts.length
      const min = 2 / vpRef.current.zoom
      if (
        n < 2 ||
        Math.hypot(world.x - pts[n - 2], world.y - pts[n - 1]) > min
      ) {
        pts.push(world.x, world.y)
        setOverlay({ stroke: [...pts] })
      }
      return
    }

    if (it.kind === "erase") {
      eraseAt(world)
      return
    }

    if (it.kind === "connect") {
      const hit = hitNode(world, it.from)
      setOverlay({
        connect: {
          from: it.from,
          side: it.side,
          point: world,
          target: hit?.id ?? null,
        },
      })
    }
  })

  const onInteractionEnd = React.useEffectEvent((e: PointerEvent) => {
    const it = interRef.current
    // un pinch finisce quando si alza un dito (vedi onTouchEnd)
    if (it.kind === "pinch") return
    // il sistema ha interrotto il gesto (notifica, scroll del browser): si
    // chiude senza creare niente a metà
    if (e.type === "pointercancel") {
      end()
      return
    }
    const world = toWorld(e.clientX, e.clientY)
    const store = getWorkspace()

    if (it.kind === "marquee") {
      const m = {
        x: Math.min(it.start.x, world.x),
        y: Math.min(it.start.y, world.y),
        w: Math.abs(world.x - it.start.x),
        h: Math.abs(world.y - it.start.y),
      }
      if (m.w > 3 || m.h > 3) {
        const nodes = dataRef.current.nodes
          .filter(
            (n) =>
              n.x < m.x + m.w &&
              n.x + n.w > m.x &&
              n.y < m.y + m.h &&
              n.y + n.h > m.y
          )
          .map((n) => n.id)
        const nodeSet = new Set(nodes)
        const edges = dataRef.current.edges
          .filter((ed) => nodeSet.has(ed.from) && nodeSet.has(ed.to))
          .map((ed) => ed.id)
        setSelection((prev) =>
          it.additive
            ? {
                nodes: [...new Set([...prev.nodes, ...nodes])],
                edges: [...new Set([...prev.edges, ...edges])],
              }
            : { nodes, edges }
        )
      }
    }

    if (it.kind === "place") {
      const spec = placementSpec(tool)
      const w = Math.abs(world.x - it.start.x)
      const h = Math.abs(world.y - it.start.y)
      if (spec) {
        if (w < 8 || h < 8) {
          const item = makeItem(spec, dataRef.current.theme)
          createItem(spec, {
            x: it.start.x - item.w / 2,
            y: it.start.y - item.h / 2,
          })
        } else {
          createItem(spec, {
            x: Math.min(it.start.x, world.x),
            y: Math.min(it.start.y, world.y),
            w,
            h,
          })
        }
      }
    }

    if (it.kind === "draw") {
      finishStroke(it.points)
    }

    // un clic su un elemento (o su un suo pallino) senza trascinare non
    // collega niente: prima creava un elemento nuovo sopra quello di partenza,
    // o un collegamento con la sezione che lo contiene
    const dragged =
      it.kind === "connect" &&
      Math.hypot(e.clientX - it.sx, e.clientY - it.sy) > CLICK_SLOP
    if (it.kind === "connect" && dragged) {
      const hit = hitNode(world, it.from)
      store.snapshot(fileId)
      if (hit) {
        store.addEdge(fileId, {
          from: it.from,
          to: hit.id,
          fromSide: it.side,
        })
      } else {
        const th = dataRef.current.theme
        const size = SHAPE_SIZE[th.defaultShape]
        const newId = store.addNode(fileId, {
          ...makeItem({ kind: "shape", shape: th.defaultShape }, th),
          x: Math.round(world.x - size.w / 2),
          y: Math.round(world.y - size.h / 2),
        })
        store.addEdge(fileId, {
          from: it.from,
          to: newId,
          fromSide: it.side,
        })
        setSelection({ nodes: [newId], edges: [] })
        setEditingNode(newId)
      }
    }

    end()
  })

  React.useEffect(() => {
    if (interKind === "none") return
    // mouse e penne arrivano a 120-240 movimenti al secondo, più di quanti
    // fotogrammi lo schermo mostri: la board si aggiorna una volta per
    // fotogramma con l'ultima posizione. Il tratto a mano e la gomma ricevono
    // invece tutti i punti, per non perdere dettagli
    let frame = 0
    let queued: PointerEvent[] = []
    const flush = () => {
      frame = 0
      const events = queued
      queued = []
      const kind = interRef.current.kind
      if (kind === "draw" || kind === "erase") {
        for (const event of events) onInteractionMove(event)
      } else if (events.length) {
        onInteractionMove(events[events.length - 1])
      }
    }
    const move = (e: PointerEvent) => {
      queued.push(e)
      if (!frame) frame = requestAnimationFrame(flush)
    }
    const up = (e: PointerEvent) => {
      // l'ultimo movimento conta prima di chiudere il gesto
      if (frame) {
        cancelAnimationFrame(frame)
        flush()
      }
      onInteractionEnd(e)
    }
    window.addEventListener("pointermove", move)
    window.addEventListener("pointerup", up)
    window.addEventListener("pointercancel", up)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener("pointermove", move)
      window.removeEventListener("pointerup", up)
      window.removeEventListener("pointercancel", up)
    }
  }, [interKind])

  // una board nascosta (navigazione verso un'altra pagina) non resta a metà
  // di un trascinamento
  React.useLayoutEffect(() => {
    return () => {
      interRef.current = { kind: "none" }
      setInterKind("none")
      setOverlay({})
      setMenu(null)
      setSpace(false)
    }
  }, [])

  /* ------------------------------- tastiera ------------------------------ */

  const onKeyDown = React.useEffectEvent((e: KeyboardEvent) => {
    const typing = isTypingTarget(document.activeElement)
    if (e.code === "Space" && !typing) {
      // lo spazio su un pulsante lo preme: lì non si ruba
      const onButton = (document.activeElement as HTMLElement | null)?.closest(
        "button, [role='button'], [role='menuitem']"
      )
      if (!onButton) {
        setSpace(true)
        e.preventDefault()
      }
    }
    if (typing) return
    // un menu o una finestra aperti gestiscono da soli i loro tasti
    if (
      (document.activeElement as HTMLElement | null)?.closest(
        "[role='menu'], [role='dialog'], [role='listbox']"
      )
    )
      return
    const store = getWorkspace()
    const sel = selRef.current
    const mod = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()

    if (mod && key === "z") {
      e.preventDefault()
      if (e.shiftKey) store.redo(fileId)
      else store.undo(fileId)
      return
    }
    if (mod && key === "y") {
      e.preventDefault()
      store.redo(fileId)
      return
    }
    if (mod && key === "a") {
      e.preventDefault()
      setSelection({
        nodes: dataRef.current.nodes.map((n) => n.id),
        edges: dataRef.current.edges.map((ed) => ed.id),
      })
      return
    }
    if (mod && key === "d") {
      e.preventDefault()
      duplicateSelection()
      return
    }
    if (mod && key === "c") {
      copySelection()
      return
    }
    if (mod && key === "x") {
      copySelection(true)
      return
    }
    if (mod && e.key === "]") {
      e.preventDefault()
      if (!sel.nodes.length) return
      store.snapshot(fileId)
      store.reorder(fileId, sel.nodes, e.shiftKey ? "front" : "forward")
      return
    }
    if (mod && e.key === "[") {
      e.preventDefault()
      if (!sel.nodes.length) return
      store.snapshot(fileId)
      store.reorder(fileId, sel.nodes, e.shiftKey ? "back" : "backward")
      return
    }
    if (e.key === "Backspace" || e.key === "Delete") {
      if (sel.nodes.length || sel.edges.length) {
        e.preventDefault()
        store.snapshot(fileId)
        store.removeSelection(fileId, sel.nodes, sel.edges)
        setSelection({ nodes: [], edges: [] })
      }
      return
    }
    if (e.key === "Escape") {
      setSelection({ nodes: [], edges: [] })
      setEditingNode(null)
      setEditingEdge(null)
      setEditingCell(null)
      setMenu(null)
      setTool({ t: "select" })
      return
    }
    if (e.key === "Enter" && sel.nodes.length === 1) {
      const node = dataRef.current.nodes.find((n) => n.id === sel.nodes[0])
      if (!node || !hasEditableText(node)) return
      e.preventDefault()
      setEditingNode(node.id)
      return
    }
    if (e.key.startsWith("Arrow") && sel.nodes.length) {
      e.preventDefault()
      const step = e.shiftKey ? 10 : 1
      const dx =
        e.key === "ArrowLeft" ? -step : e.key === "ArrowRight" ? step : 0
      const dy = e.key === "ArrowUp" ? -step : e.key === "ArrowDown" ? step : 0
      // un passo di cronologia per ogni pressione, non per ogni ripetizione
      // del tasto tenuto giù
      if (!e.repeat) store.snapshot(fileId)
      store.mutateBoard(fileId, (d) => {
        const s = new Set(sel.nodes)
        d.nodes = d.nodes.map((n) =>
          s.has(n.id) && !n.locked ? { ...n, x: n.x + dx, y: n.y + dy } : n
        )
      })
      return
    }
    if (!mod && !e.altKey) {
      const map: Record<string, Tool> = {
        v: { t: "select" },
        h: { t: "hand" },
        r: { t: "shape", shape: "rounded" },
        o: { t: "shape", shape: "ellipse" },
        d: { t: "shape", shape: "diamond" },
        s: { t: "shape", shape: "note" },
        t: { t: "shape", shape: "text" },
        c: { t: "connect" },
        f: { t: "frame", frame: "plain" },
        g: { t: "section" },
        b: { t: "table" },
        k: { t: "chart" },
        p: { t: "draw", mode: "pen" },
        e: { t: "draw", mode: "eraser" },
      }
      const next = map[key]
      if (next) setTool(next)
    }
  })

  React.useEffect(() => {
    const down = (e: KeyboardEvent) => onKeyDown(e)
    const up = (e: KeyboardEvent) => {
      if (e.code === "Space") setSpace(false)
    }
    // tornando alla scheda dopo aver lasciato lo spazio altrove, la mano non
    // deve restare attiva
    const blur = () => setSpace(false)
    window.addEventListener("keydown", down)
    window.addEventListener("keyup", up)
    window.addEventListener("blur", blur)
    return () => {
      window.removeEventListener("keydown", down)
      window.removeEventListener("keyup", up)
      window.removeEventListener("blur", blur)
    }
  }, [])

  /* incolla dal sistema */
  const onPaste = React.useEffectEvent((e: ClipboardEvent) => {
    if (isTypingTarget(document.activeElement)) return
    const text = e.clipboardData?.getData("text/plain") ?? ""
    const payload = clipForPaste(text)
    const rect = ref.current?.getBoundingClientRect()
    const world = toWorld(
      lastPointer.current.x || (rect ? rect.left + rect.width / 2 : 400),
      lastPointer.current.y || (rect ? rect.top + rect.height / 2 : 300)
    )
    if (payload) {
      e.preventDefault()
      pasteAt(world, payload)
      return
    }
    if (text.trim()) {
      e.preventDefault()
      const store = getWorkspace()
      store.snapshot(fileId)
      const id = store.addNode(fileId, {
        ...makeItem({ kind: "shape", shape: "note" }, dataRef.current.theme),
        x: Math.round(world.x - 80),
        y: Math.round(world.y - 80),
        text: text.slice(0, 400),
      })
      setSelection({ nodes: [id], edges: [] })
    }
  })

  React.useEffect(() => {
    const listener = (e: ClipboardEvent) => onPaste(e)
    window.addEventListener("paste", listener)
    return () => window.removeEventListener("paste", listener)
  }, [])

  /* ------------------------------- handlers ------------------------------ */

  /**
   * Il menu contestuale vive in un portale, fuori dal canvas nella pagina ma
   * dentro nell'albero di React: i suoi eventi risalgono fino a qui. Il clic
   * su una voce chiudeva il menu già alla pressione, e la voce non faceva
   * niente. Si ascolta solo quello che succede davvero sul canvas.
   */
  const fromCanvas = (e: React.SyntheticEvent) =>
    e.currentTarget.contains(e.target as Node)

  const onCanvasPointerDown = (e: React.PointerEvent) => {
    if (!fromCanvas(e)) return
    setMenu(null)
    if (e.button === 1 || space || tool.t === "hand") {
      e.preventDefault()
      begin({ kind: "pan", sx: e.clientX, sy: e.clientY, ox: vp.x, oy: vp.y })
      return
    }
    if (e.button !== 0) return
    // Se un campo di modifica ha il fuoco NON va chiuso qui: il pointerdown
    // precede il blur, e togliendo il campo dal DOM il testo digitato andrebbe
    // perso. Ci pensa il blur del campo stesso a salvare e chiudere.
    if (!isEditingFieldFocused()) {
      setEditingNode(null)
      setEditingEdge(null)
      setEditingCell(null)
    }

    const world = toWorld(e.clientX, e.clientY)

    if (tool.t === "draw") {
      if (tool.mode === "eraser") {
        begin({ kind: "erase", started: false })
        eraseAt(world)
      } else {
        begin({ kind: "draw", points: [world.x, world.y] })
        setOverlay({ stroke: [world.x, world.y] })
      }
      return
    }

    if (placementSpec(tool)) {
      begin({ kind: "place", start: world })
      return
    }

    if (!e.shiftKey) setSelection({ nodes: [], edges: [] })
    begin({ kind: "marquee", start: world, additive: e.shiftKey })
  }

  const onNodePointerDown = useStableHandler(
    (node: BoardNode, e: React.PointerEvent) => {
      if (e.button !== 0) return
      if (space || tool.t === "hand") return
      e.stopPropagation()
      setMenu(null)

      if (tool.t === "connect") {
        begin({
          kind: "connect",
          from: node.id,
          side: "auto",
          sx: e.clientX,
          sy: e.clientY,
        })
        setOverlay({
          connect: {
            from: node.id,
            side: "auto",
            point: { x: node.x + node.w / 2, y: node.y + node.h / 2 },
            target: null,
          },
        })
        return
      }

      const sel = selRef.current
      let nodes = sel.nodes
      if (e.shiftKey) {
        nodes = sel.nodes.includes(node.id)
          ? sel.nodes.filter((i) => i !== node.id)
          : [...sel.nodes, node.id]
        setSelection({ nodes, edges: sel.edges })
      } else if (!sel.nodes.includes(node.id)) {
        nodes = [node.id]
        setSelection({ nodes, edges: [] })
      }

      // un elemento bloccato si può selezionare (per sbloccarlo) ma non trascinare
      if (node.locked || editingNode === node.id || editingCell?.id === node.id)
        return

      const orig = new Map<string, { x: number; y: number }>()
      for (const id of nodes) {
        const n = nodeById.get(id)
        if (!n || n.locked) continue
        orig.set(id, { x: n.x, y: n.y })
        if (isContainer(n)) {
          for (const child of childrenOf(n)) {
            if (!orig.has(child.id))
              orig.set(child.id, { x: child.x, y: child.y })
          }
        }
      }
      begin({
        kind: "move",
        start: toWorld(e.clientX, e.clientY),
        orig,
        moved: false,
      })
    }
  )

  const onConnectStart = useStableHandler(
    (node: BoardNode, side: Exclude<Side, "auto">, e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      begin({
        kind: "connect",
        from: node.id,
        side,
        sx: e.clientX,
        sy: e.clientY,
      })
      setOverlay({
        connect: {
          from: node.id,
          side,
          point: { x: node.x + node.w / 2, y: node.y + node.h / 2 },
          target: null,
        },
      })
    }
  )

  const onResizeStart = useStableHandler(
    (node: BoardNode, dir: ResizeDir, e: React.PointerEvent) => {
      e.stopPropagation()
      e.preventDefault()
      begin({
        kind: "resize",
        dir,
        id: node.id,
        orig: { x: node.x, y: node.y, w: node.w, h: node.h },
        start: toWorld(e.clientX, e.clientY),
        started: false,
      })
    }
  )

  const onNodeDoubleClick = useStableHandler(
    (node: BoardNode, e: React.MouseEvent) => {
      e.stopPropagation()
      if (node.kind === "table") {
        const cell = (e.target as HTMLElement).closest("[data-cell]")
        if (cell) {
          setEditingCell({
            id: node.id,
            index: Number(cell.getAttribute("data-cell")),
          })
          return
        }
      }
      if (!hasEditableText(node)) return
      setEditingNode(node.id)
    }
  )

  const openMenuAt = (state: MenuState, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    cancelLongPress()
    setMenu({ ...state, x: e.clientX, y: e.clientY })
  }

  // il tasto destro su un elemento non selezionato lo seleziona, come la
  // pressione prolungata: Copia, Taglia e Duplica lavorano sulla selezione,
  // e prima agivano su quello che era selezionato prima (o su niente)
  const onNodeContextMenu = useStableHandler(
    (node: BoardNode, e: React.MouseEvent) => {
      if (!selRef.current.nodes.includes(node.id)) {
        const next = { nodes: [node.id], edges: [] }
        selRef.current = next
        setSelection(next)
      }
      openMenuAt({ type: "node", id: node.id, x: 0, y: 0 }, e)
    }
  )

  const onNodeTextCommit = useStableHandler((node: BoardNode, v: string) => {
    const store = getWorkspace()
    const emptyText =
      node.kind === "shape" &&
      node.shape === "text" &&
      !v.trim() &&
      !node.text.trim()
    if (emptyText) {
      // un testo vuoto sarebbe un elemento invisibile: si elimina
      store.removeSelection(fileId, [node.id], [])
      setSelection({ nodes: [], edges: [] })
    } else if (v !== node.text) {
      store.snapshot(fileId)
      store.updateNode(fileId, node.id, { text: v })
    }
    setEditingNode(null)
  })

  const onNodeCellCommit = useStableHandler(
    (node: BoardNode, index: number, value: string) => {
      const t = node.table
      if (t) {
        const row = Math.floor(index / t.cols)
        const col = index % t.cols
        if (tableCellValue(node, row, col) !== value) {
          const store = getWorkspace()
          store.snapshot(fileId)
          store.updateNode(fileId, node.id, {
            table: setTableCell(t, row, col, value),
          })
        }
      }
      setEditingCell(null)
    }
  )

  const onEdgePointerDown = useStableHandler(
    (edge: BoardEdge, e: React.PointerEvent) => {
      if (e.button !== 0 || space || tool.t === "hand") return
      e.stopPropagation()
      setMenu(null)
      setSelection((prev) =>
        e.shiftKey
          ? {
              nodes: prev.nodes,
              edges: [...new Set([...prev.edges, edge.id])],
            }
          : { nodes: [], edges: [edge.id] }
      )
    }
  )

  const onEdgeContextMenu = useStableHandler(
    (edge: BoardEdge, e: React.MouseEvent) => {
      if (!selRef.current.edges.includes(edge.id)) {
        const next = { nodes: [], edges: [edge.id] }
        selRef.current = next
        setSelection(next)
      }
      openMenuAt({ type: "edge", id: edge.id, x: 0, y: 0 }, e)
    }
  )

  const onEdgeDoubleClick = useStableHandler(
    (edge: BoardEdge, e: React.MouseEvent) => {
      e.stopPropagation()
      setEditingEdge(edge.id)
    }
  )

  const onEdgeLabelCommit = useStableHandler((edge: BoardEdge, v: string) => {
    if (v !== edge.label) {
      const store = getWorkspace()
      store.snapshot(fileId)
      store.updateEdge(fileId, edge.id, { label: v })
    }
    setEditingEdge(null)
  })

  const onEdgeLabelCancel = useStableHandler(() => setEditingEdge(null))

  /* -------------------------------- sfondo ------------------------------- */

  const darkCanvas = isDarkColor(background)
  const patternColor = rgba(
    darkCanvas ? "#ffffff" : whim.base[600],
    0.42 * theme.patternOpacity
  )
  const gridSize = 24 * vp.zoom
  // con una pagina impostata, l'area esterna è la "scrivania": un tono più spento
  const desk = page
    ? `color-mix(in srgb, ${background} 88%, ${darkCanvas ? "#ffffff" : "#000000"})`
    : background
  const bgStyle: React.CSSProperties = { backgroundColor: desk }
  if (theme.pattern !== "plain") {
    if (theme.pattern === "dots") {
      bgStyle.backgroundImage = `radial-gradient(circle at 1px 1px, ${patternColor} ${Math.max(0.8, 1.2 * vp.zoom)}px, transparent 0)`
    } else if (theme.pattern === "grid") {
      bgStyle.backgroundImage = `linear-gradient(${patternColor} 1px, transparent 1px), linear-gradient(90deg, ${patternColor} 1px, transparent 1px)`
    } else if (theme.pattern === "lines") {
      bgStyle.backgroundImage = `linear-gradient(${patternColor} 1px, transparent 1px)`
    } else if (theme.pattern === "cross") {
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><path d="M12 8.5v7M8.5 12h7" stroke="${patternColor}" stroke-width="1.2" stroke-linecap="round"/></svg>`
      bgStyle.backgroundImage = `url("data:image/svg+xml,${encodeURIComponent(svg)}")`
    }
    bgStyle.backgroundSize = `${gridSize}px ${gridSize}px`
    bgStyle.backgroundPosition = `${vp.x}px ${vp.y}px`
  }

  const cursor =
    interKind === "pan"
      ? "grabbing"
      : space || tool.t === "hand"
        ? "grab"
        : tool.t === "draw"
          ? "crosshair"
          : placementSpec(tool) || tool.t === "connect"
            ? "crosshair"
            : "default"

  const connectFrom = overlay.connect
    ? nodeById.get(overlay.connect.from)
    : undefined
  const connectTarget = overlay.connect?.target
    ? nodeById.get(overlay.connect.target)
    : undefined
  const ghost =
    connectFrom && overlay.connect
      ? buildEdgeToPoint(
          connectFrom,
          connectTarget
            ? {
                x: connectTarget.x + connectTarget.w / 2,
                y: connectTarget.y + connectTarget.h / 2,
              }
            : overlay.connect.point,
          theme.arrows.routing,
          overlay.connect.side,
          theme.arrows.cornerRadius
        )
      : null

  const selNodes = new Set(selection.nodes)
  const selEdges = new Set(selection.edges)
  const interactive = tool.t === "select" || tool.t === "connect"
  const handlesAllowed =
    tool.t === "select" && interKind === "none" && selection.nodes.length <= 1
  const resizeAllowed = tool.t === "select" && selection.nodes.length === 1

  const nodeView = (node: BoardNode) => (
    <NodeView
      key={node.id}
      node={node}
      theme={theme}
      zoom={vp.zoom}
      selected={selNodes.has(node.id)}
      editing={editingNode === node.id}
      editingCell={editingCell?.id === node.id ? editingCell.index : null}
      interactive={interactive}
      showHandles={handlesAllowed && editingNode !== node.id}
      showResize={
        resizeAllowed && selNodes.has(node.id) && editingNode !== node.id
      }
      onPointerDown={onNodePointerDown}
      onDoubleClick={onNodeDoubleClick}
      onContextMenu={onNodeContextMenu}
      onTextCommit={onNodeTextCommit}
      onCellCommit={onNodeCellCommit}
      onConnectStart={onConnectStart}
      onResizeStart={onResizeStart}
    />
  )

  return (
    <div
      ref={ref}
      className="relative h-full w-full touch-none overflow-hidden overscroll-none [-webkit-touch-callout:none]"
      style={{ ...bgStyle, cursor }}
      onPointerDownCapture={(e) => {
        if (fromCanvas(e)) onRootPointerDownCapture(e)
      }}
      onPointerDown={onCanvasPointerDown}
      onPointerMove={(e) => {
        if (fromCanvas(e)) lastPointer.current = { x: e.clientX, y: e.clientY }
      }}
      onContextMenu={(e) => {
        if (fromCanvas(e)) openMenuAt({ type: "canvas", x: 0, y: 0 }, e)
      }}
      onDoubleClick={(e) => {
        if (e.target !== e.currentTarget) return
        const w = toWorld(e.clientX, e.clientY)
        const item = makeItem(
          { kind: "shape", shape: theme.defaultShape },
          theme
        )
        createItem(
          { kind: "shape", shape: theme.defaultShape },
          { x: w.x - item.w / 2, y: w.y - item.h / 2 }
        )
      }}
    >
      {page ? (
        <svg
          data-layer="page"
          className="absolute inset-0 h-full w-full"
          style={{ pointerEvents: "none" }}
        >
          <g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
            <rect
              x={0}
              y={0}
              width={page.w}
              height={page.h}
              fill={background}
              stroke={rgba(darkCanvas ? "#ffffff" : whim.base[900], 0.16)}
              strokeWidth={1 / vp.zoom}
              style={{
                filter: `drop-shadow(0 ${8 / vp.zoom}px ${24 / vp.zoom}px ${rgba(whim.base[900], 0.22)})`,
              }}
            />
            <text
              x={0}
              y={-10 / vp.zoom}
              fontSize={12 / vp.zoom}
              fontFamily="var(--font-inter), sans-serif"
              fill={rgba(darkCanvas ? "#ffffff" : whim.base[900], 0.45)}
            >
              {formatLabel(theme.page.format, theme.page.orientation)}
            </text>
          </g>
        </svg>
      ) : null}

      {/* sezioni e frame sotto ai connettori: prima li coprivano, e un
          connettore dentro una sezione non si poteva né cliccare né
          selezionare (nella board d'esempio nessuno) */}
      <div
        data-layer="containers"
        className="absolute inset-0"
        style={{
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
        }}
      >
        {containers.map(nodeView)}
      </div>

      <svg
        data-layer="edges"
        className="absolute inset-0 h-full w-full"
        style={{ pointerEvents: "none" }}
      >
        <g transform={`translate(${vp.x} ${vp.y}) scale(${vp.zoom})`}>
          {data.edges.map((edge) => {
            const from = nodeById.get(edge.from)
            const to = nodeById.get(edge.to)
            if (!from || !to) return null
            return (
              <EdgeView
                key={edge.id}
                edge={edge}
                from={from}
                to={to}
                theme={theme}
                background={background}
                selected={selEdges.has(edge.id)}
                editing={editingEdge === edge.id}
                onPointerDown={onEdgePointerDown}
                onContextMenu={onEdgeContextMenu}
                onDoubleClick={onEdgeDoubleClick}
                onLabelCommit={onEdgeLabelCommit}
                onLabelCancel={onEdgeLabelCancel}
              />
            )
          })}

          {ghost ? (
            <g>
              <path
                d={ghost.d}
                fill="none"
                stroke={SELECT_COLOR}
                strokeWidth={2}
                strokeDasharray="6 5"
                strokeLinecap="round"
              />
              {connectTarget ? null : (
                <circle
                  cx={ghost.end.x}
                  cy={ghost.end.y}
                  r={4}
                  fill={SELECT_COLOR}
                />
              )}
            </g>
          ) : null}

          {connectTarget ? (
            <rect
              x={connectTarget.x - 3}
              y={connectTarget.y - 3}
              width={connectTarget.w + 6}
              height={connectTarget.h + 6}
              rx={(connectTarget.radius ?? theme.cornerRadius) + 3}
              fill="none"
              stroke={SELECT_COLOR}
              strokeWidth={2}
            />
          ) : null}

          {overlay.guides?.x !== undefined ? (
            <line
              x1={overlay.guides.x}
              x2={overlay.guides.x}
              y1={(overlay.guides.ySpan?.[0] ?? 0) - 20}
              y2={(overlay.guides.ySpan?.[1] ?? 0) + 20}
              stroke={whim.pink[400]}
              strokeWidth={1 / vp.zoom}
            />
          ) : null}
          {overlay.guides?.y !== undefined ? (
            <line
              y1={overlay.guides.y}
              y2={overlay.guides.y}
              x1={(overlay.guides.xSpan?.[0] ?? 0) - 20}
              x2={(overlay.guides.xSpan?.[1] ?? 0) + 20}
              stroke={whim.pink[400]}
              strokeWidth={1 / vp.zoom}
            />
          ) : null}

          {overlay.marquee ? (
            <rect
              x={overlay.marquee.x}
              y={overlay.marquee.y}
              width={overlay.marquee.w}
              height={overlay.marquee.h}
              fill={rgba(SELECT_COLOR, 0.08)}
              stroke={SELECT_COLOR}
              strokeWidth={1 / vp.zoom}
            />
          ) : null}

          {overlay.place ? (
            <rect
              x={overlay.place.x}
              y={overlay.place.y}
              width={overlay.place.w}
              height={overlay.place.h}
              fill={rgba(SELECT_COLOR, 0.06)}
              stroke={SELECT_COLOR}
              strokeWidth={1.5 / vp.zoom}
              strokeDasharray={`${6 / vp.zoom} ${4 / vp.zoom}`}
              rx={theme.cornerRadius}
            />
          ) : null}

          {overlay.stroke && overlay.stroke.length >= 4 ? (
            <StrokePreview
              points={overlay.stroke}
              highlighter={tool.t === "draw" && tool.mode === "highlighter"}
              color={theme.arrows.color}
            />
          ) : null}
        </g>
      </svg>

      <div
        data-layer="nodes"
        className="absolute inset-0"
        style={{
          transform: `translate(${vp.x}px, ${vp.y}px) scale(${vp.zoom})`,
          transformOrigin: "0 0",
          pointerEvents: "none",
        }}
      >
        {others.map(nodeView)}
      </div>

      <BoardContextMenu
        state={menu}
        onClose={() => setMenu(null)}
        fileId={fileId}
        data={data}
        selection={selection}
        setSelection={setSelection}
        onCopy={() => copySelection()}
        onCut={() => copySelection(true)}
        onPaste={() => pasteAt(toWorld(menu?.x ?? 0, menu?.y ?? 0))}
        onDuplicate={duplicateSelection}
        onEditText={(id) => setEditingNode(id)}
        worldAt={(cx, cy) => toWorld(cx, cy)}
      />
    </div>
  )
}

/** Il tratto a mano libera mentre lo si disegna */
function StrokePreview({
  points,
  highlighter,
  color,
}: {
  points: number[]
  highlighter: boolean
  color: string
}) {
  let minX = Infinity
  let minY = Infinity
  let maxX = -Infinity
  let maxY = -Infinity
  for (let i = 0; i < points.length; i += 2) {
    minX = Math.min(minX, points[i])
    maxX = Math.max(maxX, points[i])
    minY = Math.min(minY, points[i + 1])
    maxY = Math.max(maxY, points[i + 1])
  }
  const w = Math.max(maxX - minX, 1)
  const h = Math.max(maxY - minY, 1)
  const norm: number[] = []
  for (let i = 0; i < points.length; i += 2)
    norm.push((points[i] - minX) / w, (points[i + 1] - minY) / h)
  return (
    <g transform={`translate(${minX} ${minY})`}>
      <path
        d={drawPath(norm, w, h)}
        fill="none"
        stroke={highlighter ? whim.yellow[400] : color}
        strokeOpacity={highlighter ? 0.45 : 1}
        strokeWidth={highlighter ? 16 : 3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </g>
  )
}

function tableCellValue(node: BoardNode, row: number, col: number) {
  return node.table?.cells[row * (node.table?.cols ?? 1) + col] ?? ""
}

export { MIN_ZOOM, MAX_ZOOM }
