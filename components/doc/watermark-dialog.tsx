"use client"

import * as React from "react"
import { ImageUp } from "lucide-react"
import { toast } from "sonner"
import { FontPicker } from "@/components/shared/font-picker"
import { CustomColor } from "@/components/shared/custom-color"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  newWatermark,
  WATERMARK_PRESETS,
  watermarkFontSize,
} from "@/lib/doc-design"
import { fontStack } from "@/lib/fonts"
import type { DocTheme, DocWatermark } from "@/lib/types"
import { cn } from "@/lib/utils"

import { useT, tr } from "@/lib/i18n/client"
type Mode = "none" | "image" | "text"

const COLORS = [
  "#a1a1aa",
  "#71717a",
  "#ef4444",
  "#3b82f6",
  "#10b981",
  "#111827",
]

/** L'immagine rimpicciolita: la filigrana resta leggera nel file salvato */
function readImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const max = 1400
      const ratio = Math.min(1, max / Math.max(img.width, img.height))
      const canvas = document.createElement("canvas")
      canvas.width = Math.max(1, Math.round(img.width * ratio))
      canvas.height = Math.max(1, Math.round(img.height * ratio))
      canvas.getContext("2d")?.drawImage(img, 0, 0, canvas.width, canvas.height)
      URL.revokeObjectURL(url)
      resolve(
        file.type === "image/png" || file.type === "image/svg+xml"
          ? canvas.toDataURL("image/png")
          : canvas.toDataURL("image/jpeg", 0.86)
      )
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error(tr("Immagine non valida")))
    }
    img.src = url
  })
}

/** «Filigrana personalizzata», come la finestra di Word */
export function WatermarkDialog({
  open,
  onClose,
  theme,
  setTheme,
}: {
  open: boolean
  onClose: () => void
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]">
        {open ? (
          <WatermarkForm theme={theme} setTheme={setTheme} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function WatermarkForm({
  theme,
  setTheme,
  onClose,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  onClose: () => void
}) {
  const t = useT()
  const initial = theme.watermark
  const [mode, setMode] = React.useState<Mode>(
    !initial ? "text" : initial.image ? "image" : "text"
  )
  const [draft, setDraft] = React.useState<DocWatermark>(
    () => initial ?? newWatermark()
  )
  const fileRef = React.useRef<HTMLInputElement>(null)
  const set = (patch: Partial<DocWatermark>) =>
    setDraft((d) => ({ ...d, ...patch }))

  const result: DocWatermark | null =
    mode === "none"
      ? null
      : mode === "image"
        ? draft.image
          ? { ...draft, text: "" }
          : null
        : draft.text.trim()
          ? { ...draft, image: null }
          : null

  const apply = (close: boolean) => {
    setTheme({ watermark: result })
    if (close) onClose()
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        apply(true)
      }}
      className="flex min-h-0 flex-col"
    >
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle>{t("Filigrana personalizzata")}</DialogTitle>
        <DialogDescription>
          {t(
            "Compare dietro al testo su ogni pagina, anche in stampa e nel PDF."
          )}
        </DialogDescription>
      </DialogHeader>

      <div className="grid gap-4 px-5 py-4 sm:grid-cols-[1fr_150px]">
        <div className="space-y-3">
          <div
            role="radiogroup"
            aria-label={t("Tipo di filigrana")}
            className="flex gap-1 rounded-lg bg-muted p-0.5"
          >
            {(
              [
                ["none", t("Nessuna")],
                ["image", t("Immagine")],
                ["text", t("Testo")],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={mode === value}
                onClick={() => setMode(value)}
                className={cn(
                  "h-7 flex-1 rounded-md text-xs transition",
                  mode === value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>

          {mode === "image" ? (
            <div className="space-y-3">
              <input
                ref={fileRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0]
                  e.target.value = ""
                  if (!file) return
                  try {
                    set({ image: await readImage(file) })
                  } catch {
                    toast.error(t("Non riesco a leggere questa immagine"))
                  }
                }}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <ImageUp />{" "}
                {draft.image ? t("Cambia immagine…") : t("Seleziona immagine…")}
              </Button>
              <label className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
                {t("Dimensione")}
                <select
                  value={String(draft.scale)}
                  onChange={(e) => set({ scale: Number(e.target.value) })}
                  className="h-8 rounded-md border border-input bg-transparent px-2 text-xs text-foreground"
                >
                  {[0.3, 0.45, 0.6, 0.8, 1].map((n) => (
                    <option key={n} value={n}>
                      {t("{percent}% della pagina", {
                        percent: Math.round(n * 100),
                      })}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={draft.opacity < 0.6}
                  onChange={(e) =>
                    set({ opacity: e.target.checked ? 0.25 : 0.9 })
                  }
                />
                {t("Dilavata")}
              </label>
            </div>
          ) : null}

          {mode === "text" ? (
            <div className="space-y-2.5">
              <label className="block space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t("Testo")}
                </span>
                <Input
                  value={draft.text}
                  list="watermark-presets"
                  maxLength={40}
                  onChange={(e) => set({ text: e.target.value })}
                  className="h-8 text-sm"
                />
                <datalist id="watermark-presets">
                  {WATERMARK_PRESETS.map((p) => (
                    <option key={p.text} value={p.text} />
                  ))}
                </datalist>
              </label>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t("Carattere")}
                </span>
                <FontPicker
                  value={draft.font ?? theme.headingFont ?? theme.font}
                  onChange={(font) => set({ font })}
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs text-muted-foreground">
                  {t("Colore")}
                </span>
                <div className="flex items-center gap-1.5">
                  {COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      title={c}
                      onClick={() => set({ color: c })}
                      className={cn(
                        "size-6 shrink-0 rounded-md ring-1 ring-black/10 transition hover:scale-110",
                        draft.color === c &&
                          "ring-2 ring-ring ring-offset-1 ring-offset-background"
                      )}
                      style={{ background: c }}
                    />
                  ))}
                  <div className="w-24">
                    <CustomColor
                      value={draft.color}
                      onChange={(color) => set({ color })}
                    />
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-3 text-xs text-muted-foreground">
                {t("Trasparenza")}
                <input
                  type="range"
                  min={5}
                  max={90}
                  value={Math.round((1 - draft.opacity) * 100)}
                  onChange={(e) =>
                    set({ opacity: 1 - Number(e.target.value) / 100 })
                  }
                  className="flex-1"
                />
                <span className="w-9 text-right tabular-nums">
                  {Math.round((1 - draft.opacity) * 100)}%
                </span>
              </label>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                {t("Layout")}
                {(
                  [
                    ["diagonal", t("Diagonale")],
                    ["horizontal", t("Orizzontale")],
                  ] as const
                ).map(([value, label]) => (
                  <label key={value} className="flex items-center gap-1.5">
                    <input
                      type="radio"
                      name="watermark-layout"
                      checked={draft.layout === value}
                      onChange={() => set({ layout: value })}
                    />
                    <span className="text-foreground">{label}</span>
                  </label>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <WatermarkPreview theme={theme} watermark={result} />
      </div>

      <DialogFooter className="border-t border-border px-5 py-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("Annulla")}
        </Button>
        <Button type="button" variant="outline" onClick={() => apply(false)}>
          {t("Applica")}
        </Button>
        <Button type="submit">OK</Button>
      </DialogFooter>
    </form>
  )
}

/** Un foglio in miniatura con la filigrana, per le anteprime */
export function WatermarkPreview({
  theme,
  watermark,
  className,
}: {
  theme: DocTheme
  watermark: DocWatermark | null
  className?: string
}) {
  const text = watermark?.text.trim() ?? ""
  return (
    <div
      aria-hidden
      className={cn(
        "relative mx-auto flex aspect-[1/1.414] w-full max-w-[150px] items-center justify-center overflow-hidden rounded-md border border-border bg-white",
        className
      )}
      style={{ containerType: "size" }}
    >
      <div className="absolute inset-x-[14%] top-[12%] space-y-[6%]">
        {Array.from({ length: 9 }).map((_, i) => (
          <div
            key={i}
            className="h-[3px] rounded-full bg-zinc-200"
            style={{ width: i % 4 === 3 ? "60%" : "100%" }}
          />
        ))}
      </div>
      {watermark?.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- anteprima di un data URI
        <img
          src={watermark.image}
          alt=""
          className="relative object-contain"
          style={{
            width: `${Math.round(watermark.scale * 100)}%`,
            opacity: watermark.opacity,
          }}
        />
      ) : watermark && text ? (
        <span
          className="relative leading-none font-bold whitespace-nowrap"
          style={{
            fontFamily: fontStack(
              watermark.font ?? theme.headingFont ?? theme.font
            ),
            color: watermark.color,
            opacity: watermark.opacity,
            fontSize: watermarkFontSize(text, watermark.layout),
            transform:
              watermark.layout === "diagonal" ? "rotate(-45deg)" : undefined,
          }}
        >
          {text}
        </span>
      ) : null}
    </div>
  )
}
