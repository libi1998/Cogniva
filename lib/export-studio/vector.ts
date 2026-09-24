"use client"

import { FontLibrary, familyList, type ResolvedFace } from "./fonts"
import {
  apply,
  bounds,
  ellipsePath,
  parsePath,
  polyPath,
  roundRectPath,
  transform,
  type Matrix,
  type Seg,
} from "./svg-path"

/**
 * La pagina come disegno vettoriale.
 *
 * Si ripercorre il foglio già impaginato nella stanza isolata (lo stesso che
 * serve per le anteprime) e ogni cosa diventa un oggetto da disegnare, nelle
 * coordinate del foglio in pixel CSS con l'asse y verso il basso:
 *
 * - sfondi e bordi dei blocchi, delle celle, delle evidenziazioni;
 * - il testo, parola per parola, con i contorni veri delle lettere nel punto
 *   esatto in cui il browser le ha messe (vedi fonts.ts);
 * - gli SVG — forme, grafici, board, icone, formule — tracciato per
 *   tracciato, e le immagini come immagini;
 * - i numeri e i punti degli elenchi, che non sono testo del documento;
 * - i collegamenti, che nel PDF restano cliccabili.
 *
 * Quello che non ha un equivalente vettoriale (effetti del testo, filtri,
 * elementi ruotati) si disegna come immagine solo lui, ad alta risoluzione.
 */

export type RGBA = [number, number, number, number]
export type Box = [number, number, number, number]

export type Stroke = {
  color: RGBA
  width: number
  dash?: number[]
  cap?: 0 | 1 | 2
  join?: 0 | 1 | 2
}

export type ImageAsset = {
  id: string
  /** pixel dell'immagine: JPEG o RGB compresso, con la trasparenza a parte */
  encode: () => Promise<EncodedImage | null>
}

export type EncodedImage =
  | {
      kind: "jpeg"
      data: Uint8Array
      width: number
      height: number
      gray: boolean
    }
  | {
      kind: "raw"
      /** RGB (o grigio) non compresso: lo comprime chi scrive il file */
      data: Uint8Array
      alpha: Uint8Array | null
      width: number
      height: number
      gray: boolean
    }

export type Paint =
  | {
      kind: "path"
      segs: Seg[]
      fill?: RGBA
      evenOdd?: boolean
      stroke?: Stroke
      bbox: Box
    }
  | {
      kind: "glyph"
      face: ResolvedFace
      glyph: number
      /** dalle unità del carattere (y in su) al foglio (y in giù) */
      m: Matrix
      color: RGBA
      bbox: Box
    }
  | { kind: "image"; asset: ImageAsset; m: Matrix; bbox: Box; alpha?: number }
  | {
      kind: "group"
      clip?: Seg[]
      alpha?: number
      children: Paint[]
      bbox: Box
    }
  | { kind: "link"; href: string; bbox: Box }

export type Scene = {
  paints: Paint[]
  fonts: FontLibrary
}

export type VectorOptions = {
  /** pixel per pixel CSS delle immagini: 1, 2 o 3,125 */
  scale: number
  /** qualità JPEG delle foto; con `lossless` niente JPEG */
  jpeg: number
  lossless: boolean
  gray: boolean
}

/* -------------------------------- colori -------------------------------- */

const colorCache = new Map<string, RGBA>()
let probe: CanvasRenderingContext2D | null = null

/**
 * Qualsiasi colore CSS (anche oklch, color-mix, color()) in RGBA: lo dipinge
 * un canvas grande un pixel, che sa leggerli tutti.
 */
export function parseColor(value: string | null | undefined): RGBA {
  const text = (value ?? "").trim()
  if (!text || text === "none" || text === "transparent") return [0, 0, 0, 0]
  const cached = colorCache.get(text)
  if (cached) return cached
  let out: RGBA = [0, 0, 0, 0]
  const m =
    /^rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:\s*[,/]\s*([\d.]+%?))?\s*\)$/i.exec(
      text
    )
  if (m) {
    const a = m[4]
      ? m[4].endsWith("%")
        ? parseFloat(m[4]) / 100
        : parseFloat(m[4])
      : 1
    out = [Number(m[1]) / 255, Number(m[2]) / 255, Number(m[3]) / 255, a]
  } else {
    probe ??= document
      .createElement("canvas")
      .getContext("2d", { willReadFrequently: true })
    if (probe) {
      probe.clearRect(0, 0, 1, 1)
      probe.fillStyle = "#000"
      probe.fillStyle = text
      probe.fillRect(0, 0, 1, 1)
      const px = probe.getImageData(0, 0, 1, 1).data
      const a = px[3] / 255
      out = a
        ? ([px[0] / 255 / a, px[1] / 255 / a, px[2] / 255 / a, a].map((v, i) =>
            i < 3 ? Math.min(1, v) : v
          ) as RGBA)
        : [0, 0, 0, 0]
    }
  }
  colorCache.set(text, out)
  return out
}

/* ------------------------------- supporto ------------------------------- */

const union = (a: Box | null, b: Box | null): Box | null =>
  !a
    ? b
    : !b
      ? a
      : [
          Math.min(a[0], b[0]),
          Math.min(a[1], b[1]),
          Math.max(a[2], b[2]),
          Math.max(a[3], b[3]),
        ]

const boxOf = (paints: Paint[]): Box =>
  paints.reduce<Box | null>((acc, p) => union(acc, p.bbox), null) ?? [
    0, 0, 0, 0,
  ]

/** m1 · m2: prima m2, poi m1 */
export function multiply(m1: Matrix, m2: Matrix): Matrix {
  return [
    m1[0] * m2[0] + m1[2] * m2[1],
    m1[1] * m2[0] + m1[3] * m2[1],
    m1[0] * m2[2] + m1[2] * m2[3],
    m1[1] * m2[2] + m1[3] * m2[3],
    m1[0] * m2[4] + m1[2] * m2[5] + m1[4],
    m1[1] * m2[4] + m1[3] * m2[5] + m1[5],
  ]
}

const px = (value: string) => parseFloat(value) || 0

/** I raggi degli angoli di un elemento, in pixel */
function radii(cs: CSSStyleDeclaration): [number, number, number, number] {
  return [
    px(cs.borderTopLeftRadius),
    px(cs.borderTopRightRadius),
    px(cs.borderBottomRightRadius),
    px(cs.borderBottomLeftRadius),
  ]
}

const SKIP = [
  "script",
  "style",
  "template",
  "noscript",
  "iframe",
  "[data-guide]",
  "[data-block-handle]",
  ".doc-block-drop",
  "[data-band-editor]",
  ".doc-mark",
  ".katex-mathml",
].join(",")

/* -------------------------------- scena --------------------------------- */

export async function paintNode(
  node: HTMLElement,
  opts: VectorOptions
): Promise<Scene> {
  const doc = node.ownerDocument
  const view = doc.defaultView
  if (!view) throw new Error("vector: no window")
  const fonts = await FontLibrary.create(doc)
  const origin = node.getBoundingClientRect()
  const ox = origin.left
  const oy = origin.top
  const toDoc: Matrix = [1, 0, 0, 1, -ox, -oy]
  const styles = new Map<Element, CSSStyleDeclaration>()
  const style = (el: Element) => {
    let cs = styles.get(el)
    if (!cs) {
      cs = view.getComputedStyle(el)
      styles.set(el, cs)
    }
    return cs
  }
  const range = doc.createRange()
  const assets = new Map<string, ImageAsset>()
  const faceCache = new Map<string, Promise<ResolvedFace | null>>()

  const rectBox = (r: DOMRect | DOMRectReadOnly): Box => [
    r.left - ox,
    r.top - oy,
    r.right - ox,
    r.bottom - oy,
  ]

  /* ---- caratteri ---- */

  const faceFor = (cs: CSSStyleDeclaration, cp: number) => {
    const weight = Number(cs.fontWeight) || 400
    const italic = cs.fontStyle !== "normal"
    const key = `${cs.fontFamily}|${weight}|${italic}|${cp}`
    let job = faceCache.get(key)
    if (!job) {
      job = fonts.resolve(
        withFallbacks(familyList(cs.fontFamily)),
        weight,
        italic,
        cp
      )
      faceCache.set(key, job)
    }
    return job
  }

  /** Il carattere di tutta una parola, o null se servono più caratteri */
  const wordFace = async (cs: CSSStyleDeclaration, text: string) => {
    let face: ResolvedFace | null = null
    for (const ch of text) {
      const cp = ch.codePointAt(0) ?? 32
      if (cp <= 32) continue
      const f = await faceFor(cs, cp)
      if (!f) return null
      if (face && f.key !== face.key) return null
      face = f
    }
    return face
  }

  /**
   * Una parola già misurata dal browser: i glifi si mettono sulla sua linea
   * di base e si allargano o stringono appena per occupare la stessa
   * larghezza (spaziatura, giustificazione, piccole differenze di misura).
   */
  const glyphRun = (
    out: Paint[],
    face: ResolvedFace,
    text: string,
    rect: { left: number; top: number; width: number; height: number },
    cs: CSSStyleDeclaration,
    color: RGBA
  ) => {
    const font = face.font
    const size = px(cs.fontSize) || 16
    const upm = font.unitsPerEm || 1000
    const s = size / upm
    const spacing = px(cs.letterSpacing)
    let run
    try {
      run = font.layout(text)
    } catch {
      return false
    }
    let natural = 0
    for (const p of run.positions) natural += p.xAdvance * s + spacing
    const k =
      natural > 0 && rect.width > 0 && Math.abs(rect.width / natural - 1) < 0.3
        ? rect.width / natural
        : 1
    const { asc, desc } = metrics(font)
    const baseline =
      rect.top +
      (rect.height > 0 ? (rect.height * asc) / (asc + desc) : size * 0.8)
    const skew = face.synthItalic ? 0.21 : 0
    let pen = rect.left
    run.glyphs.forEach((glyph, i) => {
      const pos = run.positions[i]
      const x = pen + pos.xOffset * s * k
      const y = baseline - pos.yOffset * s
      pen += (pos.xAdvance * s + spacing) * k
      const outline = fonts.outline(face, glyph.id)
      if (!outline.commands.length) return
      const m: Matrix = [s * k, 0, skew * s, -s, x, y]
      const b = outline.bbox
      const corners = [
        apply(m, b.minX, b.minY),
        apply(m, b.maxX, b.maxY),
        apply(m, b.minX, b.maxY),
        apply(m, b.maxX, b.minY),
      ]
      const xs = corners.map((c) => c[0])
      const ys = corners.map((c) => c[1])
      out.push({
        kind: "glyph",
        face,
        glyph: glyph.id,
        m,
        color,
        bbox: [
          Math.min(...xs),
          Math.min(...ys),
          Math.max(...xs),
          Math.max(...ys),
        ],
      })
    })
    return true
  }

  /** Testo senza un carattere disponibile (emoji, simboli): un'immagine */
  const rasterText = (
    out: Paint[],
    text: string,
    rect: { left: number; top: number; width: number; height: number },
    cs: CSSStyleDeclaration
  ) => {
    const w = Math.max(1, rect.width)
    const h = Math.max(1, rect.height)
    const scale = Math.max(2, opts.scale)
    const id = `text:${text}|${cs.font}|${cs.color}|${w}x${h}`
    let asset = assets.get(id)
    if (!asset) {
      asset = {
        id,
        encode: async () => {
          const canvas = doc.createElement("canvas")
          canvas.width = Math.ceil(w * scale)
          canvas.height = Math.ceil(h * scale)
          const ctx = canvas.getContext("2d")
          if (!ctx) return null
          ctx.scale(scale, scale)
          ctx.font = cs.font
          ctx.fillStyle = cs.color
          ctx.textBaseline = "alphabetic"
          ctx.fillText(text, 0, h * 0.8)
          return encodeCanvas(canvas, opts)
        },
      }
      assets.set(id, asset)
    }
    const x = rect.left
    const y = rect.top
    out.push({
      kind: "image",
      asset,
      m: [w, 0, 0, -h, x, y + h],
      bbox: [x, y, x + w, y + h],
    })
  }

  /** Sottolineato, barrato e sopralineato, dagli elementi che lo portano */
  const decorationsOf = (el: Element) => {
    const out: { line: string; color: RGBA; thickness: number }[] = []
    for (let n: Element | null = el; n && n !== node; n = n.parentElement) {
      const cs = style(n)
      const lines = cs.textDecorationLine
      if (lines && lines !== "none") {
        for (const line of lines.split(/\s+/)) {
          if (!["underline", "line-through", "overline"].includes(line))
            continue
          out.push({
            line,
            color: parseColor(cs.textDecorationColor || cs.color),
            thickness: px(cs.textDecorationThickness),
          })
        }
      }
      if (/^(block|list-item|table-cell|flex|grid|table)/.test(cs.display))
        break
    }
    return out
  }

  const paintText = async (text: Text, parent: Element, out: Paint[]) => {
    const value = text.data
    if (!value.trim()) return
    const cs = style(parent)
    if (cs.visibility === "hidden") return
    const fill = cs.webkitTextFillColor
    const color = parseColor(
      fill && fill !== cs.color && fill !== "currentcolor" ? fill : cs.color
    )
    if (color[3] <= 0.01) return
    const decorations = decorationsOf(parent)
    const upper = cs.textTransform
    const shape = (word: string) =>
      upper === "uppercase"
        ? word.toLocaleUpperCase()
        : upper === "lowercase"
          ? word.toLocaleLowerCase()
          : upper === "capitalize"
            ? word.replace(/^\p{L}/u, (c) => c.toLocaleUpperCase())
            : word

    for (const match of value.matchAll(/\S+/g)) {
      const word = match[0]
      const from = match.index ?? 0
      range.setStart(text, from)
      range.setEnd(text, from + word.length)
      const rects = Array.from(range.getClientRects()).filter(
        (r) => r.width > 0.1 && r.height > 0.1
      )
      if (!rects.length) continue
      // una parola spezzata fra due righe (sillabazione): pezzo per pezzo
      const pieces: { text: string; rect: DOMRect }[] = []
      if (rects.length === 1) pieces.push({ text: word, rect: rects[0] })
      else {
        let current = ""
        let lineTop = NaN
        let piece: DOMRect | null = null
        for (let i = 0; i < word.length; i++) {
          range.setStart(text, from + i)
          range.setEnd(text, from + i + 1)
          const r = range.getClientRects()[0]
          if (!r) continue
          if (piece && Math.abs(r.top - lineTop) > r.height / 2) {
            pieces.push({ text: current, rect: piece })
            current = ""
            piece = null
          }
          current += word[i]
          lineTop = piece ? lineTop : r.top
          piece = piece
            ? new DOMRect(
                piece.left,
                piece.top,
                r.right - piece.left,
                piece.height
              )
            : r
        }
        if (piece && current) pieces.push({ text: current, rect: piece })
      }
      for (const { text: part, rect } of pieces) {
        const shown = shape(part)
        const local = {
          left: rect.left - ox,
          top: rect.top - oy,
          width: rect.width,
          height: rect.height,
        }
        const face = await wordFace(cs, shown)
        let drawn = false
        if (face) drawn = glyphRun(out, face, shown, local, cs, color)
        if (!drawn) rasterText(out, shown, local, cs)
        if (!decorations.length) continue
        // la linea copre anche lo spazio dopo, se sta sulla stessa riga
        let width = local.width
        const next = value.slice(from + word.length).match(/^\s+/)
        if (next && part === word) {
          range.setStart(text, from)
          range.setEnd(text, from + word.length + next[0].length)
          const all = range.getClientRects()
          if (all.length === 1) width = all[0].width
        }
        const size = px(cs.fontSize) || 16
        const m = face ? metrics(face.font) : null
        const baseline =
          local.top +
          (m && local.height > 0
            ? (local.height * m.asc) / (m.asc + m.desc)
            : local.height * 0.8)
        for (const d of decorations) {
          const t = Math.max(
            0.6,
            d.thickness ||
              (face
                ? (face.font.underlineThickness / face.font.unitsPerEm) * size
                : size / 16)
          )
          const y =
            d.line === "underline"
              ? baseline +
                (face
                  ? (-face.font.underlinePosition / face.font.unitsPerEm) * size
                  : size * 0.12)
              : d.line === "line-through"
                ? baseline - size * 0.3
                : local.top
          out.push({
            kind: "path",
            segs: roundRectPath(local.left, y - t / 2, width, t),
            fill: d.color,
            bbox: [local.left, y - t, local.left + width, y + t],
          })
        }
      }
    }
  }

  /* ---- scatole ---- */

  const paintBox = (el: Element, cs: CSSStyleDeclaration, out: Paint[]) => {
    const inline = cs.display === "inline"
    // nelle tabelle a bordi uniti la linea sta a cavallo del bordo della
    // cella, metà dentro e metà nella vicina
    const table =
      el.localName === "td" || el.localName === "th"
        ? el.closest("table")
        : null
    const collapsed = table ? style(table).borderCollapse === "collapse" : false
    const rects = inline
      ? Array.from(el.getClientRects())
      : [el.getBoundingClientRect()]
    const bg = parseColor(cs.backgroundColor)
    const r = inline
      ? ([0, 0, 0, 0] as [number, number, number, number])
      : radii(cs)
    for (const rect of rects) {
      if (rect.width < 0.1 || rect.height < 0.1) continue
      const [x0, y0, x1, y1] = rectBox(rect)
      const w = x1 - x0
      const h = y1 - y0
      if (bg[3] > 0.005) {
        out.push({
          kind: "path",
          segs: roundRectPath(x0, y0, w, h, r),
          fill: bg,
          bbox: [x0, y0, x1, y1],
        })
      }
      const sides = (["Top", "Right", "Bottom", "Left"] as const).map(
        (side) => {
          const kind = cs.getPropertyValue(`border-${side.toLowerCase()}-style`)
          const width = px(
            cs.getPropertyValue(`border-${side.toLowerCase()}-width`)
          )
          const color = parseColor(
            cs.getPropertyValue(`border-${side.toLowerCase()}-color`)
          )
          return {
            kind,
            width,
            color,
            on:
              width > 0 &&
              kind !== "none" &&
              kind !== "hidden" &&
              color[3] > 0.005,
          }
        }
      )
      if (!sides.some((s) => s.on)) continue
      const same =
        sides.every((s) => s.on) &&
        sides.every(
          (s) =>
            s.kind === sides[0].kind &&
            Math.abs(s.width - sides[0].width) < 0.01 &&
            s.color.join() === sides[0].color.join()
        )
      if (same && r.some((v) => v > 0)) {
        const bw = sides[0].width
        out.push({
          kind: "path",
          segs: roundRectPath(
            x0 + bw / 2,
            y0 + bw / 2,
            w - bw,
            h - bw,
            r.map((v) => Math.max(0, v - bw / 2)) as [
              number,
              number,
              number,
              number,
            ]
          ),
          stroke: lineStroke(sides[0].kind, bw, sides[0].color),
          bbox: [x0, y0, x1, y1],
        })
        continue
      }
      const edges: [number, number, number, number][] = [
        [x0, y0, x1, y0],
        [x1, y0, x1, y1],
        [x0, y1, x1, y1],
        [x0, y0, x0, y1],
      ]
      sides.forEach((s, i) => {
        if (!s.on) return
        const [ax, ay, bx, by] = edges[i]
        // la linea sta dentro al bordo, come la disegna il browser
        const inset = collapsed ? 0 : s.width / 2
        const dx = i === 1 ? -inset : i === 3 ? inset : 0
        const dy = i === 0 ? inset : i === 2 ? -inset : 0
        if (s.kind === "double" && s.width >= 3) {
          const t = s.width / 3
          for (const off of [-t, t]) {
            const ex = i === 1 || i === 3 ? off : 0
            const ey = i === 0 || i === 2 ? off : 0
            out.push(
              edgeLine(
                ax + dx + ex,
                ay + dy + ey,
                bx + dx + ex,
                by + dy + ey,
                t,
                s.color,
                "solid"
              )
            )
          }
          return
        }
        out.push(
          edgeLine(ax + dx, ay + dy, bx + dx, by + dy, s.width, s.color, s.kind)
        )
      })
    }
  }

  /* ---- immagini ---- */

  const imageAsset = (
    source: HTMLImageElement | HTMLCanvasElement,
    id: string,
    target: { w: number; h: number }
  ): ImageAsset => {
    let asset = assets.get(id)
    if (!asset) {
      asset = {
        id,
        encode: async () => {
          // gli elementi vengono dall'iframe: instanceof non li riconosce
          const image = "naturalWidth" in source ? source : null
          const natural = image
            ? { w: image.naturalWidth, h: image.naturalHeight }
            : { w: source.width, h: source.height }
          if (!natural.w || !natural.h) return null
          if (image) {
            try {
              await image.decode()
            } catch {
              // già decodificata o non decodificabile: si prova lo stesso
            }
          }
          // abbastanza pixel per la qualità scelta, mai più dell'originale
          const want = Math.min(
            1,
            Math.max(0.02, (target.w * opts.scale * 1.25) / natural.w)
          )
          const width = Math.max(1, Math.round(natural.w * want))
          const height = Math.max(1, Math.round(natural.h * want))
          const canvas = doc.createElement("canvas")
          canvas.width = width
          canvas.height = height
          const ctx = canvas.getContext("2d")
          if (!ctx) return null
          try {
            ctx.drawImage(source, 0, 0, width, height)
          } catch {
            return null
          }
          return encodeCanvas(canvas, opts)
        },
      }
      assets.set(id, asset)
    }
    return asset
  }

  const paintImage = async (
    img: HTMLImageElement,
    cs: CSSStyleDeclaration,
    out: Paint[]
  ) => {
    const rect = img.getBoundingClientRect()
    if (rect.width < 0.5 || rect.height < 0.5) return
    const [x0, y0, x1, y1] = rectBox(rect)
    const src = img.currentSrc || img.src
    const clip = radii(cs).some((v) => v > 0)
      ? roundRectPath(x0, y0, x1 - x0, y1 - y0, radii(cs))
      : undefined
    const items: Paint[] = []
    if (isSvgSource(src)) {
      const markup = await svgText(src)
      if (markup && (await paintSvgMarkup(markup, rect, items))) {
        out.push(group(items, clip ?? roundRectPath(x0, y0, x1 - x0, y1 - y0)))
        return
      }
    }
    if (!img.naturalWidth) return
    // object-fit: dove cade l'immagine dentro al suo riquadro
    const fit = cs.objectFit
    const nat = img.naturalWidth / img.naturalHeight
    let w = x1 - x0
    let h = y1 - y0
    let x = x0
    let y = y0
    if (fit === "contain" || fit === "cover") {
      const box = w / h
      const wider = nat > box
      if ((fit === "contain") === wider) {
        h = w / nat
        y = y0 + (y1 - y0 - h) / 2
      } else {
        w = h * nat
        x = x0 + (x1 - x0 - w) / 2
      }
    }
    items.push({
      kind: "image",
      asset: imageAsset(
        img,
        `img:${src.length > 200 ? `${src.slice(0, 100)}…${src.length}:${src.slice(-60)}` : src}`,
        { w, h }
      ),
      m: [w, 0, 0, -h, x, y + h],
      bbox: [x, y, x + w, y + h],
    })
    out.push(
      clip || fit === "cover"
        ? group(items, clip ?? roundRectPath(x0, y0, x1 - x0, y1 - y0))
        : items[0]
    )
  }

  /* ---- SVG ---- */

  /** Un SVG preso da un'immagine: montato un attimo al suo posto e letto */
  const paintSvgMarkup = async (
    markup: string,
    rect: DOMRect,
    out: Paint[]
  ) => {
    const parsed = new DOMParser().parseFromString(markup, "image/svg+xml")
    const root = parsed.documentElement
    if (
      !root ||
      root.localName !== "svg" ||
      parsed.querySelector("parsererror")
    )
      return false
    const holder = doc.createElement("div")
    holder.style.cssText = `position:fixed;left:${rect.left}px;top:${rect.top}px;width:${rect.width}px;height:${rect.height}px;overflow:hidden;pointer-events:none;margin:0;padding:0;border:0;`
    const svg = doc.importNode(root, true) as unknown as SVGSVGElement
    svg.setAttribute("width", String(rect.width))
    svg.setAttribute("height", String(rect.height))
    svg.style.display = "block"
    holder.appendChild(svg)
    doc.body.appendChild(holder)
    try {
      await paintSvg(svg, out)
    } finally {
      holder.remove()
    }
    return true
  }

  const svgPaintOf = (
    el: SVGElement,
    value: string,
    opacity: number
  ): RGBA | null => {
    if (!value || value === "none") return null
    let color: RGBA
    const url = /url\(["']?#([^"')]+)["']?\)/.exec(value)
    if (url) {
      // sfumature e motivi: il primo colore della sfumatura
      const target =
        el.ownerSVGElement?.getElementById(url[1]) ?? doc.getElementById(url[1])
      const stop = target?.querySelector("stop")
      if (!stop) {
        const rest = value.replace(url[0], "").trim()
        if (!rest) return null
        color = parseColor(rest)
      } else {
        const scs = style(stop)
        color = parseColor(
          scs.stopColor || stop.getAttribute("stop-color") || "#000"
        )
        color = [
          color[0],
          color[1],
          color[2],
          color[3] * (Number(scs.stopOpacity) || 1),
        ]
      }
    } else color = parseColor(value)
    return color[3] * opacity > 0.003
      ? [color[0], color[1], color[2], color[3] * opacity]
      : null
  }

  const shapeSegs = (el: SVGElement): Seg[] | null => {
    const num = (name: string) => {
      const attr = (
        el as unknown as Record<string, { baseVal?: { value: number } }>
      )[name]
      if (attr?.baseVal && typeof attr.baseVal.value === "number")
        return attr.baseVal.value
      return parseFloat(el.getAttribute(name) ?? "0") || 0
    }
    switch (el.localName) {
      case "path":
        return parsePath(el.getAttribute("d") ?? "")
      case "rect": {
        const w = num("width")
        const h = num("height")
        if (w <= 0 || h <= 0) return null
        // angoli ellittici: si prende il raggio più piccolo
        const rx = el.hasAttribute("rx") ? num("rx") : num("ry")
        const ry = el.hasAttribute("ry") ? num("ry") : rx
        const r = Math.min(rx, ry, w / 2, h / 2)
        return roundRectPath(num("x"), num("y"), w, h, [r, r, r, r])
      }
      case "circle": {
        const r = num("r")
        return r > 0 ? ellipsePath(num("cx"), num("cy"), r, r) : null
      }
      case "ellipse": {
        const rx = num("rx")
        const ry = num("ry")
        return rx > 0 && ry > 0
          ? ellipsePath(num("cx"), num("cy"), rx, ry)
          : null
      }
      case "line":
        return [
          { op: "M", x: num("x1"), y: num("y1") },
          { op: "L", x: num("x2"), y: num("y2") },
        ]
      case "polyline":
      case "polygon": {
        const pts = (el.getAttribute("points") ?? "")
          .trim()
          .split(/[\s,]+/)
          .map(Number)
          .filter((v) => Number.isFinite(v))
        return polyPath(pts, el.localName === "polygon")
      }
      default:
        return null
    }
  }

  const ctmOf = (el: SVGGraphicsElement): Matrix | null => {
    const m = el.getScreenCTM()
    if (!m) return null
    return multiply(toDoc, [m.a, m.b, m.c, m.d, m.e, m.f])
  }

  const svgOpacity = (el: Element, stop: Element) => {
    let value = 1
    for (let n: Element | null = el; n; n = n.parentElement) {
      value *= Number(style(n).opacity) || (style(n).opacity === "0" ? 0 : 1)
      if (n === stop) break
    }
    return value
  }

  const paintSvgText = async (
    el: SVGTextContentElement,
    m: Matrix,
    alpha: number,
    out: Paint[]
  ) => {
    const cs = style(el)
    const fill = svgPaintOf(el, cs.fill, alpha * (Number(cs.fillOpacity) || 1))
    if (!fill) return
    const text = el.textContent ?? ""
    const count = el.getNumberOfChars()
    const size = px(cs.fontSize) || 16
    const chars = [...text]
    // gli indici di SVG contano unità UTF-16: si seguono insieme
    let unit = 0
    for (const ch of chars) {
      const index = unit
      unit += ch.length
      if (index >= count || !ch.trim()) continue
      let pos: DOMPoint
      let rot = 0
      try {
        pos = el.getStartPositionOfChar(index)
        rot = el.getRotationOfChar(index)
      } catch {
        continue
      }
      const cp = ch.codePointAt(0) ?? 32
      const face = await faceFor(cs, cp)
      if (!face) continue
      let run
      try {
        run = face.font.layout(ch)
      } catch {
        continue
      }
      const glyph = run.glyphs[0]
      if (!glyph) continue
      const outline = fonts.outline(face, glyph.id)
      if (!outline.commands.length) continue
      const s = size / (face.font.unitsPerEm || 1000)
      const rad = (rot * Math.PI) / 180
      const cos = Math.cos(rad)
      const sin = Math.sin(rad)
      const skew = face.synthItalic ? 0.21 : 0
      // posizione, rotazione del carattere e unità del carattere con y in su
      const local: Matrix = multiply(
        [cos, sin, -sin, cos, pos.x, pos.y],
        [s, 0, skew * s, -s, 0, 0]
      )
      const gm = multiply(m, local)
      const b = outline.bbox
      const corners = [
        apply(gm, b.minX, b.minY),
        apply(gm, b.maxX, b.maxY),
        apply(gm, b.minX, b.maxY),
        apply(gm, b.maxX, b.minY),
      ]
      out.push({
        kind: "glyph",
        face,
        glyph: glyph.id,
        m: gm,
        color: fill,
        bbox: [
          Math.min(...corners.map((c) => c[0])),
          Math.min(...corners.map((c) => c[1])),
          Math.max(...corners.map((c) => c[0])),
          Math.max(...corners.map((c) => c[1])),
        ],
      })
    }
  }

  const paintSvg = async (svg: SVGSVGElement, out: Paint[]) => {
    const walk = async (parent: Element) => {
      for (const child of Array.from(parent.children)) {
        const el = child as SVGElement
        const tag = el.localName
        if (
          [
            "defs",
            "clipPath",
            "mask",
            "symbol",
            "title",
            "desc",
            "metadata",
            "style",
            "script",
            "linearGradient",
            "radialGradient",
            "pattern",
            "filter",
            "marker",
            "foreignObject",
          ].includes(tag)
        )
          continue
        const cs = style(el)
        if (cs.display === "none") continue
        if (tag === "g" || tag === "svg" || tag === "a" || tag === "switch") {
          await walk(el)
          continue
        }
        if (cs.visibility === "hidden") continue
        const m = ctmOf(el as unknown as SVGGraphicsElement)
        if (!m) continue
        const alpha = svgOpacity(el, svg)
        if (alpha <= 0.003) continue
        if (tag === "text") {
          const spans = el.querySelectorAll("tspan, textPath")
          if (spans.length) {
            for (const span of Array.from(spans)) {
              if (span.querySelector("tspan")) continue
              const sm = ctmOf(span as unknown as SVGGraphicsElement) ?? m
              await paintSvgText(
                span as unknown as SVGTextContentElement,
                sm,
                svgOpacity(span, svg),
                out
              )
            }
          } else {
            await paintSvgText(
              el as unknown as SVGTextContentElement,
              m,
              alpha,
              out
            )
          }
          continue
        }
        if (tag === "image") {
          const href =
            el.getAttribute("href") ??
            el.getAttributeNS("http://www.w3.org/1999/xlink", "href")
          if (!href) continue
          const num = (n: string) => parseFloat(el.getAttribute(n) ?? "0") || 0
          const img = new Image()
          img.src = href
          try {
            await img.decode()
          } catch {
            continue
          }
          const w = num("width") || img.naturalWidth
          const h = num("height") || img.naturalHeight
          const im = multiply(m, [w, 0, 0, -h, num("x"), num("y") + h])
          const corners = [
            apply(im, 0, 0),
            apply(im, 1, 1),
            apply(im, 0, 1),
            apply(im, 1, 0),
          ]
          out.push({
            kind: "image",
            asset: imageAsset(
              img,
              `svgimg:${href.slice(0, 120)}:${href.length}`,
              {
                w: Math.abs(im[0]) + Math.abs(im[2]),
                h: Math.abs(im[1]) + Math.abs(im[3]),
              }
            ),
            m: im,
            alpha: alpha < 1 ? alpha : undefined,
            bbox: [
              Math.min(...corners.map((c) => c[0])),
              Math.min(...corners.map((c) => c[1])),
              Math.max(...corners.map((c) => c[0])),
              Math.max(...corners.map((c) => c[1])),
            ],
          })
          continue
        }
        if (tag === "use") {
          const href =
            el.getAttribute("href") ??
            el.getAttributeNS("http://www.w3.org/1999/xlink", "href")
          const target = href?.startsWith("#")
            ? (svg.getElementById(href.slice(1)) as SVGElement | null)
            : null
          if (!target) continue
          const segs = shapeSegs(target)
          if (!segs?.length) continue
          const ux = parseFloat(el.getAttribute("x") ?? "0") || 0
          const uy = parseFloat(el.getAttribute("y") ?? "0") || 0
          pushShape(
            target,
            segs,
            multiply(m, [1, 0, 0, 1, ux, uy]),
            alpha,
            style(el),
            out
          )
          continue
        }
        const segs = shapeSegs(el)
        if (!segs?.length) continue
        pushShape(el, segs, m, alpha, cs, out)
      }
    }
    await walk(svg)
  }

  const pushShape = (
    el: SVGElement,
    segs: Seg[],
    m: Matrix,
    alpha: number,
    cs: CSSStyleDeclaration,
    out: Paint[]
  ) => {
    const line = el.localName === "line"
    const fill = line
      ? null
      : svgPaintOf(el, cs.fill, alpha * (Number(cs.fillOpacity) || 1))
    const strokeColor = svgPaintOf(
      el,
      cs.stroke,
      alpha * (Number(cs.strokeOpacity) || 1)
    )
    const scale = Math.sqrt(Math.abs(m[0] * m[3] - m[1] * m[2])) || 1
    const width = px(cs.strokeWidth) * scale
    const path = transform(segs, m)
    const b = bounds(path)
    if (!b) return
    const stroke: Stroke | undefined =
      strokeColor && width > 0
        ? {
            color: strokeColor,
            width,
            dash:
              cs.strokeDasharray && cs.strokeDasharray !== "none"
                ? cs.strokeDasharray
                    .split(/[\s,]+/)
                    .map((v) => px(v) * scale)
                    .filter((v) => v >= 0)
                : undefined,
            cap:
              cs.strokeLinecap === "round"
                ? 1
                : cs.strokeLinecap === "square"
                  ? 2
                  : 0,
            join:
              cs.strokeLinejoin === "round"
                ? 1
                : cs.strokeLinejoin === "bevel"
                  ? 2
                  : 0,
          }
        : undefined
    if (!fill && !stroke) return
    const pad = stroke ? width / 2 : 0
    out.push({
      kind: "path",
      segs: path,
      fill: fill ?? undefined,
      evenOdd: cs.fillRule === "evenodd",
      stroke,
      bbox: [b[0] - pad, b[1] - pad, b[2] + pad, b[3] + pad],
    })
  }

  /* ---- elenchi ---- */

  const paintMarker = async (li: HTMLElement, out: Paint[]) => {
    const text = markerText(li, view)
    if (!text) return
    const mcs = view.getComputedStyle(li, "::marker")
    const cs = mcs.fontFamily ? mcs : style(li)
    const color = parseColor(mcs.color || style(li).color)
    if (color[3] <= 0.01) return
    const face = await wordFace(cs, text.trim())
    if (!face) return
    const size = px(cs.fontSize) || px(style(li).fontSize) || 16
    const s = size / (face.font.unitsPerEm || 1000)
    let run
    try {
      run = face.font.layout(text)
    } catch {
      return
    }
    const width = run.positions.reduce((sum, p) => sum + p.xAdvance * s, 0)
    // la linea di base della prima riga dell'elemento
    const first = firstLine(li, doc)
    const box = li.getBoundingClientRect()
    const { asc, desc } = metrics(face.font)
    const top = first ? first.top : box.top
    const height = first ? first.height : size * 1.2
    const rect = {
      left: box.left - ox - width,
      top: top - oy + (first ? 0 : 0),
      width,
      height: first
        ? height
        : ((asc + desc) / (face.font.unitsPerEm || 1000)) * size,
    }
    glyphRun(out, face, text, rect, cs, color)
  }

  /* ---- elementi ---- */

  type Deferred = { z: number; el: Element; order: number }
  let order = 0

  const needsRaster = (el: Element, cs: CSSStyleDeclaration) =>
    el.localName === "canvas" ||
    el.localName === "video" ||
    // una traslazione è già nei riquadri misurati; rotazioni e scale no
    !isTranslation(cs.transform) ||
    (cs.filter && cs.filter !== "none") ||
    (cs.backgroundImage && cs.backgroundImage !== "none") ||
    (cs.webkitTextFillColor === "rgba(0, 0, 0, 0)" &&
      (el.textContent ?? "").trim().length > 0) ||
    px(cs.webkitTextStrokeWidth) > 0 ||
    (cs.textShadow && cs.textShadow !== "none") ||
    (cs.mixBlendMode && cs.mixBlendMode !== "normal")

  const rasterElement = async (el: HTMLElement, out: Paint[]) => {
    const rect = el.getBoundingClientRect()
    if (rect.width < 0.5 || rect.height < 0.5) return
    const [x0, y0, x1, y1] = rectBox(rect)
    const id = `el:${order++}`
    const asset: ImageAsset = {
      id,
      encode: async () => {
        if (el.localName === "canvas")
          return encodeCanvas(el as HTMLCanvasElement, opts)
        const { default: html2canvas } = await import("html2canvas-pro")
        try {
          const canvas = await html2canvas(el, {
            backgroundColor: null,
            scale: Math.max(2, opts.scale),
            logging: false,
            useCORS: true,
          } as Parameters<typeof html2canvas>[1])
          return encodeCanvas(canvas, opts)
        } catch {
          return null
        }
      },
    }
    out.push({
      kind: "image",
      asset,
      m: [x1 - x0, 0, 0, -(y1 - y0), x0, y1],
      bbox: [x0, y0, x1, y1],
    })
  }

  const paintElement = async (
    el: Element,
    out: Paint[],
    deferred: { neg: Deferred[]; pos: Deferred[] },
    isRoot: boolean
  ) => {
    if (el.matches(SKIP)) return
    const cs = style(el)
    if (cs.display === "none") return
    const positioned = cs.position !== "static"
    if (!isRoot && positioned && cs.zIndex !== "auto") {
      const z = Number(cs.zIndex) || 0
      ;(z < 0 ? deferred.neg : deferred.pos).push({ z, el, order: order++ })
      return
    }
    const own: Paint[] = []
    const hidden = cs.visibility === "hidden"
    if (!hidden && isHtml(el) && needsRaster(el, cs)) {
      await rasterElement(el as HTMLElement, own)
      out.push(...own)
      return
    }
    if (!hidden) paintBox(el, cs, own)
    if (isHtml(el) && el.localName === "img") {
      if (!hidden) await paintImage(el as HTMLImageElement, cs, own)
      out.push(...wrap(own, cs))
      return
    }
    if (el.localName === "svg" && el.namespaceURI === SVG_NS) {
      if (!hidden) await paintSvg(el as SVGSVGElement, own)
      out.push(...wrap(own, cs))
      return
    }
    const href =
      isHtml(el) && el.localName === "a" ? (el as HTMLAnchorElement).href : ""
    if (href && !hidden) {
      for (const r of Array.from(el.getClientRects())) {
        if (r.width < 1 || r.height < 1) continue
        own.push({ kind: "link", href, bbox: rectBox(r) })
      }
    }
    if (
      isHtml(el) &&
      el.localName === "li" &&
      !hidden &&
      cs.display === "list-item"
    ) {
      await paintMarker(el as HTMLElement, own)
    }
    const kids: Paint[] = []
    for (const child of Array.from(el.childNodes)) {
      if (child.nodeType === 3) {
        if (!hidden) await paintText(child as Text, el, kids)
      } else if (child.nodeType === 1) {
        await paintElement(child as Element, kids, deferred, false)
      }
    }
    // overflow: i figli si ritagliano sul riquadro
    const clips = cs.overflowX !== "visible" || cs.overflowY !== "visible"
    if (clips && kids.length && el !== node) {
      const [x0, y0, x1, y1] = rectBox(el.getBoundingClientRect())
      own.push(group(kids, roundRectPath(x0, y0, x1 - x0, y1 - y0, radii(cs))))
    } else own.push(...kids)
    out.push(...wrap(own, cs))
  }

  /**
   * Un contesto di sovrapposizione: sotto quello che ha z-index negativo (la
   * carta, la filigrana, le immagini dietro al testo), poi il flusso, sopra
   * quello con z-index positivo (intestazioni, immagini davanti al testo).
   */
  const paintContext = async (el: Element): Promise<Paint[]> => {
    const deferred = { neg: [] as Deferred[], pos: [] as Deferred[] }
    const flow: Paint[] = []
    await paintElement(el, flow, deferred, true)
    const byZ = (a: Deferred, b: Deferred) => a.z - b.z || a.order - b.order
    const out: Paint[] = []
    for (const d of deferred.neg.sort(byZ))
      out.push(...(await paintContext(d.el)))
    out.push(...flow)
    for (const d of deferred.pos.sort(byZ))
      out.push(...(await paintContext(d.el)))
    return out
  }

  const restore = materializePseudos(node, view)
  try {
    const paints = await paintContext(node)
    return { paints, fonts }
  } finally {
    restore()
  }
}

/**
 * Il testo che scrive il CSS (::before e ::after con `content`, come i
 * numeri delle note di chiusura) non è nel documento: per il tempo del
 * disegno diventa uno <span> vero con lo stesso aspetto, poi si rimette
 * tutto com'era. Solo testo semplice e pseudo-elementi nel flusso: quelli
 * decorativi (vuoti, posizionati) restano come sono.
 */
function materializePseudos(node: HTMLElement, view: Window) {
  const doc = node.ownerDocument
  const undo: (() => void)[] = []
  const sheet = doc.createElement("style")
  sheet.textContent =
    ".cg-vec-before::before{content:none!important}.cg-vec-after::after{content:none!important}"
  doc.head.appendChild(sheet)
  undo.push(() => sheet.remove())
  const COPY = [
    "display",
    "font-family",
    "font-size",
    "font-weight",
    "font-style",
    "color",
    "letter-spacing",
    "text-transform",
    "min-width",
    "margin-left",
    "margin-right",
    "padding-left",
    "padding-right",
    "vertical-align",
    "white-space",
    "flex-shrink",
  ]
  for (const el of Array.from(node.querySelectorAll("*"))) {
    if (el.namespaceURI !== "http://www.w3.org/1999/xhtml") continue
    // i suggerimenti dei paragrafi vuoti restano a video
    if (el.hasAttribute("data-placeholder")) continue
    for (const which of ["before", "after"] as const) {
      const ps = view.getComputedStyle(el, `::${which}`)
      const text = contentText(ps.content, el)
      if (!text || !text.trim()) continue
      if (
        ps.display === "none" ||
        ps.position === "absolute" ||
        ps.position === "fixed"
      )
        continue
      const span = doc.createElement("span")
      span.textContent = text
      span.setAttribute("aria-hidden", "true")
      span.style.cssText = COPY.map(
        (p) => `${p}:${ps.getPropertyValue(p)}`
      ).join(";")
      const cls = `cg-vec-${which}`
      el.classList.add(cls)
      if (which === "before") el.insertBefore(span, el.firstChild)
      else el.appendChild(span)
      undo.push(() => {
        span.remove()
        el.classList.remove(cls)
      })
    }
  }
  return () => {
    for (let i = undo.length - 1; i >= 0; i--) undo[i]()
  }
}

/** Il testo di `content` fatto solo di stringhe e attr(); null altrimenti */
function contentText(content: string, el: Element): string | null {
  if (!content || content === "none" || content === "normal") return null
  const re = /"((?:[^"\\]|\\.)*)"|attr\(\s*([\w-]+)\s*\)|(\S+)/g
  let out = ""
  for (const m of content.matchAll(re)) {
    if (m[1] !== undefined) out += m[1].replace(/\\(.)/g, "$1")
    else if (m[2]) out += el.getAttribute(m[2]) ?? ""
    else return null
  }
  return out
}

/* ------------------------------- aiutanti ------------------------------- */

const SVG_NS = "http://www.w3.org/2000/svg"
const HTML_NS = "http://www.w3.org/1999/xhtml"

/** Un elemento HTML, anche se viene da un'altra finestra (l'iframe) */
const isHtml = (el: Element) => el.namespaceURI === HTML_NS

/** «none» o una traslazione pura: matrix(1, 0, 0, 1, x, y) */
function isTranslation(value: string) {
  if (!value || value === "none") return true
  const m = /^matrix\(([^)]+)\)$/.exec(value.trim())
  if (!m) return false
  const [a, b, c, d] = m[1].split(",").map((v) => parseFloat(v))
  return (
    Math.abs(a - 1) < 1e-4 &&
    Math.abs(b) < 1e-4 &&
    Math.abs(c) < 1e-4 &&
    Math.abs(d - 1) < 1e-4
  )
}

/** Famiglie di riserva: i gemelli metrici dei caratteri di sistema */
function withFallbacks(families: string[]) {
  const out = [...families]
  const has = (re: RegExp) => families.some((f) => re.test(f))
  if (has(/mono|courier|consolas|menlo/)) out.push("cousine")
  if (has(/serif|times|georgia|cambria/) && !has(/sans/)) out.push("tinos")
  out.push("arimo", "carlito")
  return out
}

function metrics(font: ResolvedFace["font"]) {
  const os2 = (font as unknown as { "OS/2"?: Record<string, number> })["OS/2"]
  // con USE_TYPO_METRICS il browser usa le misure «tipografiche»
  if (os2 && (os2.fsSelection & 0x80) !== 0 && os2.typoAscender) {
    return { asc: os2.typoAscender, desc: -os2.typoDescender }
  }
  return { asc: font.ascent, desc: -font.descent }
}

function group(children: Paint[], clip?: Seg[], alpha?: number): Paint {
  return {
    kind: "group",
    clip,
    alpha,
    children,
    bbox: clip ? ((bounds(clip) as Box) ?? boxOf(children)) : boxOf(children),
  }
}

/** L'opacità dell'elemento, come gruppo */
function wrap(paints: Paint[], cs: CSSStyleDeclaration): Paint[] {
  const alpha = Number(cs.opacity)
  if (!paints.length || !(alpha < 0.999)) return paints
  if (alpha <= 0.003) return []
  return [group(paints, undefined, alpha)]
}

function lineStroke(kind: string, width: number, color: RGBA): Stroke {
  return {
    color,
    width,
    dash:
      kind === "dashed"
        ? [width * 3, width * 2]
        : kind === "dotted"
          ? [0, width * 2]
          : undefined,
    cap: kind === "dotted" ? 1 : 0,
  }
}

function edgeLine(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  width: number,
  color: RGBA,
  kind: string
): Paint {
  const pad = width / 2
  return {
    kind: "path",
    segs: [
      { op: "M", x: ax, y: ay },
      { op: "L", x: bx, y: by },
    ],
    stroke: lineStroke(kind, width, color),
    bbox: [
      Math.min(ax, bx) - pad,
      Math.min(ay, by) - pad,
      Math.max(ax, bx) + pad,
      Math.max(ay, by) + pad,
    ],
  }
}

const isSvgSource = (src: string) =>
  /^data:image\/svg\+xml/i.test(src) || /\.svg(\?|#|$)/i.test(src)

async function svgText(src: string): Promise<string | null> {
  try {
    if (src.startsWith("data:")) {
      const comma = src.indexOf(",")
      const meta = src.slice(0, comma)
      const body = src.slice(comma + 1)
      if (/;base64/i.test(meta)) {
        const bin = atob(body)
        const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0))
        return new TextDecoder().decode(bytes)
      }
      return decodeURIComponent(body)
    }
    const res = await fetch(src)
    return res.ok ? await res.text() : null
  } catch {
    return null
  }
}

/** I pixel di un canvas pronti per il file: JPEG, oppure crudi con l'alfa */
export async function encodeCanvas(
  canvas: HTMLCanvasElement,
  opts: VectorOptions
): Promise<EncodedImage | null> {
  const { width, height } = canvas
  if (!width || !height) return null
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return null
  const pixels = ctx.getImageData(0, 0, width, height).data
  let transparent = false
  for (let i = 3; i < pixels.length; i += 4) {
    if (pixels[i] < 255) {
      transparent = true
      break
    }
  }
  const gray = opts.gray
  if (!transparent && !opts.lossless) {
    if (gray) {
      const image = ctx.getImageData(0, 0, width, height)
      const d = image.data
      for (let i = 0; i < d.length; i += 4) {
        const y = Math.round(
          d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722
        )
        d[i] = d[i + 1] = d[i + 2] = y
      }
      ctx.putImageData(image, 0, 0)
    }
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", opts.jpeg)
    )
    if (blob) {
      return {
        kind: "jpeg",
        data: new Uint8Array(await blob.arrayBuffer()),
        width,
        height,
        gray: false,
      }
    }
  }
  const channels = gray ? 1 : 3
  const data = new Uint8Array(width * height * channels)
  const alpha = transparent ? new Uint8Array(width * height) : null
  for (let i = 0, j = 0, k = 0; i < pixels.length; i += 4, k++) {
    const a = pixels[i + 3]
    // i colori di un canvas sono già «premoltiplicati» solo dentro: qui no
    const r = pixels[i]
    const g = pixels[i + 1]
    const b = pixels[i + 2]
    if (gray) data[j++] = Math.round(r * 0.2126 + g * 0.7152 + b * 0.0722)
    else {
      data[j++] = r
      data[j++] = g
      data[j++] = b
    }
    if (alpha) alpha[k] = a
  }
  return { kind: "raw", data, alpha, width, height, gray }
}

/** Il riquadro della prima riga di testo di un elemento */
function firstLine(el: Element, doc: Document) {
  const walker = doc.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    const text = n as Text
    const match = text.data.match(/\S/)
    if (!match || match.index === undefined) continue
    const r = doc.createRange()
    r.setStart(text, match.index)
    r.setEnd(text, match.index + 1)
    const rect = r.getClientRects()[0]
    if (rect && rect.height > 0) return rect
  }
  return null
}

/* ------------------------ numeri degli elenchi -------------------------- */

const ROMAN: [number, string][] = [
  [1000, "m"],
  [900, "cm"],
  [500, "d"],
  [400, "cd"],
  [100, "c"],
  [90, "xc"],
  [50, "l"],
  [40, "xl"],
  [10, "x"],
  [9, "ix"],
  [5, "v"],
  [4, "iv"],
  [1, "i"],
]

function counterText(n: number, style: string) {
  const roman = () => {
    let rest = Math.max(1, Math.min(3999, n))
    let out = ""
    for (const [v, g] of ROMAN) {
      while (rest >= v) {
        out += g
        rest -= v
      }
    }
    return out
  }
  const alpha = () => {
    let rest = Math.max(1, n)
    let out = ""
    while (rest > 0) {
      rest -= 1
      out = String.fromCharCode(97 + (rest % 26)) + out
      rest = Math.floor(rest / 26)
    }
    return out
  }
  switch (style) {
    case "lower-roman":
      return roman()
    case "upper-roman":
      return roman().toUpperCase()
    case "lower-alpha":
    case "lower-latin":
      return alpha()
    case "upper-alpha":
    case "upper-latin":
      return alpha().toUpperCase()
    case "decimal-leading-zero":
      return n < 10 && n >= 0 ? `0${n}` : String(n)
    default:
      return String(n)
  }
}

/** Il numero di una voce nel suo elenco, come il contatore list-item */
function ordinal(li: Element) {
  const list = li.parentElement
  if (!list) return 1
  // nomi dei tag, non instanceof: gli elementi sono dell'iframe
  const start = list.localName === "ol" ? Number(list.getAttribute("start")) : 1
  let n = (Number.isFinite(start) && list.hasAttribute("start") ? start : 1) - 1
  for (const sibling of Array.from(list.children)) {
    if (sibling.localName !== "li") continue
    const value = Number(sibling.getAttribute("value"))
    n = sibling.hasAttribute("value") && Number.isFinite(value) ? value : n + 1
    if (sibling === li) return n
  }
  return n
}

/**
 * Il testo del segno di una voce d'elenco: il punto, o il numero nella forma
 * dello stile (1. a) iv. «Articolo 3»…), letto dal CSS calcolato.
 */
function markerText(li: HTMLElement, view: Window): string | null {
  const cs = view.getComputedStyle(li)
  const marker = view.getComputedStyle(li, "::marker")
  const content = marker.content
  if (content && content !== "normal" && content !== "none") {
    const parts: string[] = []
    const re =
      /"((?:[^"\\]|\\.)*)"|counters?\(\s*list-item\s*(?:,\s*"([^"]*)")?\s*(?:,\s*([a-z-]+))?\s*\)/g
    for (const m of content.matchAll(re)) {
      if (m[1] !== undefined) parts.push(m[1].replace(/\\(.)/g, "$1"))
      else if (m[0].startsWith("counters")) {
        const values: number[] = []
        for (
          let n: Element | null = li;
          n;
          n = n.parentElement?.closest("li") ?? null
        ) {
          values.unshift(ordinal(n))
        }
        parts.push(
          values.map((v) => counterText(v, m[3] ?? "decimal")).join(m[2] ?? ".")
        )
      } else parts.push(counterText(ordinal(li), m[3] ?? "decimal"))
    }
    const text = parts.join("")
    return text.trim() ? text : null
  }
  const type = cs.listStyleType
  if (!type || type === "none") return null
  if (type.startsWith('"')) return type.slice(1, -1)
  switch (type) {
    case "disc":
      return "• "
    case "circle":
      return "◦ "
    case "square":
      return "▪ "
    case "disclosure-open":
      return "▾ "
    case "disclosure-closed":
      return "▸ "
    default:
      return `${counterText(ordinal(li), type)}. `
  }
}
