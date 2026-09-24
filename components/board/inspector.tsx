"use client"

import * as React from "react"
import {
  AlignCenter,
  AlignLeft,
  AlignRight,
  Bold,
  Columns3,
  Copy,
  Italic,
  Minus,
  Plus,
  RotateCcw,
  Rows3,
  Trash2,
} from "lucide-react"
import {
  ColorGrid,
  HeadIcon,
  LineStyleIcon,
  PatternIcon,
  RoutingIcon,
  Row,
  Section,
  Segmented,
  SliderRow,
} from "@/components/shared/inspector-ui"
import { FontPicker } from "@/components/shared/font-picker"
import { ChartOptions } from "@/components/shared/chart-editor"
import { CustomColor } from "@/components/shared/custom-color"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  BACKGROUNDS,
  LINE_COLORS,
  SWATCHES,
  type SwatchKey,
} from "@/lib/palette"
import { getWorkspace } from "@/lib/store"
import {
  FRAME_SPECS,
  SHAPE_LABEL,
  tableAddCol,
  tableAddRow,
  tableRemoveCol,
  tableRemoveRow,
  WIRE_SPECS,
  withTable,
} from "@/lib/items"
import { Glyph } from "./glyph"
import { IconPanel, ShapeGlyph } from "./panels"
import type {
  ArrowHead,
  BackgroundPattern,
  BoardData,
  BoardEdge,
  BoardNode,
  EdgeRouting,
  FrameKind,
  LineStyle,
  NodeShape,
  Side,
  TextAlign,
} from "@/lib/types"
import {
  AUTO_BG,
  defaultBoardTheme,
  PAGE_FORMATS,
  SHAPE_KEYS,
  type PageFormat,
} from "@/lib/types"
import { formatMm } from "@/lib/page"
import type { Selection } from "./board-canvas"

import { useT, tr } from "@/lib/i18n/client"
const HEADS: { value: ArrowHead; label: string }[] = [
  {
    value: "none",
    get label() {
      return tr("Nessuna")
    },
  },
  {
    value: "arrow",
    get label() {
      return tr("Freccia")
    },
  },
  {
    value: "triangle",
    get label() {
      return tr("Triangolo")
    },
  },
  {
    value: "hollow",
    get label() {
      return tr("Triangolo vuoto")
    },
  },
  {
    value: "open",
    get label() {
      return tr("Aperta")
    },
  },
  {
    value: "circle",
    get label() {
      return tr("Cerchio")
    },
  },
  {
    value: "hollowCircle",
    get label() {
      return tr("Cerchio vuoto")
    },
  },
  {
    value: "diamond",
    get label() {
      return tr("Rombo")
    },
  },
  {
    value: "hollowDiamond",
    get label() {
      return tr("Rombo vuoto")
    },
  },
  {
    value: "bar",
    get label() {
      return tr("Barra")
    },
  },
]

const SIDES: { value: Side; label: string }[] = [
  {
    value: "auto",
    get label() {
      return tr("Auto")
    },
  },
  {
    value: "top",
    get label() {
      return tr("Alto")
    },
  },
  {
    value: "right",
    get label() {
      return tr("Destra")
    },
  },
  {
    value: "bottom",
    get label() {
      return tr("Basso")
    },
  },
  {
    value: "left",
    get label() {
      return tr("Sinistra")
    },
  },
]

// le etichette mostrate nella casella chiusa: Base UI altrimenti mostra il
// valore. Si leggono a ogni disegno: calcolate una volta sola restavano nella
// lingua di prima quando si cambia lingua
const wireItems = () =>
  Object.fromEntries(
    Object.entries(WIRE_SPECS).map(([key, spec]) => [key, spec.label])
  )
const frameItems = () =>
  Object.fromEntries(
    Object.entries(FRAME_SPECS).map(([key, spec]) => [key, spec.label])
  )
const pageItems = () => ({
  infinite: tr("Infinita"),
  ...Object.fromEntries(
    Object.entries(PAGE_FORMATS).map(([key, format]) => [key, format.label])
  ),
})

const KIND_LABEL: Record<string, string> = {
  get chart() {
    return tr("Grafico")
  },
  get shape() {
    return tr("Elemento")
  },
  get frame() {
    return tr("Frame")
  },
  get section() {
    return tr("Sezione")
  },
  get table() {
    return tr("Tabella")
  },
  get icon() {
    return tr("Icona")
  },
  get wire() {
    return tr("Componente")
  },
  get draw() {
    return tr("Tratto")
  },
}

function HeadSelect({
  value,
  onChange,
  reversed,
}: {
  value: ArrowHead
  onChange: (v: ArrowHead) => void
  reversed?: boolean
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as ArrowHead)}>
      <SelectTrigger className="h-8 w-[112px] text-xs" size="sm">
        <SelectValue>
          <HeadIcon type={value} reversed={reversed} />
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {HEADS.map((h) => (
          <SelectItem key={h.value} value={h.value}>
            <span className="flex items-center gap-2">
              <HeadIcon type={h.value} reversed={reversed} />
              <span className="text-xs">{h.label}</span>
            </span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}

function ShapeGrid({
  value,
  onChange,
}: {
  value: NodeShape | undefined
  onChange: (s: NodeShape) => void
}) {
  return (
    <div className="grid grid-cols-6 gap-1">
      {SHAPE_KEYS.map((s) => (
        <button
          key={s}
          title={SHAPE_LABEL[s] ?? s}
          onClick={() => onChange(s)}
          className={`flex h-8 items-center justify-center rounded-lg transition ${
            value === s
              ? "bg-accent text-accent-foreground"
              : "text-muted-foreground hover:bg-muted"
          }`}
        >
          <ShapeGlyph shape={s} size={16} />
        </button>
      ))}
    </div>
  )
}

/* ------------------------- proprietà dei componenti ---------------------- */

function WireProps({
  node,
  onPatch,
}: {
  node: BoardNode
  onPatch: (props: Record<string, string | number | boolean>) => void
}) {
  const t = useT()
  const kind = node.wire
  if (!kind) return null
  const p = node.wireProps ?? {}
  const set = (k: string, v: string | number | boolean) =>
    onPatch({ ...p, [k]: v })
  const has = (k: string) => k in (WIRE_SPECS[kind].props ?? {})

  return (
    <>
      {has("variant") ? (
        <Row label={t("Variante")} stacked>
          <Segmented
            value={String(p.variant ?? "primary")}
            onChange={(v) => set("variant", v)}
            items={[
              { value: "primary", label: t("Pieno") },
              { value: "outline", label: t("Bordo") },
              { value: "ghost", label: t("Piatto") },
            ]}
          />
        </Row>
      ) : null}
      {has("checked") ? (
        <Row label={t("Selezionato")}>
          <Switch
            checked={Boolean(p.checked)}
            onCheckedChange={(v) => set("checked", v)}
          />
        </Row>
      ) : null}
      {has("value") ? (
        <SliderRow
          label={t("Valore")}
          value={Number(p.value ?? 0)}
          min={0}
          max={kind === "rating" ? 5 : kind === "stepper" ? 99 : 100}
          suffix={kind === "slider" || kind === "progress" ? "%" : ""}
          onChange={(v) => set("value", v)}
        />
      ) : null}
      {has("rows") ? (
        <SliderRow
          label={
            kind === "paragraph" ? t("Righe||righe di testo") : t("Elementi")
          }
          value={Number(p.rows ?? 4)}
          min={1}
          max={10}
          suffix=""
          onChange={(v) => set("rows", v)}
        />
      ) : null}
      {has("lines") ? (
        <SliderRow
          label={t("Righe||righe di testo")}
          value={Number(p.lines ?? 4)}
          min={1}
          max={12}
          suffix=""
          onChange={(v) => set("lines", v)}
        />
      ) : null}
      {has("avatar") ? (
        <Row label={t("Avatar")}>
          <Switch
            checked={Boolean(p.avatar)}
            onCheckedChange={(v) => set("avatar", v)}
          />
        </Row>
      ) : null}
      {has("type") ? (
        <Row label={t("Tipo")} stacked>
          <Segmented
            value={String(p.type ?? "bar")}
            onChange={(v) => set("type", v)}
            items={[
              { value: "bar", label: t("Barre") },
              { value: "line", label: t("Linea") },
              { value: "pie", label: t("Torta") },
            ]}
          />
        </Row>
      ) : null}
      {has("shape") ? (
        <Row label={t("Forma")} stacked>
          <Segmented
            value={String(p.shape ?? "circle")}
            onChange={(v) => set("shape", v)}
            items={[
              { value: "circle", label: t("Tondo") },
              { value: "square", label: t("Quadrato") },
            ]}
          />
        </Row>
      ) : null}
      {has("placeholder") ? (
        <Row label={t("Segnaposto")} stacked>
          <Input
            className="h-8 text-xs"
            value={String(p.placeholder ?? "")}
            onChange={(e) => set("placeholder", e.target.value)}
          />
        </Row>
      ) : null}
      {has("icon") ? (
        <Row label={t("Icona")}>
          <Popover>
            <PopoverTrigger
              render={
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 gap-2 text-xs"
                />
              }
            >
              <Glyph
                name={String(p.icon ?? "plus")}
                size={14}
                strokeWidth={2}
              />
              {t("Cambia")}
            </PopoverTrigger>
            <PopoverContent align="end" className="w-auto p-0">
              <IconPanel onPick={(name) => set("icon", name)} />
            </PopoverContent>
          </Popover>
        </Row>
      ) : null}
    </>
  )
}

/* -------------------------------- inspector ------------------------------ */

export function BoardInspector({
  fileId,
  data,
  selection,
  setSelection,
}: {
  fileId: string
  data: BoardData
  selection: Selection
  setSelection: (s: Selection) => void
}) {
  const t = useT()
  // solo le azioni, che non cambiano mai: iscriversi a tutto lo store
  // ridisegnava il pannello a ogni fotogramma di un trascinamento
  const store = getWorkspace()
  const theme = data.theme
  // insiemi, non `includes`: con cento elementi selezionati su una board
  // grande il pannello faceva un confronto per ogni coppia
  const pickedNodes = new Set(selection.nodes)
  const pickedEdges = new Set(selection.edges)
  const nodes = data.nodes.filter((n) => pickedNodes.has(n.id))
  const edges = data.edges.filter((e) => pickedEdges.has(e.id))

  const setTheme = store.setBoardTheme
  const snap = () => store.snapshot(fileId)

  const patchNodes = (patch: Partial<BoardNode>, withHistory = true) => {
    if (withHistory) snap()
    store.updateNodes(fileId, selection.nodes, patch)
  }
  const patchEdges = (patch: Partial<BoardEdge>, withHistory = true) => {
    if (withHistory) snap()
    store.updateEdges(fileId, selection.edges, patch)
  }

  const first = nodes[0]
  const firstEdge = edges[0]
  const kind = first?.kind ?? "shape"
  const hasText =
    first && kind !== "icon" && kind !== "draw" && kind !== "chart"

  const bgColors = [
    {
      value: AUTO_BG,
      label: t("Auto (segue il tema)"),
      swatch: "linear-gradient(135deg,#ffffff 50%,#18181b 50%)",
    },
    ...BACKGROUNDS.map((b) => ({ value: b.value, label: b.label })),
  ]

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto">
      {/* ------------------------------ NODI ------------------------------ */}
      {nodes.length > 0 ? (
        <>
          <Section
            title={
              nodes.length > 1
                ? t("{count} elementi", { count: nodes.length })
                : (KIND_LABEL[kind] ?? t("Elemento"))
            }
          >
            {kind === "wire" ? (
              <Row label={t("Componente")} stacked>
                <Select
                  value={first.wire}
                  items={wireItems()}
                  onValueChange={(v) => {
                    const spec = WIRE_SPECS[v as keyof typeof WIRE_SPECS]
                    patchNodes({
                      wire: v as BoardNode["wire"],
                      wireProps: { ...(spec.props ?? {}) },
                      text: spec.text ?? "",
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-xs" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(
                      Object.keys(WIRE_SPECS) as (keyof typeof WIRE_SPECS)[]
                    ).map((k) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {WIRE_SPECS[k].label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            ) : null}

            {kind === "frame" ? (
              <Row label={t("Dispositivo")} stacked>
                <Select
                  value={first.frame ?? "plain"}
                  items={frameItems()}
                  onValueChange={(v) => {
                    const spec = FRAME_SPECS[v as FrameKind]
                    patchNodes({
                      frame: v as FrameKind,
                      w: spec.w,
                      h: spec.h,
                      radius: spec.radius,
                    })
                  }}
                >
                  <SelectTrigger className="h-8 w-full text-xs" size="sm">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(FRAME_SPECS) as FrameKind[]).map((k) => (
                      <SelectItem key={k} value={k} className="text-xs">
                        {FRAME_SPECS[k].label} · {FRAME_SPECS[k].w}×
                        {FRAME_SPECS[k].h}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Row>
            ) : null}

            {kind === "icon" ? (
              <Row label={t("Simbolo")} stacked>
                <Popover>
                  <PopoverTrigger
                    render={
                      <Button
                        variant="outline"
                        className="h-9 w-full justify-start gap-2 text-xs"
                      />
                    }
                  >
                    <Glyph
                      name={first.icon ?? "star"}
                      size={16}
                      strokeWidth={1.9}
                    />
                    {first.icon}
                  </PopoverTrigger>
                  <PopoverContent align="start" className="w-auto p-0">
                    <IconPanel onPick={(name) => patchNodes({ icon: name })} />
                  </PopoverContent>
                </Popover>
              </Row>
            ) : null}

            {kind === "chart" && first.chart ? (
              <ChartOptions
                spec={first.chart}
                onChange={(chart) => {
                  snap()
                  store.updateNode(fileId, first.id, { chart })
                }}
              />
            ) : null}

            {kind !== "chart" ? (
              <Row label={t("Colore")} stacked>
                <ColorGrid
                  columns={5}
                  value={first?.color ?? "white"}
                  colors={SWATCHES.map((s) => ({
                    value: s.key,
                    label: s.label,
                    swatch:
                      kind === "icon" || kind === "draw" ? s.solid : s.fill,
                    border: s.border,
                  }))}
                  onChange={(v) =>
                    patchNodes({
                      color: v as SwatchKey,
                      strokeColor: undefined,
                    })
                  }
                />
              </Row>
            ) : null}

            {kind === "shape" ? (
              <Row label={t("Forma")} stacked>
                <ShapeGrid
                  value={first?.shape}
                  onChange={(s) => patchNodes({ shape: s })}
                />
              </Row>
            ) : null}

            {kind === "icon" || kind === "draw" ? (
              <SliderRow
                label={t("Spessore")}
                value={first?.strokeWidth ?? (kind === "icon" ? 1.8 : 3)}
                min={0.5}
                max={kind === "icon" ? 4 : 24}
                step={0.5}
                onChange={(v) => patchNodes({ strokeWidth: v }, false)}
                onCommit={() => snap()}
              />
            ) : null}

            {kind === "draw" ? (
              <SliderRow
                label={t("Opacità")}
                value={Math.round((first?.opacity ?? 1) * 100)}
                min={10}
                max={100}
                suffix="%"
                onChange={(v) => patchNodes({ opacity: v / 100 }, false)}
                onCommit={() => snap()}
              />
            ) : null}

            {kind === "table" && first.table ? (
              <>
                <Row label={t("Righe")}>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        snap()
                        store.updateNode(
                          fileId,
                          first.id,
                          withTable(
                            first,
                            tableRemoveRow(first.table!, first.table!.rows - 1)
                          )
                        )
                      }}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-xs tabular-nums">
                      {first.table.rows}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        snap()
                        store.updateNode(
                          fileId,
                          first.id,
                          withTable(first, tableAddRow(first.table!))
                        )
                      }}
                    >
                      <Rows3 className="size-3.5" />
                    </Button>
                  </div>
                </Row>
                <Row label={t("Colonne")}>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        snap()
                        store.updateNode(
                          fileId,
                          first.id,
                          withTable(
                            first,
                            tableRemoveCol(first.table!, first.table!.cols - 1)
                          )
                        )
                      }}
                    >
                      <Minus className="size-3.5" />
                    </Button>
                    <span className="w-6 text-center text-xs tabular-nums">
                      {first.table.cols}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-7"
                      onClick={() => {
                        snap()
                        store.updateNode(
                          fileId,
                          first.id,
                          withTable(first, tableAddCol(first.table!))
                        )
                      }}
                    >
                      <Columns3 className="size-3.5" />
                    </Button>
                  </div>
                </Row>
                <Row label={t("Intestazione")}>
                  <Switch
                    checked={first.table.header}
                    onCheckedChange={(v) =>
                      patchNodes({ table: { ...first.table!, header: v } })
                    }
                  />
                </Row>
                <Row label={t("Righe alternate")}>
                  <Switch
                    checked={first.table.striped}
                    onCheckedChange={(v) =>
                      patchNodes({ table: { ...first.table!, striped: v } })
                    }
                  />
                </Row>
              </>
            ) : null}

            {kind === "wire" ? (
              <WireProps
                node={first}
                onPatch={(props) => patchNodes({ wireProps: props })}
              />
            ) : null}

            {kind !== "icon" && kind !== "draw" ? (
              <>
                <SliderRow
                  label={t("Smussatura")}
                  value={first?.radius ?? theme.cornerRadius}
                  min={0}
                  max={48}
                  onChange={(v) => patchNodes({ radius: v }, false)}
                  onCommit={() => snap()}
                />
                {first?.radius !== null && first?.radius !== undefined ? (
                  <button
                    onClick={() => patchNodes({ radius: null })}
                    className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
                  >
                    <RotateCcw className="size-3" />{" "}
                    {t("usa il valore della board ({radius} px)", {
                      radius: theme.cornerRadius,
                    })}
                  </button>
                ) : null}
              </>
            ) : null}
          </Section>

          {hasText ? (
            <Section title={t("Testo")}>
              {kind === "wire" &&
              ["navbar", "tabs", "breadcrumb", "sidebarNav", "footer"].includes(
                first.wire ?? ""
              ) ? (
                <Row label={t("Voci (separate da |)")} stacked>
                  <Input
                    className="h-8 text-xs"
                    value={first.text}
                    onChange={(e) =>
                      patchNodes({ text: e.target.value }, false)
                    }
                  />
                </Row>
              ) : (
                <Row label={t("Contenuto")} stacked>
                  <Input
                    className="h-8 text-xs"
                    value={first.text}
                    placeholder={t("Testo…")}
                    onChange={(e) =>
                      patchNodes({ text: e.target.value }, false)
                    }
                  />
                </Row>
              )}
              <SliderRow
                label={t("Dimensione")}
                value={first?.fontSize ?? 15}
                min={9}
                max={64}
                onChange={(v) => patchNodes({ fontSize: v }, false)}
                onCommit={() => snap()}
              />
              <div className="flex items-center gap-1.5">
                <Segmented<TextAlign>
                  value={(first?.align ?? "center") as TextAlign}
                  onChange={(v) => patchNodes({ align: v })}
                  items={[
                    { value: "left", icon: <AlignLeft className="size-3.5" /> },
                    {
                      value: "center",
                      icon: <AlignCenter className="size-3.5" />,
                    },
                    {
                      value: "right",
                      icon: <AlignRight className="size-3.5" />,
                    },
                  ]}
                />
                <button
                  onClick={() => patchNodes({ bold: !first?.bold })}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition ${
                    first?.bold
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Bold className="size-3.5" />
                </button>
                <button
                  onClick={() => patchNodes({ italic: !first?.italic })}
                  className={`flex size-7 shrink-0 items-center justify-center rounded-lg transition ${
                    first?.italic
                      ? "bg-accent text-accent-foreground"
                      : "text-muted-foreground hover:bg-muted"
                  }`}
                >
                  <Italic className="size-3.5" />
                </button>
              </div>
              {kind === "shape" || kind === "table" || kind === "frame" ? (
                <>
                  <Row label={t("Contorno")}>
                    <Switch
                      checked={!!first?.outline}
                      onCheckedChange={(v) => patchNodes({ outline: v })}
                    />
                  </Row>
                  <Row label={t("Ombra")}>
                    <Switch
                      checked={!!first?.shadow}
                      onCheckedChange={(v) => patchNodes({ shadow: v })}
                    />
                  </Row>
                </>
              ) : null}
            </Section>
          ) : null}

          <Section title={t("Azioni")}>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => {
                  snap()
                  // come ⌘D: i connettori fra gli elementi duplicati vengono con loro
                  const idMap = new Map<string, string>()
                  for (const n of nodes) {
                    idMap.set(
                      n.id,
                      store.addNode(fileId, { ...n, x: n.x + 28, y: n.y + 28 })
                    )
                  }
                  for (const edge of data.edges) {
                    const from = idMap.get(edge.from)
                    const to = idMap.get(edge.to)
                    if (from && to) store.addEdge(fileId, { ...edge, from, to })
                  }
                  setSelection({ nodes: [...idMap.values()], edges: [] })
                }}
              >
                <Copy className="size-3.5" /> {t("Duplica")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-xs text-destructive hover:text-destructive"
                onClick={() => {
                  snap()
                  store.removeSelection(
                    fileId,
                    selection.nodes,
                    selection.edges
                  )
                  setSelection({ nodes: [], edges: [] })
                }}
              >
                <Trash2 className="size-3.5" /> {t("Elimina")}
              </Button>
            </div>
            <div className="flex gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => {
                  snap()
                  store.reorder(fileId, selection.nodes, "front")
                }}
              >
                <Plus className="size-3.5 rotate-45" /> {t("Davanti")}
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="h-7 flex-1 text-xs"
                onClick={() => {
                  snap()
                  store.reorder(fileId, selection.nodes, "back")
                }}
              >
                {t("Dietro")}
              </Button>
            </div>
          </Section>
        </>
      ) : null}

      {/* ------------------------------ ARCHI ----------------------------- */}
      {edges.length > 0 ? (
        <Section
          title={
            edges.length > 1
              ? t("{count} connettori", { count: edges.length })
              : t("Connettore")
          }
        >
          <Row label={t("Percorso")} stacked>
            <Segmented<EdgeRouting>
              value={
                (firstEdge?.routing ?? theme.arrows.routing) as EdgeRouting
              }
              onChange={(v) => patchEdges({ routing: v })}
              items={[
                {
                  value: "straight",
                  icon: <RoutingIcon type="straight" />,
                  title: t("Dritto"),
                },
                {
                  value: "elbow",
                  icon: <RoutingIcon type="elbow" />,
                  title: t("A gomito"),
                },
                {
                  value: "curved",
                  icon: <RoutingIcon type="curved" />,
                  title: t("Curvo"),
                },
              ]}
            />
          </Row>
          <Row label={t("Punta")}>
            <HeadSelect
              value={(firstEdge?.head ?? theme.arrows.head) as ArrowHead}
              onChange={(v) => patchEdges({ head: v })}
            />
          </Row>
          <Row label={t("Coda")}>
            <HeadSelect
              reversed
              value={(firstEdge?.tail ?? theme.arrows.tail) as ArrowHead}
              onChange={(v) => patchEdges({ tail: v })}
            />
          </Row>
          <Row label={t("Linea")} stacked>
            <Segmented<LineStyle>
              value={(firstEdge?.style ?? theme.arrows.style) as LineStyle}
              onChange={(v) => patchEdges({ style: v })}
              items={[
                {
                  value: "solid",
                  icon: <LineStyleIcon type="solid" />,
                  title: t("Continua"),
                },
                {
                  value: "dashed",
                  icon: <LineStyleIcon type="dashed" />,
                  title: t("Tratteggiata"),
                },
                {
                  value: "dotted",
                  icon: <LineStyleIcon type="dotted" />,
                  title: t("Punteggiata"),
                },
                {
                  value: "sketch",
                  icon: <LineStyleIcon type="sketch" />,
                  title: t("Schizzo"),
                },
              ]}
            />
          </Row>
          <SliderRow
            label={t("Spessore")}
            value={firstEdge?.width ?? theme.arrows.width}
            min={1}
            max={8}
            onChange={(v) => patchEdges({ width: v }, false)}
            onCommit={() => snap()}
          />
          <Row label={t("Colore")} stacked>
            <ColorGrid
              columns={5}
              value={firstEdge?.color ?? theme.arrows.color}
              colors={LINE_COLORS}
              onChange={(v) => patchEdges({ color: v })}
            />
          </Row>
          <Row label={t("Etichetta")} stacked>
            <Input
              className="h-8 text-xs"
              value={firstEdge?.label ?? ""}
              placeholder={t("Nessuna")}
              onChange={(e) => patchEdges({ label: e.target.value }, false)}
            />
          </Row>
          <div className="flex gap-2">
            <Row label={t("Da")}>
              <Select
                items={SIDES}
                value={firstEdge?.fromSide ?? "auto"}
                onValueChange={(v) => patchEdges({ fromSide: v as Side })}
              >
                <SelectTrigger className="h-7 w-[86px] text-[11px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIDES.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      className="text-xs"
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
            <Row label={t("A")}>
              <Select
                items={SIDES}
                value={firstEdge?.toSide ?? "auto"}
                onValueChange={(v) => patchEdges({ toSide: v as Side })}
              >
                <SelectTrigger className="h-7 w-[86px] text-[11px]" size="sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SIDES.map((s) => (
                    <SelectItem
                      key={s.value}
                      value={s.value}
                      className="text-xs"
                    >
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Row>
          </div>
          <button
            onClick={() =>
              patchEdges({
                routing: null,
                head: null,
                tail: null,
                style: null,
                color: null,
                width: null,
              })
            }
            className="flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3" /> {t("usa lo stile della board")}
          </button>
        </Section>
      ) : null}

      {/* ------------------------------ BOARD ----------------------------- */}
      {/* la modalità sta nella barra in alto: qui era un doppione */}
      <Section title={t("Board")}>
        <FontPicker
          value={theme.font}
          onChange={(v) => setTheme(fileId, { font: v })}
        />
        <SliderRow
          label={t("Smussatura card")}
          value={theme.cornerRadius}
          min={0}
          max={40}
          onChange={(v) => setTheme(fileId, { cornerRadius: v })}
        />
        <Row label={t("Forma predefinita")} stacked>
          <ShapeGrid
            value={theme.defaultShape}
            onChange={(s) => setTheme(fileId, { defaultShape: s })}
          />
        </Row>
      </Section>

      <Section title={t("Pagina")}>
        <Row label={t("Formato")} stacked>
          <Select
            items={pageItems()}
            value={theme.page.format}
            onValueChange={(v) =>
              setTheme(fileId, {
                page: { ...theme.page, format: v as PageFormat | "infinite" },
              })
            }
          >
            <SelectTrigger className="h-8 w-full text-xs" size="sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="infinite" className="text-xs">
                <span className="flex w-full items-center justify-between gap-6">
                  <span>{t("Infinita")}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {t("nessun limite")}
                  </span>
                </span>
              </SelectItem>
              {(Object.keys(PAGE_FORMATS) as PageFormat[])
                .filter((k) => PAGE_FORMATS[k].mm)
                .map((k) => (
                  <SelectItem key={k} value={k} className="text-xs">
                    <span className="flex w-full items-center justify-between gap-6">
                      <span>{PAGE_FORMATS[k].label}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {PAGE_FORMATS[k].mm![0]}×{PAGE_FORMATS[k].mm![1]} mm
                      </span>
                    </span>
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </Row>
        {theme.page.format !== "infinite" ? (
          <>
            <Row label={t("Orientamento")} stacked>
              <Segmented<"portrait" | "landscape">
                value={theme.page.orientation}
                onChange={(v) =>
                  setTheme(fileId, { page: { ...theme.page, orientation: v } })
                }
                items={[
                  { value: "portrait", label: t("Verticale") },
                  { value: "landscape", label: t("Orizzontale") },
                ]}
              />
            </Row>
            <p className="text-[11px] leading-snug text-muted-foreground">
              {(() => {
                const mm = formatMm(theme.page.format, theme.page.orientation)
                return mm
                  ? t(
                      "Il foglio è l'area su cui lavori: definisce anche il riquadro dell'esportazione e la misura del PDF ({width}×{height} mm).",
                      { width: Math.round(mm[0]), height: Math.round(mm[1]) }
                    )
                  : t(
                      "Il foglio è l'area su cui lavori: definisce anche il riquadro dell'esportazione e la misura del PDF."
                    )
              })()}
            </p>
          </>
        ) : null}
      </Section>

      <Section title={t("Sfondo")}>
        <ColorGrid
          columns={7}
          value={theme.background}
          colors={bgColors}
          onChange={(v) => setTheme(fileId, { background: v })}
        />
        <CustomColor
          value={theme.background}
          onChange={(v) => setTheme(fileId, { background: v })}
        />
        <Row label={t("Trama")} stacked>
          <Segmented<BackgroundPattern>
            value={theme.pattern}
            onChange={(v) => setTheme(fileId, { pattern: v })}
            items={[
              {
                value: "plain",
                icon: <PatternIcon type="plain" />,
                title: t("Nessuna"),
              },
              {
                value: "dots",
                icon: <PatternIcon type="dots" />,
                title: t("Punti"),
              },
              {
                value: "grid",
                icon: <PatternIcon type="grid" />,
                title: t("Griglia"),
              },
              {
                value: "cross",
                icon: <PatternIcon type="cross" />,
                title: t("Croci"),
              },
              {
                value: "lines",
                icon: <PatternIcon type="lines" />,
                title: t("Righe||motivo di sfondo a righe"),
              },
            ]}
          />
        </Row>
        {theme.pattern !== "plain" ? (
          <SliderRow
            label={t("Intensità trama")}
            value={Math.round(theme.patternOpacity * 100)}
            min={10}
            max={100}
            suffix="%"
            onChange={(v) => setTheme(fileId, { patternOpacity: v / 100 })}
          />
        ) : null}
      </Section>

      <Section
        title={t("Frecce")}
        action={
          <button
            onClick={() =>
              setTheme(fileId, { arrows: { ...defaultBoardTheme.arrows } })
            }
            className="text-[11px] text-muted-foreground hover:text-foreground"
            title={t("Ripristina")}
          >
            <RotateCcw className="size-3" />
          </button>
        }
      >
        <Row label={t("Percorso")} stacked>
          <Segmented<EdgeRouting>
            value={theme.arrows.routing}
            onChange={(v) =>
              setTheme(fileId, { arrows: { ...theme.arrows, routing: v } })
            }
            items={[
              {
                value: "straight",
                icon: <RoutingIcon type="straight" />,
                title: t("Dritto"),
              },
              {
                value: "elbow",
                icon: <RoutingIcon type="elbow" />,
                title: t("A gomito"),
              },
              {
                value: "curved",
                icon: <RoutingIcon type="curved" />,
                title: t("Curvo"),
              },
            ]}
          />
        </Row>
        <Row label={t("Punta")}>
          <HeadSelect
            value={theme.arrows.head}
            onChange={(v) =>
              setTheme(fileId, { arrows: { ...theme.arrows, head: v } })
            }
          />
        </Row>
        <Row label={t("Coda")}>
          <HeadSelect
            reversed
            value={theme.arrows.tail}
            onChange={(v) =>
              setTheme(fileId, { arrows: { ...theme.arrows, tail: v } })
            }
          />
        </Row>
        <Row label={t("Linea")} stacked>
          <Segmented<LineStyle>
            value={theme.arrows.style}
            onChange={(v) =>
              setTheme(fileId, { arrows: { ...theme.arrows, style: v } })
            }
            items={[
              {
                value: "solid",
                icon: <LineStyleIcon type="solid" />,
                title: t("Continua"),
              },
              {
                value: "dashed",
                icon: <LineStyleIcon type="dashed" />,
                title: t("Tratteggiata"),
              },
              {
                value: "dotted",
                icon: <LineStyleIcon type="dotted" />,
                title: t("Punteggiata"),
              },
              {
                value: "sketch",
                icon: <LineStyleIcon type="sketch" />,
                title: t("Schizzo"),
              },
            ]}
          />
        </Row>
        <SliderRow
          label={t("Spessore")}
          value={theme.arrows.width}
          min={1}
          max={8}
          onChange={(v) =>
            setTheme(fileId, { arrows: { ...theme.arrows, width: v } })
          }
        />
        <SliderRow
          label={t("Raggio spigoli")}
          value={theme.arrows.cornerRadius}
          min={0}
          max={28}
          onChange={(v) =>
            setTheme(fileId, { arrows: { ...theme.arrows, cornerRadius: v } })
          }
        />
        <Row label={t("Colore")} stacked>
          <ColorGrid
            columns={5}
            value={theme.arrows.color}
            colors={LINE_COLORS}
            onChange={(v) =>
              setTheme(fileId, { arrows: { ...theme.arrows, color: v } })
            }
          />
        </Row>
      </Section>
    </div>
  )
}
