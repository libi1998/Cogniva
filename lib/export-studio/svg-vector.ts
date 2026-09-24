"use client"

import type { PathCommand } from "fontkit"
import type { FontLibrary, ResolvedFace } from "./fonts"
import type { Seg } from "./svg-path"
import type { EncodedImage, Paint, RGBA, Scene } from "./vector"
import { escapeAttr } from "@/lib/css"

/**
 * La stessa scena del PDF vettoriale (vector.ts) come SVG vero: tracciati,
 * glifi come forme riusate, immagini incorporate. Niente <foreignObject>:
 * il file si apre in Illustrator, Inkscape, Figma e nei browser, e resta
 * nitido a ogni ingrandimento. Il testo c'è anche come testo, trasparente,
 * per cercarlo e copiarlo.
 */

const f = (v: number) => {
  if (!Number.isFinite(v)) return "0"
  const r = Math.round(v * 1000) / 1000
  return String(r)
}

const rgb = (c: RGBA, gray: boolean) => {
  let [r, g, b] = c
  if (gray) r = g = b = r * 0.2126 + g * 0.7152 + b * 0.0722
  return `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`
}

function segsToD(segs: Seg[]) {
  let d = ""
  for (const s of segs) {
    if (s.op === "M") d += `M${f(s.x)} ${f(s.y)}`
    else if (s.op === "L") d += `L${f(s.x)} ${f(s.y)}`
    else if (s.op === "C")
      d += `C${f(s.x1)} ${f(s.y1)} ${f(s.x2)} ${f(s.y2)} ${f(s.x)} ${f(s.y)}`
    else d += "Z"
  }
  return d
}

function glyphD(commands: PathCommand[]) {
  let d = ""
  for (const c of commands) {
    const a = c.args.map((v) => Math.round(v))
    switch (c.command) {
      case "moveTo":
        d += `M${a[0]} ${a[1]}`
        break
      case "lineTo":
        d += `L${a[0]} ${a[1]}`
        break
      case "quadraticCurveTo":
        d += `Q${a.join(" ")}`
        break
      case "bezierCurveTo":
        d += `C${a.join(" ")}`
        break
      case "closePath":
        d += "Z"
        break
    }
  }
  return d
}

/** Un'immagine codificata come data URI (PNG se ha la trasparenza) */
function imageUri(image: EncodedImage): string | null {
  if (image.kind === "jpeg") {
    let bin = ""
    const chunk = 0x8000
    for (let i = 0; i < image.data.length; i += chunk) {
      bin += String.fromCharCode(...image.data.subarray(i, i + chunk))
    }
    return `data:image/jpeg;base64,${btoa(bin)}`
  }
  const canvas = document.createElement("canvas")
  canvas.width = image.width
  canvas.height = image.height
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  const px = ctx.createImageData(image.width, image.height)
  const channels = image.gray ? 1 : 3
  for (let i = 0, k = 0; k < image.width * image.height; k++, i += channels) {
    const o = k * 4
    px.data[o] = image.data[i]
    px.data[o + 1] = image.data[image.gray ? i : i + 1]
    px.data[o + 2] = image.data[image.gray ? i : i + 2]
    px.data[o + 3] = image.alpha ? image.alpha[k] : 255
  }
  ctx.putImageData(px, 0, 0)
  return canvas.toDataURL("image/png")
}

export async function sceneToSvg(
  scene: Scene,
  opts: {
    width: number
    height: number
    paper: RGBA
    gray: boolean
    /** parole per il testo trasparente, in coordinate del foglio */
    words?: {
      text: string
      x: number
      baseline: number
      width: number
      size: number
    }[]
    title: string
  }
): Promise<string> {
  const fonts: FontLibrary = scene.fonts
  const defs: string[] = []
  const glyphs = new Map<string, string>()
  const images = new Map<string, string | null>()
  let counter = 0

  const glyphRef = (face: ResolvedFace, id: number) => {
    const key = `${face.key}#${id}`
    let ref = glyphs.get(key)
    if (!ref) {
      ref = `g${counter++}`
      defs.push(
        `<path id="${ref}" d="${glyphD(fonts.outline(face, id).commands)}"/>`
      )
      glyphs.set(key, ref)
    }
    return ref
  }

  const body: string[] = []
  const emit = async (paints: Paint[], alpha: number, out: string[]) => {
    for (const p of paints) {
      switch (p.kind) {
        case "path": {
          const attrs: string[] = [`d="${segsToD(p.segs)}"`]
          if (p.fill) {
            attrs.push(`fill="${rgb(p.fill, opts.gray)}"`)
            const a = p.fill[3] * alpha
            if (a < 0.999) attrs.push(`fill-opacity="${f(a)}"`)
            if (p.evenOdd) attrs.push(`fill-rule="evenodd"`)
          } else attrs.push(`fill="none"`)
          if (p.stroke) {
            const s = p.stroke
            attrs.push(
              `stroke="${rgb(s.color, opts.gray)}"`,
              `stroke-width="${f(s.width)}"`
            )
            const a = s.color[3] * alpha
            if (a < 0.999) attrs.push(`stroke-opacity="${f(a)}"`)
            if (s.dash?.length)
              attrs.push(`stroke-dasharray="${s.dash.map(f).join(" ")}"`)
            if (s.cap)
              attrs.push(`stroke-linecap="${s.cap === 1 ? "round" : "square"}"`)
            if (s.join)
              attrs.push(
                `stroke-linejoin="${s.join === 1 ? "round" : "bevel"}"`
              )
          }
          out.push(`<path ${attrs.join(" ")}/>`)
          break
        }
        case "glyph": {
          const ref = glyphRef(p.face, p.glyph)
          const a = p.color[3] * alpha
          const color = rgb(p.color, opts.gray)
          const bold = p.face.synthBold
            ? ` stroke="${color}" stroke-width="${f((p.face.font.unitsPerEm || 1000) / 30)}" stroke-linejoin="round"`
            : ""
          out.push(
            `<use href="#${ref}" transform="matrix(${p.m.map(f).join(" ")})" fill="${color}"${a < 0.999 ? ` opacity="${f(a)}"` : ""}${bold}/>`
          )
          break
        }
        case "image": {
          let uri = images.get(p.asset.id)
          if (uri === undefined) {
            let encoded: EncodedImage | null = null
            try {
              encoded = await p.asset.encode()
            } catch {
              encoded = null
            }
            uri = encoded ? imageUri(encoded) : null
            images.set(p.asset.id, uri)
          }
          if (!uri) break
          // l'immagine sta nel quadrato unitario con y in su, come nel PDF
          const m = p.m
          const t = [m[0], m[1], -m[2], -m[3], m[2] + m[4], m[3] + m[5]]
          const a = (p.alpha ?? 1) * alpha
          out.push(
            `<image href="${uri}" width="1" height="1" preserveAspectRatio="none" transform="matrix(${t.map(f).join(" ")})"${a < 0.999 ? ` opacity="${f(a)}"` : ""}/>`
          )
          break
        }
        case "group": {
          const inner: string[] = []
          await emit(p.children, 1, inner)
          if (!inner.length) break
          let attrs = ""
          if (p.clip) {
            const id = `c${counter++}`
            defs.push(
              `<clipPath id="${id}"><path d="${segsToD(p.clip)}"/></clipPath>`
            )
            attrs += ` clip-path="url(#${id})"`
          }
          const a = (p.alpha ?? 1) * alpha
          if (a < 0.999) attrs += ` opacity="${f(a)}"`
          out.push(`<g${attrs}>${inner.join("")}</g>`)
          break
        }
        case "link": {
          const [x0, y0, x1, y1] = p.bbox
          if (!/^(https?|mailto):/i.test(p.href)) break
          out.push(
            `<a href="${escapeAttr(p.href)}"><rect x="${f(x0)}" y="${f(y0)}" width="${f(x1 - x0)}" height="${f(y1 - y0)}" fill="transparent"/></a>`
          )
          break
        }
      }
    }
  }
  await emit(scene.paints, 1, body)

  const text = (opts.words ?? [])
    .filter((w) => w.text.trim())
    .map(
      (w) =>
        `<text x="${f(w.x)}" y="${f(w.baseline)}" font-size="${f(w.size)}" textLength="${f(w.width)}" lengthAdjust="spacingAndGlyphs">${w.text
          .trim()
          .replace(/[<>&]/g, (c) =>
            c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&amp;"
          )}</text>`
    )
    .join("")

  const paper =
    opts.paper[3] > 0
      ? `<rect width="100%" height="100%" fill="${rgb(opts.paper, opts.gray)}"/>`
      : ""
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${f(opts.width)}" height="${f(opts.height)}" viewBox="0 0 ${f(opts.width)} ${f(opts.height)}"><title>${opts.title.replace(/[<>&]/g, "")}</title><defs>${defs.join("")}</defs>${paper}${body.join("")}${text ? `<g fill="transparent" font-family="Helvetica, Arial, sans-serif">${text}</g>` : ""}</svg>`
}
