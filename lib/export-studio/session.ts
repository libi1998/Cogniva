"use client"

import { renderBoardSvg } from "@/lib/export-board"
import { svgToBlob } from "@/lib/export"
import type { BoardData, DocMargins, PageFormat } from "@/lib/types"
import { formatMm, type Orientation } from "@/lib/page"
import {
  CANVAS_MAX_AREA,
  CANVAS_MAX_SIDE,
  captureBand,
  createRenderHost,
  paperCanvas,
} from "./raster"

/**
 * Una sessione di esportazione: prepara una volta il documento (o la board) e
 * poi disegna le pagine che servono, alla risoluzione che serve, sia per
 * l'anteprima sia per il file. Le misure sono in pixel CSS.
 */

/** Una parola sulla pagina: posizione, linea di base e corpo del carattere */
export type PageWord = {
  text: string
  x: number
  baseline: number
  width: number
  size: number
}

export type SessionLayout = { pages: number; width: number; height: number }

export type PaperChoice = { format: PageFormat; orientation: Orientation }

export type ExportSession = {
  kind: "doc" | "board"
  /** impagina (per i documenti senza formato, sulla carta scelta) */
  layout: (paper: PaperChoice) => Promise<SessionLayout>
  /** disegna le pagine richieste, in ordine, una alla volta */
  render: (
    indices: number[],
    opts: {
      scale: number
      signal?: AbortSignal
      onPage: (index: number, canvas: HTMLCanvasElement) => Promise<void> | void
    }
  ) => Promise<void>
  /** le parole di una pagina, per il testo selezionabile del PDF */
  words: (index: number) => PageWord[]
  dispose: () => void
}

/* ------------------------------ documenti ------------------------------ */

/** Il foglio clonato dall'editor, già pronto per la carta */
export type DocSnapshot = {
  clone: HTMLElement
  /** misura della pagina se il documento ha un formato di carta */
  page: { w: number; h: number } | null
  pages: number
  margins: DocMargins
  paper: string
  columns: number
}

type Slice = { top: number; height: number; dy: number }

export async function createDocSession(
  snapshot: DocSnapshot
): Promise<ExportSession> {
  const host = await createRenderHost()
  let key = ""
  let node: HTMLElement | null = null
  let width = 0
  let height = 0
  let slices: Slice[] = []
  let words: PageWord[][] = []
  // impaginare e disegnare usano lo stesso foglio: un'operazione alla volta
  let chain: Promise<unknown> = Promise.resolve()
  const serial = <T>(task: () => Promise<T>): Promise<T> => {
    const run = chain.then(task, task)
    chain = run.catch(() => undefined)
    return run
  }

  return {
    kind: "doc",
    layout: (paper) =>
      serial(async () => {
        const next = snapshot.page
          ? "fixed"
          : `${paper.format}:${paper.orientation}`
        if (next === key && node) return { pages: slices.length, width, height }
        key = next
        if (snapshot.page) {
          width = snapshot.page.w
          height = snapshot.page.h
          node = await host.mount(snapshot.clone, width)
          const total = Math.max(1, snapshot.pages)
          slices = Array.from({ length: total }, (_, i) => ({
            top: i * height,
            height,
            dy: 0,
          }))
        } else {
          // misure esatte, senza arrotondare: un A4 è 841,89 × 595,28 punti
          const mm = formatMm(paper.format, paper.orientation) ?? [210, 297]
          width = (mm[0] * 96) / 25.4
          height = (mm[1] * 96) / 25.4
          const mounted = await host.mount(snapshot.clone, width)
          reflow(mounted, width, snapshot)
          await host.settle(mounted)
          node = mounted
          slices = paginate(mounted, height, snapshot)
        }
        words = collectWords(node, slices)
        return { pages: slices.length, width, height }
      }),
    render: (indices, opts) =>
      serial(async () => {
        if (!node) return
        for (const run of runs(indices, slices, width, opts.scale)) {
          opts.signal?.throwIfAborted()
          const first = slices[run[0]]
          const last = slices[run[run.length - 1]]
          const top = first.top
          const bottom = last.top + last.height
          const band = await captureBand(node, {
            top,
            height: bottom - top,
            width,
            scale: opts.scale,
            background: snapshot.paper,
            signal: opts.signal,
          })
          const ratio = band.width / width
          for (const index of run) {
            opts.signal?.throwIfAborted()
            const slice = slices[index]
            const page = paperCanvas(
              width * ratio,
              height * ratio,
              snapshot.paper
            )
            page
              .getContext("2d")
              ?.drawImage(
                band,
                0,
                Math.round((slice.top - top) * ratio),
                band.width,
                Math.round(slice.height * ratio),
                0,
                Math.round(slice.dy * ratio),
                band.width,
                Math.round(slice.height * ratio)
              )
            await opts.onPage(index, page)
          }
        }
      }),
    words: (index) => words[index] ?? [],
    dispose: () => host.dispose(),
  }
}

/** Il documento senza formato prende la larghezza e i margini della carta */
function reflow(node: HTMLElement, width: number, snapshot: DocSnapshot) {
  const { margins } = snapshot
  Object.assign(node.style, {
    width: `${width}px`,
    height: "auto",
    minHeight: "0px",
    padding: `${margins.top}px ${margins.right}px ${margins.bottom}px ${margins.left}px`,
    background: snapshot.paper,
    boxShadow: "none",
    borderRadius: "0px",
    margin: "0px",
  })
}

/**
 * Pagine per un documento senza formato: si taglia fra un blocco e l'altro,
 * come fa la stampa, e dopo ogni interruzione di pagina. Un blocco più alto
 * di una pagina si divide dove capita.
 */
function paginate(
  node: HTMLElement,
  pageHeight: number,
  snapshot: DocSnapshot
): Slice[] {
  const { margins } = snapshot
  const origin = node.getBoundingClientRect().top
  const prose = node.querySelector(".ProseMirror") ?? node
  const blocks = Array.from(prose.children)
    .map((el) => {
      const rect = el.getBoundingClientRect()
      return {
        top: rect.top - origin,
        bottom: rect.bottom - origin,
        breakAfter: el.hasAttribute("data-page-break"),
      }
    })
    .filter((b) => b.bottom > b.top || b.breakAfter)
    .sort((a, b) => a.top - b.top)

  const room = Math.max(80, pageHeight - margins.top - margins.bottom)
  const contentTop = margins.top
  const contentEnd = Math.max(contentTop + 1, ...blocks.map((b) => b.bottom))
  // con più colonne il testo non scende in ordine: si taglia a fasce
  const byBlocks = snapshot.columns <= 1

  const slices: Slice[] = []
  let start = contentTop
  while (start < contentEnd - 1 && slices.length < 2000) {
    const limit = start + room
    let cut = Math.min(limit, contentEnd)
    if (byBlocks) {
      for (const block of blocks) {
        if (block.bottom <= start + 1) continue
        if (block.breakAfter && block.bottom <= limit) {
          cut = block.bottom
          break
        }
        if (block.bottom > limit) {
          if (block.top > start + 1) cut = block.top
          break
        }
      }
    }
    if (cut <= start + 1) cut = Math.min(limit, contentEnd)
    // l'ultima pagina prende tutto lo spazio: niente righe tagliate in fondo
    const last = cut >= contentEnd - 1
    slices.push({
      top: start,
      height: last ? room : cut - start,
      dy: margins.top,
    })
    start = cut
  }
  if (!slices.length)
    slices.push({ top: contentTop, height: room, dy: margins.top })
  return slices
}

/** Gruppi di pagine consecutive che stanno in un solo canvas */
function runs(
  indices: number[],
  slices: Slice[],
  width: number,
  scale: number
) {
  const out: number[][] = []
  let current: number[] = []
  let top = 0
  for (const index of indices) {
    const slice = slices[index]
    if (!slice) continue
    const previous = current[current.length - 1]
    const span = slice.top + slice.height - top
    const fits =
      current.length > 0 &&
      index === previous + 1 &&
      span * scale <= CANVAS_MAX_SIDE &&
      span * width * scale * scale <= CANVAS_MAX_AREA
    if (fits) {
      current.push(index)
    } else {
      if (current.length) out.push(current)
      current = [index]
      top = slice.top
    }
  }
  if (current.length) out.push(current)
  return out
}

/** Le parole del testo con la loro posizione, pagina per pagina */
function collectWords(node: HTMLElement, slices: Slice[]): PageWord[][] {
  const doc = node.ownerDocument
  const view = doc.defaultView
  const pages: PageWord[][] = slices.map(() => [])
  if (!view) return pages
  const origin = node.getBoundingClientRect()
  const styles = new Map<Element, { size: number; visible: boolean }>()
  // testo per i lettori di schermo, nascosto a video (es. le etichette delle
  // caselle da spuntare): sulla carta non c'è, quindi nemmeno nel PDF
  const hidden = (el: Element) => {
    for (let n: Element | null = el, i = 0; n && n !== node && i < 4; i++) {
      const r = n.getBoundingClientRect()
      if (r.width <= 1 && r.height <= 1) return true
      const cs = view.getComputedStyle(n)
      if (cs.clip !== "auto" && cs.clip.startsWith("rect(0")) return true
      n = n.parentElement
    }
    return false
  }
  const range = doc.createRange()
  const walker = doc.createTreeWalker(node, NodeFilter.SHOW_TEXT)
  let slice = 0

  for (let text = walker.nextNode(); text; text = walker.nextNode()) {
    const parent = text.parentElement
    const value = text.textContent ?? ""
    if (!parent || !value.trim()) continue
    if (parent.closest(".katex-mathml, style, script, [data-guide]")) continue
    let info = styles.get(parent)
    if (!info) {
      const cs = view.getComputedStyle(parent)
      info = {
        size: parseFloat(cs.fontSize) || 16,
        visible:
          cs.visibility !== "hidden" &&
          cs.display !== "none" &&
          Number(cs.opacity) > 0.01 &&
          !hidden(parent),
      }
      styles.set(parent, info)
    }
    if (!info.visible) continue

    for (const match of value.matchAll(/\S+\s*/g)) {
      const word = match[0].trimEnd()
      const from = match.index ?? 0
      range.setStart(text, from)
      range.setEnd(text, from + word.length)
      const rect = range.getClientRects()[0]
      if (!rect || rect.width < 0.5 || rect.height < 0.5) continue
      const top = rect.top - origin.top
      const center = top + rect.height / 2
      // le parole scendono quasi sempre in ordine: si riparte dalla pagina di prima
      if (!inside(slices[slice], center)) {
        const found = slices.findIndex((s) => inside(s, center))
        if (found < 0) continue
        slice = found
      }
      const s = slices[slice]
      pages[slice].push({
        text: `${word} `,
        x: rect.left - origin.left,
        baseline: top + rect.height * 0.8 - s.top + s.dy,
        width: rect.width,
        size: Math.min(info.size, rect.height),
      })
    }
  }
  return pages
}

const inside = (slice: Slice | undefined, y: number) =>
  slice !== undefined && y >= slice.top && y < slice.top + slice.height

/* -------------------------------- board -------------------------------- */

export async function createBoardSession(opts: {
  data: BoardData
  background: string
}): Promise<ExportSession & { svg: () => Blob }> {
  const { svg, width, height } = await renderBoardSvg(
    opts.data,
    opts.background,
    64
  )
  const url = URL.createObjectURL(svgToBlob(svg))
  const image = new Image()
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve()
    image.onerror = () => reject(new Error("board"))
    image.src = url
  })
  if (document.fonts?.ready) await document.fonts.ready

  return {
    kind: "board",
    layout: async () => ({ pages: 1, width, height }),
    render: async (indices, { scale, onPage }) => {
      if (!indices.includes(0)) return
      const safe = Math.min(
        scale,
        CANVAS_MAX_SIDE / width,
        CANVAS_MAX_SIDE / height,
        Math.sqrt(CANVAS_MAX_AREA / (width * height))
      )
      const canvas = paperCanvas(width * safe, height * safe, opts.background)
      canvas
        .getContext("2d")
        ?.drawImage(image, 0, 0, canvas.width, canvas.height)
      await onPage(0, canvas)
    },
    words: () => [],
    svg: () => svgToBlob(svg),
    dispose: () => URL.revokeObjectURL(url),
  }
}
