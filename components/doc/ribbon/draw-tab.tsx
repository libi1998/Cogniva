"use client"

import * as React from "react"
import {
  ChevronDown,
  Eraser,
  Hand,
  Highlighter,
  MousePointer2,
  PenTool,
  Pencil,
  Play,
  Plus,
  RotateCcw,
  Shapes,
  SquarePen,
  Trash2,
  Undo2,
  Frame,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { PEN_COLORS, PEN_LABELS, PEN_WIDTHS, type Pen } from "@/lib/ink"
import { getWorkspace } from "@/lib/store"
import { cn } from "@/lib/utils"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  RibbonRows,
  useCloseRibbonMenu,
} from "./ribbon-ui"
import type { RibbonCtx } from "./shared"

import { useT } from "@/lib/i18n/client"
/** L'icona di una penna, col suo colore e spessore sotto */
function PenIcon({ pen }: { pen: Pen }) {
  const Icon =
    pen.kind === "highlighter"
      ? Highlighter
      : pen.kind === "pencil"
        ? Pencil
        : PenTool
  return (
    <span className="flex flex-col items-center gap-0.5">
      {/* su un fondo chiaro fisso: anche la penna nera si vede col tema scuro */}
      <span className="flex size-6 items-center justify-center rounded-md bg-zinc-100 ring-1 ring-black/10">
        <Icon className="size-4" style={{ color: pen.color }} />
      </span>
      <span
        className="w-6 rounded-full"
        style={{
          height: Math.max(2, Math.min(6, pen.width / 2.5)),
          background: pen.color,
          opacity: pen.kind === "highlighter" ? 0.55 : 1,
        }}
      />
    </span>
  )
}

function PenOptions({
  pen,
  onChange,
  onRemove,
}: {
  pen: Pen
  onChange: (patch: Partial<Pen>) => void
  onRemove: () => void
}) {
  const t = useT()
  const close = useCloseRibbonMenu()
  return (
    <>
      <DropdownMenuLabel>
        {t("{pen}: spessore", { pen: PEN_LABELS[pen.kind] })}
      </DropdownMenuLabel>
      <div className="flex items-center gap-1 px-1.5 pb-1.5">
        {PEN_WIDTHS[pen.kind].map((w) => (
          <button
            key={w}
            type="button"
            title={t("{width} px", { width: String(w).replace(".", ",") })}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onChange({ width: w })}
            className={cn(
              "flex h-8 flex-1 items-center justify-center rounded-md border transition hover:bg-muted",
              pen.width === w ? "border-primary bg-accent" : "border-border"
            )}
          >
            <span
              className="rounded-full"
              style={{
                width: Math.max(3, Math.min(20, w)),
                height: Math.max(3, Math.min(20, w)),
                background: pen.color,
                opacity: pen.kind === "highlighter" ? 0.55 : 1,
              }}
            />
          </button>
        ))}
      </div>
      <DropdownMenuLabel>{t("Colore")}</DropdownMenuLabel>
      <div className="grid grid-cols-6 gap-1.5 px-1.5 pb-1.5">
        {PEN_COLORS.map((c) => (
          <button
            key={c}
            type="button"
            title={c}
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              onChange({ color: c })
              close?.()
            }}
            className={cn(
              "aspect-square rounded-md ring-1 ring-black/15 transition hover:scale-110",
              pen.color === c &&
                "ring-2 ring-ring ring-offset-1 ring-offset-background"
            )}
            style={{ background: c }}
          />
        ))}
      </div>
      <label className="flex items-center justify-between gap-2 px-2 pb-2 text-xs text-muted-foreground">
        {t("Altri colori")}
        <input
          type="color"
          value={pen.color}
          onChange={(e) => onChange({ color: e.target.value })}
          className="h-7 w-12 cursor-pointer rounded border border-border bg-transparent"
        />
      </label>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onRemove}>
        <Trash2 /> {t("Rimuovi questa penna")}
      </DropdownMenuItem>
    </>
  )
}

/**
 * «Disegno», come in Word: penne, matite ed evidenziatori sopra al foglio,
 * gomma, forme riconosciute dal tratto e riproduzione.
 */
export function DrawTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { ink, theme, setTheme } = ctx

  return (
    <>
      <RibbonGroup
        label={t("Strumenti di disegno")}
        icon={<PenTool className="size-5" />}
        safe
      >
        <RibbonButton
          large
          label={t("Seleziona")}
          title={t("Torna al testo (⎋)")}
          active={ink.tool === "select"}
          icon={<MousePointer2 className="size-5" />}
          onClick={() => ink.setTool("select")}
        />
        <RibbonButton
          large
          label={t("Disegna con tocco")}
          title={t("Con il dito si disegna invece di scorrere la pagina")}
          active={ink.touchDraw}
          icon={<Hand className="size-5" />}
          onClick={() => {
            ink.setTouchDraw(!ink.touchDraw)
            if (!ink.touchDraw && ink.tool === "select") ink.setTool("draw")
          }}
        />
        <RibbonButton
          large
          label={t("Gomma")}
          title={t("Cancella i tratti su cui passi")}
          active={ink.tool === "eraser"}
          icon={<Eraser className="size-5" />}
          onClick={() =>
            ink.setTool(ink.tool === "eraser" ? "select" : "eraser")
          }
        />
        <div className="mx-1 flex items-center gap-0.5 border-l border-border/70 pl-1.5">
          {ink.pens.map((pen) => {
            const active = ink.tool === "draw" && ink.activePen === pen.id
            return (
              <span key={pen.id} className="flex flex-col items-center">
                <RibbonButton
                  title={t("{pen} · {width} px", {
                    pen: PEN_LABELS[pen.kind],
                    width: String(pen.width).replace(".", ","),
                  })}
                  active={active}
                  icon={<PenIcon pen={pen} />}
                  onClick={() =>
                    active ? ink.setTool("select") : ink.selectPen(pen.id)
                  }
                  className="h-10 w-9"
                />
                <RibbonMenu
                  className="w-56"
                  trigger={
                    <RibbonButton
                      title={t("Colore e spessore")}
                      className="h-4 w-9"
                      icon={<ChevronDown className="size-3 opacity-60" />}
                    />
                  }
                >
                  <PenOptions
                    pen={pen}
                    onChange={(patch) => {
                      ink.updatePen(pen.id, patch)
                      ink.selectPen(pen.id)
                    }}
                    onRemove={() => ink.removePen(pen.id)}
                  />
                </RibbonMenu>
              </span>
            )
          })}
          <RibbonMenu
            className="w-52"
            trigger={
              <RibbonButton
                large
                chevron
                label={t("Aggiungi penna")}
                icon={<Plus className="size-5" />}
              />
            }
          >
            {(["pen", "pencil", "highlighter"] as const).map((kind) => (
              <DropdownMenuItem key={kind} onClick={() => ink.addPen(kind)}>
                {kind === "highlighter" ? (
                  <Highlighter />
                ) : kind === "pencil" ? (
                  <Pencil />
                ) : (
                  <PenTool />
                )}
                {PEN_LABELS[kind]}
              </DropdownMenuItem>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={ink.resetPens}>
              <RotateCcw /> {t("Ripristina le penne predefinite")}
            </DropdownMenuItem>
          </RibbonMenu>
        </div>
      </RibbonGroup>

      <RibbonGroup
        label={t("Converti")}
        icon={<Shapes className="size-5" />}
        safe
      >
        <RibbonButton
          large
          label={t("Da input penna a forma")}
          title={t(
            "Linee, triangoli, rettangoli e cerchi disegnati diventano forme precise"
          )}
          active={ink.toShape}
          icon={<Shapes className="size-5" />}
          onClick={() => {
            ink.setToShape(!ink.toShape)
            if (!ink.toShape) ink.setTool("draw")
          }}
        />
      </RibbonGroup>

      <RibbonGroup
        label={t("Modifica")}
        icon={<Eraser className="size-5" />}
        safe
      >
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Annulla tratto")}
            icon={<Undo2 className="size-4" />}
            disabled={!ink.canUndo}
            className="justify-start"
            onClick={ink.undo}
          />
          <RibbonButton
            compact
            label={t("Cancella tutto l'input penna")}
            icon={<Trash2 className="size-4" />}
            disabled={!ink.strokes.length}
            className="justify-start"
            onClick={() => {
              ink.clear()
              toast(t("Disegni cancellati"), {
                action: {
                  label: t("Annulla||annulla l'ultima modifica"),
                  onClick: ink.undo,
                },
              })
            }}
          />
          <RibbonButton
            compact
            label={
              theme.inkVisible
                ? t("Nascondi input penna")
                : t("Mostra input penna")
            }
            icon={<SquarePen className="size-4" />}
            className="justify-start"
            onClick={() => setTheme({ inkVisible: !theme.inkVisible })}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label={t("Inserisci")} icon={<Frame className="size-5" />}>
        <RibbonButton
          large
          label={t("Canvas di disegno")}
          title={t("Una board incorporata, con penne, forme e connettori")}
          icon={<SquarePen className="size-5" />}
          onClick={() => {
            const id = getWorkspace().createFile(
              "board",
              t("Canvas di disegno")
            )
            ctx.onInsertBoard(id)
            toast.success(t("Canvas inserito: aprilo per disegnare"))
          }}
        />
      </RibbonGroup>

      <RibbonGroup
        label={t("Riproduci")}
        icon={<Play className="size-5" />}
        safe
      >
        <RibbonButton
          large
          label={t("Riproduzione input penna")}
          title={t("Ridisegna i tratti nell'ordine in cui sono stati fatti")}
          disabled={!ink.strokes.length || ink.replaying}
          icon={<Play className="size-5" />}
          onClick={ink.replay}
        />
      </RibbonGroup>
    </>
  )
}
