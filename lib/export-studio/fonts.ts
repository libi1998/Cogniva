"use client"

import type { Font, PathCommand } from "fontkit"

/**
 * I caratteri per l'esportazione vettoriale.
 *
 * Il testo del PDF si disegna con i contorni veri delle lettere, presi dagli
 * stessi file che usa il browser: le @font-face dei fogli di stile dell'app
 * (next/font e i cento caratteri in fonts/). Così il PDF è uguale al foglio,
 * nitido a ogni ingrandimento, anche con i caratteri «variabili» che hanno
 * tutti i pesi in un file solo — incorporati come caratteri PDF perderebbero
 * il grassetto. Sopra c'è comunque il testo vero, invisibile, per cercare e
 * copiare (vedi pdf.ts).
 *
 * fontkit legge i woff2 ma non applica le variazioni ai loro contorni: qui
 * lo si fa a mano, dalla tabella gvar, glifo per glifo.
 */

type Face = {
  family: string
  italic: boolean
  wMin: number
  wMax: number
  /** intervalli di unicode-range; null = tutti */
  ranges: [number, number][] | null
  url: string
}

export type ResolvedFace = {
  /** chiave unica di file + peso: identifica i glifi */
  key: string
  font: Font
  /** il browser inspessisce o inclina un carattere che non ha quel peso/stile */
  synthBold: boolean
  synthItalic: boolean
}

type FontkitModule = typeof import("fontkit")

/* ------------------------------ @font-face ------------------------------ */

const unquote = (value: string) => value.trim().replace(/^["']|["']$/g, "")

/** Le famiglie di una proprietà font-family, in ordine */
export function familyList(value: string): string[] {
  const out: string[] = []
  let current = ""
  let quote = ""
  for (const ch of value) {
    if (quote) {
      if (ch === quote) quote = ""
      else current += ch
    } else if (ch === '"' || ch === "'") quote = ch
    else if (ch === ",") {
      out.push(current.trim())
      current = ""
    } else current += ch
  }
  if (current.trim()) out.push(current.trim())
  return out.filter(Boolean).map((f) => f.toLowerCase())
}

function parseRanges(text: string): [number, number][] | null {
  if (!text.trim()) return null
  const out: [number, number][] = []
  for (const part of text.split(",")) {
    const token = part.trim().replace(/^u\+/i, "")
    if (!token) continue
    if (token.includes("?")) {
      out.push([
        parseInt(token.replace(/\?/g, "0"), 16),
        parseInt(token.replace(/\?/g, "F"), 16),
      ])
      continue
    }
    const [a, b] = token.split("-")
    const from = parseInt(a, 16)
    const to = b ? parseInt(b, 16) : from
    if (!Number.isNaN(from)) out.push([from, Number.isNaN(to) ? from : to])
  }
  return out.length ? out : null
}

function parseWeight(text: string): [number, number] {
  const words = text.trim().split(/\s+/)
  const value = (w: string) =>
    w === "bold" ? 700 : w === "normal" || !w ? 400 : Number(w) || 400
  const a = value(words[0] ?? "")
  const b = words[1] ? value(words[1]) : a
  return [Math.min(a, b), Math.max(a, b)]
}

function collectFaces(doc: Document): Face[] {
  const faces: Face[] = []
  const visit = (rules: CSSRuleList, base: string) => {
    for (const rule of Array.from(rules)) {
      // @media e @supports possono contenere @font-face
      if ("cssRules" in rule && !(rule instanceof CSSFontFaceRule)) {
        try {
          visit((rule as CSSGroupingRule).cssRules, base)
        } catch {
          // regole non leggibili: si salta
        }
        continue
      }
      if (!(rule instanceof CSSFontFaceRule)) continue
      const style = rule.style
      const family = unquote(
        style.getPropertyValue("font-family")
      ).toLowerCase()
      const src = style.getPropertyValue("src")
      // il primo woff2/woff/ttf dichiarato
      const match = src.match(/url\((["']?)([^"')]+)\1\)/)
      if (!family || !match) continue
      let url: string
      try {
        url = new URL(match[2], base).href
      } catch {
        continue
      }
      const [wMin, wMax] = parseWeight(style.getPropertyValue("font-weight"))
      faces.push({
        family,
        italic: /italic|oblique/.test(style.getPropertyValue("font-style")),
        wMin,
        wMax,
        ranges: parseRanges(style.getPropertyValue("unicode-range")),
        url,
      })
    }
  }
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules
    } catch {
      continue
    }
    visit(rules, sheet.href ?? doc.baseURI)
  }
  return faces
}

const covers = (face: Face, cp: number) =>
  !face.ranges || face.ranges.some(([a, b]) => cp >= a && cp <= b)

/** La @font-face che il browser sceglierebbe, secondo le regole del CSS */
function pickFace(faces: Face[], weight: number, italic: boolean): Face | null {
  if (!faces.length) return null
  const styled = faces.filter((f) => f.italic === italic)
  const pool = styled.length ? styled : faces
  const exact = pool.find((f) => weight >= f.wMin && weight <= f.wMax)
  if (exact) return exact
  // più vicino, preferendo i pesi più chiari sotto 400 e più scuri sopra 500
  const distance = (f: Face) => {
    const d = weight < f.wMin ? f.wMin - weight : weight - f.wMax
    const heavier = f.wMin > weight
    const prefer = weight > 500 ? heavier : !heavier
    return d + (prefer ? 0 : 1000)
  }
  return pool.reduce((best, f) => (distance(f) < distance(best) ? f : best))
}

/* ------------------------- variazioni nei woff2 ------------------------- */

type WithInternals = Font & {
  _variationProcessor?: unknown
  _transformGlyfTable?: () => void
}

const patchedGlyphs = new WeakSet<object>()

/**
 * Un'istanza del carattere con i pesi scelti. fontkit sbaglia con i woff2:
 * `getVariation` perde la tabella dei caratteri, e i contorni decodificati in
 * anticipo non ricevono mai le variazioni. Qui l'istanza si crea dal file e le
 * variazioni si applicano quando si legge il glifo.
 */
export function createInstance(
  fontkit: FontkitModule,
  bytes: Uint8Array,
  coords: number[] | null
): Font {
  const font = fontkit.create(bytes) as WithInternals
  if (!coords) return font
  font.variationCoords = coords
  let proto: object | null = Object.getPrototypeOf(font)
  let desc: PropertyDescriptor | undefined
  while (
    proto &&
    !(desc = Object.getOwnPropertyDescriptor(proto, "_variationProcessor"))
  ) {
    proto = Object.getPrototypeOf(proto)
  }
  const transform = font._transformGlyfTable
  if (!desc?.get || !transform) return font
  let decoding = false
  const getter = desc.get
  Object.defineProperty(font, "_variationProcessor", {
    configurable: true,
    get() {
      // mentre il woff2 si decodifica le variazioni non valgono ancora
      if (decoding) return null
      delete (this as WithInternals)._variationProcessor
      return getter.call(this)
    },
  })
  font._transformGlyfTable = function (this: WithInternals) {
    decoding = true
    try {
      return transform.call(this)
    } finally {
      decoding = false
    }
  }
  const glyphProto = Object.getPrototypeOf(font.getGlyph(0)) as {
    _decode: (this: GlyphInternals) => DecodedGlyph | null
  }
  if (!patchedGlyphs.has(glyphProto)) {
    patchedGlyphs.add(glyphProto)
    const decode = glyphProto._decode
    glyphProto._decode = function (this: GlyphInternals) {
      const base = decode.call(this)
      const processor = this._font._variationProcessor as
        | { transformPoints: (id: number, points: PointLike[]) => void }
        | null
        | undefined
      if (!base || !processor) return base
      if (this._varied) return this._varied
      const glyph: DecodedGlyph = { ...base }
      if (base.numberOfContours > 0 && base.points?.length) {
        const Point = base.points[0].constructor as PointCtor
        glyph.points = base.points.map((p) => p.copy())
        const points = [...glyph.points, ...phantoms(Point)]
        processor.transformPoints(this.id, points)
      } else if (base.numberOfContours < 0 && base.components?.length) {
        const component = this._font.getGlyph(
          base.components[0].glyphID
        ) as unknown as { _decode: () => DecodedGlyph | null }
        const sample = component._decode()
        const Point = sample?.points?.[0]?.constructor as PointCtor | undefined
        if (Point) {
          glyph.components = base.components.map((c) => ({ ...c }))
          const points = [
            ...glyph.components.map((c) => new Point(true, true, c.dx, c.dy)),
            ...phantoms(Point),
          ]
          processor.transformPoints(this.id, points)
          glyph.components.forEach((c, i) => {
            c.dx = points[i].x
            c.dy = points[i].y
          })
        }
      }
      this._varied = glyph
      return glyph
    }
  }
  return font
}

type PointLike = { x: number; y: number; copy: () => PointLike }
type PointCtor = new (
  onCurve: boolean,
  endContour: boolean,
  x: number,
  y: number
) => PointLike
type DecodedGlyph = {
  numberOfContours: number
  points?: PointLike[]
  components?: { glyphID: number; dx: number; dy: number }[]
}
type GlyphInternals = {
  id: number
  _font: WithInternals
  _varied?: DecodedGlyph
}

// i quattro punti «fantasma» che gvar si aspetta dopo quelli del glifo
const phantoms = (Point: PointCtor) =>
  [0, 1, 2, 3].map(() => new Point(false, true, 0, 0))

/* ------------------------------ la raccolta ----------------------------- */

export type GlyphOutline = {
  commands: PathCommand[]
  bbox: { minX: number; minY: number; maxX: number; maxY: number }
}

export class FontLibrary {
  private faces: Face[]
  private byFamily = new Map<string, Face[]>()
  private files = new Map<string, Promise<Uint8Array | null>>()
  private fonts = new Map<string, Promise<Font | null>>()
  private outlines = new Map<string, GlyphOutline>()

  private constructor(
    doc: Document,
    private fontkit: FontkitModule
  ) {
    this.faces = collectFaces(doc)
    for (const face of this.faces) {
      const list = this.byFamily.get(face.family) ?? []
      list.push(face)
      this.byFamily.set(face.family, list)
    }
  }

  static async create(doc: Document) {
    const fontkit = await import("fontkit")
    return new FontLibrary(doc, fontkit)
  }

  private bytes(url: string) {
    let job = this.files.get(url)
    if (!job) {
      job = fetch(url)
        .then((res) => (res.ok ? res.arrayBuffer() : null))
        .then((buf) => (buf ? new Uint8Array(buf) : null))
        .catch(() => null)
      this.files.set(url, job)
    }
    return job
  }

  private load(face: Face, weight: number) {
    const variable = face.wMin !== face.wMax
    const w = Math.max(face.wMin, Math.min(face.wMax, weight))
    const key = variable ? `${face.url}@${w}` : face.url
    let job = this.fonts.get(key)
    if (!job) {
      job = this.bytes(face.url).then((bytes) => {
        if (!bytes) return null
        try {
          const probe = this.fontkit.create(bytes)
          const axes = probe.variationAxes ?? {}
          const tags = Object.keys(axes)
          if (!variable || !tags.includes("wght")) return probe
          const coords = tags.map((tag) =>
            tag === "wght"
              ? Math.max(axes[tag].min, Math.min(axes[tag].max, w))
              : axes[tag].default
          )
          return createInstance(this.fontkit, bytes, coords)
        } catch {
          return null
        }
      })
      this.fonts.set(key, job)
    }
    return job.then((font) => (font ? { key, font } : null))
  }

  /**
   * Il carattere che disegna un carattere (codepoint) con la famiglia, il
   * peso e lo stile dati, come lo sceglierebbe il browser; null se nessuna
   * @font-face lo ha (caratteri di sistema, emoji).
   */
  async resolve(
    families: string[],
    weight: number,
    italic: boolean,
    cp: number
  ): Promise<ResolvedFace | null> {
    for (const family of families) {
      const faces = (this.byFamily.get(family) ?? []).filter((f) =>
        covers(f, cp)
      )
      const face = pickFace(faces, weight, italic)
      if (!face) continue
      const loaded = await this.load(face, weight)
      if (!loaded || !loaded.font.hasGlyphForCodePoint(cp)) continue
      return {
        ...loaded,
        synthBold: weight >= 600 && face.wMax < 600,
        synthItalic: italic && !face.italic,
      }
    }
    return null
  }

  /** Il contorno di un glifo, in unità del carattere (y verso l'alto) */
  outline(face: ResolvedFace, glyphId: number): GlyphOutline {
    const key = `${face.key}#${glyphId}`
    let out = this.outlines.get(key)
    if (!out) {
      try {
        const path = face.font.getGlyph(glyphId).path
        out = { commands: path.commands, bbox: path.bbox }
      } catch {
        out = { commands: [], bbox: { minX: 0, minY: 0, maxX: 0, maxY: 0 } }
      }
      this.outlines.set(key, out)
    }
    return out
  }
}
