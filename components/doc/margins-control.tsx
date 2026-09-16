"use client"

import * as React from "react"
import { Link2, Link2Off } from "lucide-react"
import { cn } from "@/lib/utils"
import { clampMargin, type DocMargins, type MarginSide } from "@/lib/types"

import { useT, tr } from "@/lib/i18n/client"
import { N_ } from "@/lib/i18n/config"
/** pixel CSS in un centimetro */
const CM = 96 / 2.54
const toCm = (px: number) => Math.round((px / CM) * 10) / 10
const toPx = (cm: number) => clampMargin(cm * CM)

/** I margini predefiniti di Word, in centimetri */
const PRESETS: { label: string; cm: [number, number, number, number] }[] = [
  {
    get label() {
      return tr("Normali")
    },
    cm: [2.5, 2.5, 2.5, 2.5],
  },
  {
    get label() {
      return tr("Stretti")
    },
    cm: [1.27, 1.27, 1.27, 1.27],
  },
  {
    get label() {
      return tr("Moderati")
    },
    cm: [2.54, 1.91, 2.54, 1.91],
  },
  {
    get label() {
      return tr("Larghi")
    },
    cm: [2.54, 5.08, 2.54, 5.08],
  },
]

/** Il lato dentro una frase («Margine superiore»), accordato in ogni lingua */
const SIDE_NAMES: Record<MarginSide, string> = {
  top: N_("superiore||lato del margine"),
  right: N_("destro||lato del margine"),
  bottom: N_("inferiore||lato del margine"),
  left: N_("sinistro||lato del margine"),
}

const LABELS: Record<MarginSide, string> = {
  get top() {
    return tr("Superiore")
  },
  get right() {
    return tr("Destro")
  },
  get bottom() {
    return tr("Inferiore")
  },
  get left() {
    return tr("Sinistro")
  },
}

function CmInput({
  side,
  value,
  onChange,
}: {
  side: MarginSide
  value: number
  onChange: (px: number) => void
}) {
  const t = useT()
  // mentre si scrive il testo resta com'è: «2,» non deve diventare «2»
  const [draft, setDraft] = React.useState<string | null>(null)
  const shown = draft ?? String(toCm(value)).replace(".", ",")

  const commit = (text: string) => {
    const cm = Number(text.replace(",", "."))
    if (Number.isFinite(cm)) onChange(toPx(cm))
  }

  return (
    <label className="flex flex-col items-center gap-0.5">
      <span className="sr-only">
        {t("Margine {side}", { side: t(SIDE_NAMES[side]) })}
      </span>
      <input
        inputMode="decimal"
        value={shown}
        title={t("{side} · ↑↓ per 0,1 cm, ⇧ per 1 cm", {
          side: LABELS[side],
        })}
        onFocus={(e) => e.currentTarget.select()}
        onChange={(e) => {
          setDraft(e.target.value)
          commit(e.target.value)
        }}
        onBlur={() => setDraft(null)}
        onKeyDown={(e) => {
          if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return
          e.preventDefault()
          const step = (e.shiftKey ? 1 : 0.1) * (e.key === "ArrowUp" ? 1 : -1)
          setDraft(null)
          onChange(toPx(toCm(value) + step))
        }}
        className="h-7 w-14 rounded-md border border-border bg-background text-center text-xs tabular-nums transition outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
      />
    </label>
  )
}

/**
 * Margini del foglio come nell'impostazione pagina di Word: uno schema della
 * pagina con i quattro valori intorno, in centimetri, e i margini predefiniti.
 */
export function MarginsControl({
  margins,
  onChange,
}: {
  margins: DocMargins
  onChange: (margins: DocMargins) => void
}) {
  const t = useT()
  const [linked, setLinked] = React.useState(
    () =>
      margins.top === margins.right &&
      margins.right === margins.bottom &&
      margins.bottom === margins.left
  )

  const set = (side: MarginSide) => (px: number) =>
    onChange(
      linked
        ? { top: px, right: px, bottom: px, left: px }
        : { ...margins, [side]: px }
    )

  // lo schema è proporzionato ai margini veri, entro limiti leggibili
  const total = 240
  const scale = (px: number) => Math.max(3, Math.min(22, (px / total) * 44))

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-[auto_1fr_auto] items-center gap-1.5">
        <span />
        <div className="flex justify-center">
          <CmInput side="top" value={margins.top} onChange={set("top")} />
        </div>
        <span />

        <CmInput side="left" value={margins.left} onChange={set("left")} />
        <div
          aria-hidden
          className="mx-auto h-[86px] w-[66px] rounded-[3px] border border-border bg-background shadow-sm"
          style={{
            paddingTop: scale(margins.top),
            paddingRight: scale(margins.right),
            paddingBottom: scale(margins.bottom),
            paddingLeft: scale(margins.left),
          }}
        >
          <div className="flex h-full flex-col gap-[3px] overflow-hidden rounded-[1px] outline outline-1 outline-primary/40 outline-dashed">
            {Array.from({ length: 9 }).map((_, i) => (
              <span
                key={i}
                className="h-[2px] shrink-0 rounded-full bg-muted-foreground/30"
                style={{ width: i % 4 === 3 ? "60%" : "100%" }}
              />
            ))}
          </div>
        </div>
        <CmInput side="right" value={margins.right} onChange={set("right")} />

        <span />
        <div className="flex justify-center">
          <CmInput
            side="bottom"
            value={margins.bottom}
            onChange={set("bottom")}
          />
        </div>
        <span />
      </div>

      <div className="grid grid-cols-4 gap-1">
        {PRESETS.map((p) => {
          const [top, right, bottom, left] = p.cm.map(toPx)
          const active =
            margins.top === top &&
            margins.right === right &&
            margins.bottom === bottom &&
            margins.left === left
          return (
            <button
              key={p.label}
              type="button"
              title={t("{label}: {values} cm", {
                label: p.label,
                values: p.cm
                  .map((c) => String(c).replace(".", ","))
                  .join(" · "),
              })}
              onClick={() => {
                setLinked(top === right && right === bottom && bottom === left)
                onChange({ top, right, bottom, left })
              }}
              className={cn(
                "h-7 rounded-md border text-[11px] transition",
                active
                  ? "border-primary/40 bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          )
        })}
      </div>

      <div className="flex items-start gap-2">
        <button
          type="button"
          aria-pressed={linked}
          title={
            linked
              ? t("Margini collegati: cambiandone uno cambiano tutti")
              : t("Collega i quattro margini")
          }
          onClick={() => {
            if (!linked) {
              const v = margins.left
              onChange({ top: v, right: v, bottom: v, left: v })
            }
            setLinked(!linked)
          }}
          className={cn(
            "flex h-7 shrink-0 items-center gap-1 rounded-md border px-2 text-[11px] transition",
            linked
              ? "border-primary/40 bg-accent text-accent-foreground"
              : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {linked ? (
            <Link2 className="size-3.5" />
          ) : (
            <Link2Off className="size-3.5" />
          )}
          {t("Uguali")}
        </button>
        <p className="text-[10px] leading-snug text-muted-foreground">
          {t("Centimetri. Si trascinano anche dalle maniglie dei righelli.")}
        </p>
      </div>
    </div>
  )
}
