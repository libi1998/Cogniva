"use client"

import * as React from "react"
import { Check, ChevronDown, Search } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  FONTS,
  FONT_GROUPS,
  fontMap,
  type FontKey,
  type FontOption,
} from "@/lib/fonts"
import { rememberFont, useRecentFonts } from "@/lib/recent-fonts"
import { cn } from "@/lib/utils"

type Row =
  | { kind: "header"; label: string }
  | { kind: "font"; font: FontOption; id: string }

/** Le righe dell'elenco: recenti, poi i gruppi; con una ricerca, solo i risultati */
export function fontRows(query: string, recent: string[]): Row[] {
  const q = query.trim().toLowerCase()
  if (q) {
    return FONTS.filter(
      (f) =>
        f.label.toLowerCase().includes(q) || f.family.toLowerCase().includes(q)
    ).map((font) => ({ kind: "font", font, id: font.key }))
  }
  const rows: Row[] = []
  const recents = recent.map((k) => fontMap[k]).filter(Boolean)
  if (recents.length) {
    rows.push({ kind: "header", label: "Usati di recente" })
    for (const font of recents) {
      rows.push({ kind: "font", font, id: `recent-${font.key}` })
    }
  }
  for (const group of FONT_GROUPS) {
    const fonts = FONTS.filter((f) => f.group === group.value)
    if (!fonts.length) continue
    rows.push({ kind: "header", label: `${group.label} · ${fonts.length}` })
    for (const font of fonts) rows.push({ kind: "font", font, id: font.key })
  }
  return rows
}

/**
 * Scelta del carattere con ricerca, gruppi e caratteri recenti. Ogni voce è
 * scritta nel suo carattere, che si scarica solo quando la voce è visibile.
 */
export function FontPicker({
  value,
  onChange,
  className,
  specials = [],
}: {
  value: FontKey
  onChange: (key: FontKey) => void
  className?: string
  /**
   * voci in cima all'elenco che non sono caratteri veri, come «Corpo» e
   * «Titoli» del tema negli stili
   */
  specials?: { key: string; label: string; stack: string }[]
}) {
  const [open, setOpen] = React.useState(false)
  const [query, setQuery] = React.useState("")
  const recent = useRecentFonts()
  const special = specials.find((s) => s.key === value)
  const current = special
    ? { label: special.label, stack: special.stack }
    : fontMap[value]
  const rows: Row[] = [
    ...(specials.length && !query.trim()
      ? [
          { kind: "header" as const, label: "Caratteri del tema" },
          ...specials.map((s) => ({
            kind: "font" as const,
            id: `special-${s.key}`,
            font: {
              key: s.key,
              label: s.label,
              hint: "",
              stack: s.stack,
              scale: 1,
              group: "sans" as const,
              family: s.label,
            },
          })),
        ]
      : []),
    ...fontRows(query, recent),
  ]

  const pick = (key: FontKey) => {
    if (!specials.some((s) => s.key === key)) rememberFont(key)
    onChange(key)
    setOpen(false)
    setQuery("")
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (!v) setQuery("")
      }}
    >
      <PopoverTrigger
        render={
          <button
            type="button"
            className={cn(
              "flex h-8 w-full items-center justify-between gap-2 rounded-md border border-input bg-transparent px-2.5 text-left text-xs shadow-xs transition hover:bg-muted/60",
              className
            )}
          />
        }
      >
        <span
          className="truncate text-[13px]"
          style={{ fontFamily: current?.stack }}
        >
          {current?.label ?? value}
        </span>
        <ChevronDown className="size-3.5 shrink-0 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-0">
        <div className="flex items-center gap-2 border-b border-border px-2.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            placeholder={`Cerca fra ${FONTS.length} caratteri`}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key !== "Enter") return
              const first = rows.find((r) => r.kind === "font")
              if (first && first.kind === "font") pick(first.font.key)
            }}
            className="h-9 min-w-0 flex-1 bg-transparent text-xs outline-none"
          />
        </div>
        <div className="max-h-80 overflow-y-auto p-1">
          {rows.length ? (
            rows.map((row, i) =>
              row.kind === "header" ? (
                <p
                  key={`h-${row.label}-${i}`}
                  className="px-2 pt-2 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase"
                >
                  {row.label}
                </p>
              ) : (
                <FontRow
                  key={row.id}
                  font={row.font}
                  active={row.font.key === value}
                  onPick={pick}
                />
              )
            )
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Nessun carattere trovato
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

function FontRow({
  font,
  active,
  onPick,
}: {
  font: FontOption
  active: boolean
  onPick: (key: FontKey) => void
}) {
  return (
    <button
      type="button"
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onPick(font.key)}
      className={cn(
        "doc-font-row flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-muted",
        active && "bg-accent text-accent-foreground"
      )}
    >
      <Check className={cn("size-3.5 shrink-0", !active && "opacity-0")} />
      <span
        className="min-w-0 flex-1 truncate text-[15px]"
        style={{ fontFamily: font.stack }}
      >
        {font.label}
      </span>
      {font.hint ? (
        <span className="shrink-0 text-[10px] text-muted-foreground">
          {font.hint}
        </span>
      ) : null}
    </button>
  )
}
