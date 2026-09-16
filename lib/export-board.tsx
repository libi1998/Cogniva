"use client"

import * as React from "react"
import { createRoot } from "react-dom/client"
import { flushSync } from "react-dom"

import {
  BoardPreview,
  boardPreviewBounds,
} from "@/components/board/board-preview"
import {
  collectFontCss,
  download,
  printSvg,
  safeName,
  safeScale,
  svgToBlob,
} from "./export"
import { fontMap } from "./fonts"
import { formatMm, formatPx, pxToMm } from "./page"
import type { BoardData } from "./types"

import { tr } from "@/lib/i18n/client"
export type ExportFormat = "svg" | "png" | "pdf"

/**
 * Riquadro dell'esportazione: la pagina impostata, se c'è, altrimenti il
 * contenuto con un margine.
 */
function boardBounds(data: BoardData, padding = 64) {
  const page = formatPx(data.theme.page.format, data.theme.page.orientation)
  if (page) return { x: 0, y: 0, w: page.w, h: page.h }
  return boardPreviewBounds(data, padding)
}

/** Sostituisce i riferimenti var(--x) con i valori effettivi del tema corrente */
function inlineCssVars(markup: string) {
  const cs = window.getComputedStyle(document.documentElement)
  const seen = new Map<string, string>()
  const resolve = (name: string): string => {
    const cached = seen.get(name)
    if (cached !== undefined) return cached
    let value = cs.getPropertyValue(name).trim()
    if (value.includes("var(")) value = inlineCssVars(value)
    // i valori finiscono dentro attributi XML delimitati da apici doppi
    // (font-family risolve in «"Manrope", "Manrope Fallback"»)
    value = value.replace(/"/g, "'")
    seen.set(name, value)
    return value
  }
  return markup.replace(
    /var\((--[\w-]+)\)/g,
    (whole, name: string) => resolve(name) || whole
  )
}

/**
 * Rende la board in SVG *nativo* (niente <foreignObject>): il file resta leggero
 * e vettoriale, e può essere rasterizzato senza che il canvas venga marcato come
 * "tainted" da Chromium.
 */
async function renderBoardSvg(
  data: BoardData,
  background: string,
  padding: number
) {
  const b = boardBounds(data, padding)
  const width = Math.max(1, Math.round(b.w))
  const height = Math.max(1, Math.round(b.h))

  const holder = document.createElement("div")
  holder.style.cssText =
    "position:fixed;left:-100000px;top:0;width:1px;height:1px;overflow:hidden"
  document.body.appendChild(holder)

  let markup = ""
  const root = createRoot(holder)
  try {
    flushSync(() => {
      root.render(
        <BoardPreview
          data={data}
          background={background}
          padding={padding}
          bounds={b}
          style={{ width, height }}
        />
      )
    })
    const svg = holder.querySelector("svg")
    if (!svg) throw new Error(tr("Anteprima non disponibile"))
    svg.setAttribute("xmlns", "http://www.w3.org/2000/svg")
    svg.setAttribute("width", String(width))
    svg.setAttribute("height", String(height))
    svg.setAttribute("style", `background:${background}`)
    svg.removeAttribute("class")
    markup = new XMLSerializer().serializeToString(svg)
  } finally {
    root.unmount()
    holder.remove()
  }

  markup = inlineCssVars(markup)

  const family = fontMap[data.theme.font]?.family
  const fontCss = await collectFontCss(family ? [family] : undefined)
  const style = fontCss ? `<style>${fontCss}</style>` : ""
  markup = markup.replace(
    />/,
    `><rect x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" fill="${background}"/>`
  )
  if (style) markup = markup.replace(/>/, `>${style}`)

  return { svg: markup, width, height }
}

export async function exportBoard({
  data,
  title,
  format,
  background,
  scale = 3,
  padding = 64,
}: {
  data: BoardData
  title: string
  format: ExportFormat
  background: string
  scale?: number
  padding?: number
}) {
  const { svg, width, height } = await renderBoardSvg(data, background, padding)
  const name = safeName(title)

  if (format === "svg") {
    download(svgToBlob(svg), `${name}.svg`)
    return
  }

  if (format === "pdf") {
    // niente rasterizzazione: si passa dal motore di stampa del browser, che
    // produce un PDF vettoriale con il testo selezionabile
    const mm =
      formatMm(data.theme.page.format, data.theme.page.orientation) ??
      ([pxToMm(width), pxToMm(height)] as [number, number])
    await printSvg(svg, mm, title)
    return
  }

  const png = await rasterize(
    svg,
    width,
    height,
    safeScale(width, height, scale)
  )
  download(png, `${name}.png`)
}

async function rasterize(
  svg: string,
  width: number,
  height: number,
  scale: number
): Promise<Blob> {
  const url = URL.createObjectURL(svgToBlob(svg))
  try {
    const img = new Image()
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () =>
        reject(new Error(tr("Impossibile rasterizzare la board")))
      img.src = url
    })
    // i font incorporati devono essere pronti prima di disegnare
    if (document.fonts?.ready) await document.fonts.ready
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(width * scale)
    canvas.height = Math.round(height * scale)
    const ctx = canvas.getContext("2d")
    if (!ctx) throw new Error(tr("Canvas non disponibile"))
    ctx.scale(scale, scale)
    ctx.drawImage(img, 0, 0, width, height)
    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob
            ? resolve(blob)
            : reject(new Error(tr("Conversione PNG fallita"))),
        "image/png"
      )
    )
  } finally {
    URL.revokeObjectURL(url)
  }
}
