"use client"

import * as React from "react"
import { Eraser, Undo2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { AddinApi } from "./api"

type Point = { x: number; y: number; p: number }

const INKS = [
  { value: "#111827", label: "Nero" },
  { value: "#1d4ed8", label: "Blu" },
  { value: "#0f766e", label: "Verde petrolio" },
]

/** Il tratto disegnato, liscio: curve che passano per i punti medi */
function drawStroke(
  ctx: CanvasRenderingContext2D,
  points: Point[],
  color: string,
  width: number,
  scale: number
) {
  if (!points.length) return
  ctx.strokeStyle = color
  ctx.fillStyle = color
  ctx.lineCap = "round"
  ctx.lineJoin = "round"
  if (points.length < 3) {
    const p = points[0]!
    ctx.beginPath()
    ctx.arc(p.x * scale, p.y * scale, (width * scale) / 2, 0, Math.PI * 2)
    ctx.fill()
    return
  }
  for (let i = 1; i < points.length - 1; i += 1) {
    const a = points[i - 1]!
    const b = points[i]!
    const c = points[i + 1]!
    ctx.beginPath()
    ctx.lineWidth = width * scale * (0.55 + b.p * 0.9)
    ctx.moveTo(((a.x + b.x) / 2) * scale, ((a.y + b.y) / 2) * scale)
    ctx.quadraticCurveTo(
      b.x * scale,
      b.y * scale,
      ((b.x + c.x) / 2) * scale,
      ((b.y + c.y) / 2) * scale
    )
    ctx.stroke()
  }
}

/** Ritaglia l'immagine sul tratto, con un po' di margine */
function trimmed(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const { width, height } = canvas
  const data = ctx.getImageData(0, 0, width, height).data
  let minX = width
  let minY = height
  let maxX = -1
  let maxY = -1
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3]! > 8) {
        if (x < minX) minX = x
        if (x > maxX) maxX = x
        if (y < minY) minY = y
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return null
  const pad = 12
  const out = document.createElement("canvas")
  out.width = maxX - minX + pad * 2
  out.height = maxY - minY + pad * 2
  out
    .getContext("2d")
    ?.drawImage(
      canvas,
      minX - pad,
      minY - pad,
      out.width,
      out.height,
      0,
      0,
      out.width,
      out.height
    )
  return out.toDataURL("image/png")
}

export function SignatureAddin({ api }: { api: AddinApi }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [strokes, setStrokes] = React.useState<Point[][]>([])
  const current = React.useRef<Point[] | null>(null)
  const [ink, setInk] = React.useState(INKS[0]!.value)
  const [thickness, setThickness] = React.useState(3)
  const [width, setWidth] = React.useState(35)
  const scale = 2

  const redraw = React.useCallback(
    (list: Point[][], extra?: Point[]) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext("2d")
      if (!canvas || !ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      for (const stroke of extra ? [...list, extra] : list) {
        drawStroke(ctx, stroke, ink, thickness, scale)
      }
    },
    [ink, thickness]
  )

  React.useEffect(() => {
    redraw(strokes)
  }, [strokes, redraw])

  const point = (e: React.PointerEvent<HTMLCanvasElement>): Point => {
    const rect = e.currentTarget.getBoundingClientRect()
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
      p: e.pointerType === "pen" && e.pressure ? e.pressure : 0.5,
    }
  }

  return (
    <div className="space-y-3 p-3">
      <p className="text-xs text-muted-foreground">
        Firma nel riquadro con il mouse, il dito o la penna.
      </p>
      <canvas
        ref={canvasRef}
        width={320 * scale}
        height={160 * scale}
        aria-label="Riquadro della firma"
        data-testid="signature-canvas"
        className="h-40 w-full touch-none rounded-lg border border-dashed border-border bg-white"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId)
          current.current = [point(e)]
        }}
        onPointerMove={(e) => {
          if (!current.current) return
          current.current.push(point(e))
          redraw(strokes, current.current)
        }}
        onPointerUp={() => {
          const stroke = current.current
          current.current = null
          if (stroke) setStrokes((s) => [...s, stroke])
        }}
      />
      <div className="flex items-center gap-2">
        {INKS.map((c) => (
          <button
            key={c.value}
            type="button"
            title={c.label}
            aria-label={`Inchiostro ${c.label.toLowerCase()}`}
            onClick={() => setInk(c.value)}
            className={cn(
              "size-6 rounded-full ring-offset-2 ring-offset-background",
              ink === c.value && "ring-2 ring-primary"
            )}
            style={{ background: c.value }}
          />
        ))}
        <label className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          Tratto
          <input
            type="range"
            min={1}
            max={8}
            value={thickness}
            onChange={(e) => setThickness(Number(e.target.value))}
            className="w-20"
          />
        </label>
      </div>
      <div className="flex gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={!strokes.length}
          onClick={() => setStrokes((s) => s.slice(0, -1))}
        >
          <Undo2 className="size-3.5" /> Annulla tratto
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="flex-1"
          disabled={!strokes.length}
          onClick={() => setStrokes([])}
        >
          <Eraser className="size-3.5" /> Cancella
        </Button>
      </div>
      <label className="block space-y-1">
        <span className="flex justify-between text-xs font-medium text-muted-foreground">
          Larghezza nel documento <span className="tabular-nums">{width}%</span>
        </span>
        <input
          type="range"
          min={10}
          max={80}
          value={width}
          onChange={(e) => setWidth(Number(e.target.value))}
          className="w-full"
        />
      </label>
      <Button
        type="button"
        className="w-full"
        disabled={!strokes.length}
        onClick={() => {
          const canvas = canvasRef.current
          const src = canvas ? trimmed(canvas) : null
          if (src) api.insertImage(src, "Firma", `${width}%`)
        }}
      >
        Inserisci firma
      </Button>
    </div>
  )
}
