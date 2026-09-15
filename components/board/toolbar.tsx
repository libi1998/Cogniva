"use client"

import * as React from "react"
import {
  ChartColumnBig,
  Eraser,
  Frame,
  Hand,
  Highlighter,
  LayoutTemplate,
  MousePointer2,
  PenLine,
  Shapes,
  Smile,
  Spline,
  SquareDashed,
  StickyNote,
  Table2,
  Type,
} from "lucide-react"
import { cn } from "@/lib/utils"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Kbd } from "@/components/ui/kbd"
import { SWATCHES, type SwatchKey } from "@/lib/palette"
import {
  FramePanel,
  IconPanel,
  ShapeGlyph,
  ShapePanel,
  WirePanel,
} from "./panels"
import { toolKey, type Tool } from "./tools"
import type { BoardMode, NodeShape } from "@/lib/types"

function ToolButton({
  active,
  label,
  shortcut,
  onClick,
  children,
}: {
  active?: boolean
  label: string
  shortcut?: string
  onClick?: () => void
  children: React.ReactNode
}) {
  return (
    <Tooltip>
      <TooltipTrigger
        type="button"
        aria-label={label}
        onClick={onClick}
        className={cn(
          "flex size-9 items-center justify-center rounded-xl transition-colors",
          active
            ? "bg-accent text-accent-foreground"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        {children}
      </TooltipTrigger>
      <TooltipContent side="right">
        {label}
        {shortcut ? <Kbd>{shortcut}</Kbd> : null}
      </TooltipContent>
    </Tooltip>
  )
}

/* ------------------------------- toolbar --------------------------------- */

function Flyout({
  id,
  open,
  setOpen,
  label,
  icon,
  active,
  children,
}: {
  id: string
  open: string | null
  setOpen: (v: string | null) => void
  label: string
  icon: React.ReactNode
  active: boolean
  children: React.ReactNode
}) {
  return (
    <Popover open={open === id} onOpenChange={(o) => setOpen(o ? id : null)}>
      <Tooltip>
        <TooltipTrigger
          render={
            <PopoverTrigger
              aria-label={label}
              className={cn(
                "flex size-9 items-center justify-center rounded-xl transition-colors",
                active || open === id
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            />
          }
        >
          {icon}
        </TooltipTrigger>
        <TooltipContent side="right">{label}</TooltipContent>
      </Tooltip>
      <PopoverContent side="right" align="start" className="w-auto p-0">
        {children}
      </PopoverContent>
    </Popover>
  )
}

export function BoardToolbar({
  tool,
  onTool,
  color,
  onColor,
  mode,
}: {
  tool: Tool
  onTool: (t: Tool) => void
  color: SwatchKey
  onColor: (c: SwatchKey) => void
  mode: BoardMode
}) {
  const [open, setOpen] = React.useState<string | null>(null)
  const key = toolKey(tool)

  const pick = (t: Tool) => {
    onTool(t)
    setOpen(null)
  }

  const shapeTools = (
    <>
      <Flyout
        open={open}
        setOpen={setOpen}
        id="shapes"
        label="Forme"
        active={
          tool.t === "shape" && tool.shape !== "note" && tool.shape !== "text"
        }
        icon={<Shapes className="size-[18px]" />}
      >
        <ShapePanel onPick={(s: NodeShape) => pick({ t: "shape", shape: s })} />
      </Flyout>
      <ToolButton
        label="Connettore"
        shortcut="C"
        active={tool.t === "connect"}
        onClick={() => pick({ t: "connect" })}
      >
        <Spline className="size-[18px]" />
      </ToolButton>
    </>
  )

  const wireTools = (
    <Flyout
      open={open}
      setOpen={setOpen}
      id="wire"
      label="Componenti"
      active={tool.t === "wire"}
      icon={<LayoutTemplate className="size-[18px]" />}
    >
      <WirePanel onPick={(w) => pick({ t: "wire", wire: w })} />
    </Flyout>
  )

  return (
    // la colonna va dall'alto fino sopra ai controlli dello zoom: su uno
    // schermo basso la barra scorre invece di coprirli. La colonna non prende
    // i clic, solo la barra
    <div className="pointer-events-none absolute top-3 bottom-[calc(max(0.75rem,env(safe-area-inset-bottom))+3.25rem)] left-[max(0.75rem,env(safe-area-inset-left))] z-20 flex items-center sm:top-4 sm:bottom-16 sm:left-4">
      <div className="pointer-events-auto flex max-h-full [scrollbar-width:none] flex-col items-center gap-1 overflow-y-auto overscroll-contain rounded-2xl border border-black/5 bg-card/95 p-1.5 shadow-[0_8px_28px_-8px_rgba(9,9,11,0.2)] backdrop-blur dark:border-white/10 dark:shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)]">
        <ToolButton
          label="Seleziona"
          shortcut="V"
          active={tool.t === "select"}
          onClick={() => pick({ t: "select" })}
        >
          <MousePointer2 className="size-[18px]" />
        </ToolButton>
        <ToolButton
          label="Mano"
          shortcut="H"
          active={tool.t === "hand"}
          onClick={() => pick({ t: "hand" })}
        >
          <Hand className="size-[18px]" />
        </ToolButton>

        <div className="my-0.5 h-px w-6 bg-border" />

        {mode === "wireframe" ? (
          <>
            {wireTools}
            <Flyout
              open={open}
              setOpen={setOpen}
              id="frames"
              label="Frame"
              active={tool.t === "frame"}
              icon={<Frame className="size-[18px]" />}
            >
              <FramePanel onPick={(f) => pick({ t: "frame", frame: f })} />
            </Flyout>
            {shapeTools}
          </>
        ) : mode === "card" ? (
          <>
            <ToolButton
              label="Post-it"
              shortcut="S"
              active={key === "shape:note"}
              onClick={() => pick({ t: "shape", shape: "note" })}
            >
              <StickyNote className="size-[18px]" />
            </ToolButton>
            <ToolButton
              label="Card"
              shortcut="R"
              active={key === "shape:rounded"}
              onClick={() => pick({ t: "shape", shape: "rounded" })}
            >
              <ShapeGlyph shape="rounded" size={18} />
            </ToolButton>
            {shapeTools}
          </>
        ) : (
          <>
            {shapeTools}
            <ToolButton
              label="Post-it"
              shortcut="S"
              active={key === "shape:note"}
              onClick={() => pick({ t: "shape", shape: "note" })}
            >
              <StickyNote className="size-[18px]" />
            </ToolButton>
          </>
        )}

        <ToolButton
          label="Testo"
          shortcut="T"
          active={key === "shape:text"}
          onClick={() => pick({ t: "shape", shape: "text" })}
        >
          <Type className="size-[18px]" />
        </ToolButton>

        <div className="my-0.5 h-px w-6 bg-border" />

        <ToolButton
          label="Sezione"
          shortcut="G"
          active={tool.t === "section"}
          onClick={() => pick({ t: "section" })}
        >
          <SquareDashed className="size-[18px]" />
        </ToolButton>
        <ToolButton
          label="Tabella"
          shortcut="B"
          active={tool.t === "table"}
          onClick={() => pick({ t: "table" })}
        >
          <Table2 className="size-[18px]" />
        </ToolButton>
        <ToolButton
          label="Grafico"
          shortcut="K"
          active={tool.t === "chart"}
          onClick={() => pick({ t: "chart" })}
        >
          <ChartColumnBig className="size-[18px]" />
        </ToolButton>
        {mode !== "wireframe" ? (
          <Flyout
            open={open}
            setOpen={setOpen}
            id="frames2"
            label="Frame"
            active={tool.t === "frame"}
            icon={<Frame className="size-[18px]" />}
          >
            <FramePanel onPick={(f) => pick({ t: "frame", frame: f })} />
          </Flyout>
        ) : null}
        {mode !== "wireframe" ? wireTools : null}
        <Flyout
          open={open}
          setOpen={setOpen}
          id="icons"
          label="Icone"
          active={tool.t === "icon"}
          icon={<Smile className="size-[18px]" />}
        >
          <IconPanel onPick={(name) => pick({ t: "icon", icon: name })} />
        </Flyout>

        <Flyout
          open={open}
          setOpen={setOpen}
          id="draw"
          label="Disegno"
          active={tool.t === "draw"}
          icon={<PenLine className="size-[18px]" />}
        >
          <div className="w-[190px] p-1">
            <button
              onClick={() => pick({ t: "draw", mode: "pen" })}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-muted"
            >
              <PenLine className="size-4 text-muted-foreground" /> Penna
              <kbd className="ml-auto text-[10px] text-muted-foreground">P</kbd>
            </button>
            <button
              onClick={() => pick({ t: "draw", mode: "highlighter" })}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-muted"
            >
              <Highlighter className="size-4 text-muted-foreground" />{" "}
              Evidenziatore
            </button>
            <button
              onClick={() => pick({ t: "draw", mode: "eraser" })}
              className="flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left text-xs transition hover:bg-muted"
            >
              <Eraser className="size-4 text-muted-foreground" /> Gomma
              <kbd className="ml-auto text-[10px] text-muted-foreground">E</kbd>
            </button>
          </div>
        </Flyout>

        <div className="my-0.5 h-px w-6 bg-border" />

        <div className="grid grid-cols-2 gap-1 p-0.5">
          {SWATCHES.map((s) => (
            <Tooltip key={s.key}>
              <TooltipTrigger
                type="button"
                aria-label={s.label}
                onClick={() => onColor(s.key)}
                className={cn(
                  "size-[15px] rounded-full transition-transform hover:scale-115",
                  color === s.key &&
                    "ring-2 ring-primary ring-offset-1 ring-offset-background"
                )}
                style={{
                  background: s.fill,
                  boxShadow: `inset 0 0 0 1px ${s.border}`,
                }}
              />
              <TooltipContent side="right">{s.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      </div>
    </div>
  )
}
