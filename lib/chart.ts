import { whim } from "./palette"

/**
 * Grafici come in Word ed Excel: un foglio dati (categorie × serie) e un tipo
 * di rappresentazione. Lo stesso modello serve ai documenti e alle board, e il
 * disegno è SVG vero: resta vettoriale in stampa e nelle esportazioni.
 */

export type ChartType =
  "column" | "bar" | "line" | "area" | "pie" | "doughnut" | "radar" | "scatter"

type ChartSeries = {
  name: string
  /** null = colore della tavolozza */
  color: string | null
  values: number[]
}

export type ChartPalette = "vivid" | "cool" | "warm" | "mono"

export type ChartSpec = {
  type: ChartType
  title: string
  categories: string[]
  series: ChartSeries[]
  /** colonne, barre e aree una sopra l'altra */
  stacked: boolean
  legend: "none" | "top" | "bottom" | "right"
  /** valori scritti sopra barre, punti e fette */
  labels: boolean
  grid: boolean
  /** linee e aree morbide */
  smooth: boolean
  xTitle: string
  yTitle: string
  palette: ChartPalette
}

export const CHART_TYPES: { value: ChartType; label: string }[] = [
  { value: "column", label: "Istogramma" },
  { value: "bar", label: "Barre" },
  { value: "line", label: "Linee" },
  { value: "area", label: "Area" },
  { value: "pie", label: "Torta" },
  { value: "doughnut", label: "Anello" },
  { value: "radar", label: "Radar" },
  { value: "scatter", label: "Dispersione" },
]

export const CHART_PALETTES: Record<
  ChartPalette,
  { label: string; colors: string[] }
> = {
  vivid: {
    label: "Vivaci",
    colors: [
      whim.blue[400],
      whim.hotPink[400],
      whim.green[500],
      whim.orange[400],
      whim.purple[400],
      whim.teal[500],
      whim.yellow[500],
      whim.base[700],
    ],
  },
  cool: {
    label: "Freddi",
    colors: [
      whim.teal[600],
      whim.blue[400],
      whim.teal[300],
      whim.purple[500],
      whim.green[600],
      whim.blue[200],
      whim.teal[800],
      whim.purple[300],
    ],
  },
  warm: {
    label: "Caldi",
    colors: [
      whim.orange[400],
      whim.hotPink[400],
      whim.yellow[500],
      whim.pink[500],
      whim.orange[600],
      whim.hotPink[600],
      whim.yellow[700],
      whim.orange[200],
    ],
  },
  mono: {
    label: "Monocromatico",
    colors: [
      whim.blue[700],
      whim.blue[500],
      whim.blue[400],
      whim.blue[300],
      whim.blue[200],
      whim.blue[600],
      whim.blue[100],
      whim.blue[800],
    ],
  },
}

export function seriesColor(spec: ChartSpec, index: number) {
  const palette = CHART_PALETTES[spec.palette] ?? CHART_PALETTES.vivid
  return (
    spec.series[index]?.color || palette.colors[index % palette.colors.length]
  )
}

/** Il colore della categoria nei grafici a torta e ad anello */
export function sliceColor(spec: ChartSpec, index: number) {
  const palette = CHART_PALETTES[spec.palette] ?? CHART_PALETTES.vivid
  return palette.colors[index % palette.colors.length]
}

/** I dati di esempio che inserisce Word */
export function defaultChart(type: ChartType = "column"): ChartSpec {
  const pie = type === "pie" || type === "doughnut"
  return {
    type,
    title: "Titolo del grafico",
    categories: pie
      ? ["1° trim.", "2° trim.", "3° trim.", "4° trim."]
      : ["Categoria 1", "Categoria 2", "Categoria 3", "Categoria 4"],
    series: pie
      ? [{ name: "Vendite", color: null, values: [8.2, 3.2, 1.4, 1.2] }]
      : [
          { name: "Serie 1", color: null, values: [4.3, 2.5, 3.5, 4.5] },
          { name: "Serie 2", color: null, values: [2.4, 4.4, 1.8, 2.8] },
          { name: "Serie 3", color: null, values: [2, 2, 3, 5] },
        ],
    stacked: false,
    legend: "bottom",
    labels: false,
    grid: true,
    smooth: false,
    xTitle: "",
    yTitle: "",
    palette: "vivid",
  }
}

/** Riempie i campi mancanti di un grafico salvato o incollato */
function normalizeChart(raw: unknown): ChartSpec {
  const base = defaultChart()
  if (!raw || typeof raw !== "object") return base
  const r = raw as Partial<ChartSpec>
  const categories = Array.isArray(r.categories)
    ? r.categories.map((c) => String(c ?? ""))
    : base.categories
  const series = Array.isArray(r.series)
    ? r.series.map((s, i) => ({
        name: String(s?.name ?? `Serie ${i + 1}`),
        color: typeof s?.color === "string" && s.color ? s.color : null,
        values: categories.map((_, j) => {
          const v = Number(s?.values?.[j])
          return Number.isFinite(v) ? v : 0
        }),
      }))
    : base.series
  return {
    ...base,
    ...r,
    palette:
      r.palette && r.palette in CHART_PALETTES ? r.palette : base.palette,
    type: CHART_TYPES.some((t) => t.value === r.type)
      ? (r.type as ChartType)
      : base.type,
    categories,
    series: series.length ? series : base.series,
  }
}

export function parseChartAttr(value: unknown): ChartSpec {
  if (typeof value === "string") {
    try {
      return normalizeChart(JSON.parse(value))
    } catch {
      return defaultChart()
    }
  }
  return normalizeChart(value)
}

/** Numero scritto all'italiana o all'inglese: «1.234,5» e «1234.5» */
export function parseNumber(text: string): number {
  const t = text.trim().replace(/\s|%|€|\$/g, "")
  if (!t) return 0
  const normalized =
    t.includes(",") &&
    (!t.includes(".") || t.lastIndexOf(",") > t.lastIndexOf("."))
      ? t.replace(/\./g, "").replace(",", ".")
      : t.replace(/,/g, "")
  const n = Number(normalized)
  return Number.isFinite(n) ? n : 0
}

/**
 * Dati incollati da Excel, Numbers o Google Fogli (tabulazioni) oppure CSV:
 * la prima riga sono i nomi delle serie, la prima colonna le categorie.
 */
export function parseTable(
  text: string
): Pick<ChartSpec, "categories" | "series"> | null {
  const lines = text
    .replace(/\r/g, "")
    .split("\n")
    .filter((l) => l.trim())
  if (lines.length < 2) return null
  const sep = lines[0].includes("\t")
    ? "\t"
    : lines[0].includes(";")
      ? ";"
      : ","
  const rows = lines.map((l) => l.split(sep))
  const width = Math.max(...rows.map((r) => r.length))
  if (width < 2) return null
  const header = rows[0]
  const body = rows.slice(1)
  const series: ChartSeries[] = []
  for (let c = 1; c < width; c++) {
    series.push({
      name: (header[c] ?? "").trim() || `Serie ${c}`,
      color: null,
      values: body.map((r) => parseNumber(r[c] ?? "")),
    })
  }
  return {
    categories: body.map((r, i) => (r[0] ?? "").trim() || `Categoria ${i + 1}`),
    series,
  }
}

/** Il foglio dati come testo da copiare in Excel */
export function toTable(spec: ChartSpec) {
  const head = ["", ...spec.series.map((s) => s.name)].join("\t")
  const rows = spec.categories.map((c, i) =>
    [
      c,
      ...spec.series.map((s) => String(s.values[i] ?? 0).replace(".", ",")),
    ].join("\t")
  )
  return [head, ...rows].join("\n")
}

/* --------------------------------- scale --------------------------------- */

function niceStep(range: number, ticks: number) {
  const raw = range / Math.max(1, ticks)
  const mag = 10 ** Math.floor(Math.log10(raw || 1))
  const norm = raw / mag
  const nice =
    norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10
  return nice * mag
}

/** Asse con valori tondi, come quello automatico di Excel */
export function niceScale(min: number, max: number, ticks = 5) {
  let lo = Math.min(0, min)
  let hi = Math.max(0, max)
  if (lo === hi) hi = lo + 1
  const step = niceStep(hi - lo, ticks)
  lo = Math.floor(lo / step) * step
  hi = Math.ceil(hi / step) * step
  const values: number[] = []
  for (let v = lo; v <= hi + step / 2; v += step)
    values.push(Number(v.toFixed(10)))
  return { min: lo, max: hi, step, values }
}

export function formatValue(v: number) {
  const abs = Math.abs(v)
  if (abs >= 1e9)
    return `${(v / 1e9).toLocaleString("it-IT", { maximumFractionDigits: 1 })} Mld`
  if (abs >= 1e6)
    return `${(v / 1e6).toLocaleString("it-IT", { maximumFractionDigits: 1 })} Mln`
  if (abs >= 1e4)
    return `${(v / 1e3).toLocaleString("it-IT", { maximumFractionDigits: 1 })}k`
  return v.toLocaleString("it-IT", { maximumFractionDigits: 2 })
}
