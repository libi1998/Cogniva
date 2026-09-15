"use client"

/**
 * Trasforma un path SVG in una versione "disegnata a mano".
 * Campiona il tracciato, sposta i punti con un rumore deterministico
 * e ricostruisce una curva morbida (Catmull-Rom → Bézier).
 */

const NS = "http://www.w3.org/2000/svg"
let measurer: SVGPathElement | null = null

function getMeasurer(): SVGPathElement | null {
  if (typeof document === "undefined") return null
  if (measurer) return measurer
  const svg = document.createElementNS(NS, "svg")
  svg.setAttribute("width", "0")
  svg.setAttribute("height", "0")
  svg.style.position = "absolute"
  svg.style.pointerEvents = "none"
  svg.style.opacity = "0"
  svg.setAttribute("aria-hidden", "true")
  const path = document.createElementNS(NS, "path")
  svg.appendChild(path)
  document.body.appendChild(svg)
  measurer = path
  return measurer
}

function mulberry32(a: number) {
  return function () {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

type P = { x: number; y: number }

function catmullRom(pts: P[]): string {
  if (pts.length < 2) return ""
  let d = `M ${r(pts[0].x)} ${r(pts[0].y)}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]
    const p1 = pts[i]
    const p2 = pts[i + 1]
    const p3 = pts[i + 2] ?? p2
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C ${r(c1.x)} ${r(c1.y)} ${r(c2.x)} ${r(c2.y)} ${r(p2.x)} ${r(p2.y)}`
  }
  return d
}

function r(n: number) {
  return Math.round(n * 100) / 100
}

export function sketchify(
  d: string,
  seed: number,
  amplitude = 2.4
): string | null {
  const m = getMeasurer()
  if (!m || !d) return null
  try {
    m.setAttribute("d", d)
    const len = m.getTotalLength()
    if (!len || !isFinite(len)) return null
    const steps = Math.max(5, Math.min(48, Math.round(len / 18)))
    const rnd = mulberry32(seed)
    const pts: P[] = []
    for (let i = 0; i <= steps; i++) {
      const t = i / steps
      const pt = m.getPointAtLength(len * t)
      // ampiezza nulla agli estremi, massima al centro
      const amp = Math.sin(Math.PI * t) ** 0.7 * amplitude
      pts.push({
        x: pt.x + (rnd() - 0.5) * 2 * amp,
        y: pt.y + (rnd() - 0.5) * 2 * amp,
      })
    }
    return catmullRom(pts)
  } catch {
    return null
  }
}
