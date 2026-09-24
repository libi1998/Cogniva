"use client"

import type { Route } from "next"
import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  Columns3,
  ExternalLink,
  Layers,
  Merge,
  Rows3,
  Split,
  Trash2,
  WrapText,
  Rotate3d,
} from "lucide-react"
import { toast } from "sonner"
import { Switch } from "@/components/ui/switch"
import {
  DEFAULT_VIEW,
  isShape3D,
  MODEL_ACCEPT,
  readModelFile,
  VIEW_PRESETS,
} from "@/lib/model3d/catalog"
import Link from "next/link"
import {
  ColorGrid,
  Row,
  Section,
  Segmented,
  SliderRow,
} from "@/components/shared/inspector-ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { SWATCHES, whim } from "@/lib/palette"
import {
  IMAGE_WRAPS,
  isFloatWrap,
  isFreeWrap,
  type ImageWrap,
} from "@/lib/tiptap-extensions"
import type { DocSource, DocTheme } from "@/lib/types"
import {
  BIBLIOGRAPHY_TITLES,
  inTextCitation,
  sourceLabel,
} from "@/lib/citations"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { guardClicks } from "./focus-guard"
import { ChartOptions } from "@/components/shared/chart-editor"
import { parseChartAttr } from "@/lib/chart"
import { parseVideo } from "./video-node"
import { MATH_STRUCTURES, MATH_SYMBOLS, mathError, mathHtml } from "./math-node"
import { positionImage, type HAlign, type VAlign } from "./image-place"
import type { DocState } from "./use-doc-state"

import { useT, tr, hrefFor } from "@/lib/i18n/client"
const CM = 96 / 2.54
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
]

const LINE_COLORS = [
  {
    get label() {
      return tr("Automatico")
    },
    value: "",
    swatch: NONE_SWATCH,
  },
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

function Cmd({
  label,
  icon,
  run,
  disabled,
  danger,
}: {
  label: string
  icon?: React.ReactNode
  run: () => void
  disabled?: boolean
  danger?: boolean
}) {
  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled}
      className={cn(
        "h-7 flex-1 gap-1 px-2 text-[11px]",
        danger && "text-destructive hover:text-destructive"
      )}
      onMouseDown={(e) => e.preventDefault()}
      onClick={run}
    >
      {icon}
      {label}
    </Button>
  )
}

/* ------------------------------- immagine -------------------------------- */

const WRAP_ICON: Record<ImageWrap, React.ReactNode> = {
  inline: <AlignLeft className="size-3.5" />,
  square: <WrapText className="size-3.5" />,
  tight: <WrapText className="size-3.5 opacity-80" />,
  through: <WrapText className="size-3.5 opacity-60" />,
  topBottom: <Rows3 className="size-3.5" />,
  behind: <Layers className="size-3.5 opacity-60" />,
  front: <Layers className="size-3.5" />,
}

function ImageSection({
  editor,
  st,
  theme,
  pageHeight,
}: {
  editor: Editor
  st: DocState
  theme: DocTheme
  /** altezza esatta della pagina se il documento è impaginato, altrimenti 0 */
  pageHeight: number
}) {
  const t = useT()
  const [relative, setRelative] = React.useState<"margin" | "page">("margin")
  const wrap = st.imageWrap as ImageWrap
  const free = isFreeWrap(wrap)
  const float = isFloatWrap(wrap)
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("image", attrs).run()

  const place = (h: HAlign | null, v: VAlign | null) =>
    positionImage(editor, theme, relative, h, v)
  // l'altezza libera è salvata «sulla carta»: nel pannello si legge dalla
  // cima della sua pagina
  const paperY = st.imageY ?? 0
  const pageIndex = pageHeight ? Math.floor(paperY / pageHeight) : 0
  const yOnPage = paperY - pageIndex * (pageHeight || 0)

  return (
    <Section title={t("Immagine")}>
      <Row label={t("Disposizione testo")} stacked>
        <div className="grid grid-cols-2 gap-1">
          {IMAGE_WRAPS.map((w) => (
            <button
              key={w.value}
              type="button"
              title={w.hint}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() =>
                set(
                  isFreeWrap(w.value)
                    ? { wrap: w.value }
                    : w.value === "inline"
                      ? { wrap: w.value, x: null, y: null, dx: 0, dy: 0 }
                      : { wrap: w.value, x: null, y: null }
                )
              }
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md border px-2 text-left text-[11px] leading-tight transition",
                wrap === w.value
                  ? "border-primary/50 bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
                w.value === "inline" && "col-span-2"
              )}
            >
              {WRAP_ICON[w.value]}
              {w.label}
            </button>
          ))}
        </div>
      </Row>

      <Row label={t("Posizione sul foglio")} stacked>
        <Segmented<"margin" | "page">
          size="sm"
          value={relative}
          onChange={setRelative}
          items={[
            { value: "margin", label: t("Ai margini") },
            { value: "page", label: t("Alla pagina") },
          ]}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className="grid grid-cols-3 gap-1"
            role="group"
            aria-label={t("Posizione")}
          >
            {(["top", "middle", "bottom"] as VAlign[]).flatMap((v) =>
              (["left", "center", "right"] as HAlign[]).map((h) => (
                <button
                  key={`${v}-${h}`}
                  type="button"
                  title={`${v === "top" ? t("In alto") : v === "middle" ? t("Al centro") : t("In basso")} ${
                    h === "left"
                      ? t("a sinistra")
                      : h === "center"
                        ? t("al centro")
                        : t("a destra")
                  }`}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => place(h, v)}
                  className="flex size-7 items-center justify-center rounded-md border border-border hover:bg-muted"
                >
                  <span className="block size-3 rounded-[2px] border border-muted-foreground/50 p-px">
                    <span
                      className="block size-1 rounded-[1px] bg-primary"
                      style={{
                        marginLeft: h === "left" ? 0 : h === "center" ? 3 : 6,
                        marginTop: v === "top" ? 0 : v === "middle" ? 3 : 6,
                      }}
                    />
                  </span>
                </button>
              ))
            )}
          </div>
          <div className="grid flex-1 gap-1">
            <Cmd
              label={t("Centra in orizzontale")}
              run={() => place("center", null)}
            />
            <Cmd
              label={t("Centra in verticale")}
              run={() => place(null, "middle")}
            />
          </div>
        </div>
        {wrap === "inline" ? (
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {t(
              "In linea con il testo non ha una posizione: sceglierne una la mette in «Quadrato», col testo intorno."
            )}
          </p>
        ) : null}
      </Row>

      {free ? (
        <Row label={t("Coordinate")} stacked>
          <div className="grid grid-cols-2 gap-2">
            <SliderRow
              label={t("Da sinistra")}
              suffix=" cm"
              step={0.1}
              value={Number(((st.imageX ?? 0) / CM).toFixed(1))}
              min={-5}
              max={30}
              onChange={(cm) => set({ x: Math.round(cm * CM) })}
            />
            <SliderRow
              label={
                pageHeight
                  ? t("Dall'alto · pag. {page}", { page: pageIndex + 1 })
                  : t("Dall'alto")
              }
              suffix=" cm"
              step={0.1}
              value={Number((yOnPage / CM).toFixed(1))}
              min={-5}
              max={
                pageHeight
                  ? Math.ceil(pageHeight / CM)
                  : Math.max(40, Math.ceil(yOnPage / CM + 10))
              }
              onChange={(cm) =>
                set({
                  y: Math.round(pageIndex * (pageHeight || 0) + cm * CM),
                })
              }
            />
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {t("Trascinala sul foglio per spostarla.")}
            {wrap === "behind"
              ? ` ${t("Dietro al testo si seleziona con ⌥ + clic.")}`
              : ""}
          </p>
        </Row>
      ) : (
        <Row label={t("Nel testo")} stacked>
          {float ? (
            <Segmented<string>
              value={st.imageSide}
              onChange={(v) => set({ side: v })}
              items={[
                {
                  value: "left",
                  label: t("A sinistra"),
                  icon: <AlignLeft className="size-3.5" />,
                },
                {
                  value: "right",
                  label: t("A destra"),
                  icon: <AlignRight className="size-3.5" />,
                },
              ]}
            />
          ) : (
            <Segmented<string>
              value={
                st.imageDx && st.imageAlign === "left" ? "" : st.imageAlign
              }
              onChange={(v) => set({ align: v, dx: 0 })}
              items={[
                {
                  value: "left",
                  icon: <AlignLeft className="size-3.5" />,
                  title: t("A sinistra"),
                },
                {
                  value: "center",
                  icon: <AlignCenter className="size-3.5" />,
                  title: t("Al centro"),
                },
                {
                  value: "right",
                  icon: <AlignRight className="size-3.5" />,
                  title: t("A destra"),
                },
              ]}
            />
          )}
          {wrap !== "inline" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SliderRow
                label={t("Dal margine")}
                suffix=" cm"
                step={0.1}
                value={Number((st.imageDx / CM).toFixed(1))}
                min={0}
                max={20}
                onChange={(cm) =>
                  set({
                    dx: Math.round(cm * CM),
                    ...(float ? {} : { align: "left" }),
                  })
                }
              />
              <SliderRow
                label={t("Dal paragrafo")}
                suffix=" cm"
                step={0.1}
                value={Number((st.imageDy / CM).toFixed(1))}
                min={0}
                max={Math.max(10, Math.ceil(st.imageDy / CM + 2))}
                onChange={(cm) => set({ dy: Math.round(cm * CM) })}
              />
            </div>
          ) : null}
          <div className="mt-1.5 flex gap-1">
            <Cmd
              label={t("Sposta su")}
              icon={<ArrowUp className="size-3" />}
              run={() => editor.chain().focus().moveBlock("up").run()}
            />
            <Cmd
              label={t("Sposta giù")}
              icon={<ArrowDown className="size-3" />}
              run={() => editor.chain().focus().moveBlock("down").run()}
            />
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {wrap === "inline"
              ? t(
                  "Trascinala nel testo per spostarla; ⌥↑ e ⌥↓ la spostano di un blocco."
                )
              : t(
                  "Trascinala dove vuoi sul foglio: si aggancia al paragrafo che trova e il testo le scorre intorno."
                )}
          </p>
        </Row>
      )}

      <SliderRow
        label={t("Larghezza")}
        value={Math.round(st.imageWidth)}
        min={5}
        max={100}
        suffix="%"
        onChange={(v) => set({ width: `${v}%` })}
      />
      <SliderRow
        label={t("Rotazione")}
        value={st.imageRotate}
        min={-180}
        max={180}
        suffix="°"
        onChange={(v) => set({ rotate: v })}
      />
      <SliderRow
        label={t("Bordo")}
        value={st.imageBorderWidth}
        min={0}
        max={12}
        onChange={(v) => set({ borderWidth: v })}
      />
      {st.imageBorderWidth ? (
        <ColorGrid
          columns={8}
          value={st.imageBorderColor}
          colors={LINE_COLORS}
          onChange={(v) => set({ borderColor: v || null })}
        />
      ) : null}
      <Row label={t("Ombra")}>
        <Segmented<string>
          size="sm"
          className="w-[120px]"
          value={st.imageShadow ? "on" : "off"}
          onChange={(v) => set({ shadow: v === "on" })}
          items={[
            { value: "off", label: t("No") },
            { value: "on", label: t("Sì") },
          ]}
        />
      </Row>
      <Row label={t("Testo alternativo")} stacked>
        <Input
          className="h-8 text-xs"
          value={st.imageAlt}
          placeholder={t("Descrivi l'immagine")}
          // niente focus(): il cursore deve restare nel campo mentre si scrive
          onChange={(e) => set({ alt: e.target.value })}
        />
      </Row>
      <Cmd
        danger
        label={t("Rimuovi immagine")}
        icon={<Trash2 className="size-3.5" />}
        run={() => editor.chain().focus().deleteSelection().run()}
      />
    </Section>
  )
}

/* ------------------------------- tabella -------------------------------- */

function TableSection({ editor, st }: { editor: Editor; st: DocState }) {
  const t = useT()
  const chain = () => editor.chain().focus()
  return (
    <>
      <Section title={t("Tabella")}>
        <Row label={t("Righe")} stacked>
          <div className="flex gap-1">
            <Cmd
              label={t("Sopra")}
              icon={<Rows3 className="size-3" />}
              run={() => chain().addRowBefore().run()}
            />
            <Cmd
              label={t("Sotto")}
              icon={<Rows3 className="size-3" />}
              run={() => chain().addRowAfter().run()}
            />
            <Cmd label={t("Elimina")} run={() => chain().deleteRow().run()} />
          </div>
        </Row>
        <Row label={t("Colonne")} stacked>
          <div className="flex gap-1">
            <Cmd
              label={t("Prima")}
              icon={<Columns3 className="size-3" />}
              run={() => chain().addColumnBefore().run()}
            />
            <Cmd
              label={t("Dopo")}
              icon={<Columns3 className="size-3" />}
              run={() => chain().addColumnAfter().run()}
            />
            <Cmd
              label={t("Elimina")}
              run={() => chain().deleteColumn().run()}
            />
          </div>
        </Row>
        <Row label={t("Celle")} stacked>
          <div className="flex gap-1">
            <Cmd
              label={t("Unisci")}
              icon={<Merge className="size-3" />}
              disabled={!st.canMerge}
              run={() => chain().mergeCells().run()}
            />
            <Cmd
              label={t("Dividi")}
              icon={<Split className="size-3" />}
              disabled={!st.canSplit}
              run={() => chain().splitCell().run()}
            />
          </div>
        </Row>
        <Row label={t("Intestazione")} stacked>
          <div className="flex gap-1">
            <Cmd
              label={t("Riga")}
              run={() => chain().toggleHeaderRow().run()}
            />
            <Cmd
              label={t("Colonna")}
              run={() => chain().toggleHeaderColumn().run()}
            />
            <Cmd
              label={t("Cella")}
              run={() => chain().toggleHeaderCell().run()}
            />
          </div>
        </Row>
      </Section>

      <Section title={t("Linee e colori")}>
        <SliderRow
          label={t("Spessore linee")}
          value={st.tableBorderWidth}
          min={0}
          max={8}
          step={0.5}
          // il fuoco resta sul cursore, come negli altri
          onChange={(v) =>
            editor.chain().setTableStyle({ borderWidth: v }).run()
          }
        />
        <Row label={t("Tipo di linea")} stacked>
          <Segmented<string>
            size="sm"
            value={st.tableBorderStyle}
            onChange={(v) =>
              chain()
                .setTableStyle({ borderStyle: v as "solid" })
                .run()
            }
            items={[
              { value: "solid", label: t("Continua") },
              { value: "dashed", label: t("Trattini") },
              { value: "dotted", label: t("Punti") },
              { value: "double", label: t("Doppia") },
            ]}
          />
        </Row>
        <Row label={t("Colore linee")} stacked>
          <ColorGrid
            columns={8}
            value={st.tableBorderColor}
            colors={LINE_COLORS}
            onChange={(v) =>
              chain()
                .setTableStyle({ borderColor: v || null })
                .run()
            }
          />
        </Row>
        <Row label={t("Righe alternate")}>
          <Segmented<string>
            size="sm"
            className="w-[120px]"
            value={st.tableBanded ? "on" : "off"}
            onChange={(v) =>
              chain()
                .setTableStyle({ banded: v === "on" })
                .run()
            }
            items={[
              { value: "off", label: t("No") },
              { value: "on", label: t("Sì") },
            ]}
          />
        </Row>
      </Section>

      <Section title={t("Cella")}>
        <Row label={t("Sfondo cella")} stacked>
          <ColorGrid
            columns={8}
            value={st.cellBackground}
            colors={CELL_COLORS}
            onChange={(v) =>
              chain()
                .setCellBackground(v || null)
                .run()
            }
          />
        </Row>
        <Row label={t("Allineamento verticale")} stacked>
          <Segmented<string>
            size="sm"
            value={st.cellVAlign}
            onChange={(v) => chain().setCellAttribute("verticalAlign", v).run()}
            items={[
              { value: "top", label: t("In alto") },
              { value: "middle", label: t("Al centro") },
              { value: "bottom", label: t("In basso") },
            ]}
          />
        </Row>
        <Cmd
          danger
          label={t("Elimina tabella")}
          icon={<Trash2 className="size-3.5" />}
          run={() => chain().deleteTable().run()}
        />
      </Section>
    </>
  )
}

/* --------------------------- board incorporata --------------------------- */

function EmbedSection({ editor, st }: { editor: Editor; st: DocState }) {
  const t = useT()
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("boardEmbed", attrs).run()
  return (
    <Section title={t("Board incorporata")}>
      <SliderRow
        label={t("Altezza")}
        value={st.embedHeight}
        min={140}
        max={900}
        onChange={(v) => set({ height: v })}
      />
      <Row label={t("Didascalia")} stacked>
        <Input
          className="h-8 text-xs"
          value={st.embedCaption}
          onChange={(e) => set({ caption: e.target.value })}
        />
      </Row>
      <div className="flex gap-1">
        <Cmd
          label={t("Sposta su")}
          icon={<ArrowUp className="size-3" />}
          run={() => editor.chain().focus().moveBlock("up").run()}
        />
        <Cmd
          label={t("Sposta giù")}
          icon={<ArrowDown className="size-3" />}
          run={() => editor.chain().focus().moveBlock("down").run()}
        />
      </div>
      {st.embedBoardId ? (
        <Button
          variant="outline"
          size="sm"
          className="h-7 w-full gap-1 text-[11px]"
          nativeButton={false}
          render={<Link href={hrefFor(`/board/${st.embedBoardId}`) as Route} />}
        >
          <ExternalLink className="size-3.5" /> {t("Apri la board")}
        </Button>
      ) : null}
    </Section>
  )
}

/* ---------------------------------- note --------------------------------- */

function FootnoteSection({ editor, st }: { editor: Editor; st: DocState }) {
  const t = useT()
  const endnote = st.footnoteKind === "endnote"
  return (
    <Section
      title={endnote ? t("Nota di chiusura") : t("Nota a piè di pagina")}
    >
      <Textarea
        // nota nuova: si scrive subito, senza cercare il campo
        autoFocus={!st.footnoteText}
        rows={4}
        className="text-xs"
        placeholder={t("Testo della nota")}
        value={st.footnoteText}
        onChange={(e) =>
          editor
            .chain()
            .updateAttributes("footnote", { text: e.target.value })
            .run()
        }
      />
      <Row label={t("Posizione")} stacked>
        <Segmented<"footnote" | "endnote">
          size="sm"
          value={st.footnoteKind}
          items={[
            { value: "footnote", label: t("Fondo pagina") },
            { value: "endnote", label: t("Fine documento") },
          ]}
          onChange={(kind) =>
            editor.chain().updateAttributes("footnote", { kind }).run()
          }
        />
      </Row>
      <Cmd
        danger
        label={t("Elimina nota")}
        icon={<Trash2 className="size-3.5" />}
        run={() => editor.chain().focus().deleteSelection().run()}
      />
    </Section>
  )
}

/* --------------------------------- grafici --------------------------------- */

function ChartSection({ editor, st }: { editor: Editor; st: DocState }) {
  const t = useT()
  const spec = parseChartAttr(st.chartSpec)
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("chart", attrs).run()
  return (
    <>
      <Section title={t("Grafico")}>
        <ChartOptions
          spec={spec}
          onChange={(next) => set({ spec: JSON.stringify(next) })}
        />
      </Section>
      <Section title={t("Dimensioni")}>
        <SliderRow
          label={t("Larghezza")}
          value={st.chartWidth}
          min={25}
          max={100}
          suffix="%"
          onChange={(v) => set({ width: v })}
        />
        <SliderRow
          label={t("Altezza")}
          value={st.chartHeight}
          min={160}
          max={900}
          step={10}
          onChange={(v) => set({ height: v })}
        />
        <Row label={t("Allineamento")}>
          <Segmented<string>
            size="sm"
            className="w-[132px]"
            value={st.chartAlign}
            onChange={(v) => set({ align: v })}
            items={[
              {
                value: "left",
                icon: <AlignLeft className="size-3.5" />,
                title: t("A sinistra"),
              },
              {
                value: "center",
                icon: <AlignCenter className="size-3.5" />,
                title: t("Al centro"),
              },
              {
                value: "right",
                icon: <AlignRight className="size-3.5" />,
                title: t("A destra"),
              },
            ]}
          />
        </Row>
        <Cmd
          danger
          label={t("Elimina grafico")}
          icon={<Trash2 className="size-3.5" />}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </Section>
    </>
  )
}

/* ------------------------------- citazioni ------------------------------- */

function CitationSection({
  editor,
  st,
  theme,
  sources,
  onSources,
}: {
  editor: Editor
  st: DocState
  theme: DocTheme
  sources: DocSource[]
  onSources: (id?: string | null, cite?: boolean) => void
}) {
  const t = useT()
  const source = sources.find((s) => s.id === st.citationSourceId)
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("citation", attrs).run()
  return (
    <Section title={t("Citazione")}>
      <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs">
        {inTextCitation(theme.citationStyle, source, st.citationPages)}
      </p>
      <Row label={t("Fonte")} stacked>
        <Select
          items={sources.map((s) => ({ value: s.id, label: sourceLabel(s) }))}
          value={st.citationSourceId ?? null}
          onValueChange={(v) => set({ sourceId: v })}
        >
          <SelectTrigger className="h-8 w-full text-xs" size="sm">
            <SelectValue placeholder={t("Scegli una fonte")} />
          </SelectTrigger>
          <SelectContent>
            {sources.map((s) => (
              <SelectItem key={s.id} value={s.id} className="text-xs">
                {sourceLabel(s)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Row>
      <Row label={t("Pagine citate")} stacked>
        <Input
          className="h-8 text-xs"
          value={st.citationPages}
          placeholder={t("45 oppure 45-47")}
          onChange={(e) => set({ pages: e.target.value })}
        />
      </Row>
      <div className="flex gap-1">
        <Cmd
          label={t("Modifica fonte")}
          disabled={!source}
          run={() => onSources(source?.id ?? null)}
        />
        <Cmd
          danger
          label={t("Elimina")}
          icon={<Trash2 className="size-3.5" />}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </div>
    </Section>
  )
}

function BibliographySection({
  editor,
  st,
  theme,
  onSources,
}: {
  editor: Editor
  st: DocState
  theme: DocTheme
  onSources: (id?: string | null, cite?: boolean) => void
}) {
  const t = useT()
  return (
    <Section title={t("Bibliografia")}>
      <Row label={t("Titolo")} stacked>
        <Input
          className="h-8 text-xs"
          value={st.bibliographyTitle}
          placeholder={BIBLIOGRAPHY_TITLES[theme.citationStyle]}
          onChange={(e) =>
            editor
              .chain()
              .updateAttributes("bibliography", { title: e.target.value })
              .run()
          }
        />
      </Row>
      <p className="text-[10px] leading-snug text-muted-foreground">
        {t(
          "Elenca le fonti citate nel documento, in ordine alfabetico e nello stile scelto in Riferimenti. Si aggiorna da sola."
        )}
      </p>
      <div className="flex gap-1">
        <Cmd label={t("Gestisci fonti")} run={() => onSources()} />
        <Cmd
          danger
          label={t("Elimina")}
          icon={<Trash2 className="size-3.5" />}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </div>
    </Section>
  )
}

/* -------------------------------- modelli 3D ------------------------------- */

const MODEL_BACKGROUNDS = [
  {
    get label() {
      return tr("Trasparente")
    },
    value: "",
    swatch: NONE_SWATCH,
  },
  {
    get label() {
      return tr("Bianco")
    },
    value: "#ffffff",
  },
  {
    get label() {
      return tr("Grigio chiaro")
    },
    value: "#f1f1f4",
  },
  {
    get label() {
      return tr("Grafite")
    },
    value: "#27272a",
  },
  {
    get label() {
      return tr("Notte")
    },
    value: "#0f172a",
  },
]

const MODEL_COLORS = [
  {
    get label() {
      return tr("Blu")
    },
    value: "#4f7cff",
  },
  ...SWATCHES.filter((s) => s.key !== "white").map((s) => ({
    label: s.label,
    value: s.solid,
  })),
  {
    get label() {
      return tr("Argento")
    },
    value: "#c7c9d1",
  },
  {
    get label() {
      return tr("Oro")
    },
    value: "#d4a53c",
  },
  {
    get label() {
      return tr("Nero")
    },
    value: whim.base[900],
  },
]

function Model3DSection({ editor, st }: { editor: Editor; st: DocState }) {
  const t = useT()
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("model3d", attrs).run()
  const replaceInput = React.useRef<HTMLInputElement>(null)
  const [altDraft, setAltDraft] = React.useState<string | null>(null)
  const isShape = isShape3D(st.model3dShape)
  const current = VIEW_PRESETS.find(
    (p) =>
      Math.abs(p.view.yaw - st.model3dYaw) < 2 &&
      Math.abs(p.view.pitch - st.model3dPitch) < 2
  )

  return (
    <>
      <Section
        title={t("Visualizzazione modello 3D")}
        action={
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => set({ ...DEFAULT_VIEW })}
          >
            {t("Reimposta")}
          </button>
        }
      >
        <div className="grid grid-cols-2 gap-1">
          {VIEW_PRESETS.map((preset) => (
            <button
              key={preset.label}
              type="button"
              title={preset.title ?? preset.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => set({ ...preset.view })}
              className={cn(
                "flex h-8 items-center gap-1.5 rounded-md border border-border px-2 text-left text-[11px] transition hover:bg-muted",
                current === preset && "border-primary bg-accent"
              )}
            >
              <ViewGlyph yaw={preset.view.yaw} pitch={preset.view.pitch} />
              <span className="truncate">{preset.label}</span>
            </button>
          ))}
        </div>
        <SliderRow
          label={t("Zoom")}
          value={Math.round(st.model3dZoom * 100)}
          min={40}
          max={300}
          suffix="%"
          onChange={(v) => set({ zoom: v / 100 })}
        />
        <Row label={t("Ruota da solo")}>
          <Switch
            checked={st.model3dAutoRotate}
            onCheckedChange={(checked) => set({ autoRotate: checked })}
          />
        </Row>
      </Section>
      <Section title={isShape ? t("Forma 3D") : t("Modello")}>
        {isShape ? (
          <Row label={t("Colore")} stacked>
            <ColorGrid
              colors={MODEL_COLORS}
              value={st.model3dColor}
              onChange={(v) => set({ color: v, poster: "" })}
              columns={7}
            />
          </Row>
        ) : (
          <p
            className="truncate text-xs text-muted-foreground"
            title={st.model3dName}
          >
            {st.model3dName || t("Modello glTF")}
          </p>
        )}
        <Row label={t("Sfondo")} stacked>
          <ColorGrid
            colors={MODEL_BACKGROUNDS}
            value={st.model3dBackground}
            onChange={(v) => set({ background: v })}
            columns={5}
          />
        </Row>
        <Row label={t("Testo alternativo")} stacked>
          <Input
            className="h-8 text-xs"
            value={altDraft ?? st.model3dAlt}
            placeholder={t(
              "Descrivi il modello per chi usa un lettore di schermo"
            )}
            onChange={(e) => setAltDraft(e.target.value)}
            onBlur={() => {
              if (altDraft !== null) set({ alt: altDraft.trim() })
              setAltDraft(null)
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") (e.target as HTMLInputElement).blur()
            }}
          />
        </Row>
      </Section>
      <Section title={t("Dimensioni")}>
        <SliderRow
          label={t("Larghezza")}
          value={st.model3dWidth}
          min={20}
          max={100}
          suffix="%"
          onChange={(v) => set({ width: v })}
        />
        <SliderRow
          label={t("Altezza")}
          value={st.model3dHeight}
          min={120}
          max={900}
          onChange={(v) => set({ height: v })}
        />
        <Row label={t("Allineamento")}>
          <Segmented<string>
            size="sm"
            className="w-[132px]"
            value={st.model3dAlign}
            onChange={(v) => set({ align: v })}
            items={[
              {
                value: "left",
                icon: <AlignLeft className="size-3.5" />,
                title: t("A sinistra"),
              },
              {
                value: "center",
                icon: <AlignCenter className="size-3.5" />,
                title: t("Al centro"),
              },
              {
                value: "right",
                icon: <AlignRight className="size-3.5" />,
                title: t("A destra"),
              },
            ]}
          />
        </Row>
        <p className="text-[10px] leading-snug text-muted-foreground">
          {t(
            "Nel documento il modello si ruota col trascinamento. In stampa, nel PDF e nel file Word va la vista attuale."
          )}
        </p>
        <input
          ref={replaceInput}
          type="file"
          accept={MODEL_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (!file) return
            readModelFile(file)
              .then((src) =>
                set({
                  src,
                  shape: "",
                  name: file.name,
                  poster: "",
                  ...DEFAULT_VIEW,
                })
              )
              .catch((error: unknown) =>
                toast.error(
                  error instanceof Error ? error.message : t("File non valido")
                )
              )
          }}
        />
        <div className="flex gap-1">
          <Cmd
            label={t("Sostituisci")}
            icon={<Rotate3d className="size-3.5" />}
            run={() => replaceInput.current?.click()}
          />
          <Cmd
            danger
            label={t("Elimina")}
            icon={<Trash2 className="size-3.5" />}
            run={() => editor.chain().focus().deleteSelection().run()}
          />
        </div>
      </Section>
    </>
  )
}

/** Un cubetto visto dalla stessa angolazione della visualizzazione */
function ViewGlyph({ yaw, pitch }: { yaw: number; pitch: number }) {
  const y = (yaw * Math.PI) / 180
  const p = (pitch * Math.PI) / 180
  const project = ([x, yy, z]: [number, number, number]) => {
    const rx = x * Math.cos(y) - z * Math.sin(y)
    const rz = x * Math.sin(y) + z * Math.cos(y)
    const ry = yy * Math.cos(p) - rz * Math.sin(p)
    return [8 + rx * 4.2, 8 - ry * 4.2] as const
  }
  const v = (x: number, yy: number, z: number) => project([x, yy, z])
  const face = (points: (readonly [number, number])[]) =>
    points.map((pt) => pt.join(",")).join(" ")
  return (
    <svg viewBox="0 0 16 16" className="size-4 shrink-0" aria-hidden>
      <polygon
        points={face([v(-1, 1, 1), v(1, 1, 1), v(1, -1, 1), v(-1, -1, 1)])}
        className="fill-primary/25 stroke-current"
        strokeWidth={0.8}
      />
      <polygon
        points={face([v(-1, 1, -1), v(1, 1, -1), v(1, 1, 1), v(-1, 1, 1)])}
        className="fill-primary/10 stroke-current"
        strokeWidth={0.8}
      />
      <polygon
        points={face([v(1, 1, -1), v(1, -1, -1), v(1, -1, 1), v(1, 1, 1)])}
        className="fill-primary/5 stroke-current"
        strokeWidth={0.8}
      />
    </svg>
  )
}

/* ---------------------------------- video ---------------------------------- */

function VideoSection({ editor, st }: { editor: Editor; st: DocState }) {
  const t = useT()
  const [draft, setDraft] = React.useState<string | null>(null)
  const value = draft ?? st.videoSrc
  const valid = parseVideo(value) !== null
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("video", attrs).run()

  return (
    <Section title={t("Video online")}>
      <Row label={t("Indirizzo")} stacked>
        <Input
          className="h-8 text-xs"
          value={value}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(e) => setDraft(e.target.value)}
          onBlur={() => {
            if (draft !== null && parseVideo(draft)) set({ src: draft.trim() })
            setDraft(null)
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur()
          }}
        />
        {!valid ? (
          <p className="text-[11px] leading-snug text-destructive">
            {t(
              "Indirizzo non riconosciuto: YouTube, Vimeo, Loom, Dailymotion o un file video (.mp4, .webm)."
            )}
          </p>
        ) : null}
      </Row>
      <SliderRow
        label={t("Larghezza")}
        value={st.videoWidth}
        min={20}
        max={100}
        suffix="%"
        onChange={(v) => set({ width: v })}
      />
      <Row label={t("Allineamento")}>
        <Segmented<string>
          size="sm"
          className="w-[132px]"
          value={st.videoAlign}
          onChange={(v) => set({ align: v })}
          items={[
            {
              value: "left",
              icon: <AlignLeft className="size-3.5" />,
              title: t("A sinistra"),
            },
            {
              value: "center",
              icon: <AlignCenter className="size-3.5" />,
              title: t("Al centro"),
            },
            {
              value: "right",
              icon: <AlignRight className="size-3.5" />,
              title: t("A destra"),
            },
          ]}
        />
      </Row>
      <p className="text-[10px] leading-snug text-muted-foreground">
        {t(
          "Il video si guarda nel documento premendo play. In stampa e nelle esportazioni resta l'anteprima con l'indirizzo."
        )}
      </p>
      <div className="flex gap-1">
        <Button
          variant="outline"
          size="sm"
          className="h-7 flex-1 gap-1 px-2 text-[11px]"
          nativeButton={false}
          render={
            <a
              // solo indirizzi web: niente «javascript:» da un file importato
              href={
                /^https?:\/\//i.test(st.videoSrc.trim())
                  ? st.videoSrc.trim()
                  : undefined
              }
              target="_blank"
              rel="noopener noreferrer"
            />
          }
        >
          <ExternalLink className="size-3.5" /> {t("Apri")}
        </Button>
        <Cmd
          danger
          label={t("Elimina")}
          icon={<Trash2 className="size-3.5" />}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </div>
    </Section>
  )
}

/* -------------------------------- equazioni -------------------------------- */

function MathSection({ editor, st }: { editor: Editor; st: DocState }) {
  const t = useT()
  const field = React.useRef<HTMLTextAreaElement>(null)
  const type = st.mathDisplay ? "mathBlock" : "mathInline"
  const error = mathError(st.mathLatex)
  const setLatex = (latex: string) =>
    editor.chain().updateAttributes(type, { latex }).run()

  /** inserisce un pezzo di formula dove c'è il cursore nel campo */
  const insert = (snippet: string) => {
    const el = field.current
    const value = st.mathLatex
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const glue = start > 0 && /[\w}]$/.test(value.slice(0, start)) ? " " : ""
    const next = value.slice(0, start) + glue + snippet + value.slice(end)
    setLatex(next)
    const caret = start + glue.length + snippet.length
    requestAnimationFrame(() => {
      el?.focus()
      el?.setSelectionRange(caret, caret)
    })
  }

  return (
    <Section title={t("Equazione")}>
      <Textarea
        ref={field}
        // equazione nuova: si scrive subito
        autoFocus={!st.mathLatex}
        rows={4}
        spellCheck={false}
        className="font-mono text-xs"
        placeholder={t("Formula in LaTeX, per esempio \\frac{a}{b}")}
        value={st.mathLatex}
        onChange={(e) => setLatex(e.target.value)}
      />
      {error ? (
        <p className="text-[11px] leading-snug text-destructive">{error}</p>
      ) : null}
      <Row label={t("Posizione")} stacked>
        <Segmented<"inline" | "display">
          size="sm"
          value={st.mathDisplay ? "display" : "inline"}
          items={[
            { value: "inline", label: t("Nel testo") },
            { value: "display", label: t("Su riga propria") },
          ]}
          onChange={(v) => {
            if ((v === "display") !== st.mathDisplay) {
              editor.chain().focus().toggleMathDisplay().run()
            }
          }}
        />
      </Row>
      <Row label={t("Strutture")} stacked>
        <div className="grid grid-cols-4 gap-1">
          {MATH_STRUCTURES.map((item) => (
            <button
              key={item.label}
              type="button"
              title={item.label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(item.insert)}
              className="flex h-10 items-center justify-center overflow-hidden rounded-md border border-border text-[10px] hover:bg-muted"
              dangerouslySetInnerHTML={{ __html: mathHtml(item.preview) }}
            />
          ))}
        </div>
      </Row>
      <Row label={t("Simboli")} stacked>
        <div className="grid grid-cols-8 gap-0.5">
          {MATH_SYMBOLS.map((sym) => (
            <button
              key={sym}
              type="button"
              title={sym}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => insert(sym)}
              className="flex h-7 items-center justify-center rounded-md text-xs hover:bg-muted"
              dangerouslySetInnerHTML={{ __html: mathHtml(sym) }}
            />
          ))}
        </div>
      </Row>
      <Cmd
        danger
        label={t("Elimina equazione")}
        icon={<Trash2 className="size-3.5" />}
        run={() => editor.chain().focus().deleteSelection().run()}
      />
    </Section>
  )
}

/* ------------------------------- pannello ------------------------------- */

/**
 * Le opzioni complete dell'oggetto selezionato — immagine, grafico, tabella,
 * video, modello 3D, equazione, nota, citazione, board — nel riquadro «Altre
 * opzioni» della sua scheda della barra. Prima stavano in un pannello Stile
 * fisso a destra che rubava spazio al foglio.
 */
export function ObjectOptions({
  editor,
  st,
  theme,
  pageHeight,
  sources,
  onSources,
}: {
  editor: Editor
  st: DocState
  theme: DocTheme
  pageHeight: number
  sources: DocSource[]
  onSources: (id?: string | null, cite?: boolean) => void
}) {
  return (
    <div onClickCapture={guardClicks(editor)}>
      {st.onImage ? (
        <ImageSection
          editor={editor}
          st={st}
          theme={theme}
          pageHeight={pageHeight}
        />
      ) : st.onChart ? (
        <ChartSection editor={editor} st={st} />
      ) : st.onCitation ? (
        <CitationSection
          editor={editor}
          st={st}
          theme={theme}
          sources={sources}
          onSources={onSources}
        />
      ) : st.onBibliography ? (
        <BibliographySection
          editor={editor}
          st={st}
          theme={theme}
          onSources={onSources}
        />
      ) : st.onVideo ? (
        <VideoSection editor={editor} st={st} />
      ) : st.onModel3d ? (
        <Model3DSection editor={editor} st={st} />
      ) : st.onMath ? (
        <MathSection editor={editor} st={st} />
      ) : st.onFootnote ? (
        <FootnoteSection editor={editor} st={st} />
      ) : st.onEmbed ? (
        <EmbedSection editor={editor} st={st} />
      ) : st.inTable ? (
        <TableSection editor={editor} st={st} />
      ) : null}
    </div>
  )
}
