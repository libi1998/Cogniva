import type { JSONContent } from "@tiptap/core"
import { ICONS } from "./icon-library"
import { shapePath } from "./shapes"
import type { SwatchKey } from "./palette"
import type { BoardEdge, BoardNode, NodeShape } from "./types"

/**
 * Contenuti pronti della scheda Inserisci: frontespizi, forme e icone (come
 * immagini SVG, così hanno già posizione, testo a capo e rotazione delle
 * immagini), WordArt, riga della firma e modelli SmartArt (come board).
 */

/* ------------------------------ frontespizio ----------------------------- */

export type CoverDesign = {
  id: string
  label: string
  hint: string
}

export const COVER_DESIGNS: CoverDesign[] = [
  { id: "classic", label: "Classico", hint: "Titolo centrato, dati in fondo" },
  {
    id: "sidebar",
    label: "Barra laterale",
    hint: "Barra dell'accento a sinistra",
  },
  { id: "band", label: "Banda", hint: "Titolo su una fascia colorata" },
  {
    id: "minimal",
    label: "Essenziale",
    hint: "Linea sottile, tutto a sinistra",
  },
  { id: "report", label: "Rapporto", hint: "Etichetta, titolo e sommario" },
  { id: "elegant", label: "Elegante", hint: "Filetti sopra e sotto" },
]

const PX = 96 / 72

const text = (value: string): JSONContent[] =>
  value ? [{ type: "text", text: value }] : []

const para = (
  value: string,
  attrs: Record<string, unknown> = {}
): JSONContent => ({
  type: "paragraph",
  attrs: { cover: true, ...attrs },
  content: text(value),
})

/**
 * Le parti del frontespizio: gli attributi da dare al titolo del documento e
 * i blocchi da mettere subito dopo, fino all'interruzione di pagina.
 */
export function coverContent(
  design: string,
  info: { title: string; author: string; date: string }
): { title: Record<string, unknown>; after: JSONContent[] } {
  const spacer = (pt: number) =>
    para("", { spaceBefore: `${Math.round(pt * PX)}px` })
  const end: JSONContent = { type: "pageBreak", attrs: { cover: true } }
  switch (design) {
    case "sidebar":
      return {
        title: { spaceBefore: `${Math.round(160 * PX)}px`, border: "left" },
        after: [
          para("[Sottotitolo del documento]", { styleId: "subtitle" }),
          spacer(220),
          para(info.author, { border: "left" }),
          para(info.date, { border: "left" }),
          end,
        ],
      }
    case "band":
      return {
        title: {
          spaceBefore: `${Math.round(120 * PX)}px`,
          shading: "var(--doc-accent-soft)",
          textAlign: "center",
        },
        after: [
          para("[Sottotitolo del documento]", {
            styleId: "subtitle",
            textAlign: "center",
          }),
          spacer(260),
          para(`${info.author} · ${info.date}`, { textAlign: "center" }),
          end,
        ],
      }
    case "minimal":
      return {
        title: { spaceBefore: `${Math.round(60 * PX)}px`, border: "bottom" },
        after: [
          para("[Sottotitolo del documento]", { styleId: "subtitle" }),
          spacer(360),
          para(info.author, { textAlign: "right" }),
          para(info.date, { textAlign: "right" }),
          end,
        ],
      }
    case "report":
      return {
        title: { spaceBefore: `${Math.round(24 * PX)}px` },
        after: [
          para("RAPPORTO", { styleId: "caption" }),
          para("[Sottotitolo del documento]", { styleId: "subtitle" }),
          spacer(40),
          para(
            "[Sommario: scrivi qui in due o tre righe di cosa parla il documento e a chi si rivolge.]",
            { shading: "var(--doc-accent-soft)" }
          ),
          spacer(300),
          para(`Autore: ${info.author}`),
          para(`Data: ${info.date}`),
          end,
        ],
      }
    case "elegant":
      return {
        title: {
          spaceBefore: `${Math.round(200 * PX)}px`,
          textAlign: "center",
          border: "box",
        },
        after: [
          para("[Sottotitolo del documento]", {
            styleId: "subtitle",
            textAlign: "center",
          }),
          spacer(240),
          para(info.author, { textAlign: "center" }),
          para(info.date, { textAlign: "center" }),
          end,
        ],
      }
    default:
      return {
        title: {
          spaceBefore: `${Math.round(220 * PX)}px`,
          textAlign: "center",
        },
        after: [
          para("[Sottotitolo del documento]", {
            styleId: "subtitle",
            textAlign: "center",
          }),
          spacer(280),
          para(info.author, { textAlign: "center" }),
          para(info.date, { textAlign: "center" }),
          end,
        ],
      }
  }
}

/* --------------------------------- forme --------------------------------- */

export type DocShapeKind =
  | NodeShape
  | "line"
  | "arrow-line"
  | "double-arrow"
  | "arrow-left"
  | "arrow-up"
  | "arrow-down"
  | "callout"
  | "heart"
  | "pentagon"
  | "octagon"
  | "chevron"

export const SHAPE_GROUPS: {
  label: string
  shapes: { kind: DocShapeKind; label: string }[]
}[] = [
  {
    label: "Linee",
    shapes: [
      { kind: "line", label: "Linea" },
      { kind: "arrow-line", label: "Freccia" },
      { kind: "double-arrow", label: "Freccia doppia" },
    ],
  },
  {
    label: "Rettangoli",
    shapes: [
      { kind: "rect", label: "Rettangolo" },
      { kind: "rounded", label: "Rettangolo arrotondato" },
      { kind: "pill", label: "Pillola" },
      { kind: "note", label: "Nota" },
    ],
  },
  {
    label: "Forme di base",
    shapes: [
      { kind: "ellipse", label: "Ovale" },
      { kind: "triangle", label: "Triangolo" },
      { kind: "diamond", label: "Rombo" },
      { kind: "parallelogram", label: "Parallelogramma" },
      { kind: "pentagon", label: "Pentagono" },
      { kind: "hexagon", label: "Esagono" },
      { kind: "octagon", label: "Ottagono" },
      { kind: "cylinder", label: "Cilindro" },
      { kind: "cross", label: "Croce" },
      { kind: "heart", label: "Cuore" },
      { kind: "cloud", label: "Nuvola" },
    ],
  },
  {
    label: "Frecce a blocchi",
    shapes: [
      { kind: "arrowBlock", label: "Freccia a destra" },
      { kind: "arrow-left", label: "Freccia a sinistra" },
      { kind: "arrow-up", label: "Freccia su" },
      { kind: "arrow-down", label: "Freccia giù" },
      { kind: "chevron", label: "Gallone" },
    ],
  },
  {
    label: "Diagrammi di flusso",
    shapes: [
      { kind: "document", label: "Documento" },
      { kind: "star", label: "Stella" },
    ],
  },
  {
    label: "Callout",
    shapes: [{ kind: "callout", label: "Fumetto" }],
  },
]

const poly = (points: [number, number][]) =>
  `M ${points.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L ")} Z`

function regular(sides: number, w: number, h: number, rotate = -90) {
  return poly(
    Array.from({ length: sides }, (_, i) => {
      const a = ((rotate + (360 / sides) * i) * Math.PI) / 180
      return [w / 2 + (w / 2) * Math.cos(a), h / 2 + (h / 2) * Math.sin(a)]
    })
  )
}

/** Il path SVG di una forma nel riquadro (0, 0, w, h) */
function docShapePath(kind: DocShapeKind, w: number, h: number) {
  switch (kind) {
    case "pentagon":
      return regular(5, w, h)
    case "octagon":
      return regular(8, w, h, -67.5)
    case "heart":
      return `M ${w / 2} ${h * 0.95} C ${w * -0.1} ${h * 0.55}, ${w * 0.1} ${h * -0.1}, ${w / 2} ${h * 0.28} C ${w * 0.9} ${h * -0.1}, ${w * 1.1} ${h * 0.55}, ${w / 2} ${h * 0.95} Z`
    case "chevron":
      return poly([
        [0, 0],
        [w * 0.75, 0],
        [w, h / 2],
        [w * 0.75, h],
        [0, h],
        [w * 0.25, h / 2],
      ])
    case "callout":
      return `M 8 0 H ${w - 8} Q ${w} 0 ${w} 8 V ${h * 0.7 - 8} Q ${w} ${h * 0.7} ${w - 8} ${h * 0.7} H ${w * 0.42} L ${w * 0.22} ${h} L ${w * 0.26} ${h * 0.7} H 8 Q 0 ${h * 0.7} 0 ${h * 0.7 - 8} V 8 Q 0 0 8 0 Z`
    default:
      return shapePath(kind as NodeShape, w, h, kind === "rounded" ? 14 : 0)
  }
}

const esc = (value: string) => value.replace(/[<>&"]/g, "")

/**
 * Una forma come immagine SVG. I colori sono veri colori: dentro un data URI
 * le variabili CSS del documento non arrivano.
 */
export function shapeSvg(
  kind: DocShapeKind,
  fill: string,
  stroke: string
): { src: string; width: number } {
  const lineKinds = ["line", "arrow-line", "double-arrow"]
  if (lineKinds.includes(kind)) {
    const w = 240
    const h = 24
    const head = (x: number, dir: 1 | -1) =>
      `<path d="M ${x} ${h / 2} l ${-14 * dir} -8 v 16 z" fill="${esc(stroke)}"/>`
    const x1 = kind === "double-arrow" ? 14 : 2
    const x2 = kind === "line" ? w - 2 : w - 14
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><line x1="${x1}" y1="${h / 2}" x2="${x2}" y2="${h / 2}" stroke="${esc(stroke)}" stroke-width="3" stroke-linecap="round"/>${kind === "line" ? "" : head(w - 1, 1)}${kind === "double-arrow" ? head(1, -1) : ""}</svg>`
    return { src: svgData(svg), width: 40 }
  }
  const square = [
    "ellipse",
    "diamond",
    "star",
    "cross",
    "heart",
    "pentagon",
    "hexagon",
    "octagon",
    "cloud",
  ]
  const w = 200
  const h = square.includes(kind)
    ? 200
    : kind === "arrow-up" || kind === "arrow-down"
      ? 220
      : 130
  const inset = 3
  const iw = w - inset * 2
  const ih = h - inset * 2
  let d: string
  let transform = ""
  if (kind === "arrow-left" || kind === "arrow-up" || kind === "arrow-down") {
    const vertical = kind !== "arrow-left"
    const bw = vertical ? ih : iw
    const bh = vertical ? iw : ih
    d = shapePath("arrowBlock", bw, bh, 0)
    const angle = kind === "arrow-left" ? 180 : kind === "arrow-up" ? -90 : 90
    transform = `translate(${w / 2} ${h / 2}) rotate(${angle}) translate(${-bw / 2} ${-bh / 2})`
  } else {
    d = docShapePath(kind, iw, ih)
    transform = `translate(${inset} ${inset})`
  }
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><path d="${d}" transform="${transform}" fill="${esc(fill)}" stroke="${esc(stroke)}" stroke-width="3" stroke-linejoin="round"/></svg>`
  return { src: svgData(svg), width: square.includes(kind) ? 22 : 32 }
}

export function svgData(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

/** Un'icona della libreria come immagine SVG del colore scelto */
export function iconSvg(name: string, color: string) {
  const nodes = ICONS[name] ?? []
  const body = nodes
    .map(
      ([tag, attrs]) =>
        `<${tag} ${Object.entries(attrs)
          .map(([k, v]) => `${k}="${esc(String(v))}"`)
          .join(" ")}/>`
    )
    .join("")
  return svgData(
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="${esc(color)}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`
  )
}

/* -------------------------------- WordArt -------------------------------- */

export const WORDART_PRESETS: {
  id: string
  label: string
  style: Record<string, string | null>
  color?: string
  bold?: boolean
  italic?: boolean
}[] = [
  {
    id: "gradient",
    label: "Sfumato tramonto",
    bold: true,
    style: { textFill: "linear-gradient(90deg, #f97316, #e11d48, #9333ea)" },
  },
  {
    id: "ocean",
    label: "Sfumato oceano",
    bold: true,
    style: { textFill: "linear-gradient(90deg, #0ea5e9, #6366f1)" },
  },
  {
    id: "outline",
    label: "Contorno",
    bold: true,
    style: { textFill: "hollow", textStroke: "1.5px currentColor" },
  },
  {
    id: "neon",
    label: "Neon",
    bold: true,
    color: "#ffffff",
    style: {
      textShadow:
        "0 0 2px #fff, 0 0 0.2em var(--doc-accent, #6366f1), 0 0 0.5em var(--doc-accent, #6366f1)",
    },
  },
  {
    id: "shadow",
    label: "Ombra netta",
    bold: true,
    style: { textShadow: "0.06em 0.06em 0 var(--doc-accent, #6366f1)" },
  },
  {
    id: "retro",
    label: "Retrò",
    bold: true,
    color: "#f59e0b",
    style: {
      textShadow:
        "1px 1px 0 #b45309, 2px 2px 0 #b45309, 3px 3px 0 #92400e, 4px 4px 0 #78350f",
    },
  },
  {
    id: "elegant",
    label: "Elegante",
    italic: true,
    style: { textShadow: "0 1px 2px rgba(0,0,0,0.25)" },
  },
  {
    id: "accent",
    label: "Accento pieno",
    bold: true,
    style: { textStroke: "0.8px var(--doc-accent, #6366f1)" },
    color: "#ffffff",
  },
]

export function wordArtContent(preset: string, value: string): JSONContent {
  const p = WORDART_PRESETS.find((x) => x.id === preset) ?? WORDART_PRESETS[0]
  const marks: JSONContent["marks"] = [
    {
      type: "textStyle",
      attrs: { fontSize: "40pt", color: p.color ?? null, ...p.style },
    },
  ]
  if (p.bold) marks.push({ type: "bold" })
  if (p.italic) marks.push({ type: "italic" })
  return {
    type: "paragraph",
    attrs: { textAlign: "center" },
    content: [{ type: "text", text: value || "Il tuo testo qui", marks }],
  }
}

/* --------------------------- riga della firma ---------------------------- */

export function signatureContent(info: {
  name: string
  role: string
  email: string
  date: boolean
}): JSONContent[] {
  const lines = [info.name, info.role, info.email].filter((x) => x.trim())
  return [
    {
      type: "paragraph",
      attrs: { spaceBefore: `${Math.round(36 * PX)}px` },
      content: text(info.date ? "Luogo e data ____________________" : ""),
    },
    {
      type: "paragraph",
      attrs: {
        spaceBefore: `${Math.round(40 * PX)}px`,
        border: "top",
        indentRight: 360,
        spaceAfter: "0px",
      },
      content: text(lines[0] ?? "Firma"),
    },
    ...lines.slice(1).map((line): JSONContent => ({
      type: "paragraph",
      attrs: { spaceAfter: "0px" },
      content: [
        {
          type: "text",
          text: line,
          marks: [{ type: "textStyle", attrs: { color: "#71717a" } }],
        },
      ],
    })),
  ]
}

/* -------------------------------- SmartArt -------------------------------- */

export type SmartArtTemplate = {
  id: string
  group: string
  label: string
  hint: string
}

export const SMARTART_TEMPLATES: SmartArtTemplate[] = [
  {
    id: "list",
    group: "Elenco",
    label: "Elenco a blocchi",
    hint: "Idee affiancate",
  },
  {
    id: "process",
    group: "Processo",
    label: "Processo base",
    hint: "Passaggi in sequenza",
  },
  {
    id: "timeline",
    group: "Processo",
    label: "Cronologia",
    hint: "Tappe su una linea",
  },
  { id: "cycle", group: "Ciclo", label: "Ciclo", hint: "Fasi che si ripetono" },
  {
    id: "hierarchy",
    group: "Gerarchia",
    label: "Organigramma",
    hint: "Un capo, più rami",
  },
  {
    id: "matrix",
    group: "Matrice",
    label: "Matrice 2×2",
    hint: "Quattro quadranti",
  },
  {
    id: "pyramid",
    group: "Piramide",
    label: "Piramide",
    hint: "Livelli dal più ampio",
  },
  {
    id: "venn",
    group: "Relazione",
    label: "Relazione",
    hint: "Centro e satelliti",
  },
]

type NodeDraft = Partial<BoardNode> & { x: number; y: number }
type Draft = NodeDraft & { key: string }
type EdgeDraft = Partial<BoardEdge> & { from: string; to: string }

const COLORS: SwatchKey[] = [
  "blue",
  "purple",
  "teal",
  "green",
  "orange",
  "pink",
]

/** Nodi e collegamenti di un modello SmartArt, con testo segnaposto */
export function smartArtBoard(id: string): {
  drafts: { key: string; node: NodeDraft }[]
  edges: EdgeDraft[]
} {
  const { nodes, edges } = smartArtLayout(id)
  return {
    drafts: nodes.map(({ key, ...node }) => ({ key, node })),
    edges,
  }
}

function smartArtLayout(id: string): {
  nodes: Draft[]
  edges: EdgeDraft[]
} {
  const box = (
    key: string,
    x: number,
    y: number,
    label: string,
    i: number,
    extra: Partial<BoardNode> = {}
  ): Draft => ({
    key,
    x,
    y,
    w: 180,
    h: 84,
    text: label,
    shape: "rounded",
    color: COLORS[i % COLORS.length],
    fontSize: 16,
    bold: true,
    ...extra,
  })
  switch (id) {
    case "process":
      return {
        nodes: [0, 1, 2, 3].map((i) =>
          box(`n${i}`, i * 240, 0, `Passaggio ${i + 1}`, i)
        ),
        edges: [0, 1, 2].map((i) => ({ from: `n${i}`, to: `n${i + 1}` })),
      }
    case "timeline":
      return {
        nodes: [
          box("line", 0, 58, "", 0, {
            w: 960,
            h: 8,
            shape: "rect",
            color: "gray",
            outline: false,
            shadow: false,
          }),
          ...[0, 1, 2, 3].map((i) =>
            box(
              `n${i}`,
              i * 260,
              i % 2 ? 110 : -60,
              `Tappa ${i + 1}\n[data]`,
              i,
              {
                w: 180,
                h: 72,
              }
            )
          ),
        ],
        edges: [],
      }
    case "cycle": {
      const r = 220
      const nodes = [0, 1, 2, 3, 4].map((i) => {
        const a = (-90 + i * 72) * (Math.PI / 180)
        return box(
          `n${i}`,
          r * Math.cos(a) - 80,
          r * Math.sin(a) - 36,
          `Fase ${i + 1}`,
          i,
          {
            w: 160,
            h: 72,
            shape: "pill",
          }
        )
      })
      return {
        nodes,
        edges: nodes.map((n, i) => ({
          from: n.key,
          to: nodes[(i + 1) % nodes.length].key,
          routing: "curved",
        })),
      }
    }
    case "hierarchy":
      return {
        nodes: [
          box("root", 300, 0, "Direzione", 0),
          box("a", 0, 160, "Area 1", 1),
          box("b", 300, 160, "Area 2", 2),
          box("c", 600, 160, "Area 3", 3),
          box("a1", 0, 310, "Team", 1, { bold: false, h: 64 }),
          box("c1", 600, 310, "Team", 3, { bold: false, h: 64 }),
        ],
        edges: [
          { from: "root", to: "a", routing: "elbow" },
          { from: "root", to: "b", routing: "elbow" },
          { from: "root", to: "c", routing: "elbow" },
          { from: "a", to: "a1", routing: "elbow" },
          { from: "c", to: "c1", routing: "elbow" },
        ],
      }
    case "matrix":
      return {
        nodes: [0, 1, 2, 3].map((i) =>
          box(
            `n${i}`,
            (i % 2) * 280,
            Math.floor(i / 2) * 180,
            [
              "Alto impatto\nbasso sforzo",
              "Alto impatto\nalto sforzo",
              "Basso impatto\nbasso sforzo",
              "Basso impatto\nalto sforzo",
            ][i],
            i,
            { w: 260, h: 160, shape: "rect" }
          )
        ),
        edges: [],
      }
    case "pyramid":
      return {
        nodes: [0, 1, 2, 3]
          .map((i) =>
            box(`n${i}`, 90 * (3 - i) - 270, i * 90, `Livello ${4 - i}`, i, {
              w: 180 * (i + 1),
              h: 80,
              shape: "rect",
            })
          )
          .reverse(),
        edges: [],
      }
    case "venn": {
      const nodes = [
        box("c", 0, 0, "Idea centrale", 0, {
          w: 200,
          h: 200,
          shape: "ellipse",
        }),
        ...[0, 1, 2, 3].map((i) => {
          const a = (-45 + i * 90) * (Math.PI / 180)
          return box(
            `s${i}`,
            250 * Math.cos(a) + 20,
            250 * Math.sin(a) + 40,
            `Aspetto ${i + 1}`,
            i + 1,
            {
              w: 160,
              h: 120,
              shape: "ellipse",
              bold: false,
            }
          )
        }),
      ]
      return {
        nodes,
        edges: nodes
          .slice(1)
          .map((n) => ({ from: "c", to: n.key, head: "none" as const })),
      }
    }
    default:
      return {
        nodes: [0, 1, 2].map((i) =>
          box(`n${i}`, i * 220, 0, `[Testo]\nUna breve descrizione`, i, {
            w: 200,
            h: 140,
            bold: false,
          })
        ),
        edges: [],
      }
  }
}
