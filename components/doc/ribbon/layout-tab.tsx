"use client"

import * as React from "react"

import {
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartHorizontal,
  ArrowDownToLine,
  ArrowUpToLine,
  BringToFront,
  Columns2,
  LayoutList,
  ListOrdered,
  Frame,
  RectangleHorizontal,
  RectangleVertical,
  RotateCcw,
  RotateCw,
  Scaling,
  SendToBack,
  SquareSplitVertical,
  WrapText,
  Grid3x3,
  SeparatorVertical as Hyphen,
} from "lucide-react"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  IMAGE_WRAPS,
  isFreeWrap,
  type ImageWrap,
} from "@/lib/tiptap-extensions"
import {
  PAGE_FORMATS,
  type DocMargins,
  type DocTheme,
  type PageFormat,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { MarginsControl } from "../margins-control"
import { positionImage, type HAlign, type VAlign } from "../image-place"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  RibbonRows,
  Stepper,
} from "./ribbon-ui"
import { CM, PT, type RibbonCtx } from "./shared"

const cm = (value: number) => Math.round(value * CM * 100) / 100

/** I margini predefiniti di Word, in centimetri */
const MARGIN_PRESETS: { label: string; margins: DocMargins }[] = [
  {
    label: "Normale",
    margins: { top: cm(2.5), bottom: cm(2), left: cm(2), right: cm(2) },
  },
  {
    label: "Stretto",
    margins: {
      top: cm(1.27),
      bottom: cm(1.27),
      left: cm(1.27),
      right: cm(1.27),
    },
  },
  {
    label: "Moderato",
    margins: {
      top: cm(2.54),
      bottom: cm(2.54),
      left: cm(1.91),
      right: cm(1.91),
    },
  },
  {
    label: "Largo",
    margins: {
      top: cm(2.54),
      bottom: cm(2.54),
      left: cm(5.08),
      right: cm(5.08),
    },
  },
  {
    label: "Office 2003 predefinito",
    margins: {
      top: cm(2.54),
      bottom: cm(2.54),
      left: cm(3.18),
      right: cm(3.18),
    },
  },
]

const fmtCm = (px: number) =>
  `${(Math.round((px / CM) * 100) / 100).toString().replace(".", ",")} cm`

const WIDTHS: { value: DocTheme["width"]; label: string }[] = [
  { value: "narrow", label: "Stretta" },
  { value: "regular", label: "Media" },
  { value: "wide", label: "Larga" },
  { value: "full", label: "Tutta la finestra" },
]

const LINE_NUMBERS: {
  value: DocTheme["lineNumbers"]
  label: string
  hint: string
}[] = [
  { value: "none", label: "Nessuno", hint: "Senza numeri nel margine" },
  { value: "continuous", label: "Continui", hint: "Da 1 fino alla fine" },
  {
    value: "page",
    label: "Ricomincia a ogni pagina",
    hint: "Ogni foglio riparte da 1",
  },
]

export function LayoutTab({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st, theme, setTheme } = ctx
  const paged = Boolean(PAGE_FORMATS[theme.format].mm)

  return (
    <>
      <RibbonGroup label="Imposta pagina" safe>
        <MarginsMenu theme={theme} setTheme={setTheme} />

        <RibbonMenu
          className="w-48"
          trigger={
            <RibbonButton
              large
              chevron
              label="Orientamento"
              disabled={!paged}
              title={
                paged
                  ? "Orientamento"
                  : "Scegli prima un formato di pagina in Dimensioni"
              }
              icon={
                theme.orientation === "landscape" ? (
                  <RectangleHorizontal className="size-5" />
                ) : (
                  <RectangleVertical className="size-5" />
                )
              }
            />
          }
        >
          <DropdownMenuItem
            onClick={() => setTheme({ orientation: "portrait" })}
            className={cn(theme.orientation === "portrait" && "font-semibold")}
          >
            <RectangleVertical className="size-4" /> Verticale
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme({ orientation: "landscape" })}
            className={cn(theme.orientation === "landscape" && "font-semibold")}
          >
            <RectangleHorizontal className="size-4" /> Orizzontale
          </DropdownMenuItem>
        </RibbonMenu>

        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Dimensioni"
              icon={<Frame className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Formato della pagina</DropdownMenuLabel>
          {(Object.keys(PAGE_FORMATS) as PageFormat[]).map((k) => (
            <DropdownMenuItem
              key={k}
              onClick={() => setTheme({ format: k })}
              className={cn(theme.format === k && "font-semibold")}
            >
              <span className="flex-1">{PAGE_FORMATS[k].label}</span>
              <span className="text-[11px] text-muted-foreground">
                {PAGE_FORMATS[k].mm
                  ? `${PAGE_FORMATS[k].mm![0]}×${PAGE_FORMATS[k].mm![1]} mm`
                  : "libero"}
              </span>
            </DropdownMenuItem>
          ))}
          {!paged ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Larghezza del foglio</DropdownMenuLabel>
              {WIDTHS.map((w) => (
                <DropdownMenuItem
                  key={w.value}
                  onClick={() => setTheme({ width: w.value })}
                  className={cn(theme.width === w.value && "font-semibold")}
                >
                  {w.label}
                </DropdownMenuItem>
              ))}
            </>
          ) : null}
        </RibbonMenu>

        <RibbonMenu
          className="w-40"
          trigger={
            <RibbonButton
              large
              chevron
              label="Colonne"
              icon={<Columns2 className="size-5" />}
            />
          }
        >
          {([1, 2, 3] as const).map((n) => (
            <DropdownMenuItem
              key={n}
              onClick={() => setTheme({ columns: n })}
              className={cn(theme.columns === n && "font-semibold")}
            >
              {n === 1 ? "Una" : n === 2 ? "Due" : "Tre"}
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup label="Interruzioni" safe>
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Interruzioni"
              icon={<SquareSplitVertical className="size-5" />}
            />
          }
        >
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setPageBreak().run()}
          >
            <div className="flex flex-col">
              <span>Pagina</span>
              <span className="text-[11px] text-muted-foreground">
                Il testo riparte dalla pagina successiva
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => editor.chain().focus().setHardBreak().run()}
          >
            <div className="flex flex-col">
              <span>Disposizione testo</span>
              <span className="text-[11px] text-muted-foreground">
                A capo nella stessa riga di paragrafo ⇧↵
              </span>
            </div>
          </DropdownMenuItem>
          <DropdownMenuItem
            disabled={theme.columns < 2}
            onClick={() => editor.chain().focus().setColumnBreak().run()}
          >
            <div className="flex flex-col">
              <span>Colonna</span>
              <span className="text-[11px] text-muted-foreground">
                {theme.columns < 2
                  ? "Serve un layout a più colonne"
                  : "Il testo riparte dalla colonna successiva"}
              </span>
            </div>
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label="Numeri di riga"
              icon={<ListOrdered className="size-5" />}
            />
          }
        >
          {LINE_NUMBERS.map((option) => (
            <DropdownMenuItem
              key={option.value}
              onClick={() => setTheme({ lineNumbers: option.value })}
              className={cn(
                theme.lineNumbers === option.value && "font-semibold"
              )}
            >
              <div className="flex flex-col">
                <span>{option.label}</span>
                <span className="text-[11px] font-normal text-muted-foreground">
                  {option.hint}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Sillabazione"
              active={theme.hyphenation}
              icon={<Hyphen className="size-5" />}
            />
          }
        >
          <DropdownMenuItem
            onClick={() => setTheme({ hyphenation: false })}
            className={cn(!theme.hyphenation && "bg-accent")}
          >
            Nessuna
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => setTheme({ hyphenation: true })}
            className={cn(theme.hyphenation && "bg-accent")}
          >
            <div className="flex flex-col">
              <span>Automatica</span>
              <span className="text-[11px] text-muted-foreground">
                Spezza le parole lunghe a fine riga, secondo la lingua del
                documento
              </span>
            </div>
          </DropdownMenuItem>
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup label="Paragrafo">
        <div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
          <span className="text-[11px] font-medium text-muted-foreground">
            Rientro
          </span>
          <span className="text-[11px] font-medium text-muted-foreground">
            Spaziatura
          </span>
          <Stepper
            label="A sinistra"
            value={st.indentLeft / CM}
            unit="cm"
            step={0.5}
            min={0}
            max={8.4}
            onChange={(cm) =>
              editor
                .chain()
                .focus()
                .setIndentLeft(cm * CM)
                .run()
            }
          />
          <Stepper
            label="Prima"
            value={st.spaceBefore / PT}
            unit="pt"
            step={6}
            min={0}
            max={96}
            decimals={0}
            onChange={(pt) =>
              editor
                .chain()
                .focus()
                .setSpaceBefore(Math.round(pt * PT))
                .run()
            }
          />
          <Stepper
            label="A destra"
            value={st.indentRight / CM}
            unit="cm"
            step={0.5}
            min={0}
            max={8.4}
            onChange={(cm) =>
              editor
                .chain()
                .focus()
                .setIndentRight(cm * CM)
                .run()
            }
          />
          <Stepper
            label="Dopo"
            value={st.spaceAfter / PT}
            unit="pt"
            step={6}
            min={0}
            max={96}
            decimals={0}
            onChange={(pt) =>
              editor
                .chain()
                .focus()
                .setSpaceAfter(Math.round(pt * PT))
                .run()
            }
          />
        </div>
      </RibbonGroup>

      <ArrangeGroup ctx={ctx} />
    </>
  )
}

function MarginsMenu({
  theme,
  setTheme,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  const [custom, setCustom] = React.useState(false)
  const same = (m: DocMargins) =>
    (["top", "bottom", "left", "right"] as const).every(
      (k) => Math.abs(m[k] - theme.margins[k]) < 1
    )
  return (
    <>
      <RibbonMenu
        className="w-64"
        trigger={
          <RibbonButton
            large
            chevron
            label="Margini"
            icon={<Scaling className="size-5" />}
          />
        }
      >
        <DropdownMenuLabel>Margini</DropdownMenuLabel>
        {MARGIN_PRESETS.map((preset) => (
          <DropdownMenuItem
            key={preset.label}
            onClick={() => setTheme({ margins: preset.margins })}
            className={cn(same(preset.margins) && "bg-accent")}
          >
            <span
              aria-hidden
              className="relative h-8 w-6 shrink-0 rounded-[2px] border border-current opacity-70"
            >
              <span
                className="absolute rounded-[1px] border border-dashed border-current"
                style={{
                  top: Math.max(1, (preset.margins.top / CM) * 1.2),
                  bottom: Math.max(1, (preset.margins.bottom / CM) * 1.2),
                  left: Math.max(1, (preset.margins.left / CM) * 1.2),
                  right: Math.max(1, (preset.margins.right / CM) * 1.2),
                }}
              />
            </span>
            <span className="flex min-w-0 flex-col">
              <span>{preset.label}</span>
              <span className="text-[11px] text-muted-foreground">
                Sup. {fmtCm(preset.margins.top)} · Inf.{" "}
                {fmtCm(preset.margins.bottom)} · Sx {fmtCm(preset.margins.left)}{" "}
                · Dx {fmtCm(preset.margins.right)}
              </span>
            </span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => setCustom(true)}>
          Margini personalizzati…
        </DropdownMenuItem>
      </RibbonMenu>
      <Popover open={custom} onOpenChange={setCustom}>
        <PopoverTrigger
          render={<span aria-hidden className="size-0 self-end" />}
          nativeButton={false}
        />
        <PopoverContent
          align="start"
          className="w-[280px] p-3"
          finalFocus={false}
        >
          <p className="mb-2 text-xs font-medium">Margini personalizzati</p>
          <MarginsControl
            margins={theme.margins}
            onChange={(margins) => setTheme({ margins })}
          />
        </PopoverContent>
      </Popover>
    </>
  )
}

type DocObject = { pos: number; label: string; kind: string }

/** Gli oggetti del documento per il «Riquadro di selezione» */
function documentObjects(ctx: RibbonCtx): DocObject[] {
  const out: DocObject[] = []
  const counters = new Map<string, number>()
  const names: Record<string, string> = {
    image: "Immagine",
    chart: "Grafico",
    boardEmbed: "Board",
    video: "Video",
    table: "Tabella",
    mathBlock: "Equazione",
    textBox: "Casella di testo",
  }
  ctx.editor.state.doc.descendants((node, pos) => {
    const kind = node.type.name
    if (!names[kind]) return true
    const n = (counters.get(kind) ?? 0) + 1
    counters.set(kind, n)
    const alt = String(node.attrs.alt ?? node.attrs.caption ?? "").trim()
    out.push({
      pos,
      kind,
      label: `${names[kind]} ${n}${alt ? ` · ${alt}` : ""}`,
    })
    return kind !== "table" && kind !== "textBox"
  })
  return out
}

/** «Disponi»: posizione, testo a capo, livelli, allineamento e rotazione */
function ArrangeGroup({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st, theme } = ctx
  const [objects, setObjects] = React.useState<DocObject[]>([])
  const onImage = st.onImage
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().focus().updateAttributes("image", attrs).run()
  const wrap = st.imageWrap as ImageWrap
  const disabledTitle = "Seleziona un'immagine o una forma"

  return (
    <RibbonGroup label="Disponi">
      <RibbonMenu
        className="w-auto"
        trigger={
          <RibbonButton
            large
            chevron
            label="Posizione"
            disabled={!onImage}
            title={onImage ? "Posizione sulla pagina" : disabledTitle}
            icon={<Grid3x3 className="size-5" />}
          />
        }
      >
        <DropdownMenuItem
          onClick={() =>
            set({ wrap: "inline", x: null, y: null, dx: 0, dy: 0 })
          }
        >
          In linea con il testo
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Con testo a capo</DropdownMenuLabel>
        <div className="grid grid-cols-3 gap-1 p-1.5">
          {(["top", "middle", "bottom"] as VAlign[]).flatMap((v) =>
            (["left", "center", "right"] as HAlign[]).map((h) => (
              <DropdownMenuItem
                key={`${v}-${h}`}
                title={`${v === "top" ? "In alto" : v === "middle" ? "Al centro" : "In basso"} ${h === "left" ? "a sinistra" : h === "center" ? "al centro" : "a destra"}`}
                onClick={() => positionImage(editor, theme, "margin", h, v)}
                className="flex size-10 items-center justify-center p-0"
              >
                <span className="relative size-7 rounded-[2px] border border-current opacity-80">
                  <span
                    className="absolute size-2.5 rounded-[1px] bg-primary"
                    style={{
                      left: h === "left" ? 2 : h === "center" ? 8 : 14,
                      top: v === "top" ? 2 : v === "middle" ? 8 : 14,
                    }}
                  />
                </span>
              </DropdownMenuItem>
            ))
          )}
        </div>
      </RibbonMenu>
      <RibbonMenu
        className="w-60"
        trigger={
          <RibbonButton
            large
            chevron
            label="Testo a capo"
            disabled={!onImage}
            title={onImage ? "Come scorre il testo intorno" : disabledTitle}
            icon={<WrapText className="size-5" />}
          />
        }
      >
        {IMAGE_WRAPS.map((w) => (
          <DropdownMenuItem
            key={w.value}
            onClick={() =>
              set(
                isFreeWrap(w.value)
                  ? { wrap: w.value }
                  : w.value === "inline"
                    ? { wrap: w.value, x: null, y: null, dx: 0, dy: 0 }
                    : { wrap: w.value, x: null, y: null }
              )
            }
            className={cn(wrap === w.value && "bg-accent")}
          >
            <div className="flex flex-col">
              <span>{w.label}</span>
              <span className="text-[11px] text-muted-foreground">
                {w.hint}
              </span>
            </div>
          </DropdownMenuItem>
        ))}
      </RibbonMenu>
      <RibbonRows>
        <RibbonButton
          compact
          label="Porta avanti"
          disabled={!onImage}
          title={onImage ? "Davanti al testo" : disabledTitle}
          icon={<BringToFront className="size-4" />}
          className="justify-start"
          onClick={() => set({ wrap: "front" })}
        />
        <RibbonButton
          compact
          label="Porta indietro"
          disabled={!onImage}
          title={onImage ? "Dietro al testo" : disabledTitle}
          icon={<SendToBack className="size-4" />}
          className="justify-start"
          onClick={() => set({ wrap: "behind" })}
        />
        <Popover
          onOpenChange={(open) => {
            if (open) setObjects(documentObjects(ctx))
          }}
        >
          <PopoverTrigger
            render={
              <RibbonButton
                compact
                label="Riquadro di selezione"
                icon={<LayoutList className="size-4" />}
                className="justify-start"
              />
            }
          />
          <PopoverContent align="start" className="w-72 p-0" finalFocus={false}>
            <p className="border-b border-border px-3 py-2 text-xs font-medium">
              Oggetti nel documento ({objects.length})
            </p>
            <div className="max-h-72 overflow-y-auto p-1">
              {objects.length ? (
                objects.map((o) => (
                  <button
                    key={o.pos}
                    type="button"
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .setNodeSelection(o.pos)
                        .scrollIntoView()
                        .run()
                    }
                    className="block w-full truncate rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  >
                    {o.label}
                  </button>
                ))
              ) : (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Nessuna immagine, tabella o grafico.
                </p>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </RibbonRows>
      <RibbonMenu
        className="w-56"
        trigger={
          <RibbonButton
            large
            chevron
            label="Allinea"
            disabled={!onImage}
            title={onImage ? "Allinea l'immagine ai margini" : disabledTitle}
            icon={<AlignCenterHorizontal className="size-5" />}
          />
        }
      >
        {(
          [
            ["left", "Allinea a sinistra", <AlignStartHorizontal key="l" />],
            ["center", "Allinea al centro", <AlignCenterHorizontal key="c" />],
            ["right", "Allinea a destra", <AlignEndHorizontal key="r" />],
          ] as const
        ).map(([h, label, icon]) => (
          <DropdownMenuItem
            key={h}
            onClick={() =>
              wrap === "inline" || wrap === "topBottom"
                ? set({ align: h })
                : positionImage(editor, theme, "margin", h, null)
            }
          >
            {icon} {label}
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem
          disabled={isFreeWrap(wrap) === false && wrap === "inline"}
          onClick={() => positionImage(editor, theme, "margin", null, "top")}
        >
          <ArrowUpToLine /> Allinea in alto
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={isFreeWrap(wrap) === false && wrap === "inline"}
          onClick={() => positionImage(editor, theme, "margin", null, "bottom")}
        >
          <ArrowDownToLine /> Allinea in basso
        </DropdownMenuItem>
      </RibbonMenu>
      <RibbonMenu
        className="w-56"
        trigger={
          <RibbonButton
            large
            chevron
            label="Ruota"
            disabled={!onImage}
            title={onImage ? "Ruota l'immagine" : disabledTitle}
            icon={<RotateCw className="size-5" />}
          />
        }
      >
        <DropdownMenuItem
          onClick={() => set({ rotate: (st.imageRotate + 90) % 360 })}
        >
          <RotateCw /> Ruota a destra di 90°
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => set({ rotate: (st.imageRotate + 270) % 360 })}
        >
          <RotateCcw /> Ruota a sinistra di 90°
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => set({ rotate: 0 })}>
          Nessuna rotazione
        </DropdownMenuItem>
      </RibbonMenu>
    </RibbonGroup>
  )
}
