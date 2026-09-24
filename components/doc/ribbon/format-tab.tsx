"use client"

import * as React from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  BetweenHorizontalEnd,
  BetweenHorizontalStart,
  BetweenVerticalEnd,
  BetweenVerticalStart,
  ChartColumnBig,
  Columns3,
  Heading,
  ListTree,
  Merge,
  MousePointerClick,
  NotebookPen,
  PaintBucket,
  Rows3,
  Scaling,
  SlidersHorizontal,
  Split,
  SquareDashed,
  TableColumnsSplit,
  Trash2,
  Shapes,
  Type,
} from "lucide-react"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { CHART_TYPES, parseChartAttr, type ChartType } from "@/lib/chart"
import {
  isLineShape,
  shapeImageAttrs,
  type DocShapeKind,
} from "@/lib/shape-svg"
import { SWATCHES, whim } from "@/lib/palette"
import type { BorderKind, BorderLine } from "@/lib/table-format"
import { cn } from "@/lib/utils"
import { ObjectOptions } from "../doc-inspector"
import type { DocState } from "../use-doc-state"
import { ArrangeGroup } from "./layout-tab"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  RibbonPopover,
  RibbonRow,
  RibbonRows,
  Stepper,
  SwatchGrid,
  useCloseRibbonMenu,
} from "./ribbon-ui"
import { CM, PT, type RibbonCtx } from "./shared"

import { useT, tr } from "@/lib/i18n/client"

/**
 * La scheda contestuale, come «Formato immagine» e «Layout tabella» di Word:
 * compare accanto a «Visualizza» solo quando si lavora su un oggetto — una
 * tabella, un'immagine o una forma, un grafico, un sommario, un video, un
 * modello 3D, un'equazione, una nota — e raccoglie i suoi comandi. Prende il
 * posto del pannello Stile che stava sempre aperto a destra del foglio.
 */

export type FormatKind =
  | "shape"
  | "image"
  | "chart"
  | "toc"
  | "index"
  | "video"
  | "model3d"
  | "math"
  | "embed"
  | "footnote"
  | "citation"
  | "bibliography"
  | "table"

/** L'oggetto su cui si lavora, o null nel testo semplice */
export function formatKind(st: DocState): FormatKind | null {
  if (st.onImage && st.imageShape) return "shape"
  if (st.onImage) return "image"
  if (st.onChart) return "chart"
  if (st.onToc) return "toc"
  if (st.onIndex) return "index"
  if (st.onVideo) return "video"
  if (st.onModel3d) return "model3d"
  if (st.onMath) return "math"
  if (st.onEmbed) return "embed"
  if (st.onFootnote) return "footnote"
  if (st.onCitation) return "citation"
  if (st.onBibliography) return "bibliography"
  if (st.inTable) return "table"
  return null
}

/** Il nome della scheda, come in Word */
export function formatTabLabel(kind: FormatKind): string {
  switch (kind) {
    case "shape":
      return tr("Formato forma")
    case "image":
      return tr("Formato immagine")
    case "chart":
      return tr("Formato grafico")
    case "toc":
      return tr("Sommario")
    case "index":
      return tr("Indice")
    case "video":
      return tr("Video")
    case "model3d":
      return tr("Modello 3D")
    case "math":
      return tr("Equazione")
    case "embed":
      return tr("Board")
    case "footnote":
      return tr("Nota")
    case "citation":
      return tr("Citazione")
    case "bibliography":
      return tr("Bibliografia")
    case "table":
      return tr("Tabella")
  }
}

/* ------------------------------- in comune ------------------------------- */

/** «Altre opzioni»: tutte le impostazioni dell'oggetto, in un riquadro */
function OptionsButton({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  return (
    <RibbonPopover
      label={t("Altre opzioni")}
      className="w-80"
      align="end"
      trigger={
        <RibbonButton
          large
          chevron
          label={t("Altre opzioni")}
          icon={<SlidersHorizontal className="size-5" />}
        />
      }
    >
      <ObjectOptions
        editor={ctx.editor}
        st={ctx.st}
        theme={ctx.theme}
        pageHeight={ctx.pageHeight}
        sources={ctx.sources}
        onSources={ctx.openSources}
      />
    </RibbonPopover>
  )
}

/** Sposta su e giù di un blocco, come ⌥↑ e ⌥↓ */
function MoveRows({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const move = (dir: "up" | "down") =>
    ctx.editor.chain().focus().moveBlock(dir).run()
  return (
    <RibbonRows>
      <RibbonButton
        compact
        label={t("Sposta su")}
        title={t("Sposta su di un blocco ⌥↑")}
        icon={<ArrowUp className="size-4" />}
        className="justify-start"
        onClick={() => move("up")}
      />
      <RibbonButton
        compact
        label={t("Sposta giù")}
        title={t("Sposta giù di un blocco ⌥↓")}
        icon={<ArrowDown className="size-4" />}
        className="justify-start"
        onClick={() => move("down")}
      />
    </RibbonRows>
  )
}

function DeleteButton({ label, run }: { label: string; run: () => void }) {
  return (
    <RibbonButton
      large
      label={label}
      icon={<Trash2 className="size-5" />}
      className="text-destructive hover:text-destructive"
      onClick={run}
    />
  )
}

function ObjectGroup({
  ctx,
  deleteLabel,
  movable = true,
}: {
  ctx: RibbonCtx
  deleteLabel: string
  movable?: boolean
}) {
  const t = useT()
  return (
    <RibbonGroup
      label={t("Oggetto")}
      icon={<SlidersHorizontal className="size-5" />}
    >
      {movable ? <MoveRows ctx={ctx} /> : null}
      <OptionsButton ctx={ctx} />
      <DeleteButton
        label={deleteLabel}
        run={() => ctx.editor.chain().focus().deleteSelection().run()}
      />
    </RibbonGroup>
  )
}

/** Allineamento a sinistra, al centro, a destra di un oggetto a blocco */
function AlignButtons({
  value,
  onChange,
}: {
  value: string
  onChange: (align: "left" | "center" | "right") => void
}) {
  const t = useT()
  const items = [
    ["left", t("A sinistra"), <AlignLeft key="l" className="size-4" />],
    ["center", t("Al centro"), <AlignCenter key="c" className="size-4" />],
    ["right", t("A destra"), <AlignRight key="r" className="size-4" />],
  ] as const
  return (
    <RibbonRow>
      {items.map(([align, label, icon]) => (
        <RibbonButton
          key={align}
          title={label}
          active={value === align}
          icon={icon}
          onClick={() => onChange(align)}
        />
      ))}
    </RibbonRow>
  )
}

/* -------------------------------- tabella -------------------------------- */

const LINE_COLORS = [
  {
    get label() {
      return tr("Nero")
    },
    value: whim.base[900],
  },
  {
    get label() {
      return tr("Grigio")
    },
    value: whim.base[400],
  },
  ...SWATCHES.filter((s) => s.key !== "white" && s.key !== "gray").map((s) => ({
    label: s.label,
    value: s.solid,
  })),
]

const NONE_SWATCH =
  "linear-gradient(135deg, transparent 45%, #e03177 45% 55%, transparent 55%)"

const CELL_COLORS = [
  {
    get label() {
      return tr("Nessuno")
    },
    value: "",
    swatch: NONE_SWATCH,
  },
  ...SWATCHES.map((s) => ({ label: s.label, value: s.fill })),
  ...SWATCHES.filter((s) => s.key !== "white").map((s) => ({
    label: tr("{color} scuro", { color: s.label }),
    value: s.solid,
  })),
]

/** Le icone dei bordi: un quadrato di quattro celle con le linee toccate */
function BorderGlyph({ kind }: { kind: BorderKind }) {
  const on = (edge: string) => {
    switch (kind) {
      case "all":
        return true
      case "outside":
        return ["t", "r", "b", "l"].includes(edge)
      case "inside":
        return edge === "h" || edge === "v"
      case "insideH":
        return edge === "h"
      case "insideV":
        return edge === "v"
      case "top":
        return edge === "t"
      case "bottom":
        return edge === "b"
      case "left":
        return edge === "l"
      case "right":
        return edge === "r"
      default:
        return false
    }
  }
  const line = (edge: string, d: string) => (
    <path
      key={edge}
      d={d}
      stroke="currentColor"
      strokeWidth={on(edge) ? 1.6 : 0.8}
      strokeDasharray={on(edge) ? undefined : "1.2 1.2"}
      opacity={on(edge) ? 1 : 0.45}
    />
  )
  return (
    <svg viewBox="0 0 16 16" className="size-4" fill="none" aria-hidden>
      {line("t", "M2 2H14")}
      {line("b", "M2 14H14")}
      {line("l", "M2 2V14")}
      {line("r", "M14 2V14")}
      {line("h", "M2 8H14")}
      {line("v", "M8 2V14")}
    </svg>
  )
}

const BORDER_KINDS: { kind: BorderKind; label: string }[] = [
  {
    kind: "bottom",
    get label() {
      return tr("Bordo inferiore")
    },
  },
  {
    kind: "top",
    get label() {
      return tr("Bordo superiore")
    },
  },
  {
    kind: "left",
    get label() {
      return tr("Bordo sinistro")
    },
  },
  {
    kind: "right",
    get label() {
      return tr("Bordo destro")
    },
  },
  {
    kind: "all",
    get label() {
      return tr("Tutti i bordi")
    },
  },
  {
    kind: "outside",
    get label() {
      return tr("Bordi esterni")
    },
  },
  {
    kind: "inside",
    get label() {
      return tr("Bordi interni")
    },
  },
  {
    kind: "insideH",
    get label() {
      return tr("Bordo orizzontale interno")
    },
  },
  {
    kind: "insideV",
    get label() {
      return tr("Bordo verticale interno")
    },
  },
  {
    kind: "none",
    get label() {
      return tr("Nessun bordo")
    },
  },
]

const LINE_WIDTHS = [0.5, 1, 1.5, 2, 3, 4.5]

/**
 * «Bordi» come in Word: si sceglie la penna (tipo, spessore, colore) e poi
 * dove passarla — sulla cella del cursore o sulle celle selezionate.
 */
function BordersPanel({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const close = useCloseRibbonMenu()
  const [pen, setPen] = React.useState<BorderLine>({
    width: 1,
    style: "solid",
    color: whim.base[900],
  })
  const apply = (kind: BorderKind) => {
    ctx.editor.chain().focus().setCellBorders(kind, pen).run()
  }
  return (
    <div className="space-y-3 p-3">
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          {t("Tipo di linea")}
        </p>
        <div className="grid grid-cols-4 gap-1">
          {(
            [
              ["solid", t("Continua")],
              ["dashed", t("Trattini")],
              ["dotted", t("Punti")],
              ["double", t("Doppia")],
            ] as const
          ).map(([style, label]) => (
            <button
              key={style}
              type="button"
              title={label}
              aria-pressed={pen.style === style}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPen({ ...pen, style })}
              className={cn(
                "flex h-7 items-center justify-center rounded-md border px-1",
                pen.style === style
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-muted"
              )}
            >
              <span
                className="block w-full"
                style={{
                  borderTop: `${style === "double" ? 3 : 2}px ${style} currentColor`,
                }}
              />
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          {t("Spessore")}
        </p>
        <div className="grid grid-cols-6 gap-1">
          {LINE_WIDTHS.map((w) => (
            <button
              key={w}
              type="button"
              aria-pressed={pen.width === w}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => setPen({ ...pen, width: w })}
              className={cn(
                "h-7 rounded-md border text-[11px] tabular-nums",
                pen.width === w
                  ? "border-primary bg-accent"
                  : "border-border hover:bg-muted"
              )}
            >
              {String(w).replace(".", ",")}
            </button>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-0.5 text-[11px] font-medium text-muted-foreground">
          {t("Colore")}
        </p>
        <PenColors
          value={pen.color}
          onPick={(color) => setPen({ ...pen, color })}
        />
      </div>
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-muted-foreground">
          {t("Applica alle celle")}
        </p>
        <div className="grid grid-cols-2 gap-1">
          {BORDER_KINDS.map(({ kind, label }) => (
            <button
              key={kind}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => apply(kind)}
              className="flex h-7 items-center gap-1.5 rounded-md border border-border px-2 text-left text-[11px] hover:bg-muted"
            >
              <BorderGlyph kind={kind} />
              {label}
            </button>
          ))}
          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              ctx.editor.chain().focus().setCellBorders("reset").run()
              close?.()
            }}
            className="col-span-2 flex h-7 items-center justify-center rounded-md border border-border px-2 text-[11px] hover:bg-muted"
          >
            {t("Bordi della tabella (predefiniti)")}
          </button>
        </div>
      </div>
    </div>
  )
}

/** Tavolozza della penna: non chiude il riquadro a ogni colore */
function PenColors({
  value,
  onPick,
}: {
  value: string
  onPick: (color: string) => void
}) {
  return (
    <div className="grid grid-cols-8 gap-1.5 py-1">
      {LINE_COLORS.map((c) => (
        <button
          key={c.label}
          type="button"
          title={c.label}
          aria-pressed={value === c.value}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => onPick(c.value)}
          className={cn(
            "aspect-square rounded-md transition hover:scale-110",
            value === c.value &&
              "ring-2 ring-ring ring-offset-1 ring-offset-background"
          )}
          style={{
            background: c.value,
            boxShadow: "inset 0 0 0 1px rgba(15,1,26,0.16)",
          }}
        />
      ))}
    </div>
  )
}

/** I nove allineamenti della cella: in orizzontale il testo, in verticale la cella */
function CellAlignGrid({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { st, editor } = ctx
  const vs = ["top", "middle", "bottom"] as const
  const hs = ["left", "center", "right"] as const
  const vLabel = {
    top: t("In alto"),
    middle: t("Al centro"),
    bottom: t("In basso"),
  }
  const hLabel = {
    left: t("a sinistra"),
    center: t("al centro"),
    right: t("a destra"),
  }
  return (
    <div
      className="grid grid-cols-3 gap-0.5"
      role="group"
      aria-label={t("Allineamento")}
    >
      {vs.flatMap((v) =>
        hs.map((h) => {
          const active = st.cellVAlign === v && st.align === h
          return (
            <button
              key={`${v}-${h}`}
              type="button"
              title={`${vLabel[v]} ${hLabel[h]}`}
              aria-label={`${vLabel[v]} ${hLabel[h]}`}
              aria-pressed={active}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                editor
                  .chain()
                  .focus()
                  .setTextAlign(h)
                  .setCellAttribute("verticalAlign", v)
                  .run()
              }
              className={cn(
                "flex size-[22px] items-center justify-center rounded-[4px] hover:bg-muted",
                active && "bg-accent"
              )}
            >
              <span className="relative block size-3.5 rounded-[2px] border border-current/50">
                <span
                  className="absolute h-[2px] w-1.5 rounded-full bg-current"
                  style={{
                    left: h === "left" ? 1 : h === "center" ? 3 : 5,
                    top: v === "top" ? 1.5 : v === "middle" ? 5 : 8.5,
                  }}
                />
              </span>
            </button>
          )
        })
      )}
    </div>
  )
}

function TableTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, st } = ctx
  const chain = () => editor.chain().focus()

  return (
    <>
      <RibbonGroup
        label={t("Seleziona")}
        icon={<MousePointerClick className="size-5" />}
      >
        <RibbonMenu
          className="w-48"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Seleziona")}
              icon={<MousePointerClick className="size-5" />}
            />
          }
        >
          <DropdownMenuItem
            onClick={() => chain().selectTablePart("cell").run()}
          >
            {t("Seleziona cella")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => chain().selectTablePart("row").run()}
          >
            {t("Seleziona riga")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => chain().selectTablePart("column").run()}
          >
            {t("Seleziona colonna")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => chain().selectTablePart("table").run()}
          >
            {t("Seleziona tabella")}
          </DropdownMenuItem>
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup
        label={t("Righe e colonne")}
        icon={<Rows3 className="size-5" />}
      >
        <RibbonMenu
          className="w-52"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Elimina")}
              icon={<Trash2 className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={() => chain().deleteRow().run()}>
            {t("Elimina righe")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => chain().deleteColumn().run()}>
            {t("Elimina colonne")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => chain().deleteTable().run()}
          >
            {t("Elimina tabella")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Inserisci sopra")}
            icon={<BetweenHorizontalStart className="size-4" />}
            className="justify-start"
            onClick={() => chain().addRowBefore().run()}
          />
          <RibbonButton
            compact
            label={t("Inserisci sotto")}
            icon={<BetweenHorizontalEnd className="size-4" />}
            className="justify-start"
            onClick={() => chain().addRowAfter().run()}
          />
        </RibbonRows>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Inserisci a sinistra")}
            icon={<BetweenVerticalStart className="size-4" />}
            className="justify-start"
            onClick={() => chain().addColumnBefore().run()}
          />
          <RibbonButton
            compact
            label={t("Inserisci a destra")}
            icon={<BetweenVerticalEnd className="size-4" />}
            className="justify-start"
            onClick={() => chain().addColumnAfter().run()}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label={t("Unisci")} icon={<Merge className="size-5" />}>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Unisci celle")}
            disabled={!st.canMerge}
            title={
              st.canMerge
                ? t("Unisci celle")
                : t("Seleziona più celle trascinando sopra la tabella")
            }
            icon={<Merge className="size-4" />}
            className="justify-start"
            onClick={() => chain().mergeCells().run()}
          />
          <RibbonButton
            compact
            label={t("Dividi cella")}
            disabled={!st.canSplit}
            icon={<Split className="size-4" />}
            className="justify-start"
            onClick={() => chain().splitCell().run()}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup
        label={t("Bordi e sfondo")}
        icon={<SquareDashed className="size-5" />}
      >
        <RibbonPopover
          label={t("Bordi")}
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Bordi")}
              title={t("Bordi della cella o delle celle selezionate")}
              icon={<BorderGlyph kind="all" />}
            />
          }
        >
          <BordersPanel ctx={ctx} />
        </RibbonPopover>
        <RibbonMenu
          className="w-auto"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Sfondo")}
              title={t("Sfondo della cella o delle celle selezionate")}
              icon={
                <span className="relative">
                  <PaintBucket className="size-5" />
                  <span
                    className="absolute -bottom-1 left-0 h-1 w-5 rounded-sm"
                    style={{
                      background: st.cellBackground || "transparent",
                      boxShadow: "inset 0 0 0 1px rgba(15,1,26,0.2)",
                    }}
                  />
                </span>
              }
            />
          }
        >
          <DropdownMenuLabel>{t("Sfondo cella")}</DropdownMenuLabel>
          <SwatchGrid
            columns={8}
            colors={CELL_COLORS}
            value={st.cellBackground}
            onPick={(v) =>
              chain()
                .setCellBackground(v || null)
                .run()
            }
          />
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Riga di intestazione")}
            icon={<Heading className="size-4" />}
            className="justify-start"
            onClick={() => chain().toggleHeaderRow().run()}
          />
          <RibbonButton
            compact
            label={t("Righe alternate")}
            active={st.tableBanded}
            icon={<Rows3 className="size-4" />}
            className="justify-start"
            onClick={() =>
              chain().setTableStyle({ banded: !st.tableBanded }).run()
            }
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup
        label={t("Allineamento")}
        icon={<AlignCenter className="size-5" />}
      >
        <CellAlignGrid ctx={ctx} />
      </RibbonGroup>

      <RibbonGroup
        label={t("Dimensioni cella")}
        icon={<Scaling className="size-5" />}
      >
        <div className="flex flex-col gap-0.5">
          <Stepper
            compact
            label={t("Altezza")}
            labelWidth={52}
            value={st.cellMinHeight / CM}
            unit="cm"
            step={0.25}
            min={0}
            max={15}
            decimals={2}
            onChange={(cm) =>
              editor
                .chain()
                .setRowHeight(cm > 0 ? cm * CM : null)
                .run()
            }
          />
          <Stepper
            compact
            label={t("Margini")}
            labelWidth={52}
            value={st.cellPadding / PT}
            unit="pt"
            step={1}
            min={0}
            max={36}
            decimals={0}
            onChange={(pt) =>
              editor
                .chain()
                .setCellPadding(pt > 0 ? pt * PT : null)
                .run()
            }
          />
          <RibbonButton
            compact
            label={t("Distribuisci colonne")}
            icon={<TableColumnsSplit className="size-4" />}
            className="justify-start"
            onClick={() => chain().distributeColumns().run()}
          />
        </div>
      </RibbonGroup>

      <RibbonGroup label={t("Tabella")} icon={<Columns3 className="size-5" />}>
        <MoveRows ctx={ctx} />
        <OptionsButton ctx={ctx} />
      </RibbonGroup>
    </>
  )
}

/* ------------------------------- immagine -------------------------------- */

const SHAPE_FILLS = [
  {
    get label() {
      return tr("Nessun riempimento")
    },
    value: "none",
    swatch: NONE_SWATCH,
  },
  {
    get label() {
      return tr("Bianco")
    },
    value: "#ffffff",
  },
  ...LINE_COLORS,
  ...SWATCHES.filter((s) => s.key !== "white").map((s) => ({
    label: tr("{color} chiaro", { color: s.label }),
    value: s.fill,
  })),
]

/** Riempimento, contorno e testo di una forma: il disegno si rifà */
function ShapeGroup({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, st } = ctx
  const kind = st.imageShape as DocShapeKind
  const line = isLineShape(kind)
  const look = {
    fill: st.imageFill || "none",
    stroke: st.imageStroke || "#000000",
    strokeWidth: st.imageStrokeWidth,
    ratio: st.imageRatio,
    text: st.imageLabel,
  }
  const set = (patch: Partial<typeof look>) =>
    editor
      .chain()
      .updateAttributes("image", shapeImageAttrs(kind, { ...look, ...patch }))
      .run()
  return (
    <RibbonGroup label={t("Stile forma")} icon={<Shapes className="size-5" />}>
      {line ? null : (
        <RibbonMenu
          className="w-auto"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Riempimento")}
              icon={
                <span className="relative">
                  <PaintBucket className="size-5" />
                  <span
                    className="absolute -bottom-1 left-0 h-1 w-5 rounded-sm"
                    style={{
                      background:
                        look.fill === "none" ? "transparent" : look.fill,
                      boxShadow: "inset 0 0 0 1px rgba(15,1,26,0.2)",
                    }}
                  />
                </span>
              }
            />
          }
        >
          <DropdownMenuLabel>{t("Riempimento forma")}</DropdownMenuLabel>
          <SwatchGrid
            columns={8}
            colors={SHAPE_FILLS}
            value={look.fill}
            onPick={(fill) => set({ fill })}
          />
        </RibbonMenu>
      )}
      <RibbonMenu
        className="w-auto"
        trigger={
          <RibbonButton
            large
            chevron
            label={t("Contorno")}
            icon={
              <span className="relative">
                <SquareDashed className="size-5" />
                <span
                  className="absolute -bottom-1 left-0 h-1 w-5 rounded-sm"
                  style={{
                    background: look.strokeWidth ? look.stroke : "transparent",
                  }}
                />
              </span>
            }
          />
        }
      >
        <DropdownMenuLabel>{t("Colore del contorno")}</DropdownMenuLabel>
        <SwatchGrid
          columns={8}
          colors={LINE_COLORS}
          value={look.stroke}
          onPick={(stroke) =>
            set({ stroke, strokeWidth: look.strokeWidth || 2 })
          }
        />
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Spessore")}</DropdownMenuLabel>
        {(line ? [1, 2, 3, 4, 6, 8] : [0, 1, 2, 3, 4, 6]).map((w) => (
          <DropdownMenuItem
            key={w}
            onClick={() => set({ strokeWidth: w })}
            className={cn(look.strokeWidth === w && "font-semibold")}
          >
            {w ? (
              <span
                className="block w-16"
                style={{ borderTop: `${w}px solid currentColor` }}
              />
            ) : (
              t("Nessun contorno")
            )}
          </DropdownMenuItem>
        ))}
      </RibbonMenu>
      {line ? null : (
        <RibbonPopover
          label={t("Testo nella forma")}
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Testo")}
              active={Boolean(look.text)}
              icon={<Type className="size-5" />}
            />
          }
        >
          <div className="space-y-2 p-3">
            <p className="text-xs font-medium">{t("Testo nella forma")}</p>
            <Textarea
              rows={3}
              autoFocus
              className="text-sm"
              value={look.text}
              placeholder={t("Scrivi il testo della forma")}
              onChange={(e) => set({ text: e.target.value })}
            />
          </div>
        </RibbonPopover>
      )}
    </RibbonGroup>
  )
}

function ImageTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, st } = ctx
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("image", attrs).run()
  return (
    <>
      {st.imageShape ? <ShapeGroup ctx={ctx} /> : null}
      <RibbonGroup
        label={t("Stile")}
        icon={<SquareDashed className="size-5" />}
      >
        <RibbonMenu
          className="w-auto"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Bordo")}
              icon={<SquareDashed className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Spessore")}</DropdownMenuLabel>
          {[0, 1, 2, 3, 4, 6].map((w) => (
            <DropdownMenuItem
              key={w}
              onClick={() => set({ borderWidth: w })}
              className={cn(st.imageBorderWidth === w && "font-semibold")}
            >
              {w ? (
                <span
                  className="block w-16"
                  style={{ borderTop: `${w}px solid currentColor` }}
                />
              ) : (
                t("Nessun bordo")
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("Colore")}</DropdownMenuLabel>
          <SwatchGrid
            columns={8}
            colors={LINE_COLORS}
            value={st.imageBorderColor}
            onPick={(v) =>
              set({
                borderColor: v,
                borderWidth: st.imageBorderWidth || 2,
              })
            }
          />
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Ombra")}
            active={st.imageShadow}
            className="justify-start"
            onClick={() => set({ shadow: !st.imageShadow })}
          />
          <AltTextButton value={st.imageAlt} onChange={(alt) => set({ alt })} />
        </RibbonRows>
      </RibbonGroup>

      <ArrangeGroup ctx={ctx} />

      <RibbonGroup
        label={t("Dimensioni")}
        icon={<Scaling className="size-5" />}
      >
        <div className="flex flex-col gap-1">
          <Stepper
            compact
            label={t("Larghezza")}
            labelWidth={62}
            value={st.imageWidth}
            unit="%"
            step={5}
            min={5}
            max={100}
            decimals={0}
            onChange={(v) => set({ width: `${v}%` })}
          />
          <Stepper
            compact
            label={t("Rotazione")}
            labelWidth={62}
            value={st.imageRotate}
            unit="°"
            step={15}
            min={-180}
            max={180}
            decimals={0}
            onChange={(v) => set({ rotate: v })}
          />
        </div>
      </RibbonGroup>

      <ObjectGroup
        ctx={ctx}
        deleteLabel={t("Elimina")}
        movable={st.imageWrap === "inline"}
      />
    </>
  )
}

/** «Testo alternativo»: la descrizione per chi usa un lettore di schermo */
function AltTextButton({
  value,
  onChange,
}: {
  value: string
  onChange: (alt: string) => void
}) {
  const t = useT()
  return (
    <RibbonPopover
      label={t("Testo alternativo")}
      trigger={
        <RibbonButton
          compact
          label={t("Testo alternativo")}
          active={Boolean(value)}
          className="justify-start"
        />
      }
    >
      <div className="space-y-2 p-3">
        <p className="text-xs font-medium">{t("Testo alternativo")}</p>
        <Input
          className="h-8 text-xs"
          value={value}
          autoFocus
          placeholder={t("Descrivi l'immagine")}
          onChange={(e) => onChange(e.target.value)}
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          {t(
            "Lo leggono i lettori di schermo e compare nelle esportazioni al posto dell'immagine."
          )}
        </p>
      </div>
    </RibbonPopover>
  )
}

/* -------------------------------- grafico -------------------------------- */

function ChartTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, st } = ctx
  const spec = parseChartAttr(st.chartSpec)
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("chart", attrs).run()
  return (
    <>
      <RibbonGroup
        label={t("Tipo")}
        icon={<ChartColumnBig className="size-5" />}
      >
        <RibbonMenu
          className="w-48"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Cambia tipo")}
              icon={<ChartColumnBig className="size-5" />}
            />
          }
        >
          {CHART_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.value}
              className={cn(spec.type === type.value && "font-semibold")}
              onClick={() =>
                set({
                  spec: JSON.stringify({
                    ...spec,
                    type: type.value as ChartType,
                  }),
                })
              }
            >
              {type.label}
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
        <RibbonPopover
          label={t("Dati e stile")}
          className="w-80"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Dati e stile")}
              title={t("Titolo, dati, legenda, colori")}
              icon={<SlidersHorizontal className="size-5" />}
            />
          }
        >
          <ObjectOptions
            editor={editor}
            st={st}
            theme={ctx.theme}
            pageHeight={ctx.pageHeight}
            sources={ctx.sources}
            onSources={ctx.openSources}
          />
        </RibbonPopover>
      </RibbonGroup>

      <RibbonGroup
        label={t("Dimensioni")}
        icon={<Scaling className="size-5" />}
      >
        <div className="flex flex-col gap-1">
          <Stepper
            compact
            label={t("Larghezza")}
            labelWidth={56}
            value={st.chartWidth}
            unit="%"
            step={5}
            min={25}
            max={100}
            decimals={0}
            onChange={(v) => set({ width: v })}
          />
          <Stepper
            compact
            label={t("Altezza")}
            labelWidth={56}
            value={st.chartHeight / CM}
            unit="cm"
            step={0.5}
            min={4.3}
            max={23.8}
            decimals={1}
            onChange={(cm) => set({ height: Math.round(cm * CM) })}
          />
        </div>
      </RibbonGroup>

      <RibbonGroup
        label={t("Allinea")}
        icon={<AlignCenter className="size-5" />}
      >
        <AlignButtons
          value={st.chartAlign}
          onChange={(align) => set({ align })}
        />
      </RibbonGroup>

      <RibbonGroup label={t("Oggetto")} icon={<Trash2 className="size-5" />}>
        <MoveRows ctx={ctx} />
        <DeleteButton
          label={t("Elimina")}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </RibbonGroup>
    </>
  )
}

/* -------------------------------- sommario ------------------------------- */

function TocTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, st } = ctx
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("toc", attrs).run()
  const variants = [
    ["classic", t("Automatico 1"), t("Puntini e numeri di pagina")],
    ["card", t("Automatico 2"), t("Riquadro colorato, con i numeri di pagina")],
    ["simple", t("Semplice"), t("Solo i titoli")],
  ] as const
  return (
    <>
      <RibbonGroup label={t("Stile")} icon={<ListTree className="size-5" />}>
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Stile sommario")}
              icon={<ListTree className="size-5" />}
            />
          }
        >
          {variants.map(([variant, label, hint]) => (
            <DropdownMenuItem
              key={variant}
              onClick={() => set({ variant })}
              className={cn(st.tocVariant === variant && "bg-accent")}
            >
              <div className="flex flex-col">
                <span>{label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {hint}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
        <RibbonMenu
          className="w-48"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Livelli")}
              icon={<Rows3 className="size-5" />}
            />
          }
        >
          {[1, 2, 3].map((levels) => (
            <DropdownMenuItem
              key={levels}
              onClick={() => set({ levels })}
              className={cn(st.tocLevels === levels && "font-semibold")}
            >
              {levels === 1
                ? t("Solo Titolo 1")
                : t("Titoli fino al livello {levels}", { levels })}
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Titolo predefinito")}
            title={t("Il titolo si scrive direttamente nel sommario")}
            className="justify-start"
            onClick={() => set({ title: null })}
          />
        </RibbonRows>
      </RibbonGroup>
      <RibbonGroup label={t("Oggetto")} icon={<Trash2 className="size-5" />}>
        <MoveRows ctx={ctx} />
        <DeleteButton
          label={t("Elimina sommario")}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </RibbonGroup>
    </>
  )
}

/* ---------------------------------- note --------------------------------- */

function FootnoteTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, st } = ctx
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("footnote", attrs).run()
  return (
    <>
      <RibbonGroup
        label={
          st.footnoteKind === "endnote"
            ? t("Nota di chiusura")
            : t("Nota a piè di pagina")
        }
        icon={<NotebookPen className="size-5" />}
      >
        <Textarea
          // nota nuova: si scrive subito, senza cercare il campo
          autoFocus={!st.footnoteText}
          rows={3}
          className="h-[58px] min-h-0 w-[min(380px,60vw)] resize-none py-1 text-xs"
          placeholder={t("Testo della nota")}
          value={st.footnoteText}
          onChange={(e) => set({ text: e.target.value })}
        />
      </RibbonGroup>
      <RibbonGroup
        label={t("Posizione")}
        icon={<NotebookPen className="size-5" />}
      >
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Fondo pagina")}
            active={st.footnoteKind === "footnote"}
            className="justify-start"
            onClick={() => set({ kind: "footnote" })}
          />
          <RibbonButton
            compact
            label={t("Fine documento")}
            active={st.footnoteKind === "endnote"}
            className="justify-start"
            onClick={() => set({ kind: "endnote" })}
          />
        </RibbonRows>
        <DeleteButton
          label={t("Elimina nota")}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </RibbonGroup>
    </>
  )
}

/* ------------------------------ la scheda -------------------------------- */

export function FormatTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const kind = formatKind(ctx.st)
  switch (kind) {
    case "table":
      return <TableTab ctx={ctx} />
    case "shape":
    case "image":
      return <ImageTab ctx={ctx} />
    case "chart":
      return <ChartTab ctx={ctx} />
    case "toc":
      return <TocTab ctx={ctx} />
    case "index":
      return (
        <RibbonGroup label={t("Oggetto")} icon={<Trash2 className="size-5" />}>
          <MoveRows ctx={ctx} />
          <DeleteButton
            label={t("Elimina")}
            run={() => ctx.editor.chain().focus().deleteSelection().run()}
          />
        </RibbonGroup>
      )
    case "footnote":
      return <FootnoteTab ctx={ctx} />
    case "citation":
      return (
        <ObjectGroup ctx={ctx} deleteLabel={t("Elimina")} movable={false} />
      )
    case "math":
      return (
        <ObjectGroup
          ctx={ctx}
          deleteLabel={t("Elimina")}
          movable={ctx.st.mathDisplay}
        />
      )
    case null:
      return null
    default:
      return <ObjectGroup ctx={ctx} deleteLabel={t("Elimina")} />
  }
}
