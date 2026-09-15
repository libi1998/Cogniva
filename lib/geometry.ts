import type { ArrowHead, BoardNode, EdgeRouting, Side } from "./types"

export type Point = { x: number; y: number }
type Anchor = Point & { dx: number; dy: number }

const STUB = 24

function center(n: BoardNode): Point {
  return { x: n.x + n.w / 2, y: n.y + n.h / 2 }
}

const SIDE_DIR: Record<Exclude<Side, "auto">, Point> = {
  top: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  bottom: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
}

function anchorOf(n: BoardNode, side: Exclude<Side, "auto">): Anchor {
  const d = SIDE_DIR[side]
  const c = center(n)
  return {
    x: c.x + (d.x * n.w) / 2,
    y: c.y + (d.y * n.h) / 2,
    dx: d.x,
    dy: d.y,
  }
}

function autoSide(
  from: BoardNode,
  to: BoardNode
): [Exclude<Side, "auto">, Exclude<Side, "auto">] {
  const a = center(from)
  const b = center(to)
  const dx = b.x - a.x
  const dy = b.y - a.y
  // normalizzo rispetto alle dimensioni per evitare scelte innaturali
  const nx = Math.abs(dx) / Math.max(1, (from.w + to.w) / 2)
  const ny = Math.abs(dy) / Math.max(1, (from.h + to.h) / 2)
  if (nx >= ny) {
    return dx >= 0 ? ["right", "left"] : ["left", "right"]
  }
  return dy >= 0 ? ["bottom", "top"] : ["top", "bottom"]
}

function resolveSides(
  from: BoardNode,
  to: BoardNode,
  fromSide: Side,
  toSide: Side
): [Exclude<Side, "auto">, Exclude<Side, "auto">] {
  const [af, at] = autoSide(from, to)
  return [fromSide === "auto" ? af : fromSide, toSide === "auto" ? at : toSide]
}

/** Punto sul bordo della forma, lungo la direzione (dx,dy) uscente dal centro */
function boundaryPoint(n: BoardNode, dx: number, dy: number): Point {
  const c = center(n)
  const hw = n.w / 2
  const hh = n.h / 2
  const len = Math.hypot(dx, dy) || 1
  const ux = dx / len
  const uy = dy / len

  if (n.shape === "ellipse") {
    const t = 1 / Math.hypot(ux / hw, uy / hh || 1e-9)
    return { x: c.x + ux * t, y: c.y + uy * t }
  }
  if (n.shape === "diamond") {
    const t = 1 / (Math.abs(ux) / hw + Math.abs(uy) / hh || 1e-9)
    return { x: c.x + ux * t, y: c.y + uy * t }
  }
  // rettangolo (anche pill / note / text)
  const tx = ux === 0 ? Infinity : hw / Math.abs(ux)
  const ty = uy === 0 ? Infinity : hh / Math.abs(uy)
  const t = Math.min(tx, ty)
  return { x: c.x + ux * t, y: c.y + uy * t }
}

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t }
}

/** Polilinea con spigoli arrotondati */
function roundedPolyline(pts: Point[], r: number): string {
  if (pts.length < 2) return ""
  if (pts.length === 2 || r <= 0) {
    return `M ${pts.map((p) => `${round(p.x)} ${round(p.y)}`).join(" L ")}`
  }
  let d = `M ${round(pts[0].x)} ${round(pts[0].y)}`
  for (let i = 1; i < pts.length - 1; i++) {
    const prev = pts[i - 1]
    const cur = pts[i]
    const next = pts[i + 1]
    const l1 = Math.hypot(cur.x - prev.x, cur.y - prev.y)
    const l2 = Math.hypot(next.x - cur.x, next.y - cur.y)
    const rr = Math.min(r, l1 / 2, l2 / 2)
    if (rr < 0.5) {
      d += ` L ${round(cur.x)} ${round(cur.y)}`
      continue
    }
    const p1 = lerp(cur, prev, rr / l1)
    const p2 = lerp(cur, next, rr / l2)
    d += ` L ${round(p1.x)} ${round(p1.y)} Q ${round(cur.x)} ${round(cur.y)} ${round(p2.x)} ${round(p2.y)}`
  }
  const last = pts[pts.length - 1]
  d += ` L ${round(last.x)} ${round(last.y)}`
  return d
}

function round(n: number) {
  return Math.round(n * 100) / 100
}

function orthPoints(a: Anchor, b: Anchor, stub: number): Point[] {
  const a2 = { x: a.x + a.dx * stub, y: a.y + a.dy * stub }
  const b2 = { x: b.x + b.dx * stub, y: b.y + b.dy * stub }
  const aHoriz = a.dx !== 0
  const bHoriz = b.dx !== 0
  const pts: Point[] = [{ x: a.x, y: a.y }, a2]

  if (aHoriz && bHoriz) {
    const mx = (a2.x + b2.x) / 2
    pts.push({ x: mx, y: a2.y }, { x: mx, y: b2.y })
  } else if (!aHoriz && !bHoriz) {
    const my = (a2.y + b2.y) / 2
    pts.push({ x: a2.x, y: my }, { x: b2.x, y: my })
  } else if (aHoriz && !bHoriz) {
    pts.push({ x: b2.x, y: a2.y })
  } else {
    pts.push({ x: a2.x, y: b2.y })
  }
  pts.push(b2, { x: b.x, y: b.y })

  // rimuovo punti duplicati/collineari
  const out: Point[] = []
  for (const p of pts) {
    const last = out[out.length - 1]
    if (last && Math.abs(last.x - p.x) < 0.01 && Math.abs(last.y - p.y) < 0.01)
      continue
    out.push(p)
  }
  return out
}

function polylineMid(pts: Point[]): Point {
  let total = 0
  const segs: number[] = []
  for (let i = 1; i < pts.length; i++) {
    const l = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y)
    segs.push(l)
    total += l
  }
  let acc = 0
  for (let i = 0; i < segs.length; i++) {
    if (acc + segs[i] >= total / 2) {
      const t = (total / 2 - acc) / (segs[i] || 1)
      return lerp(pts[i], pts[i + 1], t)
    }
    acc += segs[i]
  }
  return pts[0]
}

function cubicAt(p0: Point, c1: Point, c2: Point, p1: Point, t: number): Point {
  const mt = 1 - t
  return {
    x:
      mt ** 3 * p0.x +
      3 * mt ** 2 * t * c1.x +
      3 * mt * t ** 2 * c2.x +
      t ** 3 * p1.x,
    y:
      mt ** 3 * p0.y +
      3 * mt ** 2 * t * c1.y +
      3 * mt * t ** 2 * c2.y +
      t ** 3 * p1.y,
  }
}

export type EdgeGeometry = {
  d: string
  start: Point
  end: Point
  /** angolo (rad) della direzione di arrivo sul nodo di destinazione */
  endAngle: number
  /** angolo (rad) della direzione di partenza (uscente dal nodo sorgente) */
  startAngle: number
  mid: Point
}

/** Quanto accorciare la linea per non sbordare dalla punta */
export function headInset(head: ArrowHead, size: number): number {
  switch (head) {
    case "arrow":
      return size * 0.7
    case "triangle":
    case "hollow":
      return size * 0.94
    case "diamond":
    case "hollowDiamond":
      return size * 1.06
    case "circle":
    case "hollowCircle":
      return size * 0.9
    default:
      return 0
  }
}

export function buildEdgeGeometry(
  from: BoardNode,
  to: BoardNode,
  routing: EdgeRouting,
  fromSide: Side,
  toSide: Side,
  cornerRadius: number,
  startInset = 0,
  endInset = 0
): EdgeGeometry {
  if (routing === "straight") {
    const a = center(from)
    const b = center(to)
    let p0 = boundaryPoint(from, b.x - a.x, b.y - a.y)
    let p1 = boundaryPoint(to, a.x - b.x, a.y - b.y)
    const ang = Math.atan2(p1.y - p0.y, p1.x - p0.x)
    p0 = {
      x: p0.x + Math.cos(ang) * startInset,
      y: p0.y + Math.sin(ang) * startInset,
    }
    p1 = {
      x: p1.x - Math.cos(ang) * endInset,
      y: p1.y - Math.sin(ang) * endInset,
    }
    return {
      d: `M ${round(p0.x)} ${round(p0.y)} L ${round(p1.x)} ${round(p1.y)}`,
      start: p0,
      end: p1,
      startAngle: ang,
      endAngle: ang,
      mid: lerp(p0, p1, 0.5),
    }
  }

  const [sf, st] = resolveSides(from, to, fromSide, toSide)
  const a = anchorOf(from, sf)
  const b = anchorOf(to, st)

  if (routing === "curved") {
    const dist = Math.hypot(b.x - a.x, b.y - a.y)
    const k = Math.min(Math.max(dist * 0.42, 36), 220)
    const p0 = { x: a.x + a.dx * startInset, y: a.y + a.dy * startInset }
    const p1 = { x: b.x + b.dx * endInset, y: b.y + b.dy * endInset }
    const c1 = { x: a.x + a.dx * k, y: a.y + a.dy * k }
    const c2 = { x: b.x + b.dx * k, y: b.y + b.dy * k }
    const near = cubicAt(p0, c1, c2, p1, 0.985)
    return {
      d: `M ${round(p0.x)} ${round(p0.y)} C ${round(c1.x)} ${round(c1.y)} ${round(c2.x)} ${round(c2.y)} ${round(p1.x)} ${round(p1.y)}`,
      start: p0,
      end: p1,
      startAngle: Math.atan2(c1.y - p0.y, c1.x - p0.x),
      endAngle: Math.atan2(p1.y - near.y, p1.x - near.x),
      mid: cubicAt(p0, c1, c2, p1, 0.5),
    }
  }

  // elbow
  const pts = orthPoints(a, b, STUB)
  if (startInset > 0) {
    pts[0] = {
      x: pts[0].x + a.dx * startInset,
      y: pts[0].y + a.dy * startInset,
    }
  }
  if (endInset > 0) {
    pts[pts.length - 1] = {
      x: pts[pts.length - 1].x + b.dx * endInset,
      y: pts[pts.length - 1].y + b.dy * endInset,
    }
  }
  const last = pts[pts.length - 1]
  const beforeLast = pts[pts.length - 2] ?? last
  const first = pts[0]
  const second = pts[1] ?? first
  return {
    d: roundedPolyline(pts, cornerRadius),
    start: first,
    end: last,
    startAngle: Math.atan2(second.y - first.y, second.x - first.x),
    endAngle: Math.atan2(last.y - beforeLast.y, last.x - beforeLast.x),
    mid: polylineMid(pts),
  }
}

/** Geometria verso un punto libero (durante il trascinamento di un connettore) */
export function buildEdgeToPoint(
  from: BoardNode,
  target: Point,
  routing: EdgeRouting,
  fromSide: Side,
  cornerRadius: number
): EdgeGeometry {
  const ghost: BoardNode = {
    ...from,
    id: "__ghost__",
    x: target.x - 1,
    y: target.y - 1,
    w: 2,
    h: 2,
    shape: "rect",
  }
  return buildEdgeGeometry(
    from,
    ghost,
    routing,
    fromSide,
    "auto",
    cornerRadius,
    0,
    0
  )
}

/* ----------------------------- Punte frecce ------------------------------ */

export type HeadRender = {
  d: string
  filled: boolean
  closed: boolean
}

/**
 * Path della punta in coordinate locali: la punta è in (0,0)
 * e il corpo si estende verso -x. Va poi ruotato di `angle`.
 */
export function headPath(type: ArrowHead, s: number): HeadRender | null {
  switch (type) {
    case "arrow":
      // punta concava
      return {
        d: `M 0 0 L ${-s * 1.05} ${-s * 0.58} L ${-s * 0.62} 0 L ${-s * 1.05} ${s * 0.58} Z`,
        filled: true,
        closed: true,
      }
    case "triangle":
      return {
        d: `M 0 0 L ${-s} ${-s * 0.52} L ${-s} ${s * 0.52} Z`,
        filled: true,
        closed: true,
      }
    case "hollow":
      return {
        d: `M 0 0 L ${-s} ${-s * 0.52} L ${-s} ${s * 0.52} Z`,
        filled: false,
        closed: true,
      }
    case "open":
      return {
        d: `M ${-s} ${-s * 0.62} L 0 0 L ${-s} ${s * 0.62}`,
        filled: false,
        closed: false,
      }
    case "circle":
      return {
        d: circlePath(-s * 0.5, 0, s * 0.5),
        filled: true,
        closed: true,
      }
    case "hollowCircle":
      return {
        d: circlePath(-s * 0.5, 0, s * 0.45),
        filled: false,
        closed: true,
      }
    case "diamond":
      return {
        d: `M 0 0 L ${-s * 0.58} ${-s * 0.46} L ${-s * 1.16} 0 L ${-s * 0.58} ${s * 0.46} Z`,
        filled: true,
        closed: true,
      }
    case "hollowDiamond":
      return {
        d: `M 0 0 L ${-s * 0.58} ${-s * 0.46} L ${-s * 1.16} 0 L ${-s * 0.58} ${s * 0.46} Z`,
        filled: false,
        closed: true,
      }
    case "bar":
      return {
        d: `M 0 ${-s * 0.66} L 0 ${s * 0.66}`,
        filled: false,
        closed: false,
      }
    default:
      return null
  }
}

function circlePath(cx: number, cy: number, r: number) {
  return `M ${cx - r} ${cy} a ${r} ${r} 0 1 0 ${r * 2} 0 a ${r} ${r} 0 1 0 ${-r * 2} 0`
}

export function transformFor(p: Point, angleRad: number) {
  return `translate(${round(p.x)} ${round(p.y)}) rotate(${round((angleRad * 180) / Math.PI)})`
}

export const dashFor = (style: string, width: number) => {
  if (style === "dashed") return `${width * 3.4} ${width * 2.6}`
  if (style === "dotted") return `0.01 ${width * 2.4}`
  return undefined
}
