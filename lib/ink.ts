import type { InkStroke } from "./types"

import { tr } from "@/lib/i18n/client"
/**
 * Input penna della scheda Disegno: tratti morbidi, gomma, riconoscimento
 * delle forme («Da input penna a forma») e penne personalizzate.
 *
 * I punti sono in coordinate del foglio (pixel CSS, senza zoom): il disegno
 * resta dove è stato fatto, come in Word.
 */

export type PenKind = "pen" | "pencil" | "highlighter"

export type Pen = {
  id: string
  kind: PenKind
  color: string
  /** spessore in pixel del foglio */
  width: number
}

export const DEFAULT_PENS: Pen[] = [
  { id: "pen-black", kind: "pen", color: "#18181b", width: 2 },
  { id: "pen-red", kind: "pen", color: "#e11d48", width: 2 },
  { id: "pen-blue", kind: "pen", color: "#2563eb", width: 3 },
  { id: "pencil", kind: "pencil", color: "#52525b", width: 1.5 },
  { id: "hl-yellow", kind: "highlighter", color: "#facc15", width: 14 },
  { id: "hl-green", kind: "highlighter", color: "#4ade80", width: 14 },
]

export const PEN_COLORS = [
  "#18181b",
  "#ffffff",
  "#71717a",
  "#e11d48",
  "#f97316",
  "#facc15",
  "#22c55e",
  "#14b8a6",
  "#2563eb",
  "#7c3aed",
  "#db2777",
  "#92400e",
]

export const PEN_WIDTHS: Record<PenKind, number[]> = {
  pen: [0.75, 1.5, 2, 3.5, 5, 8],
  pencil: [0.75, 1, 1.5, 2.5, 4],
  highlighter: [6, 10, 14, 20, 28],
}

export const PEN_LABELS: Record<PenKind, string> = {
  get pen() {
    return tr("Penna")
  },
  get pencil() {
    return tr("Matita")
  },
  get highlighter() {
    return tr("Evidenziatore")
  },
}

/** Il path SVG di un tratto: curve fra i punti medi, morbide anche se lente */
export function strokePath(points: number[]): string {
  const n = points.length / 2
  if (n === 0) return ""
  const x = (i: number) => points[i * 2].toFixed(1)
  const y = (i: number) => points[i * 2 + 1].toFixed(1)
  if (n === 1) return `M ${x(0)} ${y(0)} l 0.01 0`
  if (n === 2) return `M ${x(0)} ${y(0)} L ${x(1)} ${y(1)}`
  let d = `M ${x(0)} ${y(0)}`
  for (let i = 1; i < n - 1; i += 1) {
    const mx = ((points[i * 2] + points[(i + 1) * 2]) / 2).toFixed(1)
    const my = ((points[i * 2 + 1] + points[(i + 1) * 2 + 1]) / 2).toFixed(1)
    d += ` Q ${x(i)} ${y(i)} ${mx} ${my}`
  }
  return `${d} L ${x(n - 1)} ${y(n - 1)}`
}

/** Distanza di un punto da un segmento */
function segmentDistance(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
) {
  const dx = bx - ax
  const dy = by - ay
  const len = dx * dx + dy * dy
  const t = len
    ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len))
    : 0
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

/** Il tratto passa vicino al punto? (per la gomma) */
export function hitStroke(
  stroke: InkStroke,
  x: number,
  y: number,
  radius: number
) {
  const p = stroke.points
  const reach = radius + stroke.width / 2
  if (p.length === 2) return Math.hypot(p[0] - x, p[1] - y) <= reach
  for (let i = 0; i + 3 < p.length; i += 2) {
    if (segmentDistance(x, y, p[i], p[i + 1], p[i + 2], p[i + 3]) <= reach) {
      return true
    }
  }
  return false
}

/** Ramer–Douglas–Peucker: gli angoli di un tratto */
function simplify(
  pts: [number, number][],
  epsilon: number
): [number, number][] {
  if (pts.length < 3) return pts
  const [ax, ay] = pts[0]
  const [bx, by] = pts[pts.length - 1]
  let index = 0
  let max = 0
  for (let i = 1; i < pts.length - 1; i += 1) {
    const d = segmentDistance(pts[i][0], pts[i][1], ax, ay, bx, by)
    if (d > max) {
      max = d
      index = i
    }
  }
  if (max <= epsilon) return [pts[0], pts[pts.length - 1]]
  const left = simplify(pts.slice(0, index + 1), epsilon)
  const right = simplify(pts.slice(index), epsilon)
  return [...left.slice(0, -1), ...right]
}

const pairs = (points: number[]): [number, number][] => {
  const out: [number, number][] = []
  for (let i = 0; i + 1 < points.length; i += 2)
    out.push([points[i], points[i + 1]])
  return out
}

/**
 * «Da input penna a forma»: una linea, un triangolo, un rettangolo o
 * un'ellisse al posto del tratto disegnato a mano. null se non somiglia a
 * niente di riconoscibile.
 */
export function recognizeShape(points: number[]): number[] | null {
  const pts = pairs(points)
  if (pts.length < 6) return null
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const w = maxX - minX
  const h = maxY - minY
  const size = Math.max(w, h)
  if (size < 24) return null
  const [sx, sy] = pts[0]
  const [ex, ey] = pts[pts.length - 1]

  // linea: tutti i punti vicini al segmento fra inizio e fine
  const straight = pts.every(
    ([x, y]) => segmentDistance(x, y, sx, sy, ex, ey) < Math.max(6, size * 0.06)
  )
  if (straight) return [sx, sy, ex, ey]

  const closed = Math.hypot(ex - sx, ey - sy) < size * 0.25
  if (!closed) return null
  const corners = simplify(pts, size * 0.08)
  // l'ultimo punto coincide quasi con il primo: non è un angolo in più
  const count = corners.length - 1
  if (count === 3) {
    const [a, b, c] = corners
    return [a[0], a[1], b[0], b[1], c[0], c[1], a[0], a[1]]
  }
  if (count === 4 || count === 5) {
    return [minX, minY, maxX, minY, maxX, maxY, minX, maxY, minX, minY]
  }
  // ellisse inscritta nel riquadro
  const cx = (minX + maxX) / 2
  const cy = (minY + maxY) / 2
  const out: number[] = []
  for (let i = 0; i <= 48; i += 1) {
    const a = (i / 48) * Math.PI * 2
    out.push(cx + (w / 2) * Math.cos(a), cy + (h / 2) * Math.sin(a))
  }
  return out
}

/** Riduce i punti di un tratto lungo: file più leggeri, disegno identico */
export function thinPoints(points: number[], minDistance = 1.2): number[] {
  if (points.length <= 4) return points
  const out = [points[0], points[1]]
  for (let i = 2; i + 1 < points.length; i += 2) {
    const lx = out[out.length - 2]
    const ly = out[out.length - 1]
    if (Math.hypot(points[i] - lx, points[i + 1] - ly) >= minDistance) {
      out.push(
        Math.round(points[i] * 10) / 10,
        Math.round(points[i + 1] * 10) / 10
      )
    }
  }
  const lastX = points[points.length - 2]
  const lastY = points[points.length - 1]
  if (out[out.length - 2] !== lastX || out[out.length - 1] !== lastY) {
    out.push(lastX, lastY)
  }
  return out
}

/** La lunghezza di un tratto, per la riproduzione a velocità costante */
export function strokeLength(points: number[]) {
  let total = 0
  for (let i = 0; i + 3 < points.length; i += 2) {
    total += Math.hypot(
      points[i + 2] - points[i],
      points[i + 3] - points[i + 1]
    )
  }
  return total
}

const PENS_KEY = "cogniva.ink.pens"

// le penne sono un piccolo store esterno: si leggono con useSyncExternalStore,
// niente discordanze fra server e client
let cachedPens: Pen[] | null = null
const penListeners = new Set<() => void>()

function loadPens(): Pen[] {
  try {
    const raw = JSON.parse(localStorage.getItem(PENS_KEY) ?? "null")
    if (!Array.isArray(raw)) return DEFAULT_PENS
    const pens = raw.filter(
      (p): p is Pen =>
        p &&
        typeof p.id === "string" &&
        ["pen", "pencil", "highlighter"].includes(p.kind) &&
        /^#[0-9a-f]{6}$/i.test(p.color) &&
        typeof p.width === "number"
    )
    return pens.length ? pens.slice(0, 16) : DEFAULT_PENS
  } catch {
    return DEFAULT_PENS
  }
}

export function readPens(): Pen[] {
  cachedPens ??= loadPens()
  return cachedPens
}

export function subscribePens(listener: () => void) {
  penListeners.add(listener)
  return () => {
    penListeners.delete(listener)
  }
}

export function savePens(pens: Pen[]) {
  cachedPens = pens
  try {
    localStorage.setItem(PENS_KEY, JSON.stringify(pens))
  } catch {
    // senza localStorage le penne valgono per questa sessione
  }
  penListeners.forEach((l) => l())
}
