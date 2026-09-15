"use client"

import * as React from "react"
import { nanoid } from "nanoid"
import { getWorkspace, useStore } from "@/lib/store"
import {
  DEFAULT_PENS,
  hitStroke,
  readPens,
  recognizeShape,
  savePens,
  subscribePens,
  strokeLength,
  strokePath,
  thinPoints,
  type Pen,
  type PenKind,
} from "@/lib/ink"
import type { InkStroke } from "@/lib/types"

export type InkTool = "select" | "draw" | "eraser"

export type InkController = {
  tool: InkTool
  setTool: (tool: InkTool) => void
  pens: Pen[]
  activePen: string
  selectPen: (id: string) => void
  updatePen: (id: string, patch: Partial<Pen>) => void
  addPen: (kind: PenKind) => void
  removePen: (id: string) => void
  resetPens: () => void
  /** «Disegna con tocco»: il dito disegna invece di scorrere */
  touchDraw: boolean
  setTouchDraw: (value: boolean) => void
  /** «Da input penna a forma» */
  toShape: boolean
  setToShape: (value: boolean) => void
  strokes: InkStroke[]
  canUndo: boolean
  undo: () => void
  clear: () => void
  replaying: boolean
  replay: () => void
  /** cambia i tratti tenendo il passo per «Annulla» */
  commit: (fn: (ink: InkStroke[]) => InkStroke[]) => void
}

const NO_INK: InkStroke[] = []

/** Stato della scheda Disegno per un documento */
export function useInk(fileId: string): InkController {
  const strokes = useStore((s) => {
    const f = s.files.find((x) => x.id === fileId)
    return f && f.kind === "doc" ? (f.data.ink ?? NO_INK) : NO_INK
  })
  const [tool, setTool] = React.useState<InkTool>("select")
  const pens = React.useSyncExternalStore(
    subscribePens,
    readPens,
    () => DEFAULT_PENS
  )
  const [chosenPen, setActivePen] = React.useState(DEFAULT_PENS[0].id)
  const activePen = pens.some((p) => p.id === chosenPen)
    ? chosenPen
    : pens[0].id
  const [touchDraw, setTouchDraw] = React.useState(false)
  const [toShape, setToShape] = React.useState(false)
  const [history, setHistory] = React.useState<InkStroke[][]>([])
  const [replaying, setReplaying] = React.useState(false)

  const setPens = savePens

  const update = (fn: (ink: InkStroke[]) => InkStroke[]) => {
    const current = getWorkspace().files.find(
      (f) => f.id === fileId && f.kind === "doc"
    )
    const before =
      current && current.kind === "doc" ? (current.data.ink ?? NO_INK) : NO_INK
    setHistory((h) => [...h.slice(-49), before])
    getWorkspace().updateDocInk(fileId, fn)
  }

  // ⎋ torna alla selezione del testo, come in Word
  React.useEffect(() => {
    if (tool === "select") return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setTool("select")
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [tool])

  return {
    tool,
    setTool,
    pens,
    activePen,
    selectPen: (id) => {
      setActivePen(id)
      setTool("draw")
    },
    updatePen: (id, patch) =>
      setPens(pens.map((p) => (p.id === id ? { ...p, ...patch } : p))),
    addPen: (kind) => {
      const base = DEFAULT_PENS.find((p) => p.kind === kind) ?? DEFAULT_PENS[0]
      const pen = { ...base, id: `${kind}-${nanoid(6)}` }
      setPens([...pens, pen])
      setActivePen(pen.id)
      setTool("draw")
    },
    removePen: (id) => {
      const next = pens.filter((p) => p.id !== id)
      setPens(next.length ? next : DEFAULT_PENS)
      if (activePen === id) setActivePen((next[0] ?? DEFAULT_PENS[0]).id)
    },
    resetPens: () => {
      setPens(DEFAULT_PENS)
      setActivePen(DEFAULT_PENS[0].id)
    },
    touchDraw,
    setTouchDraw,
    toShape,
    setToShape,
    strokes,
    canUndo: history.length > 0,
    undo: () => {
      const previous = history[history.length - 1]
      if (!previous) return
      setHistory(history.slice(0, -1))
      getWorkspace().updateDocInk(fileId, () => previous)
    },
    clear: () => {
      if (strokes.length) update(() => [])
    },
    replaying,
    replay: () => {
      if (!strokes.length) return
      setReplaying(true)
      const total = strokes.reduce((t, s) => t + replayDuration(s) + 60, 0)
      window.setTimeout(() => setReplaying(false), total + 300)
    },
    commit: update,
  }
}

const replayDuration = (stroke: InkStroke) =>
  Math.max(160, Math.min(1400, strokeLength(stroke.points) * 1.6))

/**
 * Il livello dei disegni sopra al foglio. Con la selezione attiva lascia
 * passare i clic al testo; con una penna o la gomma prende il puntatore.
 */
export function InkLayer({
  ink,
  visible,
  paperDark,
}: {
  ink: InkController
  visible: boolean
  paperDark: boolean
}) {
  const filterId = React.useId().replace(/:/g, "")
  const svgRef = React.useRef<SVGSVGElement>(null)
  const points = React.useRef<number[]>([])
  const drawing = React.useRef(false)
  const [draft, setDraft] = React.useState<number[] | null>(null)
  const frame = React.useRef(0)
  const pen = ink.pens.find((p) => p.id === ink.activePen) ?? ink.pens[0]
  const active = ink.tool !== "select" && visible
  const commit = ink.commit
  // nella riproduzione ogni tratto parte quando finisce il precedente
  const delays = ink.strokes.map((_, i) =>
    ink.strokes
      .slice(0, i)
      .reduce((total, s) => total + replayDuration(s) + 60, 0)
  )

  const toSheet = (e: { clientX: number; clientY: number }) => {
    const el = svgRef.current
    if (!el) return [0, 0] as const
    const rect = el.getBoundingClientRect()
    const scale = rect.width / (el.clientWidth || rect.width || 1)
    return [
      (e.clientX - rect.left) / scale,
      (e.clientY - rect.top) / scale,
    ] as const
  }

  const erase = (x: number, y: number) => {
    const hit = ink.strokes.filter((s) => hitStroke(s, x, y, 8))
    if (!hit.length) return
    const ids = new Set(hit.map((s) => s.id))
    commit((list) => list.filter((s) => !ids.has(s.id)))
  }

  const schedule = () => {
    if (frame.current) return
    frame.current = requestAnimationFrame(() => {
      frame.current = 0
      setDraft([...points.current])
    })
  }

  if (!visible) return null

  return (
    <svg
      ref={svgRef}
      data-ink=""
      className="absolute inset-0 size-full overflow-visible"
      style={{
        zIndex: 6,
        pointerEvents: active ? "auto" : "none",
        touchAction:
          active && ink.touchDraw ? "none" : "pan-x pan-y pinch-zoom",
        cursor:
          ink.tool === "eraser"
            ? "cell"
            : ink.tool === "draw"
              ? "crosshair"
              : undefined,
      }}
      onPointerDown={(e) => {
        if (!active || e.button !== 0) return
        if (e.pointerType === "touch" && !ink.touchDraw) return
        e.preventDefault()
        e.currentTarget.setPointerCapture(e.pointerId)
        drawing.current = true
        const [x, y] = toSheet(e)
        if (ink.tool === "eraser") {
          erase(x, y)
          return
        }
        points.current = [x, y]
        setDraft([x, y])
      }}
      onPointerMove={(e) => {
        if (!drawing.current) return
        const events = e.nativeEvent.getCoalescedEvents?.() ?? [e.nativeEvent]
        if (ink.tool === "eraser") {
          const [x, y] = toSheet(e)
          erase(x, y)
          return
        }
        for (const ev of events) {
          const [x, y] = toSheet(ev)
          points.current.push(x, y)
        }
        schedule()
      }}
      onPointerUp={() => {
        if (!drawing.current) return
        drawing.current = false
        if (ink.tool !== "draw" || !pen) return
        let pts = thinPoints(points.current)
        if (ink.toShape) pts = recognizeShape(pts) ?? pts
        points.current = []
        setDraft(null)
        if (!pts.length) return
        const stroke: InkStroke = {
          id: nanoid(8),
          points: pts,
          color: pen.color,
          width: pen.width,
          highlighter: pen.kind === "highlighter",
          pencil: pen.kind === "pencil" || undefined,
        }
        commit((list) => [...list, stroke])
      }}
      onPointerCancel={() => {
        drawing.current = false
        points.current = []
        setDraft(null)
      }}
    >
      <defs>
        <filter id={`${filterId}-pencil`}>
          <feTurbulence
            type="fractalNoise"
            baseFrequency="1.2"
            numOctaves="1"
            result="noise"
          />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="1.4" />
        </filter>
      </defs>
      {ink.strokes.map((stroke, i) => (
        <StrokePath
          key={stroke.id}
          stroke={stroke}
          filter={`${filterId}-pencil`}
          paperDark={paperDark}
          style={
            ink.replaying
              ? {
                  strokeDasharray: 1,
                  strokeDashoffset: 1,
                  animation: `ink-draw ${replayDuration(stroke)}ms linear ${delays[i]}ms forwards`,
                }
              : undefined
          }
        />
      ))}
      {draft && pen ? (
        <StrokePath
          stroke={{
            id: "draft",
            points: draft,
            color: pen.color,
            width: pen.width,
            highlighter: pen.kind === "highlighter",
            pencil: pen.kind === "pencil",
          }}
          filter={`${filterId}-pencil`}
          paperDark={paperDark}
        />
      ) : null}
    </svg>
  )
}

function StrokePath({
  stroke,
  filter,
  paperDark,
  style,
}: {
  stroke: InkStroke
  filter: string
  paperDark: boolean
  style?: React.CSSProperties
}) {
  return (
    <path
      d={strokePath(stroke.points)}
      pathLength={1}
      fill="none"
      stroke={stroke.color}
      strokeWidth={stroke.width}
      strokeLinecap={stroke.highlighter ? "square" : "round"}
      strokeLinejoin="round"
      opacity={stroke.highlighter ? 0.42 : stroke.pencil ? 0.85 : 1}
      filter={stroke.pencil ? `url(#${filter})` : undefined}
      style={{
        // l'evidenziatore colora il testo senza coprirlo
        mixBlendMode: stroke.highlighter
          ? paperDark
            ? "screen"
            : "multiply"
          : undefined,
        ...style,
      }}
    />
  )
}
