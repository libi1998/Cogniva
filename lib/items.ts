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
  rect: "Rettangolo",
  pill: "Pillola",
  ellipse: "Ellisse",
  diamond: "Decisione",
  parallelogram: "Input/Output",
  hexagon: "Preparazione",
  cylinder: "Database",
  triangle: "Triangolo",
  document: "Documento",
  cloud: "Cloud",
  star: "Stella",
  cross: "Croce",
  arrowBlock: "Freccia",
  note: "Post-it",
  text: "Testo",
}

/* -------------------------------- frame --------------------------------- */

export const FRAME_SPECS: Record<
  FrameKind,
  { label: string; w: number; h: number; chrome: number; radius: number }
> = {
  plain: { label: "Frame", w: 560, h: 400, chrome: 0, radius: 8 },
  browser: { label: "Browser", w: 1000, h: 660, chrome: 36, radius: 10 },
  desktop: { label: "Desktop", w: 1280, h: 800, chrome: 0, radius: 6 },
  tablet: { label: "Tablet", w: 768, h: 1024, chrome: 0, radius: 26 },
  phone: { label: "Telefono", w: 375, h: 812, chrome: 26, radius: 36 },
  watch: { label: "Orologio", w: 220, h: 268, chrome: 0, radius: 46 },
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
    label: "Bottone",
    group: "Base",
    w: 128,
    h: 40,
    text: "Bottone",
    props: { variant: "primary" },
  },
  iconButton: {
    label: "Bottone icona",
    group: "Base",
    w: 40,
    h: 40,
    props: { icon: "plus", variant: "outline" },
  },
  badge: { label: "Badge", group: "Base", w: 76, h: 24, text: "Nuovo" },
  link: {
    label: "Link",
    group: "Base",
    w: 110,
    h: 22,
    text: "Vai alla pagina",
  },
  divider: { label: "Divisore", group: "Base", w: 240, h: 12 },
  heading: {
    label: "Titolo",
    group: "Base",
    w: 300,
    h: 40,
    text: "Titolo di sezione",
  },
  paragraph: {
    label: "Paragrafo",
    group: "Base",
    w: 300,
    h: 76,
    props: { lines: 4 },
  },
  // form
  input: {
    label: "Campo",
    group: "Form",
    w: 260,
    h: 40,
    text: "Etichetta",
    props: { placeholder: "Testo…" },
  },
  textarea: {
    label: "Area di testo",
    group: "Form",
    w: 260,
    h: 96,
    text: "Etichetta",
    props: { placeholder: "Scrivi…" },
  },
  select: {
    label: "Menu a tendina",
    group: "Form",
    w: 260,
    h: 40,
    text: "Etichetta",
    props: { placeholder: "Seleziona…" },
  },
  searchField: {
    label: "Ricerca",
    group: "Form",
    w: 260,
    h: 40,
    props: { placeholder: "Cerca…" },
  },
  checkbox: {
    label: "Checkbox",
    group: "Form",
    w: 180,
    h: 24,
    text: "Opzione",
    props: { checked: true },
  },
  radio: {
    label: "Radio",
    group: "Form",
    w: 180,
    h: 24,
    text: "Opzione",
    props: { checked: true },
  },
  toggle: {
    label: "Interruttore",
    group: "Form",
    w: 180,
    h: 26,
    text: "Attivo",
    props: { checked: true },
  },
  slider: {
    label: "Cursore",
    group: "Form",
    w: 240,
    h: 28,
    props: { value: 60 },
  },
  stepper: {
    label: "Contatore",
    group: "Form",
    w: 120,
    h: 36,
    props: { value: 2 },
  },
  rating: {
    label: "Valutazione",
    group: "Form",
    w: 132,
    h: 26,
    props: { value: 4 },
  },
  progress: {
    label: "Avanzamento",
    group: "Form",
    w: 240,
    h: 14,
    props: { value: 45 },
  },
  // contenuto
  avatar: {
    label: "Avatar",
    group: "Contenuto",
    w: 48,
    h: 48,
    props: { shape: "circle" },
  },
  image: { label: "Immagine", group: "Contenuto", w: 240, h: 160 },
  video: { label: "Video", group: "Contenuto", w: 280, h: 160 },
  map: { label: "Mappa", group: "Contenuto", w: 260, h: 180 },
  chart: {
    label: "Grafico",
    group: "Contenuto",
    w: 280,
    h: 180,
    props: { type: "bar" },
  },
  card: {
    label: "Card",
    group: "Contenuto",
    w: 260,
    h: 200,
    text: "Titolo della card",
  },
  list: {
    label: "Elenco",
    group: "Contenuto",
    w: 280,
    h: 180,
    props: { rows: 4, avatar: true },
  },
  calendar: { label: "Calendario", group: "Contenuto", w: 260, h: 220 },
  // struttura
  navbar: {
    label: "Barra di navigazione",
    group: "Struttura",
    w: 640,
    h: 56,
    text: "Logo|Prodotto|Prezzi|Blog",
  },
  tabs: {
    label: "Tab",
    group: "Struttura",
    w: 360,
    h: 40,
    text: "Panoramica|Attività|Impostazioni",
  },
  breadcrumb: {
    label: "Breadcrumb",
    group: "Struttura",
    w: 320,
    h: 24,
    text: "Home|Progetti|Dettaglio",
  },
  sidebarNav: {
    label: "Sidebar",
    group: "Struttura",
    w: 200,
    h: 320,
    text: "Dashboard|Progetti|Team|Impostazioni",
  },
  modal: {
    label: "Finestra",
    group: "Struttura",
    w: 380,
    h: 220,
    text: "Conferma l'azione",
  },
  alert: {
    label: "Avviso",
    group: "Struttura",
    w: 320,
    h: 56,
    text: "Operazione completata",
  },
  tooltip: {
    label: "Tooltip",
    group: "Struttura",
    w: 160,
    h: 38,
    text: "Suggerimento",
  },
  pagination: { label: "Paginazione", group: "Struttura", w: 240, h: 34 },
  footer: {
    label: "Footer",
    group: "Struttura",
    w: 640,
    h: 90,
    text: "Prodotto|Azienda|Risorse|Legale",
  },
}

export const WIRE_GROUPS = ["Base", "Form", "Contenuto", "Struttura"]

/* -------------------------------- tabella ------------------------------- */

export function newTable(cols = 3, rows = 3): TableData {
  const cells: string[] = []
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push(r === 0 ? `Colonna ${c + 1}` : "")
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
        text: "Sezione",
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
