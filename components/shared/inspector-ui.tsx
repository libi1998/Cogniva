"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { Check } from "lucide-react"
import { Slider } from "@/components/ui/slider"
import { headPath } from "@/lib/geometry"
import type {
  ArrowHead,
  BackgroundPattern,
  EdgeRouting,
  LineStyle,
} from "@/lib/types"

export function Section({
  title,
  children,
  action,
}: {
  title: string
  children: React.ReactNode
  action?: React.ReactNode
}) {
  return (
    <div className="border-b border-border/70 px-4 py-3.5 last:border-b-0">
      <div className="mb-2.5 flex items-center justify-between">
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-muted-foreground uppercase">
          {title}
        </h3>
        {action}
      </div>
      <div className="space-y-3">{children}</div>
    </div>
  )
}

export function Row({
  label,
  children,
  stacked,
}: {
  label: string
  children: React.ReactNode
  stacked?: boolean
}) {
  if (stacked) {
    return (
      <div className="space-y-1.5">
        <div className="text-xs font-medium text-muted-foreground">{label}</div>
        {children}
      </div>
    )
  }
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="shrink-0 text-xs font-medium text-muted-foreground">
        {label}
      </div>
      <div className="min-w-0 flex-1 [&>*]:ml-auto">{children}</div>
    </div>
  )
}

/* ------------------------------- Segmented -------------------------------- */

export type SegItem<T extends string> = {
  value: T
  label?: string
  icon?: React.ReactNode
  title?: string
}

export function Segmented<T extends string>({
  items,
  value,
  onChange,
  className,
  size = "md",
}: {
  items: SegItem<T>[]
  value: T
  onChange: (v: T) => void
  className?: string
  size?: "sm" | "md"
}) {
  return (
    <div
      className={cn(
        "flex w-full items-center gap-0.5 rounded-lg bg-muted p-0.5",
        className
      )}
    >
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          title={it.title ?? it.label}
          onClick={() => onChange(it.value)}
          className={cn(
            "flex flex-1 items-center justify-center gap-1 rounded-[7px] font-medium transition-all",
            size === "sm" ? "h-6 text-[11px]" : "h-7 text-xs",
            value === it.value
              ? "bg-background text-foreground shadow-sm ring-1 ring-black/5"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          {it.icon}
          {it.label ? <span className="truncate">{it.label}</span> : null}
        </button>
      ))}
    </div>
  )
}

/* ------------------------------ Color grid -------------------------------- */

export function ColorGrid({
  colors,
  value,
  onChange,
  columns = 5,
  ring = true,
}: {
  colors: { value: string; label: string; swatch?: string; border?: string }[]
  value: string
  onChange: (v: string) => void
  columns?: number
  ring?: boolean
}) {
  return (
    <div
      className="grid gap-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {colors.map((c) => {
        const active = value.toLowerCase() === c.value.toLowerCase()
        return (
          <button
            key={c.value + c.label}
            type="button"
            title={c.label}
            onClick={() => onChange(c.value)}
            className={cn(
              "relative flex aspect-square items-center justify-center rounded-[9px] transition",
              "ring-offset-1 ring-offset-background hover:scale-[1.06]",
              active && ring && "ring-2 ring-foreground/70"
            )}
            style={{
              background: c.swatch ?? c.value,
              boxShadow: `inset 0 0 0 1px ${c.border ?? "rgba(15,1,26,0.12)"}`,
            }}
          >
            {active && !ring ? (
              <Check className="size-3.5 text-foreground/70" />
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

/* -------------------------------- Numeric --------------------------------- */

export function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  suffix = "px",
  onChange,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  suffix?: string
  onChange: (v: number) => void
  onCommit?: () => void
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-muted-foreground">
          {label}
        </span>
        <span className="text-xs font-medium text-foreground/70 tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <Slider
        // l'etichetta qui sopra è solo scritta: senza aria-label il cursore
        // arrivava ai lettori di schermo senza nome
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        onValueChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        onValueCommitted={() => onCommit?.()}
      />
    </div>
  )
}

/* --------------------------------- Icone ---------------------------------- */

export function HeadIcon({
  type,
  reversed,
  color = "currentColor",
}: {
  type: ArrowHead
  reversed?: boolean
  color?: string
}) {
  const s = 6
  const h = headPath(type, s)
  const tipX = reversed ? 6 : 38
  const angle = reversed ? 180 : 0
  const lineStart = reversed ? 10 : 6
  const lineEnd = reversed ? 38 : 34
  return (
    <svg width="44" height="14" viewBox="0 0 44 14" fill="none" aria-hidden>
      <path
        d={`M ${lineStart} 7 L ${lineEnd} 7`}
        stroke={color}
        strokeWidth="1.6"
        strokeLinecap="round"
      />
      {h ? (
        <path
          d={h.d}
          transform={`translate(${tipX} 7) rotate(${angle})`}
          fill={h.filled ? color : "var(--background)"}
          stroke={color}
          strokeWidth={h.closed && !h.filled ? 1.4 : h.filled ? 0 : 1.6}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  )
}

export function RoutingIcon({ type }: { type: EdgeRouting }) {
  const common = {
    stroke: "currentColor",
    strokeWidth: 1.7,
    fill: "none",
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      {type === "straight" && <path d="M3 14 L15 4" {...common} />}
      {type === "elbow" && <path d="M3 14 L3 8 Q3 6 5 6 L15 6" {...common} />}
      {type === "curved" && <path d="M3 14 C3 6 15 12 15 4" {...common} />}
    </svg>
  )
}

export function LineStyleIcon({ type }: { type: LineStyle }) {
  const dash =
    type === "dashed" ? "5 3.5" : type === "dotted" ? "0.01 3.6" : undefined
  return (
    <svg width="26" height="16" viewBox="0 0 26 16" aria-hidden>
      <path
        d={
          type === "sketch"
            ? "M2 9 C6 5.5 9 11 13 7.5 C17 4 20 10 24 7"
            : "M2 8 L24 8"
        }
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeDasharray={dash}
        fill="none"
      />
    </svg>
  )
}

export function PatternIcon({ type }: { type: BackgroundPattern }) {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <rect
        x="1.5"
        y="1.5"
        width="15"
        height="15"
        rx="3.5"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        opacity="0.45"
      />
      {type === "dots" &&
        [5, 9, 13].map((x) =>
          [5, 9, 13].map((y) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="1" fill="currentColor" />
          ))
        )}
      {type === "grid" && (
        <g stroke="currentColor" strokeWidth="1">
          <path d="M6.5 2v14M11.5 2v14M2 6.5h14M2 11.5h14" />
        </g>
      )}
      {type === "cross" && (
        <g stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <path d="M5 3.6v2.8M3.6 5h2.8M13 3.6v2.8M11.6 5h2.8M5 11.6v2.8M3.6 13h2.8M13 11.6v2.8M11.6 13h2.8" />
        </g>
      )}
      {type === "lines" && (
        <g stroke="currentColor" strokeWidth="1">
          <path d="M2 6.5h14M2 11.5h14" />
        </g>
      )}
    </svg>
  )
}
