"use client"

import { tr } from "@/lib/i18n/client"
import { cssColor, escapeAttr } from "@/lib/css"
import { removeEmptyPseudos } from "@/lib/export-studio/raster"
/**
 * Esportazione in SVG / PNG / PDF.
 *
 * L'approccio è "DOM → SVG": si clona il pezzo di interfaccia già renderizzato,
 * si copiano gli stili calcolati su ogni nodo (dentro <foreignObject> i fogli di
 * stile esterni non valgono) e si incorporano i font come data URI, così il
 * risultato è identico a ciò che si vede a schermo.
 */

const XHTML = "http://www.w3.org/1999/xhtml"

/* ------------------------------- font ----------------------------------- */

const fontCache = new Map<string, string>()

async function toDataUrl(url: string): Promise<string | null> {
  try {
    const res = await fetch(url)
    if (!res.ok) return null
    const buf = await res.arrayBuffer()
    let bin = ""
    const bytes = new Uint8Array(buf)
    const chunk = 0x8000
    for (let i = 0; i < bytes.length; i += chunk) {
      bin += String.fromCharCode(...bytes.subarray(i, i + chunk))
    }
    const type = url.endsWith(".woff2")
      ? "font/woff2"
      : url.endsWith(".woff")
        ? "font/woff"
        : "font/ttf"
    return `data:${type};base64,${btoa(bin)}`
  } catch {
    return null
  }
}

/**
 * Tiene solo i sottoinsiemi che servono a un testo latino.
 * Attenzione: il browser normalizza `unicode-range` (U+0000-00FF diventa U+0-ff),
 * quindi le stringhe vanno interpretate, non confrontate.
 */
function isLatinFace(cssText: string) {
  const m = cssText.match(/unicode-range:\s*([^;}]+)/i)
  if (!m) return true
  const LATIN_A = 0x41
  for (const part of m[1].split(",")) {
    const token = part.trim().replace(/^u\+/i, "")
    if (!token) continue
    if (token.includes("?")) {
      const from = parseInt(token.replace(/\?/g, "0"), 16)
      const to = parseInt(token.replace(/\?/g, "F"), 16)
      if (LATIN_A >= from && LATIN_A <= to) return true
      continue
    }
    const [a, b] = token.split("-")
    const from = parseInt(a, 16)
    const to = b ? parseInt(b, 16) : from
    if (Number.isNaN(from)) continue
    if (LATIN_A >= from && LATIN_A <= to) return true
  }
  return false
}

function familyOf(cssText: string) {
  const m = cssText.match(/font-family:\s*([^;}]+)/i)
  return (m?.[1] ?? "").replace(/["']/g, "").trim().toLowerCase()
}

/**
 * Raccoglie le @font-face del documento e le riscrive con i font incorporati
 * come data URI: dentro un SVG autonomo gli URL relativi non si risolvono.
 */
export async function collectFontCss(families?: string[]): Promise<string> {
  const want = (families ?? []).map((f) => f.toLowerCase())
  const key = want.slice().sort().join("|") || "*"
  const cached = fontCache.get(key)
  if (cached !== undefined) return cached

  const rules: string[] = []
  const jobs: Promise<void>[] = []

  for (const sheet of Array.from(document.styleSheets)) {
    let list: CSSRuleList
    try {
      list = sheet.cssRules
    } catch {
      continue
    }
    for (const rule of Array.from(list)) {
      if (!(rule instanceof CSSFontFaceRule)) continue
      const text = rule.cssText
      if (!isLatinFace(text)) continue
      const fam = familyOf(text)
      if (want.length && !want.some((f) => fam === f || fam.startsWith(f)))
        continue

      const m = text.match(/url\((["']?)([^"')]+)\1\)/)
      if (!m) {
        rules.push(text)
        continue
      }
      const idx = rules.length
      rules.push(text)
      // gli URL delle @font-face sono relativi al foglio di stile, non alla pagina
      const base = sheet.href ?? location.href
      jobs.push(
        toDataUrl(new URL(m[2], base).href).then((data) => {
          if (data) rules[idx] = text.replace(m[0], `url(${data})`)
          else rules[idx] = ""
        })
      )
    }
  }
  await Promise.all(jobs)
  const css = rules.filter(Boolean).join("\n")
  fontCache.set(key, css)
  return css
}

/* --------------------------- stili calcolati ----------------------------- */

/**
 * Solo le proprietà che contano davvero: copiare l'intero computed style
 * significherebbe portarsi dietro anche tutte le variabili CSS (--tw-*, --font-*…)
 * su ogni singolo elemento, gonfiando il file di megabyte.
 */
const COPY_PROPS = [
  "display",
  "position",
  "top",
  "right",
  "bottom",
  "left",
  "float",
  "clear",
  "width",
  "height",
  "min-width",
  "min-height",
  "max-width",
  "max-height",
  "margin-top",
  "margin-right",
  "margin-bottom",
  "margin-left",
  "padding-top",
  "padding-right",
  "padding-bottom",
  "padding-left",
  "box-sizing",
  "overflow",
  "z-index",
  "opacity",
  "visibility",
  "flex-direction",
  "flex-wrap",
  "justify-content",
  "align-items",
  "align-self",
  "align-content",
  "flex-grow",
  "flex-shrink",
  "flex-basis",
  "gap",
  "order",
  "grid-template-columns",
  "grid-template-rows",
  // colonne del documento: senza queste l'esportazione tornava a una colonna
  "column-count",
  "column-gap",
  "column-fill",
  "break-inside",
  "grid-column",
  "grid-row",
  "font-family",
  "font-size",
  "font-weight",
  "font-style",
  "font-variant",
  "line-height",
  "letter-spacing",
  "word-spacing",
  "text-align",
  "text-indent",
  "text-transform",
  "text-decoration-line",
  "text-decoration-color",
  "text-decoration-style",
  "text-underline-offset",
  "white-space",
  "word-break",
  "overflow-wrap",
  "vertical-align",
  "color",
  "direction",
  "background-color",
  "background-image",
  "background-size",
  "background-position",
  "background-repeat",
  "background-clip",
  "background-origin",
  "border-top-width",
  "border-right-width",
  "border-bottom-width",
  "border-left-width",
  "border-top-style",
  "border-right-style",
  "border-bottom-style",
  "border-left-style",
  "border-top-color",
  "border-right-color",
  "border-bottom-color",
  "border-left-color",
  "border-top-left-radius",
  "border-top-right-radius",
  "border-bottom-left-radius",
  "border-bottom-right-radius",
  "box-shadow",
  "outline",
  "transform",
  "transform-origin",
  "filter",
  "list-style-type",
  "list-style-position",
  "fill",
  "stroke",
  "stroke-width",
  "table-layout",
  "border-collapse",
  "border-spacing",
  "object-fit",
]

/**
 * Proprietà il cui zero coincide col valore di partenza in qualunque elemento:
 * solo queste si possono omettere. Margini e rientri no: dentro all'SVG non
 * c'è il reset del foglio di stile, e titoli, paragrafi ed elenchi riprendono i
 * margini predefiniti del browser. Neanche altezze e posizioni: `height: 0` o
 * `top: 0` omessi diventano «auto».
 */
const ZERO_BY_DEFAULT = /^(gap|text-indent|letter-spacing|word-spacing)$/

function copyStyle(src: Element, dst: Element) {
  const cs = window.getComputedStyle(src)
  const out: string[] = []
  for (const prop of COPY_PROPS) {
    const value = cs.getPropertyValue(prop)
    if (!value || value === "none" || value === "normal" || value === "auto")
      continue
    if (value === "0px" && ZERO_BY_DEFAULT.test(prop)) continue
    out.push(`${prop}:${value}`)
  }
  ;(dst as HTMLElement).setAttribute("style", out.join(";"))
  dst.removeAttribute("class")
}

function walk(src: Element, dst: Element) {
  copyStyle(src, dst)
  const s = Array.from(src.children)
  const d = Array.from(dst.children)
  for (let i = 0; i < s.length && i < d.length; i++) walk(s[i], d[i])
}

/* ------------------------------ cattura ---------------------------------- */

export type CaptureOptions = {
  width: number
  height: number
  background: string
  /** trasformazione da applicare ai livelli pan/zoom del clone */
  transform?: { x: number; y: number; scale: number }
  fontCss?: string
}

/**
 * Clona `el` in una stringa SVG autonoma.
 * `prepare` riceve il clone e può correggerne trasformazioni e dimensioni.
 */
export function elementToSvg(
  el: HTMLElement,
  opts: CaptureOptions,
  prepare?: (clone: HTMLElement) => void
): string {
  const clone = el.cloneNode(true) as HTMLElement
  walk(el, clone)
  prepare?.(clone)

  // il colore della carta arriva dal tema del documento, che può venire da un
  // file importato: dentro all'SVG finisce in un attributo, e un valore
  // storto potrebbe aggiungerne altri al file esportato
  const background = cssColor(opts.background) ?? "#ffffff"
  const width = Math.max(1, Math.round(opts.width))
  const height = Math.max(1, Math.round(opts.height))

  clone.setAttribute("xmlns", XHTML)
  clone.style.width = `${opts.width}px`
  clone.style.height = `${opts.height}px`
  clone.style.overflow = "hidden"
  clone.style.position = "relative"
  clone.style.margin = "0"
  clone.style.background = background
  clone.style.transform = "none"

  const html = new XMLSerializer().serializeToString(clone)
  const style = opts.fontCss ? `<style>${escapeXml(opts.fontCss)}</style>` : ""

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">${style}<rect width="100%" height="100%" fill="${escapeAttr(background)}"/><foreignObject x="0" y="0" width="${width}" height="${height}">${html}</foreignObject></svg>`
}

function escapeXml(s: string) {
  return s
    .replace(/&(?!(#\d+|#x[\da-f]+|\w+);)/gi, "&amp;")
    .replace(/</g, "&lt;")
}

/* ---------------------------- rasterizzazione ---------------------------- */

/**
 * Chromium rifiuta i canvas oltre ~16384px per lato o ~268 Mpx complessivi:
 * su board molto grandi la scala va ridotta, altrimenti il PNG esce vuoto.
 */
export function safeScale(width: number, height: number, desired: number) {
  const MAX_SIDE = 16384
  const MAX_AREA = 2.4e8
  const bySide = Math.min(MAX_SIDE / width, MAX_SIDE / height)
  const byArea = Math.sqrt(MAX_AREA / (width * height))
  // anche sotto 1: con un minimo di 1 un documento di centinaia di pagine
  // superava comunque il limite, e il PNG usciva vuoto
  return Math.max(0.05, Math.min(desired, bySide, byArea))
}

export function svgToBlob(svg: string) {
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
}

/**
 * Rasterizza un elemento del DOM.
 *
 * Non si passa da <foreignObject>: Chromium considera "sporco" (tainted) un
 * canvas su cui è stata disegnata un'immagine SVG che lo contiene, e il PNG
 * non si potrebbe più estrarre. html2canvas-pro ridisegna il DOM con primitive
 * di canvas, quindi il risultato resta esportabile.
 */
export async function elementToPngBlob(
  el: HTMLElement,
  opts: {
    width: number
    height: number
    background: string
    scale?: number
    onClone?: (doc: Document, node: HTMLElement) => void
  }
): Promise<{ blob: Blob; width: number; height: number }> {
  const { default: html2canvas } = await import("html2canvas-pro")
  const canvas = await html2canvas(el, {
    backgroundColor: opts.background,
    scale: opts.scale ?? 2,
    width: opts.width,
    height: opts.height,
    windowWidth: Math.max(opts.width, el.scrollWidth),
    windowHeight: Math.max(opts.height, el.scrollHeight),
    useCORS: true,
    logging: false,
    onclone: (doc: Document) => {
      removeEmptyPseudos(doc)
      if (!opts.onClone || !el.id) return
      const node = doc.getElementById(el.id) as HTMLElement | null
      if (node) opts.onClone(doc, node)
    },
  })
  const blob = await new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (b) =>
        b ? resolve(b) : reject(new Error(tr("Conversione PNG fallita"))),
      "image/png"
    )
  )
  return { blob, width: canvas.width, height: canvas.height }
}

export function download(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function safeName(title: string) {
  return (
    title
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, "")
      .replace(/\s+/g, "-")
      .toLowerCase()
      .slice(0, 60) || "cogniva"
  )
}
