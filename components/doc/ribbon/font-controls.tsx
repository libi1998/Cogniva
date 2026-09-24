"use client"

import * as React from "react"
import { Check, ChevronDown } from "lucide-react"
import { Popover, PopoverContent } from "@/components/ui/popover"
import { fontFromCss, type FontKey } from "@/lib/fonts"
import { rememberFont, useRecentFonts } from "@/lib/recent-fonts"
import { fontRows } from "@/components/shared/font-picker"
import { cn } from "@/lib/utils"

import { useT } from "@/lib/i18n/client"
import { formatDecimal } from "@/lib/numbers"
/** Le dimensioni del menu «Dimensione carattere» di Word, in punti */
const WORD_SIZES = [
  8, 9, 10, 10.5, 11, 12, 14, 16, 18, 20, 22, 24, 26, 28, 36, 48, 72,
]

const half = (n: number) => Math.round(n * 2) / 2

/** Un corpo CSS («16px», «12pt») in punti, come li mostra Word */
export function toPt(css: string, fallbackPx: number): number {
  if (!css) return half(fallbackPx * 0.75)
  const n = parseFloat(css)
  if (!Number.isFinite(n)) return half(fallbackPx * 0.75)
  return css.endsWith("pt") ? half(n) : half(n * 0.75)
}

const fmt = (n: number) => formatDecimal(n)

/**
 * Casella combinata: si può scrivere per filtrare o premere la freccia per
 * vedere l'elenco. L'elenco è in un portale perché la barra scorre in
 * orizzontale e taglierebbe tutto quello che sporge.
 */
function Combo<T>({
  label,
  display,
  width,
  items,
  isActive,
  renderItem,
  filter,
  onPick,
  onCommitText,
  inputMode,
  headerOf,
  rowClassName,
}: {
  label: string
  display: string
  width: number
  items: T[]
  isActive: (item: T) => boolean
  renderItem: (item: T) => React.ReactNode
  filter: (item: T, query: string) => boolean
  onPick: (item: T) => void
  onCommitText?: (text: string) => void
  inputMode?: "decimal" | "text"
  /** voci che fanno da intestazione di gruppo (non si scelgono) */
  headerOf?: (item: T) => string | null
  rowClassName?: string
}) {
  const t = useT()
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)
  const anchorRef = React.useRef<HTMLDivElement>(null)
  const shown =
    query === null
      ? items
      : items.filter((i) => !headerOf?.(i) && filter(i, query))
  const pickable = shown.filter((i) => !headerOf?.(i))

  const close = () => {
    setOpen(false)
    setQuery(null)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(next, details) => {
        if (next) return setOpen(true)
        // un clic sulla casella non chiude l'elenco: ci pensano campo e freccia
        const target = details.event?.target
        if (target instanceof Node && anchorRef.current?.contains(target)) {
          return
        }
        close()
      }}
    >
      <div
        ref={anchorRef}
        className="flex h-7 items-center overflow-hidden rounded-md border border-border bg-background transition focus-within:border-ring hover:border-foreground/25"
        style={{ width }}
      >
        <input
          ref={inputRef}
          aria-label={label}
          title={label}
          value={query ?? display}
          inputMode={inputMode}
          // si seleziona tutto: scrivendo si sostituisce, come in Word
          onFocus={(e) => requestAnimationFrame(() => e.target.select())}
          onChange={(e) => {
            setQuery(e.target.value)
            setOpen(true)
          }}
          onBlur={() => window.setTimeout(close, 120)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              close()
              inputRef.current?.blur()
            }
            if (e.key === "Enter") {
              e.preventDefault()
              const text = query ?? ""
              if (onCommitText && text.trim()) onCommitText(text)
              else if (pickable[0]) onPick(pickable[0])
              close()
              inputRef.current?.blur()
            }
          }}
          className="h-full w-0 min-w-0 flex-1 bg-transparent px-2 text-xs text-foreground outline-none"
        />
        <button
          type="button"
          tabIndex={-1}
          aria-label={t("Apri {list}", {
            list: label.toLowerCase(),
          })}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => (open ? close() : setOpen(true))}
          className="flex h-full w-5 shrink-0 items-center justify-center border-l border-border text-muted-foreground hover:bg-muted"
        >
          <ChevronDown className="size-3" />
        </button>
      </div>
      <PopoverContent
        anchor={anchorRef}
        align="start"
        sideOffset={4}
        className="max-h-80 w-auto min-w-(--anchor-width) gap-0 overflow-y-auto p-1"
        initialFocus={false}
        finalFocus={false}
      >
        {shown.length ? (
          shown.map((item, i) => {
            const header = headerOf?.(item)
            if (header) {
              return (
                <p
                  key={`h${i}`}
                  className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {header}
                </p>
              )
            }
            return (
              <button
                key={i}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onPick(item)
                  close()
                  inputRef.current?.blur()
                }}
                className={cn(
                  "flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm hover:bg-muted",
                  isActive(item) && "bg-accent text-accent-foreground",
                  rowClassName
                )}
              >
                <Check
                  className={cn(
                    "size-3.5 shrink-0",
                    !isActive(item) && "opacity-0"
                  )}
                />
                {renderItem(item)}
              </button>
            )
          })
        ) : (
          <p className="px-2 py-1.5 text-xs text-muted-foreground">
            {t("Nessun risultato")}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}

/** Una voce dell'elenco: un carattere oppure l'intestazione di un gruppo */
type FontItem = {
  header?: string
  key?: FontKey | null
  label?: string
  stack?: string
  id?: string
}

/** Nome del carattere, come «Aptos (Corpo)» in Word */
export function FontCombo({
  value,
  styleFont,
  onPick,
}: {
  /** famiglia CSS applicata al testo selezionato, vuota se è quella dello stile */
  value: string
  /** il carattere dello stile del paragrafo, come «Inter (Corpo)» */
  styleFont: { label: string; stack: string }
  onPick: (key: FontKey | null) => void
}) {
  const t = useT()
  const recent = useRecentFonts()
  const doc = styleFont
  const current = fontFromCss(value)
  const items: FontItem[] = [
    { header: t("Carattere dello stile") },
    {
      key: null,
      id: "doc",
      label: doc.label,
      stack: doc.stack,
    },
    ...fontRows("", recent).map((row): FontItem =>
      row.kind === "header"
        ? { header: row.label }
        : {
            key: row.font.key,
            id: row.id,
            label: row.font.label,
            stack: row.font.stack,
          }
    ),
  ]
  return (
    <Combo<FontItem>
      label={t("Carattere")}
      width={156}
      display={current ? current.label : doc.label}
      items={items}
      headerOf={(i) => i.header ?? null}
      rowClassName="doc-font-row"
      isActive={(i) =>
        !i.header &&
        !i.id?.startsWith("recent-") &&
        (current ? i.key === current.key : i.key === null)
      }
      filter={(i, q) =>
        !i.header &&
        !i.id?.startsWith("recent-") &&
        Boolean(i.label?.toLowerCase().includes(q.toLowerCase()))
      }
      renderItem={(i) =>
        i.header ? null : (
          <span
            style={{ fontFamily: i.stack }}
            className="truncate text-[15px]"
          >
            {i.label}
          </span>
        )
      }
      onPick={(i) => {
        if (i.header) return
        if (i.key) rememberFont(i.key)
        onPick(i.key ?? null)
      }}
    />
  )
}

/** Dimensione carattere in punti, scrivibile come in Word */
export function SizeCombo({
  pt,
  onPick,
}: {
  pt: number
  onPick: (pt: number) => void
}) {
  const t = useT()
  return (
    <Combo<number>
      label={t("Dimensione carattere")}
      width={60}
      inputMode="decimal"
      display={fmt(pt)}
      items={WORD_SIZES}
      isActive={(n) => n === pt}
      filter={(n, q) => fmt(n).startsWith(formatDecimal(q.replace(",", ".")))}
      renderItem={(n) => <span className="tabular-nums">{fmt(n)}</span>}
      onPick={onPick}
      onCommitText={(text) => {
        const n = Number(text.replace(",", "."))
        if (Number.isFinite(n) && n >= 1 && n <= 400) onPick(half(n))
      }}
    />
  )
}

/** Il corpo successivo o precedente nell'elenco di Word */
export function stepSize(pt: number, dir: 1 | -1): number {
  if (dir > 0) return WORD_SIZES.find((s) => s > pt) ?? Math.min(400, pt + 12)
  return [...WORD_SIZES].reverse().find((s) => s < pt) ?? Math.max(1, pt - 1)
}
