"use client"

import { PdfWriter } from "./pdf"
import {
  CANVAS_MAX_AREA,
  CANVAS_MAX_SIDE,
  QUALITY,
  canvasToBlob,
  grayscale,
  paperCanvas,
  pdfImage,
  type ExportQuality,
} from "./raster"
import type { ExportSession, SessionLayout } from "./session"
import { makeZip } from "./zip"

/** 1 pixel CSS = 0,75 punti tipografici; il PDF non va oltre 14 400 punti */
const PT = 0.75
const PDF_MAX = 14400

type Progress = (done: number, total: number) => void

/**
 * Le pagine scritte come «1-3, 5, 8-» (numerate da 1) in indici da 0.
 * Restituisce null se il testo non si capisce o non indica nessuna pagina.
 */
export function parsePageRange(text: string, total: number): number[] | null {
  const pages = new Set<number>()
  const parts = text
    .split(/[,;]/)
    .map((p) => p.trim())
    .filter(Boolean)
  if (!parts.length) return null
  for (const part of parts) {
    const match = part.match(/^(\d+)?\s*(?:[-–—]\s*(\d+)?)?$/)
    if (!match || (!match[1] && !match[2])) return null
    const dash = /[-–—]/.test(part)
    const from = match[1] ? Number(match[1]) : 1
    const to = dash ? (match[2] ? Number(match[2]) : total) : from
    if (from < 1 || to < from) return null
    for (let p = from; p <= Math.min(to, total); p++) pages.add(p - 1)
  }
  return pages.size ? [...pages].sort((a, b) => a - b) : null
}

export async function exportPdf(
  session: ExportSession,
  layout: SessionLayout,
  opts: {
    indices: number[]
    quality: ExportQuality
    gray: boolean
    selectable: boolean
    title: string
    language?: string
    signal?: AbortSignal
    onProgress?: Progress
  }
): Promise<Blob> {
  const q = QUALITY[opts.quality]
  const unit = Math.min(PT, PDF_MAX / Math.max(layout.width, layout.height))
  const writer = new PdfWriter()
  let done = 0
  opts.onProgress?.(0, opts.indices.length)
  await session.render(opts.indices, {
    scale: q.scale,
    signal: opts.signal,
    onPage: async (index, canvas) => {
      if (opts.gray) grayscale(canvas)
      const image = await pdfImage(canvas, {
        lossless: q.lossless,
        gray: opts.gray,
        jpeg: q.jpeg,
      })
      const words = opts.selectable
        ? session.words(index).map((w) => ({
            text: w.text,
            x: w.x * unit,
            y: w.baseline * unit,
            width: w.width * unit,
            size: w.size * unit,
          }))
        : undefined
      await writer.addPage({
        width: layout.width * unit,
        height: layout.height * unit,
        image,
        words,
      })
      opts.onProgress?.(++done, opts.indices.length)
    },
  })
  opts.signal?.throwIfAborted()
  return writer.finish({ title: opts.title, language: opts.language })
}

/**
 * Le pagine in PNG: una sola pagina è un'immagine, più pagine un archivio
 * .zip oppure, se richiesto, un'unica immagine con le pagine una sotto l'altra.
 */
export async function exportPng(
  session: ExportSession,
  layout: SessionLayout,
  opts: {
    indices: number[]
    quality: ExportQuality
    gray: boolean
    combine: boolean
    name: string
    signal?: AbortSignal
    onProgress?: Progress
  }
): Promise<{ blob: Blob; filename: string }> {
  const q = QUALITY[opts.quality]
  const total = opts.indices.length
  let done = 0
  opts.onProgress?.(0, total)

  if (total > 1 && opts.combine) {
    const fullHeight = layout.height * total
    const scale = Math.min(
      q.scale,
      CANVAS_MAX_SIDE / layout.width,
      CANVAS_MAX_SIDE / fullHeight,
      Math.sqrt(CANVAS_MAX_AREA / (layout.width * fullHeight))
    )
    const sheet = paperCanvas(
      layout.width * scale,
      fullHeight * scale,
      "transparent"
    )
    const ctx = sheet.getContext("2d")
    let row = 0
    await session.render(opts.indices, {
      scale,
      signal: opts.signal,
      onPage: (_index, canvas) => {
        if (opts.gray) grayscale(canvas)
        ctx?.drawImage(
          canvas,
          0,
          Math.round(row * layout.height * scale),
          sheet.width,
          Math.round(layout.height * scale)
        )
        row++
        opts.onProgress?.(++done, total)
      },
    })
    opts.signal?.throwIfAborted()
    return {
      blob: await canvasToBlob(sheet, "image/png"),
      filename: `${opts.name}.png`,
    }
  }

  const files: { name: string; blob: Blob }[] = []
  const digits = String(Math.max(...opts.indices) + 1).length
  await session.render(opts.indices, {
    scale: q.scale,
    signal: opts.signal,
    onPage: async (index, canvas) => {
      if (opts.gray) grayscale(canvas)
      files.push({
        name: `${opts.name}-${String(index + 1).padStart(digits, "0")}.png`,
        blob: await canvasToBlob(canvas, "image/png"),
      })
      opts.onProgress?.(++done, total)
    },
  })
  opts.signal?.throwIfAborted()
  if (files.length === 1)
    return { blob: files[0].blob, filename: `${opts.name}.png` }
  return { blob: await makeZip(files), filename: `${opts.name}.zip` }
}

/** Anteprima: pagine leggere in JPEG, consegnate man mano che sono pronte */
export async function renderPreview(
  session: ExportSession,
  layout: SessionLayout,
  opts: {
    width: number
    signal: AbortSignal
    onPage: (index: number, url: string) => void
  }
) {
  const scale = Math.max(0.3, Math.min(2, opts.width / layout.width))
  const indices = Array.from({ length: layout.pages }, (_, i) => i)
  await session.render(indices, {
    scale,
    signal: opts.signal,
    onPage: async (index, canvas) => {
      const blob = await canvasToBlob(canvas, "image/jpeg", 0.86)
      if (opts.signal.aborted) return
      opts.onPage(index, URL.createObjectURL(blob))
    },
  })
}
