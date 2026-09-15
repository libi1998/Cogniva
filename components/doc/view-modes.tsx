"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { AlignJustify, Focus, Glasses, X } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Le modalità «a schermo pieno» della scheda Visualizza: focus (solo il
 * foglio), lettura (solo lettura, testo più grande) e lettura immersiva
 * (colonna, colore della pagina, spaziatura e messa a fuoco della riga).
 */

export type DocMode = "normal" | "focus" | "reading" | "immersive"

export type ImmersiveSettings = {
  width: "narrow" | "moderate" | "wide"
  paper: "none" | "sepia" | "cream" | "mint" | "dark"
  spacing: boolean
  /** righe lasciate in chiaro intorno al cursore; 0 = spenta */
  lineFocus: 0 | 1 | 3 | 5
}

export const DEFAULT_IMMERSIVE: ImmersiveSettings = {
  width: "moderate",
  paper: "none",
  spacing: false,
  lineFocus: 0,
}

export const IMMERSIVE_WIDTHS = { narrow: 560, moderate: 720, wide: 920 }

export const IMMERSIVE_PAPERS: Record<
  ImmersiveSettings["paper"],
  string | null
> = {
  none: null,
  sepia: "#f4ecd8",
  cream: "#fdf6e3",
  mint: "#e3f2e8",
  dark: "#1f1f23",
}

const MODE_LABELS: Record<Exclude<DocMode, "normal">, string> = {
  focus: "Modalità focus",
  reading: "Modalità lettura",
  immersive: "Lettura immersiva",
}

/** La barra che resta visibile in cima nelle modalità a schermo pieno */
export function ModeBar({
  mode,
  onExit,
  immersive,
  setImmersive,
}: {
  mode: Exclude<DocMode, "normal">
  onExit: () => void
  immersive: ImmersiveSettings
  setImmersive: (next: ImmersiveSettings) => void
}) {
  const set = (patch: Partial<ImmersiveSettings>) =>
    setImmersive({ ...immersive, ...patch })
  const chip = (active: boolean) =>
    cn(
      "h-7 rounded-md px-2 text-xs transition",
      active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-muted hover:text-foreground"
    )

  return (
    <div
      role="toolbar"
      aria-label={MODE_LABELS[mode]}
      className="fixed inset-x-0 top-2 z-50 flex justify-center px-2 safe-x"
    >
      <div className="flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border border-border bg-card/95 p-1 shadow-lg backdrop-blur">
        <span className="flex shrink-0 items-center gap-1.5 px-2 text-xs font-medium">
          {mode === "focus" ? (
            <Focus className="size-3.5" />
          ) : mode === "reading" ? (
            <Glasses className="size-3.5" />
          ) : (
            <AlignJustify className="size-3.5" />
          )}
          {MODE_LABELS[mode]}
        </span>
        {mode === "immersive" ? (
          <>
            <span className="mx-1 h-5 w-px shrink-0 bg-border" />
            {(["narrow", "moderate", "wide"] as const).map((w) => (
              <button
                key={w}
                type="button"
                className={chip(immersive.width === w)}
                onClick={() => set({ width: w })}
              >
                {w === "narrow"
                  ? "Stretta"
                  : w === "moderate"
                    ? "Media"
                    : "Ampia"}
              </button>
            ))}
            <span className="mx-1 h-5 w-px shrink-0 bg-border" />
            {(
              Object.keys(IMMERSIVE_PAPERS) as ImmersiveSettings["paper"][]
            ).map((p) => (
              <button
                key={p}
                type="button"
                title={
                  p === "none"
                    ? "Colore del documento"
                    : p === "sepia"
                      ? "Seppia"
                      : p === "cream"
                        ? "Crema"
                        : p === "mint"
                          ? "Menta"
                          : "Scuro"
                }
                onClick={() => set({ paper: p })}
                className={cn(
                  "size-6 shrink-0 rounded-full ring-1 ring-foreground/15 transition",
                  immersive.paper === p && "ring-2 ring-primary"
                )}
                style={{
                  background:
                    IMMERSIVE_PAPERS[p] ??
                    "linear-gradient(135deg, #fff 50%, #a1a1aa 50%)",
                }}
              />
            ))}
            <span className="mx-1 h-5 w-px shrink-0 bg-border" />
            <button
              type="button"
              className={chip(immersive.spacing)}
              onClick={() => set({ spacing: !immersive.spacing })}
            >
              Spaziatura testo
            </button>
            {([0, 1, 3, 5] as const).map((n) => (
              <button
                key={n}
                type="button"
                className={chip(immersive.lineFocus === n)}
                onClick={() => set({ lineFocus: n })}
                title="Messa a fuoco riga"
              >
                {n === 0 ? "Tutto" : `${n} ${n === 1 ? "riga" : "righe"}`}
              </button>
            ))}
          </>
        ) : null}
        <span className="mx-1 h-5 w-px shrink-0 bg-border" />
        <button
          type="button"
          onClick={onExit}
          className="flex h-7 shrink-0 items-center gap-1 rounded-md px-2 text-xs hover:bg-muted"
        >
          <X className="size-3.5" /> Esci
          <kbd className="ml-1 rounded border border-border px-1 text-[10px] text-muted-foreground">
            Esc
          </kbd>
        </button>
      </div>
    </div>
  )
}

/**
 * «Messa a fuoco riga»: oscura la pagina tranne le righe intorno al cursore.
 * Le fasce seguono il cursore e lo scorrimento.
 */
export function LineFocus({
  editor,
  lines,
}: {
  editor: Editor | null
  lines: number
}) {
  const [band, setBand] = React.useState<{
    top: number
    bottom: number
  } | null>(null)

  React.useEffect(() => {
    if (!editor || !lines) return
    let frame = 0
    const measure = () => {
      frame = 0
      if (editor.isDestroyed) return
      const head = editor.state.selection.head
      const coords = editor.view.coordsAtPos(head)
      const lineHeight = Math.max(16, (coords.bottom - coords.top) * 1.25)
      const center = (coords.top + coords.bottom) / 2
      const half = (lineHeight * lines) / 2
      setBand({ top: center - half, bottom: center + half })
    }
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(measure)
    }
    schedule()
    editor.on("selectionUpdate", schedule)
    editor.on("update", schedule)
    window.addEventListener("scroll", schedule, true)
    window.addEventListener("resize", schedule)
    return () => {
      if (frame) cancelAnimationFrame(frame)
      editor.off("selectionUpdate", schedule)
      editor.off("update", schedule)
      window.removeEventListener("scroll", schedule, true)
      window.removeEventListener("resize", schedule)
    }
  }, [editor, lines])

  if (!lines || !band) return null
  const shade =
    "pointer-events-none fixed inset-x-0 z-40 bg-black/55 transition-[top,height] duration-150"
  return (
    <>
      <div
        aria-hidden
        className={shade}
        style={{ top: 0, height: Math.max(0, band.top) }}
      />
      <div
        aria-hidden
        className={shade}
        style={{ top: band.bottom, bottom: 0 }}
      />
    </>
  )
}
