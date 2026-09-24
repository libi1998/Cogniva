"use client"

import type { PathCommand } from "fontkit"
import {
  ascii,
  deflate,
  n,
  pdfDate,
  textLayer,
  utf16,
  type PdfWord,
} from "./pdf"
import type { FontLibrary, ResolvedFace } from "./fonts"
import type { Seg, Matrix } from "./svg-path"
import type { Box, EncodedImage, Paint, RGBA, Stroke } from "./vector"

/**
 * Un PDF vettoriale, scritto a mano come l'altro (vedi pdf.ts).
 *
 * Ogni pagina è un disegno: tracciati per sfondi, bordi e forme, immagini per
 * le foto, e i glifi del testo come piccoli disegni riusati (un oggetto per
 * lettera e peso, disegnato ogni volta che serve). Sopra c'è il testo vero,
 * invisibile, nella posizione delle parole: si cerca, si seleziona, si copia.
 * I collegamenti restano cliccabili.
 */

const encoder = new TextEncoder()

/** Numeri con abbastanza cifre per le scale piccole dei glifi */
const f = (value: number) => {
  if (!Number.isFinite(value)) return "0"
  const abs = Math.abs(value)
  const fixed =
    abs >= 100
      ? value.toFixed(2)
      : abs >= 1
        ? value.toFixed(3)
        : value.toPrecision(5)
  const clean = fixed.includes("e") ? value.toFixed(6) : fixed
  return clean.includes(".") ? clean.replace(/\.?0+$/, "") || "0" : clean
}

const luma = (c: RGBA): RGBA => {
  const y = c[0] * 0.2126 + c[1] * 0.7152 + c[2] * 0.0722
  return [y, y, y, c[3]]
}

function segsToPdf(segs: Seg[]) {
  let out = ""
  for (const s of segs) {
    if (s.op === "M") out += `${f(s.x)} ${f(s.y)} m\n`
    else if (s.op === "L") out += `${f(s.x)} ${f(s.y)} l\n`
    else if (s.op === "C")
      out += `${f(s.x1)} ${f(s.y1)} ${f(s.x2)} ${f(s.y2)} ${f(s.x)} ${f(s.y)} c\n`
    else out += "h\n"
  }
  return out
}

function glyphToPdf(commands: PathCommand[]) {
  let out = ""
  let x = 0
  let y = 0
  let sx = 0
  let sy = 0
  const r = (v: number) => String(Math.round(v * 10) / 10)
  for (const c of commands) {
    const a = c.args
    switch (c.command) {
      case "moveTo":
        x = sx = a[0]
        y = sy = a[1]
        out += `${r(x)} ${r(y)} m\n`
        break
      case "lineTo":
        x = a[0]
        y = a[1]
        out += `${r(x)} ${r(y)} l\n`
        break
      case "quadraticCurveTo": {
        const [qx, qy, ex, ey] = a
        out += `${r(x + (2 / 3) * (qx - x))} ${r(y + (2 / 3) * (qy - y))} ${r(ex + (2 / 3) * (qx - ex))} ${r(ey + (2 / 3) * (qy - ey))} ${r(ex)} ${r(ey)} c\n`
        x = ex
        y = ey
        break
      }
      case "bezierCurveTo":
        out += `${r(a[0])} ${r(a[1])} ${r(a[2])} ${r(a[3])} ${r(a[4])} ${r(a[5])} c\n`
        x = a[4]
        y = a[5]
        break
      case "closePath":
        out += "h\n"
        x = sx
        y = sy
        break
    }
  }
  return out
}

const intersects = (a: Box, b: Box) =>
  a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1]

export type VectorPage = {
  /** misure della pagina in pixel CSS */
  width: number
  height: number
  /** il pezzo del foglio che va su questa pagina, e dove comincia */
  slice: { top: number; height: number; dy: number }
  paints: Paint[]
  paper: RGBA
  words?: PdfWord[]
}

export class VectorPdfWriter {
  private parts: Uint8Array[] = []
  private length = 0
  private offsets: number[] = []
  private pageRefs: number[] = []
  /** 1 catalogo, 2 albero delle pagine, 3 carattere, 4 informazioni */
  private next = 5
  private glyphs = new Map<string, { name: string; id: number }>()
  private images = new Map<string, { name: string; id: number } | null>()
  private states = new Map<string, { name: string; id: number }>()
  private counter = 0

  constructor(
    private fonts: FontLibrary,
    private opts: { gray: boolean; unit: number }
  ) {
    this.write("%PDF-1.7\n%âãÏÓ\n", true)
  }

  private write(chunk: string | Uint8Array, latin1 = false) {
    const bytes =
      typeof chunk !== "string"
        ? chunk
        : latin1
          ? Uint8Array.from(chunk, (c) => c.charCodeAt(0) & 0xff)
          : encoder.encode(chunk)
    this.parts.push(bytes)
    this.length += bytes.length
  }

  private object(id: number, body: string, stream?: Uint8Array) {
    this.offsets[id] = this.length
    this.write(`${id} 0 obj\n${body}\n`)
    if (stream) {
      this.write("stream\n")
      this.write(stream)
      this.write("\nendstream\n")
    }
    this.write("endobj\n")
  }

  private async stream(id: number, dict: string, content: string | Uint8Array) {
    const raw =
      typeof content === "string"
        ? Uint8Array.from(content, (c) => c.charCodeAt(0) & 0xff)
        : content
    const packed = await deflate(raw)
    this.object(
      id,
      packed
        ? `<< ${dict} /Length ${packed.length} /Filter /FlateDecode >>`
        : `<< ${dict} /Length ${raw.length} >>`,
      packed ?? raw
    )
  }

  private color(c: RGBA): RGBA {
    return this.opts.gray ? luma(c) : c
  }

  /** Lo stato con la trasparenza data (riempimento e tratto) */
  private alpha(fill: number, stroke: number) {
    const key = `${fill.toFixed(3)}|${stroke.toFixed(3)}`
    let state = this.states.get(key)
    if (!state) {
      state = { name: `A${this.states.size}`, id: this.next++ }
      this.object(
        state.id,
        `<< /Type /ExtGState /ca ${f(fill)} /CA ${f(stroke)} >>`
      )
      this.states.set(key, state)
    }
    return state
  }

  /** Il disegno di un glifo, creato alla prima volta che serve */
  private async glyph(face: ResolvedFace, id: number) {
    const bold = face.synthBold
    const key = `${face.key}#${id}${bold ? "b" : ""}`
    let entry = this.glyphs.get(key)
    if (entry) return entry
    const outline = this.fonts.outline(face, id)
    const upm = face.font.unitsPerEm || 1000
    // il grassetto che il browser inventa: il contorno ripassato
    const stroke = bold ? upm / 30 : 0
    const b = outline.bbox
    const pad = stroke + 2
    const body = `${stroke ? `${f(stroke)} w 1 j ` : ""}${glyphToPdf(outline.commands)}${stroke ? "B" : "f"}\n`
    entry = { name: `G${this.counter++}`, id: this.next++ }
    await this.stream(
      entry.id,
      `/Type /XObject /Subtype /Form /BBox [${f(b.minX - pad)} ${f(b.minY - pad)} ${f(b.maxX + pad)} ${f(b.maxY + pad)}] /Resources << >>`,
      body
    )
    this.glyphs.set(key, entry)
    return entry
  }

  private async image(asset: {
    id: string
    encode: () => Promise<EncodedImage | null>
  }) {
    if (this.images.has(asset.id)) return this.images.get(asset.id) ?? null
    let encoded: EncodedImage | null = null
    try {
      encoded = await asset.encode()
    } catch {
      encoded = null
    }
    if (!encoded) {
      this.images.set(asset.id, null)
      return null
    }
    const entry = { name: `I${this.counter++}`, id: this.next++ }
    const { width, height } = encoded
    if (encoded.kind === "jpeg") {
      this.object(
        entry.id,
        `<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${encoded.data.length} >>`,
        encoded.data
      )
    } else {
      let smask = ""
      if (encoded.alpha) {
        const maskId = this.next++
        await this.stream(
          maskId,
          `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceGray /BitsPerComponent 8`,
          encoded.alpha
        )
        smask = ` /SMask ${maskId} 0 R`
      }
      await this.stream(
        entry.id,
        `/Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /${encoded.gray ? "DeviceGray" : "DeviceRGB"} /BitsPerComponent 8${smask}`,
        encoded.data
      )
    }
    this.images.set(asset.id, entry)
    return entry
  }

  async addPage(page: VectorPage) {
    const unit = this.opts.unit
    const W = page.width * unit
    const H = page.height * unit
    const { top, height, dy } = page.slice
    const view: Box = [-1e6, top, 1e6, top + height]
    const xobjects = new Map<string, number>()
    const states = new Map<string, number>()
    const links: { href: string; bbox: Box }[] = []
    let out = ""

    const paper = this.color(page.paper)
    if (
      paper[3] > 0 &&
      !(paper[0] > 0.999 && paper[1] > 0.999 && paper[2] > 0.999)
    ) {
      out += `${f(paper[0])} ${f(paper[1])} ${f(paper[2])} rg 0 0 ${f(W)} ${f(H)} re f\n`
    }
    // pixel CSS con l'asse y verso il basso, e il pezzo del foglio al suo posto
    out += `q ${f(unit)} 0 0 ${f(-unit)} 0 ${f(H)} cm 1 0 0 1 0 ${f(dy - top)} cm\n`
    out += `0 ${f(top)} ${f(page.width + 2)} ${f(height)} re W n\n`

    const setAlpha = (fillA: number, strokeA: number) => {
      if (fillA >= 0.999 && strokeA >= 0.999) return ""
      const st = this.alpha(fillA, strokeA)
      states.set(st.name, st.id)
      return `/${st.name} gs `
    }
    const strokeOps = (s: Stroke) => {
      const c = this.color(s.color)
      let ops = `${f(c[0])} ${f(c[1])} ${f(c[2])} RG ${f(s.width)} w ${s.cap ?? 0} J ${s.join ?? 0} j `
      if (s.dash?.length) ops += `[${s.dash.map(f).join(" ")}] 0 d `
      return ops
    }

    const emit = async (paints: Paint[], alpha: number) => {
      for (const p of paints) {
        if (p.kind === "link") {
          if (intersects(p.bbox, view)) links.push(p)
          continue
        }
        if (!intersects(p.bbox, view)) continue
        switch (p.kind) {
          case "path": {
            const fill = p.fill ? this.color(p.fill) : null
            const stroke = p.stroke
            if (!fill && !stroke) break
            let ops = "q "
            ops += setAlpha(
              fill ? fill[3] * alpha : 1,
              stroke ? stroke.color[3] * alpha : 1
            )
            if (fill) ops += `${f(fill[0])} ${f(fill[1])} ${f(fill[2])} rg `
            if (stroke) ops += strokeOps(stroke)
            ops += `\n${segsToPdf(p.segs)}`
            ops +=
              fill && stroke
                ? p.evenOdd
                  ? "B*"
                  : "B"
                : fill
                  ? p.evenOdd
                    ? "f*"
                    : "f"
                  : "S"
            out += `${ops}\nQ\n`
            break
          }
          case "glyph": {
            const g = await this.glyph(p.face, p.glyph)
            xobjects.set(g.name, g.id)
            const c = this.color(p.color)
            const m = p.m
            out += `q ${setAlpha(c[3] * alpha, c[3] * alpha)}${f(c[0])} ${f(c[1])} ${f(c[2])} rg ${f(c[0])} ${f(c[1])} ${f(c[2])} RG ${m.map(f).join(" ")} cm /${g.name} Do Q\n`
            break
          }
          case "image": {
            const img = await this.image(p.asset)
            if (!img) break
            xobjects.set(img.name, img.id)
            const a = (p.alpha ?? 1) * alpha
            out += `q ${setAlpha(a, a)}${p.m.map(f).join(" ")} cm /${img.name} Do Q\n`
            break
          }
          case "group": {
            const a = alpha * (p.alpha ?? 1)
            if (a <= 0.003) break
            out += "q\n"
            if (p.clip) out += `${segsToPdf(p.clip)}W n\n`
            await emit(p.children, a)
            out += "Q\n"
            break
          }
        }
      }
    }
    await emit(page.paints, 1)
    out += "Q\n"
    if (page.words?.length) out += textLayer(page.words, H)

    const pageId = this.next++
    const contentId = this.next++
    await this.stream(contentId, "", out)

    const annots: number[] = []
    for (const link of links) {
      const uri = safeUri(link.href)
      if (!uri) continue
      const [x0, y0, x1, y1] = link.bbox
      const toPage = (y: number) => H - (y - top + dy) * unit
      const id = this.next++
      this.object(
        id,
        `<< /Type /Annot /Subtype /Link /Rect [${n(x0 * unit)} ${n(toPage(y1))} ${n(x1 * unit)} ${n(toPage(y0))}] /Border [0 0 0] /A << /S /URI /URI (${uri}) >> >>`
      )
      annots.push(id)
    }

    const xo = [...xobjects].map(([name, id]) => `/${name} ${id} 0 R`).join(" ")
    const gs = [...states].map(([name, id]) => `/${name} ${id} 0 R`).join(" ")
    this.object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${n(W)} ${n(H)}] /Resources << /Font << /F1 3 0 R >>${xo ? ` /XObject << ${xo} >>` : ""}${gs ? ` /ExtGState << ${gs} >>` : ""} >> /Contents ${contentId} 0 R${annots.length ? ` /Annots [${annots.map((a) => `${a} 0 R`).join(" ")}]` : ""} >>`
    )
    this.pageRefs.push(pageId)
  }

  finish(meta: { title: string; language?: string }): Blob {
    this.object(
      1,
      `<< /Type /Catalog /Pages 2 0 R${meta.language ? ` /Lang (${ascii(meta.language)})` : ""} /ViewerPreferences << /DisplayDocTitle true >> >>`
    )
    this.object(
      2,
      `<< /Type /Pages /Kids [${this.pageRefs.map((id) => `${id} 0 R`).join(" ")}] /Count ${this.pageRefs.length} >>`
    )
    this.object(
      3,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>"
    )
    this.object(
      4,
      `<< /Title ${utf16(meta.title)} /Producer (Cogniva) /Creator (Cogniva) /CreationDate (${pdfDate(new Date())}) >>`
    )
    const xref = this.length
    const count = this.next
    let table = `xref\n0 ${count}\n0000000000 65535 f \n`
    for (let id = 1; id < count; id++) {
      table += `${String(this.offsets[id] ?? 0).padStart(10, "0")} 00000 n \n`
    }
    this.write(table)
    this.write(
      `trailer\n<< /Size ${count} /Root 1 0 R /Info 4 0 R >>\nstartxref\n${xref}\n%%EOF\n`
    )
    return new Blob(this.parts as BlobPart[], { type: "application/pdf" })
  }
}

/** Solo indirizzi web e di posta, in ASCII e senza parentesi aperte */
function safeUri(href: string) {
  let url: URL
  try {
    url = new URL(href)
  } catch {
    return null
  }
  if (!["http:", "https:", "mailto:"].includes(url.protocol)) return null
  return url.href
    .replace(/[()\\]/g, (c) => `\\${c}`)
    .replace(/[^\x20-\x7e]/g, encodeURIComponent)
}

export type { Matrix }
