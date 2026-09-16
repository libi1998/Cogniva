import { defaultChart } from "./chart"
import type {
  BoardNode,
  BoardTheme,
  FrameKind,
  ItemKind,
  NodeShape,
  TableData,
  WireKind,
} from "./types"

import { tr } from "@/lib/i18n/client"
/* ------------------------------- forme ---------------------------------- */

export const SHAPE_SIZE: Record<NodeShape, { w: number; h: number }> = {
  rect: { w: 180, h: 84 },
  rounded: { w: 180, h: 84 },
  pill: { w: 168, h: 56 },
  ellipse: { w: 150, h: 110 },
  diamond: { w: 160, h: 116 },
  parallelogram: { w: 190, h: 84 },
  hexagon: { w: 190, h: 96 },
  cylinder: { w: 150, h: 116 },
  triangle: { w: 150, h: 124 },
  document: { w: 180, h: 110 },
  cloud: { w: 180, h: 120 },
  star: { w: 132, h: 132 },
  cross: { w: 132, h: 132 },
  arrowBlock: { w: 190, h: 92 },
  note: { w: 160, h: 160 },
  text: { w: 200, h: 44 },
}

export const SHAPE_LABEL: Partial<Record<NodeShape, string>> = {
  rounded: "Card",
  get rect() {
    return tr("Rettangolo")
  },
  get pill() {
    return tr("Pillola")
  },
  get ellipse() {
    return tr("Ellisse")
  },
  get diamond() {
    return tr("Decisione")
  },
  parallelogram: "Input/Output",
  get hexagon() {
    return tr("Preparazione")
  },
  cylinder: "Database",
  get triangle() {
    return tr("Triangolo")
  },
  get document() {
    return tr("Documento")
  },
  cloud: "Cloud",
  get star() {
    return tr("Stella")
  },
  get cross() {
    return tr("Croce")
  },
  get arrowBlock() {
    return tr("Freccia")
  },
  note: "Post-it",
  get text() {
    return tr("Testo")
  },
}

/* -------------------------------- frame --------------------------------- */

export const FRAME_SPECS: Record<
  FrameKind,
  { label: string; w: number; h: number; chrome: number; radius: number }
> = {
  plain: {
    get label() {
      return tr("Frame")
    },
    w: 560,
    h: 400,
    chrome: 0,
    radius: 8,
  },
  browser: {
    get label() {
      return tr("Browser")
    },
    w: 1000,
    h: 660,
    chrome: 36,
    radius: 10,
  },
  desktop: {
    get label() {
      return tr("Desktop")
    },
    w: 1280,
    h: 800,
    chrome: 0,
    radius: 6,
  },
  tablet: {
    get label() {
      return tr("Tablet")
    },
    w: 768,
    h: 1024,
    chrome: 0,
    radius: 26,
  },
  phone: {
    get label() {
      return tr("Telefono")
    },
    w: 375,
    h: 812,
    chrome: 26,
    radius: 36,
  },
  watch: {
    get label() {
      return tr("Orologio")
    },
    w: 220,
    h: 268,
    chrome: 0,
    radius: 46,
  },
}

/* ----------------------------- wireframe -------------------------------- */

export type WireSpec = {
  label: string
  group: string
  w: number
  h: number
  text?: string
  props?: Record<string, string | number | boolean>
}

export const WIRE_SPECS: Record<WireKind, WireSpec> = {
  // base
  button: {
    get label() {
      return tr("Bottone")
    },
    get group() {
      return tr("Base")
    },
    w: 128,
    h: 40,
    get text() {
      return tr("Bottone")
    },
    props: { variant: "primary" },
  },
  iconButton: {
    get label() {
      return tr("Bottone icona")
    },
    get group() {
      return tr("Base")
    },
    w: 40,
    h: 40,
    props: { icon: "plus", variant: "outline" },
  },
  badge: {
    get label() {
      return tr("Badge")
    },
    get group() {
      return tr("Base")
    },
    w: 76,
    h: 24,
    get text() {
      return tr("Nuovo")
    },
  },
  link: {
    get label() {
      return tr("Link")
    },
    get group() {
      return tr("Base")
    },
    w: 110,
    h: 22,
    get text() {
      return tr("Vai alla pagina")
    },
  },
  divider: {
    get label() {
      return tr("Divisore")
    },
    get group() {
      return tr("Base")
    },
    w: 240,
    h: 12,
  },
  heading: {
    get label() {
      return tr("Titolo")
    },
    get group() {
      return tr("Base")
    },
    w: 300,
    h: 40,
    get text() {
      return tr("Titolo di sezione")
    },
  },
  paragraph: {
    get label() {
      return tr("Paragrafo")
    },
    get group() {
      return tr("Base")
    },
    w: 300,
    h: 76,
    props: { lines: 4 },
  },
  // form
  input: {
    get label() {
      return tr("Campo")
    },
    get group() {
      return tr("Form")
    },
    w: 260,
    h: 40,
    get text() {
      return tr("Etichetta")
    },
    props: {
      get placeholder() {
        return tr("Testo…")
      },
    },
  },
  textarea: {
    get label() {
      return tr("Area di testo")
    },
    get group() {
      return tr("Form")
    },
    w: 260,
    h: 96,
    get text() {
      return tr("Etichetta")
    },
    props: {
      get placeholder() {
        return tr("Scrivi…")
      },
    },
  },
  select: {
    get label() {
      return tr("Menu a tendina")
    },
    get group() {
      return tr("Form")
    },
    w: 260,
    h: 40,
    get text() {
      return tr("Etichetta")
    },
    props: {
      get placeholder() {
        return tr("Seleziona…")
      },
    },
  },
  searchField: {
    get label() {
      return tr("Ricerca")
    },
    get group() {
      return tr("Form")
    },
    w: 260,
    h: 40,
    props: {
      get placeholder() {
        return tr("Cerca…")
      },
    },
  },
  checkbox: {
    get label() {
      return tr("Checkbox")
    },
    get group() {
      return tr("Form")
    },
    w: 180,
    h: 24,
    get text() {
      return tr("Opzione")
    },
    props: { checked: true },
  },
  radio: {
    get label() {
      return tr("Radio")
    },
    get group() {
      return tr("Form")
    },
    w: 180,
    h: 24,
    get text() {
      return tr("Opzione")
    },
    props: { checked: true },
  },
  toggle: {
    get label() {
      return tr("Interruttore")
    },
    get group() {
      return tr("Form")
    },
    w: 180,
    h: 26,
    get text() {
      return tr("Attivo")
    },
    props: { checked: true },
  },
  slider: {
    get label() {
      return tr("Cursore")
    },
    get group() {
      return tr("Form")
    },
    w: 240,
    h: 28,
    props: { value: 60 },
  },
  stepper: {
    get label() {
      return tr("Contatore")
    },
    get group() {
      return tr("Form")
    },
    w: 120,
    h: 36,
    props: { value: 2 },
  },
  rating: {
    get label() {
      return tr("Valutazione")
    },
    get group() {
      return tr("Form")
    },
    w: 132,
    h: 26,
    props: { value: 4 },
  },
  progress: {
    get label() {
      return tr("Avanzamento")
    },
    get group() {
      return tr("Form")
    },
    w: 240,
    h: 14,
    props: { value: 45 },
  },
  // contenuto
  avatar: {
    get label() {
      return tr("Avatar")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 48,
    h: 48,
    props: { shape: "circle" },
  },
  image: {
    get label() {
      return tr("Immagine")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 240,
    h: 160,
  },
  video: {
    get label() {
      return tr("Video")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 280,
    h: 160,
  },
  map: {
    get label() {
      return tr("Mappa")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 260,
    h: 180,
  },
  chart: {
    get label() {
      return tr("Grafico")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 280,
    h: 180,
    props: { type: "bar" },
  },
  card: {
    get label() {
      return tr("Card")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 260,
    h: 200,
    get text() {
      return tr("Titolo della card")
    },
  },
  list: {
    get label() {
      return tr("Elenco")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 280,
    h: 180,
    props: { rows: 4, avatar: true },
  },
  calendar: {
    get label() {
      return tr("Calendario")
    },
    get group() {
      return tr("Contenuto")
    },
    w: 260,
    h: 220,
  },
  // struttura
  navbar: {
    get label() {
      return tr("Barra di navigazione")
    },
    get group() {
      return tr("Struttura")
    },
    w: 640,
    h: 56,
    get text() {
      return tr("Logo|Prodotto|Prezzi|Blog")
    },
  },
  tabs: {
    get label() {
      return tr("Tab")
    },
    get group() {
      return tr("Struttura")
    },
    w: 360,
    h: 40,
    get text() {
      return tr("Panoramica|Attività|Impostazioni")
    },
  },
  breadcrumb: {
    get label() {
      return tr("Breadcrumb")
    },
    get group() {
      return tr("Struttura")
    },
    w: 320,
    h: 24,
    get text() {
      return tr("Home|Progetti|Dettaglio")
    },
  },
  sidebarNav: {
    get label() {
      return tr("Sidebar")
    },
    get group() {
      return tr("Struttura")
    },
    w: 200,
    h: 320,
    get text() {
      return tr("Dashboard|Progetti|Team|Impostazioni")
    },
  },
  modal: {
    get label() {
      return tr("Finestra")
    },
    get group() {
      return tr("Struttura")
    },
    w: 380,
    h: 220,
    get text() {
      return tr("Conferma l'azione")
    },
  },
  alert: {
    get label() {
      return tr("Avviso")
    },
    get group() {
      return tr("Struttura")
    },
    w: 320,
    h: 56,
    get text() {
      return tr("Operazione completata")
    },
  },
  tooltip: {
    get label() {
      return tr("Tooltip")
    },
    get group() {
      return tr("Struttura")
    },
    w: 160,
    h: 38,
    get text() {
      return tr("Suggerimento")
    },
  },
  pagination: {
    get label() {
      return tr("Paginazione")
    },
    get group() {
      return tr("Struttura")
    },
    w: 240,
    h: 34,
  },
  footer: {
    get label() {
      return tr("Footer")
    },
    get group() {
      return tr("Struttura")
    },
    w: 640,
    h: 90,
    get text() {
      return tr("Prodotto|Azienda|Risorse|Legale")
    },
  },
}

/** I gruppi dei componenti wireframe, tradotti quando servono */
export const wireGroups = () => [
  tr("Base"),
  tr("Form"),
  tr("Contenuto"),
  tr("Struttura"),
]

/* -------------------------------- tabella ------------------------------- */

export function newTable(cols = 3, rows = 3): TableData {
  const cells: string[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(r === 0 ? tr("Colonna {number}", { number: c + 1 }) : "")
    }
  }
  return {
    cols,
    rows,
    cells,
    colW: Array.from({ length: cols }, () => 140),
    rowH: Array.from({ length: rows }, () => 40),
    header: true,
    striped: true,
  }
}

export function tableSize(t: TableData) {
  return {
    w: t.colW.reduce((a, b) => a + b, 0),
    h: t.rowH.reduce((a, b) => a + b, 0),
  }
}

export function tableCell(t: TableData, r: number, c: number) {
  return t.cells[r * t.cols + c] ?? ""
}

export function setTableCell(
  t: TableData,
  r: number,
  c: number,
  v: string
): TableData {
  const cells = [...t.cells]
  cells[r * t.cols + c] = v
  return { ...t, cells }
}

export function tableAddRow(t: TableData, at = t.rows): TableData {
  const cells = [...t.cells]
  cells.splice(at * t.cols, 0, ...Array.from({ length: t.cols }, () => ""))
  const rowH = [...t.rowH]
  rowH.splice(at, 0, 40)
  return { ...t, rows: t.rows + 1, cells, rowH }
}

export function tableAddCol(t: TableData, at = t.cols): TableData {
  const cells: string[] = []
  for (let r = 0; r < t.rows; r++) {
    const row = t.cells.slice(r * t.cols, (r + 1) * t.cols)
    row.splice(at, 0, "")
    cells.push(...row)
  }
  const colW = [...t.colW]
  colW.splice(at, 0, 140)
  return { ...t, cols: t.cols + 1, cells, colW }
}

export function tableRemoveRow(t: TableData, at: number): TableData {
  if (t.rows <= 1) return t
  const cells = [...t.cells]
  cells.splice(at * t.cols, t.cols)
  const rowH = [...t.rowH]
  rowH.splice(at, 1)
  return { ...t, rows: t.rows - 1, cells, rowH }
}

export function tableRemoveCol(t: TableData, at: number): TableData {
  if (t.cols <= 1) return t
  const cells: string[] = []
  for (let r = 0; r < t.rows; r++) {
    const row = t.cells.slice(r * t.cols, (r + 1) * t.cols)
    row.splice(at, 1)
    cells.push(...row)
  }
  const colW = [...t.colW]
  colW.splice(at, 1)
  return { ...t, cols: t.cols - 1, cells, colW }
}

/* ------------------------------- fabbrica -------------------------------- */

export function baseNode(theme: BoardTheme): Omit<BoardNode, "id" | "x" | "y"> {
  return {
    kind: "shape",
    w: 180,
    h: 84,
    text: "",
    shape: theme.defaultShape,
    color: theme.defaultColor,
    radius: null,
    fontSize: 15,
    bold: false,
    italic: false,
    align: "center",
    outline: true,
    shadow: true,
  }
}

export type ItemSpec = {
  kind: ItemKind
  shape?: NodeShape
  frame?: FrameKind
  wire?: WireKind
  icon?: string
}

/** Costruisce un nuovo elemento a partire dal tipo richiesto */
export function makeItem(
  spec: ItemSpec,
  theme: BoardTheme
): Omit<BoardNode, "id" | "x" | "y"> {
  const base = baseNode(theme)
  switch (spec.kind) {
    case "frame": {
      const f = FRAME_SPECS[spec.frame ?? "plain"]
      return {
        ...base,
        kind: "frame",
        frame: spec.frame ?? "plain",
        w: f.w,
        h: f.h,
        text: f.label,
        color: "white",
        align: "left",
        fontSize: 13,
        shadow: false,
        radius: f.radius,
      }
    }
    case "section":
      return {
        ...base,
        kind: "section",
        w: 520,
        h: 380,
        text: tr("Sezione"),
        color: theme.defaultColor === "white" ? "blue" : theme.defaultColor,
        align: "left",
        fontSize: 14,
        bold: true,
        shadow: false,
        outline: true,
      }
    case "table": {
      const t = newTable(3, 3)
      const size = tableSize(t)
      return {
        ...base,
        kind: "table",
        table: t,
        w: size.w,
        h: size.h,
        color: "white",
        align: "left",
        fontSize: 13,
        shadow: true,
      }
    }
    case "chart":
      return {
        ...base,
        kind: "chart",
        chart: defaultChart("column"),
        w: 460,
        h: 300,
        color: "white",
        outline: true,
        shadow: true,
      }
    case "icon":
      return {
        ...base,
        kind: "icon",
        icon: spec.icon ?? "star",
        w: 64,
        h: 64,
        color: theme.defaultColor,
        outline: false,
        shadow: false,
        strokeWidth: 1.8,
      }
    case "wire": {
      const k = spec.wire ?? "button"
      const s = WIRE_SPECS[k]
      return {
        ...base,
        kind: "wire",
        wire: k,
        wireProps: { ...(s.props ?? {}) },
        w: s.w,
        h: s.h,
        text: s.text ?? "",
        color: "white",
        align: "left",
        fontSize: 13,
        outline: false,
        shadow: false,
      }
    }
    case "draw":
      return {
        ...base,
        kind: "draw",
        points: [],
        strokeColor: theme.arrows.color,
        strokeWidth: 3,
        outline: false,
        shadow: false,
        w: 100,
        h: 100,
      }
    default: {
      const shape = spec.shape ?? theme.defaultShape
      const size = SHAPE_SIZE[shape]
      return {
        ...base,
        kind: "shape",
        shape,
        ...size,
        color:
          shape === "note" && theme.defaultColor === "white"
            ? "yellow"
            : theme.defaultColor,
        outline: shape !== "note" && shape !== "text",
        align: shape === "text" ? "left" : "center",
        shadow: shape !== "text",
      }
    }
  }
}

/** true per gli elementi che fanno da contenitore (trascinandoli portano con sé il contenuto) */
export function isContainer(n: BoardNode) {
  return n.kind === "frame" || n.kind === "section"
}

export function contains(outer: BoardNode, inner: BoardNode) {
  const cx = inner.x + inner.w / 2
  const cy = inner.y + inner.h / 2
  return (
    cx >= outer.x &&
    cx <= outer.x + outer.w &&
    cy >= outer.y &&
    cy <= outer.y + outer.h
  )
}

/** I contenitori vanno disegnati sotto a tutto il resto */
function layerOf(n: BoardNode) {
  if (n.kind === "section") return 0
  if (n.kind === "frame") return 1
  if (n.kind === "draw") return 3
  return 2
}

export function sortedForRender(nodes: BoardNode[]) {
  return nodes
    .map((n, i) => ({ n, i }))
    .sort((a, b) => layerOf(a.n) - layerOf(b.n) || a.i - b.i)
    .map((x) => x.n)
}
