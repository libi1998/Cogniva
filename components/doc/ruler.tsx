"use client"

import * as React from "react"
import { clampMargin, type MarginSide } from "@/lib/types"

/** pixel CSS in un centimetro */
const CM = 96 / 2.54
/** spessore del righello */
export const RULER_SIZE = 22

type Axis = "horizontal" | "vertical"

/**
 * Righello in stile Word: tacche ogni mezzo centimetro, numeri ogni centimetro
 * contati dal margine, e una maniglia per lato da trascinare.
 *
 * Lo stesso componente disegna quello in alto (margini sinistro e destro) e
 * quello di fianco (margini superiore e inferiore).
 */
export function Ruler({
  axis,
  length,
  start,
  end,
  onMargin,
}: {
  axis: Axis
  /** lunghezza del foglio lungo questo asse, in pixel */
  length: number
  /** margine iniziale: sinistro in orizzontale, superiore in verticale */
  start: number
  /** margine finale: destro in orizzontale, inferiore in verticale */
  end: number
  onMargin: (side: MarginSide, value: number) => void
}) {
  const [dragging, setDragging] = React.useState<"start" | "end" | null>(null)
  const horizontal = axis === "horizontal"
  const id = horizontal ? "doc-ruler" : "doc-ruler-y"
  const sides = React.useMemo<Record<"start" | "end", MarginSide>>(
    () =>
      horizontal
        ? { start: "left", end: "right" }
        : { start: "top", end: "bottom" },
    [horizontal]
  )

  const ticks = React.useMemo(() => {
    if (length <= 0) return []
    const out: { at: number; label: number | null }[] = []
    const first = Math.ceil((-start / CM) * 2) / 2
    const last = Math.floor(((length - start) / CM) * 2) / 2
    for (let k = first; k <= last; k += 0.5) {
      const at = start + k * CM
      if (at < 0 || at > length) continue
      out.push({ at, label: Number.isInteger(k) ? Math.abs(k) : null })
    }
    return out
  }, [length, start])

  const latest = React.useRef({ length, onMargin })
  React.useEffect(() => {
    latest.current = { length, onMargin }
  })

  const startDrag = React.useCallback(
    (which: "start" | "end", event: React.PointerEvent) => {
      event.preventDefault()
      setDragging(which)
      const bar = document.getElementById(id)
      let frame = 0
      let pending: number | null = null
      const side = sides[which]

      const commit = () => {
        frame = 0
        if (pending !== null) latest.current.onMargin(side, pending)
      }
      const move = (e: PointerEvent) => {
        const box = bar?.getBoundingClientRect()
        const len = latest.current.length
        if (!box || !len) return
        // con lo zoom il righello è disegnato più grande dei suoi pixel
        const scale = (horizontal ? box.width : box.height) / len
        if (!scale) return
        const pos = horizontal
          ? (e.clientX - box.left) / scale
          : (e.clientY - box.top) / scale
        pending = clampMargin(which === "start" ? pos : len - pos)
        // un aggiornamento per fotogramma: il margine ridisegna tutto il foglio
        if (!frame) frame = requestAnimationFrame(commit)
      }
      const up = () => {
        if (frame) cancelAnimationFrame(frame)
        commit()
        setDragging(null)
        window.removeEventListener("pointermove", move)
        window.removeEventListener("pointerup", up)
      }
      window.addEventListener("pointermove", move)
      window.addEventListener("pointerup", up)
    },
    [horizontal, id, sides]
  )

  if (length <= 0) return null

  const box = horizontal
    ? { width: length, height: RULER_SIZE }
    : { width: RULER_SIZE, height: length }

  return (
    <div
      id={id}
      data-guide
      className="relative shrink-0 rounded-md border border-[var(--doc-border)] select-none"
      style={{ ...box, background: "var(--doc-ruler-off)" }}
    >
      {/* zona di testo, fra i due margini */}
      <div
        className="absolute rounded-sm"
        style={{
          background: "var(--doc-ruler-on)",
          ...(horizontal
            ? { top: 0, bottom: 0, left: start, right: end }
            : { left: 0, right: 0, top: start, bottom: end }),
        }}
      />

      {ticks.map((t, i) => (
        <React.Fragment key={i}>
          <div
            className="absolute"
            style={
              horizontal
                ? {
                    left: t.at,
                    bottom: 0,
                    width: 1,
                    height: t.label === null ? 4 : 6,
                    background: "var(--doc-muted)",
                    opacity: t.label === null ? 0.45 : 0.7,
                  }
                : {
                    top: t.at,
                    right: 0,
                    height: 1,
                    width: t.label === null ? 4 : 6,
                    background: "var(--doc-muted)",
                    opacity: t.label === null ? 0.45 : 0.7,
                  }
            }
          />
          {t.label !== null ? (
            <span
              className="pointer-events-none absolute text-[8px] leading-none tabular-nums"
              style={
                horizontal
                  ? {
                      left: t.at,
                      top: 2,
                      transform: "translateX(-50%)",
                      color: "var(--doc-muted)",
                    }
                  : {
                      top: t.at,
                      left: 2,
                      transform: "translateY(-50%)",
                      color: "var(--doc-muted)",
                    }
              }
            >
              {t.label}
            </span>
          ) : null}
        </React.Fragment>
      ))}

      {(["start", "end"] as const).map((which) => {
        const offset = (which === "start" ? start : end) - 6
        return (
          <button
            key={which}
            type="button"
            aria-label={`Margine ${LABELS[sides[which]]}`}
            title={`Margine ${LABELS[sides[which]]} · trascina`}
            onPointerDown={(e) => startDrag(which, e)}
            className={
              horizontal
                ? "absolute inset-y-0 w-3 cursor-ew-resize"
                : "absolute inset-x-0 h-3 cursor-ns-resize"
            }
            style={
              horizontal
                ? which === "start"
                  ? { left: offset }
                  : { right: offset }
                : which === "start"
                  ? { top: offset }
                  : { bottom: offset }
            }
          >
            <span
              className="absolute top-1/2 left-1/2 block -translate-x-1/2 -translate-y-1/2 rounded-[2px]"
              style={{
                width: horizontal ? 6 : 10,
                height: horizontal ? 10 : 6,
                background: "var(--doc-accent)",
                opacity: dragging === which ? 1 : 0.75,
              }}
            />
          </button>
        )
      })}
    </div>
  )
}

const LABELS: Record<MarginSide, string> = {
  top: "superiore",
  right: "destro",
  bottom: "inferiore",
  left: "sinistro",
}
