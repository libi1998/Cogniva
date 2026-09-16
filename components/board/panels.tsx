"use client"

import * as React from "react"
import { Frame, Search, StickyNote, Type } from "lucide-react"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { shapePath } from "@/lib/shapes"
import { FRAME_SPECS, SHAPE_LABEL, WIRE_SPECS, wireGroups } from "@/lib/items"
import { ICON_CATEGORIES, ICONS } from "@/lib/icon-library"
import { Glyph } from "./glyph"
import type { FrameKind, NodeShape, WireKind } from "@/lib/types"
import { SHAPE_KEYS } from "@/lib/types"

import { useT } from "@/lib/i18n/client"
export function ShapeGlyph({
  shape,
  size = 22,
}: {
  shape: NodeShape
  size?: number
}) {
  const w = size * 1.3
  const h = size
  if (shape === "text") return <Type className="size-[18px]" />
  if (shape === "note") return <StickyNote className="size-[18px]" />
  const d =
    shape === "ellipse" ||
    shape === "pill" ||
    shape === "rect" ||
    shape === "rounded"
      ? null
      : shapePath(shape, w, h, 2.5)
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none">
      {d ? (
        <path
          d={d}
          stroke="currentColor"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
      ) : (
        <rect
          x="1"
          y={shape === "pill" ? h * 0.18 : 1}
          width={w - 2}
          height={shape === "pill" ? h * 0.64 : h - 2}
          rx={
            shape === "ellipse" || shape === "pill"
              ? h / 2
              : shape === "rounded"
                ? 4
                : 1
          }
          ry={shape === "ellipse" ? (h - 2) / 2 : undefined}
          stroke="currentColor"
          strokeWidth="1.6"
        />
      )}
    </svg>
  )
}

export function ShapePanel({ onPick }: { onPick: (s: NodeShape) => void }) {
  return (
    <div className="grid w-[220px] grid-cols-4 gap-1 p-1">
      {SHAPE_KEYS.map((s) => (
        <button
          key={s}
          title={SHAPE_LABEL[s] ?? s}
          onClick={() => onPick(s)}
          className="flex h-12 flex-col items-center justify-center gap-1 rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        >
          <ShapeGlyph shape={s} size={20} />
        </button>
      ))}
    </div>
  )
}

export function FramePanel({ onPick }: { onPick: (f: FrameKind) => void }) {
  return (
    <div className="w-[210px] p-1">
      {(Object.keys(FRAME_SPECS) as FrameKind[]).map((k) => {
        const f = FRAME_SPECS[k]
        return (
          <button
            key={k}
            onClick={() => onPick(k)}
            className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-muted"
          >
            <span className="flex size-7 items-center justify-center rounded-md border border-border text-muted-foreground">
              <Frame className="size-3.5" />
            </span>
            <span className="flex-1 text-xs font-medium">{f.label}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">
              {f.w}×{f.h}
            </span>
          </button>
        )
      })}
    </div>
  )
}

export function WirePanel({ onPick }: { onPick: (w: WireKind) => void }) {
  const t = useT()
  const [q, setQ] = React.useState("")
  const keys = Object.keys(WIRE_SPECS) as WireKind[]
  const filtered = keys.filter((k) =>
    WIRE_SPECS[k].label.toLowerCase().includes(q.toLowerCase().trim())
  )
  return (
    <div className="w-[268px]">
      <div className="relative border-b border-border p-2">
        <Search className="absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Cerca componente…")}
          className="h-8 border-transparent bg-muted pl-7 text-xs"
        />
      </div>
      <ScrollArea className="h-[300px]">
        <div className="p-1.5">
          {wireGroups().map((g) => {
            const items = filtered.filter((k) => WIRE_SPECS[k].group === g)
            if (!items.length) return null
            return (
              <div key={g} className="mb-2">
                <div className="px-1.5 pt-1 pb-1 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                  {g}
                </div>
                <div className="grid grid-cols-2 gap-1">
                  {items.map((k) => (
                    <button
                      key={k}
                      onClick={() => onPick(k)}
                      className="truncate rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-muted"
                    >
                      {WIRE_SPECS[k].label}
                    </button>
                  ))}
                </div>
              </div>
            )
          })}
          {!filtered.length ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {t("Nessun componente")}
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </div>
  )
}

export function IconPanel({ onPick }: { onPick: (name: string) => void }) {
  const t = useT()
  const [q, setQ] = React.useState("")
  const query = q.toLowerCase().trim()
  const cats = query
    ? [
        {
          label: t("Risultati"),
          icons: Object.keys(ICONS).filter((n) => n.includes(query)),
        },
      ]
    : ICON_CATEGORIES
  return (
    <div className="w-[280px]">
      <div className="relative border-b border-border p-2">
        <Search className="absolute top-1/2 left-4 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("Cerca fra 250+ icone…")}
          className="h-8 border-transparent bg-muted pl-7 text-xs"
        />
      </div>
      <ScrollArea className="h-[320px]">
        <div className="p-2">
          {cats.map((c) => (
            <div key={c.label} className="mb-3">
              <div className="pb-1.5 text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
                {t(c.label)}
              </div>
              <div className="grid grid-cols-8 gap-0.5">
                {c.icons.map((name) => (
                  <button
                    key={name}
                    title={name}
                    onClick={() => onPick(name)}
                    className="flex size-8 items-center justify-center rounded-md text-foreground/80 transition hover:bg-muted hover:text-foreground"
                  >
                    <Glyph name={name} size={17} strokeWidth={1.8} />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </ScrollArea>
    </div>
  )
}
