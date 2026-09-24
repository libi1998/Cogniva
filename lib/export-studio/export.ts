"use client"

import { PdfWriter } from "./pdf"
import { VectorPdfWriter } from "./pdf-vector"
import { parseColor } from "./vector"
import { sceneToSvg } from "./svg-vector"
import {
  QUALITY,
  canvasToBlob,
  fitScale,
  grayscale,
  paperCanvas,
  pdfImage,
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

/**
 * Il testo della pagina, invisibile sopra al disegno: nel PDF si cerca e si
 * copia sempre, anche dove la pagina è un'immagine
 */
function pdfWords(session: ExportSession, index: number, unit: number) {
  return session.words(index).map((w) => ({
    text: w.text,
    x: w.x * unit,
    y: w.baseline * unit,
    width: w.width * unit,
    size: w.size * unit,
  }))
}

export async function exportPdf(
  session: ExportSession,
  layout: SessionLayout,
  opts: {
    indices: number[]
    gray: boolean
    title: string
    language?: string
    signal?: AbortSignal
    onProgress?: Progress
  }
): Promise<Blob> {
  const q = QUALITY
  const unit = Math.min(PT, PDF_MAX / Math.max(layout.width, layout.height))

  // un PDF vero: testo, forme e tabelle a vettori, le foto come immagini
  if (session.vector) {
    try {
      return await vectorPdf(session, layout, opts, unit)
    } catch (error) {
      if (opts.signal?.aborted) throw error
      // qualcosa che il disegno vettoriale non sa fare: si ripiega sulle
      // pagine come immagini, con il testo selezionabile sopra
      console.warn("PDF vettoriale non riuscito, si passa alle immagini", error)
    }
  }

  const writer = new PdfWriter()
  let done = 0
  opts.onProgress?.(0, opts.indices.length)
  await session.render(opts.indices, {
    scale: fitScale(layout.width, layout.height),
    signal: opts.signal,
    onPage: async (index, canvas) => {
      if (opts.gray) grayscale(canvas)
      const image = await pdfImage(canvas, {
        lossless: q.lossless,
        gray: opts.gray,
        jpeg: q.jpeg,
      })
      await writer.addPage({
        width: layout.width * unit,
        height: layout.height * unit,
        image,
        words: pdfWords(session, index, unit),
      })
      opts.onProgress?.(++done, opts.indices.length)
    },
  })
  opts.signal?.throwIfAborted()
  return writer.finish({ title: opts.title, language: opts.language })
}

async function vectorPdf(
  session: ExportSession,
  layout: SessionLayout,
  opts: {
    indices: number[]
    gray: boolean
    title: string
    language?: string
    signal?: AbortSignal
    onProgress?: Progress
  },
  unit: number
) {
  const q = QUALITY
  const vector = session.vector
  if (!vector) throw new Error("vector")
  opts.onProgress?.(0, opts.indices.length)
  const { scene, slices, paper } = await vector({
    scale: q.scale,
    jpeg: q.jpeg,
    lossless: q.lossless,
    gray: opts.gray,
  })
  opts.signal?.throwIfAborted()
  const writer = new VectorPdfWriter(scene.fonts, { gray: opts.gray, unit })
  const paperColor = parseColor(paper)
  let done = 0
  for (const index of opts.indices) {
    opts.signal?.throwIfAborted()
    const slice = slices[index]
    if (!slice) continue
    await writer.addPage({
      width: layout.width,
      height: layout.height,
      slice,
      paints: scene.paints,
      paper: paperColor,
      words: pdfWords(session, index, unit),
    })
    opts.onProgress?.(++done, opts.indices.length)
  }
  return writer.finish({ title: opts.title, language: opts.language })
}

/**
 * Il documento in un SVG vero, tutto il foglio in un file: la stessa scena
 * del PDF vettoriale, con il testo trasparente sopra per cercarlo.
 */
export async function exportSvg(
  session: ExportSession,
  layout: SessionLayout,
  opts: { gray: boolean; title: string; signal?: AbortSignal }
): Promise<Blob> {
  const vector = session.vector
  if (!vector) throw new Error("vector")
  const { scene, slices, paper } = await vector({
    scale: QUALITY.scale,
    jpeg: QUALITY.jpeg,
    lossless: QUALITY.lossless,
    gray: opts.gray,
  })
  opts.signal?.throwIfAborted()
  const height = Math.max(layout.height, ...slices.map((s) => s.top + s.height))
  // le parole della sessione sono per pagina: tornano sul foglio intero
  const words = slices.flatMap((slice, index) =>
    session.words(index).map((w) => ({
      ...w,
      baseline: w.baseline + slice.top - slice.dy,
    }))
  )
  const svg = await sceneToSvg(scene, {
    width: layout.width,
    height,
    paper: parseColor(paper),
    gray: opts.gray,
    words,
    title: opts.title,
  })
  return new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
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
    gray: boolean
    combine: boolean
    name: string
    signal?: AbortSignal
    onProgress?: Progress
  }
): Promise<{ blob: Blob; filename: string }> {
  const total = opts.indices.length
  let done = 0
  opts.onProgress?.(0, total)

  if (total > 1 && opts.combine) {
    const fullHeight = layout.height * total
    const scale = fitScale(layout.width, fullHeight)
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
    scale: fitScale(layout.width, layout.height),
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
