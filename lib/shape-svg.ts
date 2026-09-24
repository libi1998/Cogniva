import { shapePath } from "./shapes"
import type { NodeShape } from "./types"

/**
 * Il disegno delle forme del documento (Inserisci › Forme), senza testi da
 * tradurre: lo usano la vista delle immagini e le esportazioni, che non
 * devono portarsi dietro le frasi della scheda Inserisci.
 */

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

export const esc = (value: string) => value.replace(/[<>&"]/g, "")

const LINE_KINDS: DocShapeKind[] = ["line", "arrow-line", "double-arrow"]
const SQUARE_KINDS: DocShapeKind[] = [
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

/** Una linea o una freccia: si allunga, non si allarga */
export const isLineShape = (kind: string) =>
  (LINE_KINDS as string[]).includes(kind)

/** Altezza su larghezza della forma appena inserita */
export function naturalRatio(kind: DocShapeKind) {
  if (isLineShape(kind)) return 0.1
  if (SQUARE_KINDS.includes(kind)) return 1
  return kind === "arrow-up" || kind === "arrow-down" ? 1.1 : 0.65
}

export type ShapeLook = {
  /** riempimento; "none" = trasparente */
  fill: string
  stroke: string
  strokeWidth?: number
  /** altezza su larghezza; null = quella naturale della forma */
  ratio?: number | null
  /** il testo scritto dentro la forma */
  text?: string
}

/** Chiaro o scuro, per scegliere il colore del testo dentro la forma */
function isDark(color: string) {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return false
  const n = parseInt(m[1], 16)
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  return 0.299 * r + 0.587 * g + 0.114 * b < 150
}

/** Il testo a capo sulle righe che entrano nella larghezza, stimata */
function wrapText(text: string, width: number, size: number) {
  const max = Math.max(4, Math.floor(width / (size * 0.56)))
  const out: string[] = []
  for (const para of text.split("\n")) {
    let line = ""
    for (const word of para.split(/\s+/)) {
      if (!word) continue
      const next = line ? `${line} ${word}` : word
      if (next.length > max && line) {
        out.push(line)
        line = word
      } else line = next
    }
    out.push(line)
  }
  return out
}

/**
 * Una forma come immagine SVG, come le forme di Word: riempimento, contorno
 * e testo al centro. I colori sono veri colori (dentro un data URI le
 * variabili CSS del documento non arrivano) e il testo è nel disegno, così
 * la forma è uguale a video, in stampa e in tutte le esportazioni.
 */
export function shapeSvg(
  kind: DocShapeKind,
  fill: string,
  stroke: string,
  look: Partial<ShapeLook> = {}
): { src: string; width: number } {
  const sw = Math.max(0, Math.min(12, look.strokeWidth ?? 3))
  if (isLineShape(kind)) {
    const w = 240
    const h = 24
    const head = (x: number, dir: 1 | -1) =>
      `<path d="M ${x} ${h / 2} l ${-14 * dir} -8 v 16 z" fill="${esc(stroke)}"/>`
    const x1 = kind === "double-arrow" ? 14 : 2
    const x2 = kind === "line" ? w - 2 : w - 14
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><line x1="${x1}" y1="${h / 2}" x2="${x2}" y2="${h / 2}" stroke="${esc(stroke)}" stroke-width="${Math.max(1, sw)}" stroke-linecap="round"/>${kind === "line" ? "" : head(w - 1, 1)}${kind === "double-arrow" ? head(1, -1) : ""}</svg>`
    return { src: svgData(svg), width: 40 }
  }
  const ratio = Math.max(0.1, Math.min(6, look.ratio ?? naturalRatio(kind)))
  const w = 200
  const h = Math.round(w * ratio)
  const inset = Math.max(1.5, sw / 2 + 0.5)
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
  const text = (look.text ?? "").trim()
  let label = ""
  if (text) {
    const size = 16
    // nel fumetto il testo sta nella parte alta, sopra la coda
    const boxH = kind === "callout" ? h * 0.7 : h
    const lines = wrapText(text, w * 0.72, size)
    const lead = size * 1.2
    const y0 = boxH / 2 - ((lines.length - 1) * lead) / 2
    const color =
      fill === "none" ? stroke : isDark(fill) ? "#ffffff" : "#27272a"
    label = `<text x="${w / 2}" text-anchor="middle" dominant-baseline="central" font-family="Arial, Helvetica, sans-serif" font-size="${size}" fill="${esc(color)}">${lines
      .map(
        (line, i) =>
          `<tspan x="${w / 2}" y="${(y0 + i * lead).toFixed(1)}">${line.replace(/[<>&]/g, (c) => (c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"))}</tspan>`
      )
      .join("")}</text>`
  }
  // preserveAspectRatio: mentre si allunga dalle maniglie l'anteprima si
  // deforma; lasciando, la forma si ridisegna con le proporzioni nuove
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" preserveAspectRatio="none"><path d="${d}" transform="${transform}" fill="${esc(fill)}" stroke="${sw ? esc(stroke) : "none"}" stroke-width="${sw}" stroke-linejoin="round"/>${label}</svg>`
  return {
    src: svgData(svg),
    width: SQUARE_KINDS.includes(kind) ? 22 : 32,
  }
}

/** Un colore più scuro dello stesso tono, per il contorno */
export function darker(color: string, amount = 0.28) {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return color
  const n = parseInt(m[1], 16)
  const part = (shift: number) =>
    Math.round(((n >> shift) & 255) * (1 - amount))
      .toString(16)
      .padStart(2, "0")
  return `#${part(16)}${part(8)}${part(0)}`
}

/**
 * L'aspetto di una forma appena inserita, come in Word: riempimento pieno
 * del colore del documento e contorno dello stesso tono più scuro. Linee e
 * frecce sono solo contorno. Prima il riempimento era il colore tenue dello
 * sfondo, e sul foglio bianco la forma quasi non si vedeva.
 */
export function shapeLook(kind: DocShapeKind, accent: string): ShapeLook {
  return isLineShape(kind)
    ? { fill: "none", stroke: accent, strokeWidth: 3, ratio: null }
    : { fill: accent, stroke: darker(accent), strokeWidth: 2, ratio: null }
}

/** Gli attributi dell'immagine di una forma, con il disegno rifatto */
export function shapeImageAttrs(
  kind: DocShapeKind,
  look: ShapeLook
): Record<string, unknown> {
  const { src } = shapeSvg(kind, look.fill, look.stroke, look)
  return {
    src,
    shape: kind,
    fill: look.fill,
    stroke: look.stroke,
    strokeWidth: look.strokeWidth ?? 3,
    ratio: look.ratio ?? null,
    label: look.text ?? "",
  }
}

export function svgData(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}
