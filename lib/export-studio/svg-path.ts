/**
 * Tracciati per l'esportazione vettoriale: tutto diventa una sequenza di
 * spostamenti, linee e curve di Bézier cubiche in coordinate assolute, che il
 * PDF e l'SVG sanno disegnare così come sono. Si leggono l'attributo `d`
 * degli SVG (con archi, curve quadratiche e forme abbreviate) e le forme
 * semplici (rettangoli anche arrotondati, cerchi, ellissi, linee, poligoni).
 */

export type Seg =
  | { op: "M"; x: number; y: number }
  | { op: "L"; x: number; y: number }
  | {
      op: "C"
      x1: number
      y1: number
      x2: number
      y2: number
      x: number
      y: number
    }
  | { op: "Z" }

export type Matrix = [number, number, number, number, number, number]

export const IDENTITY: Matrix = [1, 0, 0, 1, 0, 0]

export function apply(m: Matrix, x: number, y: number): [number, number] {
  return [m[0] * x + m[2] * y + m[4], m[1] * x + m[3] * y + m[5]]
}

/** Il tracciato con la trasformazione applicata ai punti */
export function transform(path: Seg[], m: Matrix): Seg[] {
  return path.map((s) => {
    if (s.op === "Z") return s
    if (s.op === "C") {
      const [x1, y1] = apply(m, s.x1, s.y1)
      const [x2, y2] = apply(m, s.x2, s.y2)
      const [x, y] = apply(m, s.x, s.y)
      return { op: "C", x1, y1, x2, y2, x, y }
    }
    const [x, y] = apply(m, s.x, s.y)
    return { op: s.op, x, y }
  })
}

/** Il riquadro che contiene il tracciato (punti di controllo compresi) */
export function bounds(path: Seg[]): [number, number, number, number] | null {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  const add = (x: number, y: number) => {
    if (x < x0) x0 = x
    if (y < y0) y0 = y
    if (x > x1) x1 = x
    if (y > y1) y1 = y
  }
  for (const s of path) {
    if (s.op === "Z") continue
    if (s.op === "C") {
      add(s.x1, s.y1)
      add(s.x2, s.y2)
    }
    add(s.x, s.y)
  }
  return x0 <= x1 ? [x0, y0, x1, y1] : null
}

/* -------------------------------- forme --------------------------------- */

const K = 0.5522847498 // 4/3·(√2 − 1): quarti di cerchio con le Bézier

export function ellipsePath(
  cx: number,
  cy: number,
  rx: number,
  ry: number
): Seg[] {
  const ox = rx * K
  const oy = ry * K
  return [
    { op: "M", x: cx + rx, y: cy },
    {
      op: "C",
      x1: cx + rx,
      y1: cy + oy,
      x2: cx + ox,
      y2: cy + ry,
      x: cx,
      y: cy + ry,
    },
    {
      op: "C",
      x1: cx - ox,
      y1: cy + ry,
      x2: cx - rx,
      y2: cy + oy,
      x: cx - rx,
      y: cy,
    },
    {
      op: "C",
      x1: cx - rx,
      y1: cy - oy,
      x2: cx - ox,
      y2: cy - ry,
      x: cx,
      y: cy - ry,
    },
    {
      op: "C",
      x1: cx + ox,
      y1: cy - ry,
      x2: cx + rx,
      y2: cy - oy,
      x: cx + rx,
      y: cy,
    },
    { op: "Z" },
  ]
}

/** Rettangolo con angoli arrotondati; i raggi sono [tl, tr, br, bl] */
export function roundRectPath(
  x: number,
  y: number,
  w: number,
  h: number,
  radii: [number, number, number, number] = [0, 0, 0, 0]
): Seg[] {
  // raggi troppo grandi si riducono insieme, come fa il CSS
  const f = Math.min(
    1,
    w / Math.max(1e-6, radii[0] + radii[1]),
    w / Math.max(1e-6, radii[3] + radii[2]),
    h / Math.max(1e-6, radii[0] + radii[3]),
    h / Math.max(1e-6, radii[1] + radii[2])
  )
  const [tl, tr, br, bl] = radii.map((r) => Math.max(0, r * f))
  if (tl + tr + br + bl < 0.01) {
    return [
      { op: "M", x, y },
      { op: "L", x: x + w, y },
      { op: "L", x: x + w, y: y + h },
      { op: "L", x, y: y + h },
      { op: "Z" },
    ]
  }
  const out: Seg[] = [{ op: "M", x: x + tl, y }]
  out.push({ op: "L", x: x + w - tr, y })
  if (tr)
    out.push({
      op: "C",
      x1: x + w - tr + tr * K,
      y1: y,
      x2: x + w,
      y2: y + tr - tr * K,
      x: x + w,
      y: y + tr,
    })
  out.push({ op: "L", x: x + w, y: y + h - br })
  if (br)
    out.push({
      op: "C",
      x1: x + w,
      y1: y + h - br + br * K,
      x2: x + w - br + br * K,
      y2: y + h,
      x: x + w - br,
      y: y + h,
    })
  out.push({ op: "L", x: x + bl, y: y + h })
  if (bl)
    out.push({
      op: "C",
      x1: x + bl - bl * K,
      y1: y + h,
      x2: x,
      y2: y + h - bl + bl * K,
      x,
      y: y + h - bl,
    })
  out.push({ op: "L", x, y: y + tl })
  if (tl)
    out.push({
      op: "C",
      x1: x,
      y1: y + tl - tl * K,
      x2: x + tl - tl * K,
      y2: y,
      x: x + tl,
      y,
    })
  out.push({ op: "Z" })
  return out
}

export function polyPath(points: number[], close: boolean): Seg[] {
  const out: Seg[] = []
  for (let i = 0; i + 1 < points.length; i += 2) {
    out.push({ op: i === 0 ? "M" : "L", x: points[i], y: points[i + 1] })
  }
  if (close && out.length) out.push({ op: "Z" })
  return out
}

/* -------------------------------- archi --------------------------------- */

/** Un arco SVG in curve cubiche (algoritmo delle specifiche SVG, F.6) */
function arcToCubics(
  x1: number,
  y1: number,
  rx: number,
  ry: number,
  angle: number,
  large: boolean,
  sweep: boolean,
  x2: number,
  y2: number
): Seg[] {
  if (rx === 0 || ry === 0 || (x1 === x2 && y1 === y2)) {
    return [{ op: "L", x: x2, y: y2 }]
  }
  const phi = (angle * Math.PI) / 180
  const cos = Math.cos(phi)
  const sin = Math.sin(phi)
  const dx = (x1 - x2) / 2
  const dy = (y1 - y2) / 2
  const xp = cos * dx + sin * dy
  const yp = -sin * dx + cos * dy
  rx = Math.abs(rx)
  ry = Math.abs(ry)
  const lambda = (xp * xp) / (rx * rx) + (yp * yp) / (ry * ry)
  if (lambda > 1) {
    rx *= Math.sqrt(lambda)
    ry *= Math.sqrt(lambda)
  }
  const sign = large === sweep ? -1 : 1
  const num = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp
  const den = rx * rx * yp * yp + ry * ry * xp * xp
  const coef = sign * Math.sqrt(Math.max(0, num / den))
  const cxp = (coef * rx * yp) / ry
  const cyp = (-coef * ry * xp) / rx
  const cx = cos * cxp - sin * cyp + (x1 + x2) / 2
  const cy = sin * cxp + cos * cyp + (y1 + y2) / 2
  const vAngle = (ux: number, uy: number, vx: number, vy: number) => {
    const a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy)
    return a
  }
  const theta1 = vAngle(1, 0, (xp - cxp) / rx, (yp - cyp) / ry)
  let delta = vAngle(
    (xp - cxp) / rx,
    (yp - cyp) / ry,
    (-xp - cxp) / rx,
    (-yp - cyp) / ry
  )
  if (!sweep && delta > 0) delta -= 2 * Math.PI
  else if (sweep && delta < 0) delta += 2 * Math.PI
  const parts = Math.max(1, Math.ceil(Math.abs(delta) / (Math.PI / 2)))
  const step = delta / parts
  const t = (4 / 3) * Math.tan(step / 4)
  const out: Seg[] = []
  let a = theta1
  const point = (angle2: number) => {
    const ex = rx * Math.cos(angle2)
    const ey = ry * Math.sin(angle2)
    return [cos * ex - sin * ey + cx, sin * ex + cos * ey + cy]
  }
  for (let i = 0; i < parts; i++) {
    const b = a + step
    const [sx, sy] = point(a)
    const [ex, ey] = point(b)
    const d1x = -rx * Math.sin(a)
    const d1y = ry * Math.cos(a)
    const d2x = -rx * Math.sin(b)
    const d2y = ry * Math.cos(b)
    out.push({
      op: "C",
      x1: sx + t * (cos * d1x - sin * d1y),
      y1: sy + t * (sin * d1x + cos * d1y),
      x2: ex - t * (cos * d2x - sin * d2y),
      y2: ey - t * (sin * d2x + cos * d2y),
      x: ex,
      y: ey,
    })
    a = b
  }
  return out
}

/* ------------------------------ attributo d ----------------------------- */

const ARGS: Record<string, number> = {
  M: 2,
  L: 2,
  H: 1,
  V: 1,
  C: 6,
  S: 4,
  Q: 4,
  T: 2,
  A: 7,
  Z: 0,
}

function tokenize(d: string) {
  const out: (string | number)[] = []
  const re =
    /([MmLlHhVvCcSsQqTtAaZz])|([-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = re.exec(d))) out.push(m[1] ?? Number(m[2]))
  return out
}

/**
 * L'attributo `d` in segmenti assoluti. Nei comandi d'arco i due flag possono
 * essere attaccati («a1 1 0 01 10 10»): si leggono cifra per cifra.
 */
export function parsePath(d: string): Seg[] {
  const tokens = tokenize(d.replace(/([aA][^a-zA-Z]*)/g, (m) => splitFlags(m)))
  const out: Seg[] = []
  let cmd = ""
  let i = 0
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  // ultimo punto di controllo, per S e T
  let cx = 0
  let cy = 0
  let prev = ""
  const num = () => {
    const v = tokens[i++]
    return typeof v === "number" ? v : NaN
  }
  while (i < tokens.length) {
    const t = tokens[i]
    if (typeof t === "string") {
      cmd = t
      i++
      if (cmd === "Z" || cmd === "z") {
        out.push({ op: "Z" })
        x = sx
        y = sy
        prev = "Z"
        continue
      }
    } else if (!cmd) {
      i++
      continue
    }
    const upper = cmd.toUpperCase()
    const rel = cmd !== upper
    const need = ARGS[upper] ?? 0
    if (need && i + need > tokens.length) break
    if (need && tokens.slice(i, i + need).some((v) => typeof v !== "number")) {
      i++
      continue
    }
    const ox = rel ? x : 0
    const oy = rel ? y : 0
    switch (upper) {
      case "M": {
        x = ox + num()
        y = oy + num()
        sx = x
        sy = y
        out.push({ op: "M", x, y })
        // coppie dopo M sono linee
        cmd = rel ? "l" : "L"
        break
      }
      case "L":
        x = ox + num()
        y = oy + num()
        out.push({ op: "L", x, y })
        break
      case "H":
        x = (rel ? x : 0) + num()
        out.push({ op: "L", x, y })
        break
      case "V":
        y = (rel ? y : 0) + num()
        out.push({ op: "L", x, y })
        break
      case "C": {
        const x1 = ox + num()
        const y1 = oy + num()
        const x2 = ox + num()
        const y2 = oy + num()
        x = ox + num()
        y = oy + num()
        out.push({ op: "C", x1, y1, x2, y2, x, y })
        cx = x2
        cy = y2
        break
      }
      case "S": {
        const x1 = prev === "C" || prev === "S" ? 2 * x - cx : x
        const y1 = prev === "C" || prev === "S" ? 2 * y - cy : y
        const x2 = ox + num()
        const y2 = oy + num()
        x = ox + num()
        y = oy + num()
        out.push({ op: "C", x1, y1, x2, y2, x, y })
        cx = x2
        cy = y2
        break
      }
      case "Q":
      case "T": {
        let qx: number
        let qy: number
        if (upper === "Q") {
          qx = ox + num()
          qy = oy + num()
        } else {
          qx = prev === "Q" || prev === "T" ? 2 * x - cx : x
          qy = prev === "Q" || prev === "T" ? 2 * y - cy : y
        }
        const ex = ox + num()
        const ey = oy + num()
        out.push({
          op: "C",
          x1: x + (2 / 3) * (qx - x),
          y1: y + (2 / 3) * (qy - y),
          x2: ex + (2 / 3) * (qx - ex),
          y2: ey + (2 / 3) * (qy - ey),
          x: ex,
          y: ey,
        })
        cx = qx
        cy = qy
        x = ex
        y = ey
        break
      }
      case "A": {
        const rx = num()
        const ry = num()
        const rot = num()
        const large = num() !== 0
        const sweep = num() !== 0
        const ex = ox + num()
        const ey = oy + num()
        out.push(...arcToCubics(x, y, rx, ry, rot, large, sweep, ex, ey))
        x = ex
        y = ey
        break
      }
      default:
        i++
    }
    prev = upper
  }
  return out
}

/** Separa i flag degli archi scritti attaccati: «0 01 10» → «0 0 1 10» */
function splitFlags(chunk: string) {
  const cmd = chunk[0]
  const nums =
    chunk.slice(1).match(/[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/g) ?? []
  const out: string[] = []
  let k = 0
  let raw = chunk.slice(1)
  // si rileggono i numeri tenendo conto dei flag a una cifra
  const re = /[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/y
  let pos = 0
  const skip = () => {
    while (pos < raw.length && /[\s,]/.test(raw[pos])) pos++
  }
  while (pos < raw.length) {
    skip()
    if (pos >= raw.length) break
    const slot = k % 7
    if (slot === 3 || slot === 4) {
      // un flag è una cifra sola
      if (raw[pos] === "0" || raw[pos] === "1") {
        out.push(raw[pos])
        pos++
        k++
        continue
      }
    }
    re.lastIndex = pos
    const m = re.exec(raw)
    if (!m) {
      pos++
      continue
    }
    out.push(m[0])
    pos = re.lastIndex
    k++
  }
  raw = ""
  return nums.length ? `${cmd} ${out.join(" ")} ` : chunk
}
