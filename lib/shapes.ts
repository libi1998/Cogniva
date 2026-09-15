import type { NodeShape } from "./types"
import { PATH_SHAPES } from "./types"

type P = { x: number; y: number }

const lerp = (a: P, b: P, t: number): P => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t,
})

const rr = (n: number) => Math.round(n * 100) / 100

/** Poligono chiuso con angoli arrotondati */
function roundedPolygon(pts: P[], radius: number): string {
  const n = pts.length
  if (n < 3) return ""
  let d = ""
  for (let i = 0; i < n; i++) {
    const prev = pts[(i - 1 + n) % n]
    const cur = pts[i]
    const next = pts[(i + 1) % n]
    const l1 = Math.hypot(cur.x - prev.x, cur.y - prev.y) || 1
    const l2 = Math.hypot(next.x - cur.x, next.y - cur.y) || 1
    const r = Math.min(radius, l1 / 2.05, l2 / 2.05)
    if (r < 0.4) {
      d += (i === 0 ? "M " : " L ") + `${rr(cur.x)} ${rr(cur.y)}`
      continue
    }
    const p1 = lerp(cur, prev, r / l1)
    const p2 = lerp(cur, next, r / l2)
    d += i === 0 ? `M ${rr(p1.x)} ${rr(p1.y)}` : ` L ${rr(p1.x)} ${rr(p1.y)}`
    d += ` Q ${rr(cur.x)} ${rr(cur.y)} ${rr(p2.x)} ${rr(p2.y)}`
  }
  return d + " Z"
}

export function isPathShape(shape: NodeShape) {
  return PATH_SHAPES.includes(shape)
}

/** Path della forma nel box (0,0,w,h) */
export function shapePath(
  shape: NodeShape,
  w: number,
  h: number,
  radius: number
): string {
  const r = Math.max(0, radius)
  switch (shape) {
    case "diamond":
      return roundedPolygon(
        [
          { x: w / 2, y: 0 },
          { x: w, y: h / 2 },
          { x: w / 2, y: h },
          { x: 0, y: h / 2 },
        ],
        r * 1.4
      )
    case "parallelogram": {
      const s = Math.min(w * 0.2, 34)
      return roundedPolygon(
        [
          { x: s, y: 0 },
          { x: w, y: 0 },
          { x: w - s, y: h },
          { x: 0, y: h },
        ],
        r * 0.9
      )
    }
    case "hexagon": {
      const s = Math.min(w * 0.22, 40)
      return roundedPolygon(
        [
          { x: s, y: 0 },
          { x: w - s, y: 0 },
          { x: w, y: h / 2 },
          { x: w - s, y: h },
          { x: s, y: h },
          { x: 0, y: h / 2 },
        ],
        r
      )
    }
    case "triangle":
      return roundedPolygon(
        [
          { x: w / 2, y: 0 },
          { x: w, y: h },
          { x: 0, y: h },
        ],
        r * 1.3
      )
    case "star": {
      const cx = w / 2
      const cy = h / 2
      const R = Math.min(w, h) / 2
      const ri = R * 0.45
      const pts: P[] = []
      for (let i = 0; i < 10; i++) {
        const ang = (Math.PI / 5) * i - Math.PI / 2
        const rad = i % 2 === 0 ? R : ri
        pts.push({
          x: cx + Math.cos(ang) * rad * (w / Math.min(w, h)),
          y: cy + Math.sin(ang) * rad * (h / Math.min(w, h)),
        })
      }
      return roundedPolygon(pts, Math.min(r * 0.5, 8))
    }
    case "cross": {
      const t = Math.min(w, h) * 0.32
      const x0 = (w - t) / 2
      const y0 = (h - t) / 2
      return roundedPolygon(
        [
          { x: x0, y: 0 },
          { x: x0 + t, y: 0 },
          { x: x0 + t, y: y0 },
          { x: w, y: y0 },
          { x: w, y: y0 + t },
          { x: x0 + t, y: y0 + t },
          { x: x0 + t, y: h },
          { x: x0, y: h },
          { x: x0, y: y0 + t },
          { x: 0, y: y0 + t },
          { x: 0, y: y0 },
          { x: x0, y: y0 },
        ],
        Math.min(r * 0.6, 10)
      )
    }
    case "arrowBlock": {
      const head = Math.min(w * 0.34, 60)
      const t = h * 0.46
      const y0 = (h - t) / 2
      return roundedPolygon(
        [
          { x: 0, y: y0 },
          { x: w - head, y: y0 },
          { x: w - head, y: 0 },
          { x: w, y: h / 2 },
          { x: w - head, y: h },
          { x: w - head, y: y0 + t },
          { x: 0, y: y0 + t },
        ],
        Math.min(r * 0.5, 8)
      )
    }
    case "document": {
      const wave = Math.min(h * 0.16, 22)
      const rad = Math.min(r, w / 2, (h - wave) / 2)
      return [
        `M 0 ${rr(rad)}`,
        `Q 0 0 ${rr(rad)} 0`,
        `L ${rr(w - rad)} 0`,
        `Q ${rr(w)} 0 ${rr(w)} ${rr(rad)}`,
        `L ${rr(w)} ${rr(h - wave)}`,
        `C ${rr(w * 0.75)} ${rr(h - wave * 2.1)} ${rr(w * 0.25)} ${rr(h + wave * 0.35)} 0 ${rr(h - wave)}`,
        "Z",
      ].join(" ")
    }
    case "cylinder": {
      const e = Math.min(h * 0.18, 26)
      return [
        `M 0 ${rr(e)}`,
        `A ${rr(w / 2)} ${rr(e)} 0 0 1 ${rr(w)} ${rr(e)}`,
        `L ${rr(w)} ${rr(h - e)}`,
        `A ${rr(w / 2)} ${rr(e)} 0 0 1 0 ${rr(h - e)}`,
        "Z",
      ].join(" ")
    }
    default:
      return ""
  }
}

/** Decorazione aggiuntiva (es. la bocca del cilindro) */
export function shapeDetail(
  shape: NodeShape,
  w: number,
  h: number
): string | null {
  if (shape === "cylinder") {
    const e = Math.min(h * 0.18, 26)
    return `M 0 ${rr(e)} A ${rr(w / 2)} ${rr(e)} 0 0 0 ${rr(w)} ${rr(e)}`
  }
  return null
}

/** Riquadro interno in cui far stare il testo (evita gli angoli tagliati) */
export function textInset(shape: NodeShape, w: number, h: number) {
  switch (shape) {
    case "diamond":
      return { x: w * 0.18, y: h * 0.2 }
    case "triangle":
      return { x: w * 0.2, y: h * 0.34 }
    case "hexagon":
      return { x: Math.min(w * 0.22, 40), y: 8 }
    case "parallelogram":
      return { x: Math.min(w * 0.2, 34), y: 8 }
    case "cylinder":
      return { x: 12, y: Math.min(h * 0.18, 26) }
    case "star":
      return { x: w * 0.26, y: h * 0.3 }
    case "cross":
      return { x: w * 0.34, y: h * 0.34 }
    case "arrowBlock":
      return { x: 14, y: h * 0.27 }
    default:
      return { x: 10, y: 10 }
  }
}
