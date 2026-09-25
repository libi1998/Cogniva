import type { FontKey } from "./fonts"
import type { SwatchKey } from "./palette"
import { parseChartAttr, type ChartSpec } from "./chart"
import type { DocStyleDef } from "./doc-styles"

import { tr } from "@/lib/i18n/client"
export type FileKind = "board" | "doc"

type FileMeta = {
  id: string
  kind: FileKind
  title: string
  /** nome di un'icona Lucide (vedi icon-library) */
  icon: string
  createdAt: number
  updatedAt: number
  starred?: boolean
  /** nel cestino da questo momento; dopo 30 giorni il file sparisce */
  deletedAt?: number
  /** la cartella della home in cui sta; senza, fuori da ogni cartella */
  folder?: string
}

/* ------------------------------- Board ---------------------------------- */

/** Tipo di elemento sul canvas */
export type ItemKind =
  "shape" | "frame" | "section" | "table" | "icon" | "wire" | "draw" | "chart"

export type NodeShape =
  // base
  | "rect"
  | "rounded"
  | "pill"
  | "ellipse"
  | "diamond"
  | "note"
  | "text"
  // diagrammi
  | "parallelogram"
  | "hexagon"
  | "cylinder"
  | "triangle"
  | "document"
  | "cloud"
  | "star"
  | "cross"
  | "arrowBlock"

export const SHAPE_KEYS: NodeShape[] = [
  "rounded",
  "rect",
  "pill",
  "ellipse",
  "diamond",
  "parallelogram",
  "hexagon",
  "cylinder",
  "triangle",
  "document",
  "cloud",
  "star",
  "cross",
  "arrowBlock",
  "note",
  "text",
]

/** Forme disegnate con un path SVG invece che con il box CSS */
export const PATH_SHAPES: NodeShape[] = [
  "diamond",
  "parallelogram",
  "hexagon",
  "cylinder",
  "triangle",
  "document",
  "cloud",
  "star",
  "cross",
  "arrowBlock",
]

export type FrameKind =
  "plain" | "browser" | "phone" | "tablet" | "desktop" | "watch"

export type WireKind =
  | "button"
  | "iconButton"
  | "input"
  | "textarea"
  | "select"
  | "searchField"
  | "checkbox"
  | "radio"
  | "toggle"
  | "slider"
  | "progress"
  | "rating"
  | "stepper"
  | "avatar"
  | "image"
  | "video"
  | "map"
  | "chart"
  | "heading"
  | "paragraph"
  | "link"
  | "badge"
  | "divider"
  | "navbar"
  | "tabs"
  | "breadcrumb"
  | "sidebarNav"
  | "card"
  | "list"
  | "modal"
  | "alert"
  | "tooltip"
  | "calendar"
  | "pagination"
  | "footer"

export type TextAlign = "left" | "center" | "right"

export type TableData = {
  cols: number
  rows: number
  /** rows * cols celle, in ordine di lettura */
  cells: string[]
  colW: number[]
  rowH: number[]
  header: boolean
  striped: boolean
}

export type BoardNode = {
  id: string
  kind: ItemKind
  x: number
  y: number
  w: number
  h: number
  text: string
  shape: NodeShape
  color: SwatchKey
  /** null = eredita il raggio della board */
  radius: number | null
  fontSize: number
  bold: boolean
  italic: boolean
  align: TextAlign
  outline: boolean
  shadow: boolean
  locked?: boolean

  /* payload per tipo */
  frame?: FrameKind
  icon?: string
  strokeWidth?: number
  strokeColor?: string
  wire?: WireKind
  wireProps?: Record<string, string | number | boolean>
  table?: TableData
  /** grafico: dati e aspetto, come nei documenti */
  chart?: ChartSpec
  /** freehand: punti assoluti nel mondo, appiattiti [x0,y0,x1,y1,…] */
  points?: number[]
  opacity?: number
}

export type Side = "top" | "right" | "bottom" | "left" | "auto"

export type EdgeRouting = "straight" | "elbow" | "curved"

export type ArrowHead =
  | "none"
  | "arrow"
  | "open"
  | "triangle"
  | "hollow"
  | "circle"
  | "hollowCircle"
  | "diamond"
  | "hollowDiamond"
  | "bar"

export type LineStyle = "solid" | "dashed" | "dotted" | "sketch"

export type BoardEdge = {
  id: string
  from: string
  to: string
  fromSide: Side
  toSide: Side
  label: string
  routing: EdgeRouting | null
  head: ArrowHead | null
  tail: ArrowHead | null
  style: LineStyle | null
  color: string | null
  width: number | null
}

export type BackgroundPattern = "plain" | "dots" | "grid" | "cross" | "lines"

type ArrowDefaults = {
  routing: EdgeRouting
  head: ArrowHead
  tail: ArrowHead
  style: LineStyle
  width: number
  color: string
  cornerRadius: number
}

/** Modalità della board: cambia strumenti e valori predefiniti */
export type BoardMode = "diagram" | "wireframe" | "card"

/** Area di lavoro della board: "infinite" = canvas senza limiti */
type BoardPage = {
  format: PageFormat | "infinite"
  orientation: "portrait" | "landscape"
}

/** "auto" segue il tema chiaro/scuro dell'app */
type BoardBackground = string

export type BoardTheme = {
  font: FontKey
  cornerRadius: number
  background: BoardBackground
  pattern: BackgroundPattern
  patternOpacity: number
  arrows: ArrowDefaults
  defaultColor: SwatchKey
  defaultShape: NodeShape
  mode: BoardMode
  page: BoardPage
}

export type BoardData = {
  nodes: BoardNode[]
  edges: BoardEdge[]
  theme: BoardTheme
  viewport?: { x: number; y: number; zoom: number }
}

/* -------------------------------- Doc ----------------------------------- */

export type PageFormat =
  | "screen"
  | "a4"
  | "a5"
  | "a3"
  | "letter"
  | "legal"
  | "tabloid"
  | "dl"
  | "c5"
  | "c6"

export const PAGE_FORMATS: Record<
  PageFormat,
  { label: string; mm: [number, number] | null }
> = {
  screen: {
    get label() {
      return tr("Schermo")
    },
    mm: null,
  },
  a4: { label: "A4", mm: [210, 297] },
  a5: { label: "A5", mm: [148, 210] },
  a3: { label: "A3", mm: [297, 420] },
  letter: { label: "Letter", mm: [215.9, 279.4] },
  legal: { label: "Legal", mm: [215.9, 355.6] },
  tabloid: { label: "Tabloid", mm: [279.4, 431.8] },
  // buste (scheda Corrispondenza), in orizzontale
  dl: {
    get label() {
      return tr("Busta DL")
    },
    mm: [110, 220],
  },
  c5: {
    get label() {
      return tr("Busta C5")
    },
    mm: [162, 229],
  },
  c6: {
    get label() {
      return tr("Busta C6")
    },
    mm: [114, 162],
  },
}

export type DocMargins = {
  top: number
  right: number
  bottom: number
  left: number
}

export type MarginSide = "top" | "right" | "bottom" | "left"

/** Un nodo di intestazione o piè di pagina, nel JSON di ProseMirror */
export type BandNode = {
  type: string
  attrs?: Record<string, unknown>
  content?: BandNode[]
  marks?: { type: string; attrs?: Record<string, unknown> }[]
  text?: string
}

/** Intestazione o piè di pagina a testo libero: un piccolo documento */
export type BandContent = { type: "doc"; content?: BandNode[] }

export type DocTheme = {
  font: FontKey
  cornerRadius: number
  background: string
  paper: string
  /** chiave della tavolozza, oppure un colore esadecimale personalizzato */
  accent: SwatchKey | (string & {})
  width: "narrow" | "regular" | "wide" | "full"
  fontSize: number
  /** formato del file per stampa ed esportazione */
  format: PageFormat
  orientation: "portrait" | "landscape"
  /** i quattro margini del foglio, in pixel */
  margins: DocMargins
  /** colonne del testo, come in Word */
  columns: 1 | 2 | 3
  /**
   * riga ripetuta in cima e in fondo a ogni pagina: «sinistra | centro |
   * destra», con i campi {pagina}, {pagine}, {titolo}, {autore}, {data}.
   * Con il testo libero qui c'è il suo riassunto in testo semplice, per le
   * versioni precedenti dell'app e per sapere al volo se c'è
   */
  header: string
  footer: string
  /**
   * intestazione e piè di pagina a testo libero, come in Word: righe con la
   * loro formattazione, tabulazioni al centro e a destra, immagini e campi.
   * Quando mancano valgono `header` e `footer`
   */
  headerContent?: BandContent | null
  footerContent?: BandContent | null
  /** dove compare il numero di pagina */
  pageNumbers: PageNumberPosition
  /** stile dei numeri di pagina e numero della prima pagina */
  pageNumberFormat: PageNumberFormat
  pageNumberStart: number
  /** «Diversa per la prima pagina»: niente intestazione sul frontespizio */
  differentFirstPage: boolean
  /** cornice intorno a ogni pagina, come «Bordi pagina» di Word */
  pageBorder: PageBorder
  /** colore del bordo pagina; vuoto = grigio attenuato */
  pageBorderColor: string
  /** numeri di riga nel margine sinistro, come in Word */
  lineNumbers: "none" | "continuous" | "page"
  /** stile di citazioni e bibliografia */
  citationStyle: CitationStyle
  /** controllo ortografico del browser mentre si scrive */
  spellcheck: boolean
  /** colonna dei commenti a destra del foglio */
  comments: boolean
  /* ---- visualizzazione (come la scheda «Visualizza» di Word) ---- */
  /** ingrandimento del foglio, 0.5–2 */
  zoom: number
  ruler: boolean
  grid: boolean
  /** segni di formattazione (¶) */
  marks: boolean

  /* ---- progettazione (come la scheda «Progettazione» di Word) ---- */
  /** carattere di titoli e titolo; null = lo stesso del corpo */
  headingFont: FontKey | null
  /** «set di stili»: l'aspetto di titoli e citazioni (vedi lib/doc-design.ts) */
  styleSet: string
  /** stili modificati e stili nuovi; quelli non presenti restano predefiniti */
  styles: Record<string, DocStyleDef>
  /** filigrana ripetuta su ogni pagina */
  watermark: DocWatermark | null

  /* ---- layout, lingua e revisione ---- */
  /** sillabazione automatica a fine riga */
  hyphenation: boolean
  /** lingua del documento: controllo ortografico, sillabazione, lettura */
  language: string
  /** visualizzazione, come i pulsanti in fondo alla scheda «Visualizza» */
  view: DocView
  /** mostra i disegni fatti a penna */
  inkVisible: boolean
  /** registra le modifiche come revisioni */
  trackChanges: boolean
  /** come si vedono le revisioni */
  markup: DocMarkup
  /** «Limita modifica» */
  protection: DocProtection
}

export type PageNumberPosition =
  | "none"
  | "top-left"
  | "top-center"
  | "top-right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"

export type PageNumberFormat =
  "arabic" | "dash" | "roman" | "ROMAN" | "alpha" | "ALPHA"

export type PageBorder =
  "none" | "thin" | "thick" | "double" | "dashed" | "dotted"

export type DocView = "print" | "web" | "outline" | "draft"
export type DocMarkup = "all" | "simple" | "none" | "original"
/** «Limita modifica»: sola lettura, solo commenti o solo revisioni */
export type DocProtection = "none" | "readonly" | "comments" | "tracked"

export type DocWatermark = {
  /** testo della filigrana; vuoto se è un'immagine */
  text: string
  font: FontKey | null
  color: string
  /** 0–1 */
  opacity: number
  layout: "diagonal" | "horizontal"
  /** immagine (data URL) al posto del testo */
  image: string | null
  /** larghezza dell'immagine rispetto alla pagina, 0.2–1 */
  scale: number
}

/** Un tratto di penna: punti nel sistema del foglio, in pixel */
export type InkStroke = {
  id: string
  /** [x0, y0, x1, y1, …] */
  points: number[]
  color: string
  width: number
  /** evidenziatore: tratto semitrasparente sotto al testo */
  highlighter: boolean
  /** matita: tratto sottile e un po' granuloso */
  pencil?: boolean
}

/** Dati della stampa unione: l'elenco dei destinatari */
export type MergeData = {
  type: "letters" | "labels" | "envelopes" | "normal"
  fields: string[]
  rows: Record<string, string>[]
  /** righe escluse dall'elenco (indici) */
  excluded: number[]
  /** anteprima dei risultati: il record mostrato, -1 = campi «come sono» */
  preview: number
  /** «Evidenzia campi unione» */
  highlight?: boolean
  /** «Salta record se…»: i record che soddisfano una regola non si uniscono */
  skip?: MergeRule[]
}

export type MergeRule = {
  field: string
  op: "eq" | "ne" | "lt" | "gt" | "contains" | "empty" | "filled"
  value: string
}

/** Risposta dentro a un commento */
type DocCommentReply = {
  id: string
  author: string
  text: string
  createdAt: number
}

/**
 * Commento come in Word. Il testo commentato porta un marchio con l'id; qui
 * c'è la conversazione. Sta fuori dal contenuto: annullare una modifica del
 * testo non deve cancellare le risposte.
 */
export type DocComment = {
  id: string
  author: string
  text: string
  createdAt: number
  resolved: boolean
  replies: DocCommentReply[]
}

export type SourceKind = "book" | "article" | "web" | "report"

/** Fonte per citazioni e bibliografia, come «Gestisci fonti» di Word */
export type DocSource = {
  id: string
  kind: SourceKind
  /** «Cognome, Nome; Cognome, Nome» */
  authors: string
  title: string
  year: string
  /** editore (libri, rapporti) o rivista (articoli) o sito (web) */
  publisher: string
  city: string
  volume: string
  pages: string
  url: string
  /** data di consultazione per le fonti web */
  accessed: string
}

export type CitationStyle = "apa" | "mla" | "chicago" | "iso690"

export type DocData = {
  content: unknown
  theme: DocTheme
  comments?: DocComment[]
  sources?: DocSource[]
  /** disegni a penna sul foglio (scheda «Disegno») */
  ink?: InkStroke[]
  /** stampa unione (scheda «Corrispondenza») */
  merge?: MergeData
}

export type WFile =
  | ({ kind: "board" } & FileMeta & { data: BoardData })
  | ({ kind: "doc" } & FileMeta & { data: DocData })

/**
 * Il nome da mostrare: un documento nuovo ha il titolo vuoto finché non si
 * scrive la prima riga, e negli elenchi (palette, «Cambia finestra»,
 * «Confronta») compariva come una voce bianca.
 */
export const displayTitle = (f: Pick<FileMeta, "title">) =>
  f.title.trim() || tr("Senza titolo")

/* ------------------------------ Defaults -------------------------------- */

export const AUTO_BG = "auto"

const defaultArrowDefaults: ArrowDefaults = {
  routing: "elbow",
  head: "arrow",
  tail: "none",
  style: "solid",
  width: 2,
  color: "#52525b",
  cornerRadius: 10,
}

export const defaultBoardTheme: BoardTheme = {
  font: "inter",
  cornerRadius: 10,
  background: AUTO_BG,
  pattern: "dots",
  patternOpacity: 0.5,
  arrows: defaultArrowDefaults,
  defaultColor: "white",
  defaultShape: "rounded",
  mode: "diagram",
  page: { format: "infinite", orientation: "landscape" },
}

export const defaultDocTheme: DocTheme = {
  font: "manrope",
  cornerRadius: 12,
  background: AUTO_BG,
  paper: AUTO_BG,
  accent: "blue",
  width: "regular",
  fontSize: 17,
  format: "screen",
  orientation: "portrait",
  margins: { top: 56, right: 56, bottom: 96, left: 56 },
  columns: 1,
  header: "",
  footer: "",
  headerContent: null,
  footerContent: null,
  pageNumbers: "none",
  pageNumberFormat: "arabic",
  pageNumberStart: 1,
  differentFirstPage: false,
  pageBorder: "none",
  pageBorderColor: "",
  lineNumbers: "none",
  citationStyle: "apa",
  spellcheck: true,
  comments: true,
  zoom: 1,
  ruler: true,
  grid: false,
  marks: false,
  headingFont: null,
  styleSet: "default",
  styles: {},
  watermark: null,
  hyphenation: false,
  language: "it-IT",
  view: "print",
  inkVisible: true,
  trackChanges: false,
  markup: "all",
  protection: "none",
}

/* ------------------------------ Normalizzazione -------------------------- */

/** Riempie i campi introdotti dopo la prima versione dei dati salvati */
/**
 * La board d'esempio della versione 1.0.1 salvava in italiano una cella con il
 * contesto per i traduttori ancora attaccato: si ripulisce all'apertura.
 */
const LEGACY_CELLS: Record<string, string> = {
  "Ricerca||fase di un progetto": "Ricerca",
}

/** Un numero che si può disegnare: un NaN sul canvas sparisce tutto */
const finite = (value: unknown, fallback: number) => {
  const n = Number(value)
  return Number.isFinite(n) ? n : fallback
}

/**
 * Una tabella che si può disegnare: righe e colonne intere, una cella per
 * posto e una misura per riga e per colonna. Un file rovinato (o scritto a
 * mano) con un campo mancante faceva fallire il disegno di tutta la board.
 */
function normalizeTable(raw: unknown): TableData | undefined {
  if (!raw || typeof raw !== "object") return undefined
  const t = raw as Partial<TableData>
  const count = (value: unknown) =>
    Math.min(200, Math.max(1, Math.round(finite(value, 1))))
  const cols = count(t.cols)
  const rows = count(t.rows)
  const sizes = (list: unknown, length: number, fallback: number) =>
    Array.from({ length }, (_, i) =>
      Math.max(1, finite(Array.isArray(list) ? list[i] : undefined, fallback))
    )
  return {
    cols,
    rows,
    cells: Array.from({ length: cols * rows }, (_, i) => {
      const cell = Array.isArray(t.cells) ? t.cells[i] : undefined
      return typeof cell === "string" ? cell : cell == null ? "" : String(cell)
    }),
    colW: sizes(t.colW, cols, 140),
    rowH: sizes(t.rowH, rows, 40),
    header: t.header !== false,
    striped: Boolean(t.striped),
  }
}

export function normalizeNode(
  n: Partial<BoardNode> & { id: string }
): BoardNode {
  if (
    Array.isArray(n.table?.cells) &&
    n.table.cells.some((cell) => cell in LEGACY_CELLS)
  ) {
    n = {
      ...n,
      table: {
        ...n.table,
        cells: n.table.cells.map((cell) => LEGACY_CELLS[cell] ?? cell),
      },
    }
  }
  return {
    kind: "shape",
    shape: "rounded",
    color: "white",
    radius: null,
    bold: false,
    italic: false,
    align: "center",
    outline: true,
    shadow: true,
    ...n,
    // geometria e testo si controllano dopo lo spread: un file salvato a mano
    // (o l'incolla di un testo qualunque) non deve poter piantare la board
    x: finite(n.x, 0),
    y: finite(n.y, 0),
    w: Math.max(1, finite(n.w, 180)),
    h: Math.max(1, finite(n.h, 84)),
    fontSize: Math.max(1, finite(n.fontSize, 15)),
    text: typeof n.text === "string" ? n.text : "",
    // tabelle e grafici si disegnano campo per campo: un campo mancante
    // faceva fallire il disegno di tutta la board
    ...(n.kind === "table" ? { table: normalizeTable(n.table) } : {}),
    ...(n.kind === "chart" ? { chart: parseChartAttr(n.chart) } : {}),
  } as BoardNode
}

export function normalizeBoard(d: BoardData): BoardData {
  const src: Partial<BoardData> = d && typeof d === "object" ? d : {}
  return {
    ...src,
    nodes: Array.isArray(src.nodes)
      ? src.nodes
          .filter((n) => n && typeof n.id === "string")
          .map((n) => normalizeNode(n))
      : [],
    edges: Array.isArray(src.edges)
      ? src.edges.filter(
          (e) =>
            e &&
            typeof e.id === "string" &&
            typeof e.from === "string" &&
            typeof e.to === "string"
        )
      : [],
    theme: {
      ...defaultBoardTheme,
      ...src.theme,
      arrows: { ...defaultArrowDefaults, ...src.theme?.arrows },
      page: { ...defaultBoardTheme.page, ...src.theme?.page },
    },
  }
}

const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
export const ZOOM_STEPS = [0.5, 0.75, 0.9, 1, 1.25, 1.5, 1.75, 2]

export const clampZoom = (z: number) =>
  Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(z * 100) / 100))

const MARGIN_MIN = 8
const MARGIN_MAX = 240
// al centesimo di pixel: i margini di Word in centimetri restano esatti
export const clampMargin = (v: number) =>
  Math.round(Math.min(MARGIN_MAX, Math.max(MARGIN_MIN, v)) * 100) / 100

export function normalizeDoc(d: DocData): DocData {
  const src: Partial<DocData> = d && typeof d === "object" ? d : {}
  const saved = (src.theme ?? {}) as Partial<DocTheme> & { margin?: number }
  const theme = { ...defaultDocTheme, ...saved }
  // i documenti salvati prima avevano un margine solo, uguale sui quattro lati
  const margins = saved.margins ?? {
    top: saved.margin ?? defaultDocTheme.margins.top,
    right: saved.margin ?? defaultDocTheme.margins.right,
    bottom: (saved.margin ?? defaultDocTheme.margins.top) + 40,
    left: saved.margin ?? defaultDocTheme.margins.left,
  }
  // il vecchio campo singolo non serve più: toglierlo evita di riportarselo
  // dietro a ogni salvataggio
  delete (theme as Partial<DocTheme> & { margin?: number }).margin
  return {
    ...src,
    content: src.content ?? null,
    comments: Array.isArray(src.comments) ? src.comments : undefined,
    sources: Array.isArray(src.sources) ? src.sources : undefined,
    ink: Array.isArray(src.ink) ? src.ink : undefined,
    merge: src.merge && typeof src.merge === "object" ? src.merge : undefined,
    theme: {
      ...theme,
      styles:
        theme.styles && typeof theme.styles === "object" ? theme.styles : {},
      zoom: clampZoom(Number(theme.zoom) || 1),
      // un lato mancante (file scritto a mano o rovinato) diventava NaN e il
      // foglio perdeva l'impaginazione
      margins: {
        top: clampMargin(finite(margins.top, defaultDocTheme.margins.top)),
        right: clampMargin(
          finite(margins.right, defaultDocTheme.margins.right)
        ),
        bottom: clampMargin(
          finite(margins.bottom, defaultDocTheme.margins.bottom)
        ),
        left: clampMargin(finite(margins.left, defaultDocTheme.margins.left)),
      },
    },
  }
}
