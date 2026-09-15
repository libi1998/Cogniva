"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  ArrowDown,
  ArrowUp,
  BookOpenText,
  ChartColumnBig,
  Columns3,
  ExternalLink,
  Image as ImageIcon,
  Layers,
  Merge,
  NotebookPen,
  Quote,
  Rows3,
  Sigma,
  Split,
  Table2,
  Trash2,
  Type,
  Video,
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

const CM = 96 / 2.54
const NONE_SWATCH =
  "linear-gradient(135deg, transparent 45%, #e03177 45% 55%, transparent 55%)"

const CELL_COLORS = [
  { label: "Nessuno", value: "", swatch: NONE_SWATCH },
  ...SWATCHES.map((s) => ({ label: s.label, value: s.fill })),
]

const LINE_COLORS = [
  { label: "Automatico", value: "", swatch: NONE_SWATCH },
  { label: "Nero", value: whim.base[900] },
  { label: "Grigio", value: whim.base[400] },
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

/* --------------------------------- testo --------------------------------- */

/**
 * Nel testo il pannello mostra solo quello che la barra non ha: carattere,
 * corpo, colori, interlinea, rientri e spaziature stanno nelle schede Home e
 * Layout.
 */
function TextSection({ editor, st }: { editor: Editor; st: DocState }) {
  return (
    <Section title="Testo">
      <SliderRow
        label="Spaziatura caratteri"
        value={st.letterSpacing}
        min={-2}
        max={12}
        step={0.5}
        onChange={(v) =>
          editor
            .chain()
            .focus()
            .setLetterSpacing(v || null)
            .run()
        }
      />
      <SliderRow
        label="Rientro prima riga"
        value={st.firstLine}
        min={0}
        max={96}
        onChange={(v) => editor.chain().focus().setFirstLineIndent(v).run()}
      />
      <p className="text-[11px] leading-snug text-muted-foreground">
        Carattere, colori e paragrafo sono nella scheda <b>Home</b>; rientri e
        spaziatura in <b>Layout</b>.
      </p>
    </Section>
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
    <Section title="Immagine">
      <Row label="Disposizione testo" stacked>
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

      <Row label="Posizione sul foglio" stacked>
        <Segmented<"margin" | "page">
          size="sm"
          value={relative}
          onChange={setRelative}
          items={[
            { value: "margin", label: "Ai margini" },
            { value: "page", label: "Alla pagina" },
          ]}
        />
        <div className="mt-1.5 flex items-center gap-2">
          <div
            className="grid grid-cols-3 gap-1"
            role="group"
            aria-label="Posizione"
          >
            {(["top", "middle", "bottom"] as VAlign[]).flatMap((v) =>
              (["left", "center", "right"] as HAlign[]).map((h) => (
                <button
                  key={`${v}-${h}`}
                  type="button"
                  title={`${v === "top" ? "In alto" : v === "middle" ? "Al centro" : "In basso"} ${
                    h === "left"
                      ? "a sinistra"
                      : h === "center"
                        ? "al centro"
                        : "a destra"
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
              label="Centra in orizzontale"
              run={() => place("center", null)}
            />
            <Cmd
              label="Centra in verticale"
              run={() => place(null, "middle")}
            />
          </div>
        </div>
        {wrap === "inline" ? (
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            In linea con il testo non ha una posizione: sceglierne una la mette
            in «Quadrato», col testo intorno.
          </p>
        ) : null}
      </Row>

      {free ? (
        <Row label="Coordinate" stacked>
          <div className="grid grid-cols-2 gap-2">
            <SliderRow
              label="Da sinistra"
              suffix=" cm"
              step={0.1}
              value={Number(((st.imageX ?? 0) / CM).toFixed(1))}
              min={-5}
              max={30}
              onChange={(cm) => set({ x: Math.round(cm * CM) })}
            />
            <SliderRow
              label={
                pageHeight ? `Dall'alto · pag. ${pageIndex + 1}` : "Dall'alto"
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
            Trascinala sul foglio per spostarla.
            {wrap === "behind"
              ? " Dietro al testo si seleziona con ⌥ + clic."
              : ""}
          </p>
        </Row>
      ) : (
        <Row label="Nel testo" stacked>
          {float ? (
            <Segmented<string>
              value={st.imageSide}
              onChange={(v) => set({ side: v })}
              items={[
                {
                  value: "left",
                  label: "A sinistra",
                  icon: <AlignLeft className="size-3.5" />,
                },
                {
                  value: "right",
                  label: "A destra",
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
                  title: "A sinistra",
                },
                {
                  value: "center",
                  icon: <AlignCenter className="size-3.5" />,
                  title: "Al centro",
                },
                {
                  value: "right",
                  icon: <AlignRight className="size-3.5" />,
                  title: "A destra",
                },
              ]}
            />
          )}
          {wrap !== "inline" ? (
            <div className="mt-2 grid grid-cols-2 gap-2">
              <SliderRow
                label="Dal margine"
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
                label="Dal paragrafo"
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
              label="Sposta su"
              icon={<ArrowUp className="size-3" />}
              run={() => editor.chain().focus().moveBlock("up").run()}
            />
            <Cmd
              label="Sposta giù"
              icon={<ArrowDown className="size-3" />}
              run={() => editor.chain().focus().moveBlock("down").run()}
            />
          </div>
          <p className="mt-1 text-[10px] leading-snug text-muted-foreground">
            {wrap === "inline"
              ? "Trascinala nel testo per spostarla; ⌥↑ e ⌥↓ la spostano di un blocco."
              : "Trascinala dove vuoi sul foglio: si aggancia al paragrafo che trova e il testo le scorre intorno."}
          </p>
        </Row>
      )}

      <SliderRow
        label="Larghezza"
        value={Math.round(st.imageWidth)}
        min={5}
        max={100}
        suffix="%"
        onChange={(v) => set({ width: `${v}%` })}
      />
      <SliderRow
        label="Rotazione"
        value={st.imageRotate}
        min={-180}
        max={180}
        suffix="°"
        onChange={(v) => set({ rotate: v })}
      />
      <SliderRow
        label="Bordo"
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
      <Row label="Ombra">
        <Segmented<string>
          size="sm"
          className="w-[120px]"
          value={st.imageShadow ? "on" : "off"}
          onChange={(v) => set({ shadow: v === "on" })}
          items={[
            { value: "off", label: "No" },
            { value: "on", label: "Sì" },
          ]}
        />
      </Row>
      <Row label="Testo alternativo" stacked>
        <Input
          className="h-8 text-xs"
          value={st.imageAlt}
          placeholder="Descrivi l'immagine"
          // niente focus(): il cursore deve restare nel campo mentre si scrive
          onChange={(e) => set({ alt: e.target.value })}
        />
      </Row>
      <Cmd
        danger
        label="Rimuovi immagine"
        icon={<Trash2 className="size-3.5" />}
        run={() => editor.chain().focus().deleteSelection().run()}
      />
    </Section>
  )
}

/* ------------------------------- tabella -------------------------------- */

function TableSection({ editor, st }: { editor: Editor; st: DocState }) {
  const chain = () => editor.chain().focus()
  return (
    <>
      <Section title="Tabella">
        <Row label="Righe" stacked>
          <div className="flex gap-1">
            <Cmd
              label="Sopra"
              icon={<Rows3 className="size-3" />}
              run={() => chain().addRowBefore().run()}
            />
            <Cmd
              label="Sotto"
              icon={<Rows3 className="size-3" />}
              run={() => chain().addRowAfter().run()}
            />
            <Cmd label="Elimina" run={() => chain().deleteRow().run()} />
          </div>
        </Row>
        <Row label="Colonne" stacked>
          <div className="flex gap-1">
            <Cmd
              label="Prima"
              icon={<Columns3 className="size-3" />}
              run={() => chain().addColumnBefore().run()}
            />
            <Cmd
              label="Dopo"
              icon={<Columns3 className="size-3" />}
              run={() => chain().addColumnAfter().run()}
            />
            <Cmd label="Elimina" run={() => chain().deleteColumn().run()} />
          </div>
        </Row>
        <Row label="Celle" stacked>
          <div className="flex gap-1">
            <Cmd
              label="Unisci"
              icon={<Merge className="size-3" />}
              disabled={!st.canMerge}
              run={() => chain().mergeCells().run()}
            />
            <Cmd
              label="Dividi"
              icon={<Split className="size-3" />}
              disabled={!st.canSplit}
              run={() => chain().splitCell().run()}
            />
          </div>
        </Row>
        <Row label="Intestazione" stacked>
          <div className="flex gap-1">
            <Cmd label="Riga" run={() => chain().toggleHeaderRow().run()} />
            <Cmd
              label="Colonna"
              run={() => chain().toggleHeaderColumn().run()}
            />
            <Cmd label="Cella" run={() => chain().toggleHeaderCell().run()} />
          </div>
        </Row>
      </Section>

      <Section title="Linee e colori">
        <SliderRow
          label="Spessore linee"
          value={st.tableBorderWidth}
          min={0}
          max={8}
          step={0.5}
          onChange={(v) => chain().setTableStyle({ borderWidth: v }).run()}
        />
        <Row label="Tipo di linea" stacked>
          <Segmented<string>
            size="sm"
            value={st.tableBorderStyle}
            onChange={(v) =>
              chain()
                .setTableStyle({ borderStyle: v as "solid" })
                .run()
            }
            items={[
              { value: "solid", label: "Continua" },
              { value: "dashed", label: "Trattini" },
              { value: "dotted", label: "Punti" },
              { value: "double", label: "Doppia" },
            ]}
          />
        </Row>
        <Row label="Colore linee" stacked>
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
        <Row label="Righe alternate">
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
              { value: "off", label: "No" },
              { value: "on", label: "Sì" },
            ]}
          />
        </Row>
      </Section>

      <Section title="Cella">
        <Row label="Sfondo cella" stacked>
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
        <Row label="Allineamento verticale" stacked>
          <Segmented<string>
            size="sm"
            value={st.cellVAlign}
            onChange={(v) => chain().setCellAttribute("verticalAlign", v).run()}
            items={[
              { value: "top", label: "In alto" },
              { value: "middle", label: "Al centro" },
              { value: "bottom", label: "In basso" },
            ]}
          />
        </Row>
        <Cmd
          danger
          label="Elimina tabella"
          icon={<Trash2 className="size-3.5" />}
          run={() => chain().deleteTable().run()}
        />
      </Section>
    </>
  )
}

/* --------------------------- board incorporata --------------------------- */

function EmbedSection({ editor, st }: { editor: Editor; st: DocState }) {
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("boardEmbed", attrs).run()
  return (
    <Section title="Board incorporata">
      <SliderRow
        label="Altezza"
        value={st.embedHeight}
        min={140}
        max={900}
        onChange={(v) => set({ height: v })}
      />
      <Row label="Didascalia" stacked>
        <Input
          className="h-8 text-xs"
          value={st.embedCaption}
          onChange={(e) => set({ caption: e.target.value })}
        />
      </Row>
      <div className="flex gap-1">
        <Cmd
          label="Sposta su"
          icon={<ArrowUp className="size-3" />}
          run={() => editor.chain().focus().moveBlock("up").run()}
        />
        <Cmd
          label="Sposta giù"
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
          render={<Link href={`/board/${st.embedBoardId}`} />}
        >
          <ExternalLink className="size-3.5" /> Apri la board
        </Button>
      ) : null}
    </Section>
  )
}

/* ---------------------------------- note --------------------------------- */

function FootnoteSection({ editor, st }: { editor: Editor; st: DocState }) {
  const endnote = st.footnoteKind === "endnote"
  return (
    <Section title={endnote ? "Nota di chiusura" : "Nota a piè di pagina"}>
      <Textarea
        // nota nuova: si scrive subito, senza cercare il campo
        autoFocus={!st.footnoteText}
        rows={4}
        className="text-xs"
        placeholder="Testo della nota"
        value={st.footnoteText}
        onChange={(e) =>
          editor
            .chain()
            .updateAttributes("footnote", { text: e.target.value })
            .run()
        }
      />
      <Row label="Posizione" stacked>
        <Segmented<"footnote" | "endnote">
          size="sm"
          value={st.footnoteKind}
          items={[
            { value: "footnote", label: "Fondo pagina" },
            { value: "endnote", label: "Fine documento" },
          ]}
          onChange={(kind) =>
            editor.chain().updateAttributes("footnote", { kind }).run()
          }
        />
      </Row>
      <Cmd
        danger
        label="Elimina nota"
        icon={<Trash2 className="size-3.5" />}
        run={() => editor.chain().focus().deleteSelection().run()}
      />
    </Section>
  )
}

/* --------------------------------- grafici --------------------------------- */

function ChartSection({ editor, st }: { editor: Editor; st: DocState }) {
  const spec = parseChartAttr(st.chartSpec)
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("chart", attrs).run()
  return (
    <>
      <Section title="Grafico">
        <ChartOptions
          spec={spec}
          onChange={(next) => set({ spec: JSON.stringify(next) })}
        />
      </Section>
      <Section title="Dimensioni">
        <SliderRow
          label="Larghezza"
          value={st.chartWidth}
          min={25}
          max={100}
          suffix="%"
          onChange={(v) => set({ width: v })}
        />
        <SliderRow
          label="Altezza"
          value={st.chartHeight}
          min={160}
          max={900}
          step={10}
          onChange={(v) => set({ height: v })}
        />
        <Row label="Allineamento">
          <Segmented<string>
            size="sm"
            className="w-[132px]"
            value={st.chartAlign}
            onChange={(v) => set({ align: v })}
            items={[
              {
                value: "left",
                icon: <AlignLeft className="size-3.5" />,
                title: "A sinistra",
              },
              {
                value: "center",
                icon: <AlignCenter className="size-3.5" />,
                title: "Al centro",
              },
              {
                value: "right",
                icon: <AlignRight className="size-3.5" />,
                title: "A destra",
              },
            ]}
          />
        </Row>
        <Cmd
          danger
          label="Elimina grafico"
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
  const source = sources.find((s) => s.id === st.citationSourceId)
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("citation", attrs).run()
  return (
    <Section title="Citazione">
      <p className="rounded-md bg-muted/60 px-2.5 py-2 text-xs">
        {inTextCitation(theme.citationStyle, source, st.citationPages)}
      </p>
      <Row label="Fonte" stacked>
        <Select
          items={sources.map((s) => ({ value: s.id, label: sourceLabel(s) }))}
          value={st.citationSourceId ?? null}
          onValueChange={(v) => set({ sourceId: v })}
        >
          <SelectTrigger className="h-8 w-full text-xs" size="sm">
            <SelectValue placeholder="Scegli una fonte" />
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
      <Row label="Pagine citate" stacked>
        <Input
          className="h-8 text-xs"
          value={st.citationPages}
          placeholder="45 oppure 45-47"
          onChange={(e) => set({ pages: e.target.value })}
        />
      </Row>
      <div className="flex gap-1">
        <Cmd
          label="Modifica fonte"
          disabled={!source}
          run={() => onSources(source?.id ?? null)}
        />
        <Cmd
          danger
          label="Elimina"
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
  return (
    <Section title="Bibliografia">
      <Row label="Titolo" stacked>
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
        Elenca le fonti citate nel documento, in ordine alfabetico e nello stile
        scelto in Riferimenti. Si aggiorna da sola.
      </p>
      <div className="flex gap-1">
        <Cmd label="Gestisci fonti" run={() => onSources()} />
        <Cmd
          danger
          label="Elimina"
          icon={<Trash2 className="size-3.5" />}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </div>
    </Section>
  )
}

/* -------------------------------- modelli 3D ------------------------------- */

const MODEL_BACKGROUNDS = [
  { label: "Trasparente", value: "", swatch: NONE_SWATCH },
  { label: "Bianco", value: "#ffffff" },
  { label: "Grigio chiaro", value: "#f1f1f4" },
  { label: "Grafite", value: "#27272a" },
  { label: "Notte", value: "#0f172a" },
]

const MODEL_COLORS = [
  { label: "Blu", value: "#4f7cff" },
  ...SWATCHES.filter((s) => s.key !== "white").map((s) => ({
    label: s.label,
    value: s.solid,
  })),
  { label: "Argento", value: "#c7c9d1" },
  { label: "Oro", value: "#d4a53c" },
  { label: "Nero", value: whim.base[900] },
]

function Model3DSection({ editor, st }: { editor: Editor; st: DocState }) {
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
        title="Visualizzazione modello 3D"
        action={
          <button
            type="button"
            className="text-[11px] text-muted-foreground hover:text-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => set({ ...DEFAULT_VIEW })}
          >
            Reimposta
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
          label="Zoom"
          value={Math.round(st.model3dZoom * 100)}
          min={40}
          max={300}
          suffix="%"
          onChange={(v) => set({ zoom: v / 100 })}
        />
        <Row label="Ruota da solo">
          <Switch
            checked={st.model3dAutoRotate}
            onCheckedChange={(checked) => set({ autoRotate: checked })}
          />
        </Row>
      </Section>
      <Section title={isShape ? "Forma 3D" : "Modello"}>
        {isShape ? (
          <Row label="Colore" stacked>
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
            {st.model3dName || "Modello glTF"}
          </p>
        )}
        <Row label="Sfondo" stacked>
          <ColorGrid
            colors={MODEL_BACKGROUNDS}
            value={st.model3dBackground}
            onChange={(v) => set({ background: v })}
            columns={5}
          />
        </Row>
        <Row label="Testo alternativo" stacked>
          <Input
            className="h-8 text-xs"
            value={altDraft ?? st.model3dAlt}
            placeholder="Descrivi il modello per chi usa un lettore di schermo"
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
      <Section title="Dimensioni">
        <SliderRow
          label="Larghezza"
          value={st.model3dWidth}
          min={20}
          max={100}
          suffix="%"
          onChange={(v) => set({ width: v })}
        />
        <SliderRow
          label="Altezza"
          value={st.model3dHeight}
          min={120}
          max={900}
          onChange={(v) => set({ height: v })}
        />
        <Row label="Allineamento">
          <Segmented<string>
            size="sm"
            className="w-[132px]"
            value={st.model3dAlign}
            onChange={(v) => set({ align: v })}
            items={[
              {
                value: "left",
                icon: <AlignLeft className="size-3.5" />,
                title: "A sinistra",
              },
              {
                value: "center",
                icon: <AlignCenter className="size-3.5" />,
                title: "Al centro",
              },
              {
                value: "right",
                icon: <AlignRight className="size-3.5" />,
                title: "A destra",
              },
            ]}
          />
        </Row>
        <p className="text-[10px] leading-snug text-muted-foreground">
          Nel documento il modello si ruota col trascinamento. In stampa, nel
          PDF e nel file Word va la vista attuale.
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
                  error instanceof Error ? error.message : "File non valido"
                )
              )
          }}
        />
        <div className="flex gap-1">
          <Cmd
            label="Sostituisci"
            icon={<Rotate3d className="size-3.5" />}
            run={() => replaceInput.current?.click()}
          />
          <Cmd
            danger
            label="Elimina"
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
  const [draft, setDraft] = React.useState<string | null>(null)
  const value = draft ?? st.videoSrc
  const valid = parseVideo(value) !== null
  const set = (attrs: Record<string, unknown>) =>
    editor.chain().updateAttributes("video", attrs).run()

  return (
    <Section title="Video online">
      <Row label="Indirizzo" stacked>
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
            Indirizzo non riconosciuto: YouTube, Vimeo, Loom, Dailymotion o un
            file video (.mp4, .webm).
          </p>
        ) : null}
      </Row>
      <SliderRow
        label="Larghezza"
        value={st.videoWidth}
        min={20}
        max={100}
        suffix="%"
        onChange={(v) => set({ width: v })}
      />
      <Row label="Allineamento">
        <Segmented<string>
          size="sm"
          className="w-[132px]"
          value={st.videoAlign}
          onChange={(v) => set({ align: v })}
          items={[
            {
              value: "left",
              icon: <AlignLeft className="size-3.5" />,
              title: "A sinistra",
            },
            {
              value: "center",
              icon: <AlignCenter className="size-3.5" />,
              title: "Al centro",
            },
            {
              value: "right",
              icon: <AlignRight className="size-3.5" />,
              title: "A destra",
            },
          ]}
        />
      </Row>
      <p className="text-[10px] leading-snug text-muted-foreground">
        Il video si guarda nel documento premendo play. In stampa e nelle
        esportazioni resta l&apos;anteprima con l&apos;indirizzo.
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
          <ExternalLink className="size-3.5" /> Apri
        </Button>
        <Cmd
          danger
          label="Elimina"
          icon={<Trash2 className="size-3.5" />}
          run={() => editor.chain().focus().deleteSelection().run()}
        />
      </div>
    </Section>
  )
}

/* -------------------------------- equazioni -------------------------------- */

function MathSection({ editor, st }: { editor: Editor; st: DocState }) {
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
    <Section title="Equazione">
      <Textarea
        ref={field}
        // equazione nuova: si scrive subito
        autoFocus={!st.mathLatex}
        rows={4}
        spellCheck={false}
        className="font-mono text-xs"
        placeholder="Formula in LaTeX, per esempio \frac{a}{b}"
        value={st.mathLatex}
        onChange={(e) => setLatex(e.target.value)}
      />
      {error ? (
        <p className="text-[11px] leading-snug text-destructive">{error}</p>
      ) : null}
      <Row label="Posizione" stacked>
        <Segmented<"inline" | "display">
          size="sm"
          value={st.mathDisplay ? "display" : "inline"}
          items={[
            { value: "inline", label: "Nel testo" },
            { value: "display", label: "Su riga propria" },
          ]}
          onChange={(v) => {
            if ((v === "display") !== st.mathDisplay) {
              editor.chain().focus().toggleMathDisplay().run()
            }
          }}
        />
      </Row>
      <Row label="Strutture" stacked>
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
      <Row label="Simboli" stacked>
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
        label="Elimina equazione"
        icon={<Trash2 className="size-3.5" />}
        run={() => editor.chain().focus().deleteSelection().run()}
      />
    </Section>
  )
}

/* ------------------------------- pannello ------------------------------- */

/**
 * Pannello contestuale: mostra solo quello su cui si sta lavorando — testo,
 * immagine, tabella, board incorporata o nota. Le impostazioni del file stanno
 * nelle schede Layout e Progettazione.
 */
export function DocInspector({
  editor,
  st,
  theme,
  pageHeight,
  sources,
  onSources,
}: {
  editor: Editor | null
  st: DocState
  theme: DocTheme
  pageHeight: number
  sources: DocSource[]
  onSources: (id?: string | null, cite?: boolean) => void
}) {
  if (!editor) return null
  const heading = st.onImage
    ? {
        icon: <ImageIcon className="size-3.5" />,
        label: "Immagine selezionata",
      }
    : st.onChart
      ? {
          icon: <ChartColumnBig className="size-3.5" />,
          label: "Grafico selezionato",
        }
      : st.onCitation
        ? {
            icon: <Quote className="size-3.5" />,
            label: "Citazione selezionata",
          }
        : st.onBibliography
          ? {
              icon: <BookOpenText className="size-3.5" />,
              label: "Bibliografia",
            }
          : st.onVideo
            ? {
                icon: <Video className="size-3.5" />,
                label: "Video selezionato",
              }
            : st.onModel3d
              ? {
                  icon: <Rotate3d className="size-3.5" />,
                  label: "Modello 3D selezionato",
                }
              : st.onMath
                ? {
                    icon: <Sigma className="size-3.5" />,
                    label: "Equazione selezionata",
                  }
                : st.onFootnote
                  ? {
                      icon: <NotebookPen className="size-3.5" />,
                      label: "Nota selezionata",
                    }
                  : st.onEmbed
                    ? {
                        icon: <ImageIcon className="size-3.5" />,
                        label: "Board selezionata",
                      }
                    : st.inTable
                      ? {
                          icon: <Table2 className="size-3.5" />,
                          label: "Nella tabella",
                        }
                      : {
                          icon: <Type className="size-3.5" />,
                          label: "Nel testo",
                        }

  return (
    <div
      className="flex h-full w-full flex-col overflow-y-auto"
      onClickCapture={guardClicks(editor)}
    >
      <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-border px-4 text-[11px] font-semibold text-muted-foreground">
        {heading.icon}
        {heading.label}
      </div>
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
      ) : (
        <TextSection editor={editor} st={st} />
      )}
    </div>
  )
}
