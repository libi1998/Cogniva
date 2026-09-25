"use client"

import * as React from "react"
import { clampMargin, type MarginSide } from "@/lib/types"

import { useT } from "@/lib/i18n/client"
import { N_ } from "@/lib/i18n/config"
/** pixel CSS in un centimetro */
const CM = 96 / 2.54
/** spessore del righello */
export const RULER_SIZE = 22
/** metà dell'ingombro di un numero: più vicino al bordo uscirebbe dal binario */
const LABEL_HALF = 6
/** attorno alla maniglia di un margine i numeri finirebbero sotto di lei */
const HANDLE_CLEAR = 9

type Axis = "horizontal" | "vertical"

/**
 * Righello in stile Word: tacche ogni mezzo centimetro, numeri ogni centimetro
 * contati dal margine, e una maniglia per lato da trascinare.
 *
 * Lo stesso componente disegna quello in alto (margini sinistro e destro) e
 * quello di fianco (margini superiore e inferiore). Con le pagine vere quello
 * di fianco si ripete accanto a ogni foglio, come in Word: ogni pagina ha i
 * suoi margini e i numeri ripartono dal suo margine alto, invece di contare
 * di seguito lungo tutto il documento e attraverso lo spazio fra i fogli.
 */
export function Ruler({
  axis,
  length,
  start,
  end,
  onMargin,
  pages = 1,
  gap = 0,
}: {
  axis: Axis
  /** lunghezza del foglio (di una pagina, con le pagine vere) lungo questo asse, in pixel */
  length: number
  /** margine iniziale: sinistro in orizzontale, superiore in verticale */
  start: number
  /** margine finale: destro in orizzontale, inferiore in verticale */
  end: number
  onMargin: (side: MarginSide, value: number) => void
  /** fogli da affiancare, uno sotto l'altro (solo in verticale) */
  pages?: number
  /** spazio fra un foglio e l'altro */
  gap?: number
}) {
  const horizontal = axis === "horizontal"
  const count = horizontal ? 1 : Math.max(1, Math.floor(pages))
  if (length <= 0) return null
  if (count === 1) {
    return (
      <Track
        axis={axis}
        length={length}
        start={start}
        end={end}
        onMargin={onMargin}
        id={horizontal ? "doc-ruler" : "doc-ruler-y"}
      />
    )
  }
  return (
    <div
      id="doc-ruler-y"
      className="relative shrink-0"
      style={{
        width: RULER_SIZE,
        height: count * length + (count - 1) * gap,
      }}
    >
      {Array.from({ length: count }, (_, page) => (
        <div
          key={page}
          className="absolute inset-x-0"
          style={{ top: page * (length + gap) }}
        >
          <Track
            axis={axis}
            length={length}
            start={start}
            end={end}
            onMargin={onMargin}
          />
        </div>
      ))}
    </div>
  )
}

function Track({
  axis,
  length,
  start,
  end,
  onMargin,
  id,
}: {
  axis: Axis
  length: number
  start: number
  end: number
  onMargin: (side: MarginSide, value: number) => void
  id?: string
}) {
  const t = useT()
  const [dragging, setDragging] = React.useState<"start" | "end" | null>(null)
  const horizontal = axis === "horizontal"
  const sides = React.useMemo<Record<"start" | "end", MarginSide>>(
    () =>
      horizontal
        ? { start: "left", end: "right" }
        : { start: "top", end: "bottom" },
    [horizontal]
  )

  const ticks = React.useMemo(() => {
    if (length <= 0) return []
    const out: { at: number; label: number | null; whole: boolean }[] = []
    const first = Math.ceil((-start / CM) * 2) / 2
    const last = Math.floor(((length - start) / CM) * 2) / 2
    const handles = [start, length - end]
    for (let k = first; k <= last; k += 0.5) {
      const at = start + k * CM
      // una tacca sul bordo sporgerebbe dagli angoli arrotondati
      if (at < 1 || at > length - 1) continue
      // lo zero sta sotto la maniglia del margine, come in Word; i numeri
      // troppo vicini a una maniglia o al bordo restano solo tacche
      const label =
        Number.isInteger(k) &&
        k !== 0 &&
        at >= LABEL_HALF &&
        at <= length - LABEL_HALF &&
        handles.every((h) => Math.abs(at - h) >= HANDLE_CLEAR)
          ? Math.abs(k)
          : null
      out.push({ at, label, whole: Number.isInteger(k) })
    }
    return out
  }, [length, start, end])

  const latest = React.useRef({ length, onMargin })
  React.useEffect(() => {
    latest.current = { length, onMargin }
  })

  const startDrag = React.useCallback(
    (which: "start" | "end", event: React.PointerEvent<HTMLElement>) => {
      event.preventDefault()
      setDragging(which)
      // il binario di questa pagina: con le pagine vere ce n'è uno per foglio
      const bar = event.currentTarget.closest<HTMLElement>("[data-ruler]")
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
    [horizontal, sides]
  )

  const box = horizontal
    ? { width: length, height: RULER_SIZE }
    : { width: RULER_SIZE, height: length }

  return (
    <div
      id={id}
      data-ruler
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

      {ticks.map((tick, i) => (
        <React.Fragment key={i}>
          <div
            className="absolute"
            style={
              horizontal
                ? {
                    left: tick.at,
                    bottom: 0,
                    width: 1,
                    height: tick.whole ? 6 : 4,
                    background: "var(--doc-muted)",
                    opacity: tick.whole ? 0.7 : 0.45,
                  }
                : {
                    top: tick.at,
                    right: 0,
                    height: 1,
                    width: tick.whole ? 6 : 4,
                    background: "var(--doc-muted)",
                    opacity: tick.whole ? 0.7 : 0.45,
                  }
            }
          />
          {tick.label !== null ? (
            <span
              className="pointer-events-none absolute text-[8px] leading-none tabular-nums"
              style={
                horizontal
                  ? {
                      left: tick.at,
                      top: 3,
                      transform: "translateX(-50%)",
                      color: "var(--doc-muted)",
                    }
                  : {
                      top: tick.at,
                      left: 3,
                      transform: "translateY(-50%)",
                      color: "var(--doc-muted)",
                    }
              }
            >
              {tick.label}
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
            aria-label={t("Margine {side}", { side: t(LABELS[sides[which]]) })}
            title={t("Margine {side} · trascina", {
              side: t(LABELS[sides[which]]),
            })}
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
  top: N_("superiore||lato del margine"),
  right: N_("destro||lato del margine"),
  bottom: N_("inferiore||lato del margine"),
  left: N_("sinistro||lato del margine"),
}
