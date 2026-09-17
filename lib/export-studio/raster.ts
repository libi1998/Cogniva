"use client"

import { deflate, type PdfImage } from "./pdf"

/**
 * Pezzi comuni delle esportazioni in immagine: la «stanza» isolata dove si
 * disegnano le pagine, i limiti dei canvas e la codifica dei pixel.
 */

/* ------------------------------ qualità -------------------------------- */

export type ExportQuality = "draft" | "standard" | "high"

/** Pixel per pixel CSS e codifica: 96, 192 e 300 punti per pollice */
export const QUALITY: Record<
  ExportQuality,
  { scale: number; dpi: number; lossless: boolean; jpeg: number }
> = {
  draft: { scale: 1, dpi: 96, lossless: false, jpeg: 0.8 },
  standard: { scale: 2, dpi: 192, lossless: false, jpeg: 0.9 },
  high: { scale: 300 / 96, dpi: 300, lossless: true, jpeg: 0.95 },
}

/**
 * Chromium rifiuta i canvas oltre ~16384 px per lato o ~268 milioni di pixel:
 * le pagine si disegnano a gruppi che ci stanno.
 */
export const CANVAS_MAX_SIDE = 16000
export const CANVAS_MAX_AREA = 2.2e8

/* --------------------------- stanza isolata ---------------------------- */

export type RenderHost = {
  doc: Document
  root: HTMLElement
  mount: (node: HTMLElement, width: number) => Promise<HTMLElement>
  /** dopo aver cambiato stili al nodo montato: impaginazione e caratteri */
  settle: (node: HTMLElement) => Promise<void>
  dispose: () => void
}

/**
 * Un iframe nascosto con gli stessi fogli di stile dell'app ma senza l'app:
 * html2canvas clona il documento che contiene l'elemento a ogni disegno, e
 * clonare solo il foglio invece di tutto l'editor è molto più veloce. Il tema
 * scuro resta fuori: sulla carta il documento è sempre chiaro.
 */
export async function createRenderHost(): Promise<RenderHost> {
  const frame = document.createElement("iframe")
  frame.setAttribute("aria-hidden", "true")
  frame.tabIndex = -1
  frame.style.cssText =
    "position:fixed;left:-200000px;top:0;width:1200px;height:900px;border:0;opacity:0;pointer-events:none;"
  document.body.appendChild(frame)
  const doc = frame.contentDocument
  if (!doc) {
    frame.remove()
    throw new Error("iframe")
  }

  const styles = Array.from(
    document.querySelectorAll<HTMLElement>('link[rel="stylesheet"], style')
  )
    .map((el) => el.outerHTML)
    .join("")
  const html = document.documentElement
  const htmlClass = Array.from(html.classList)
    .filter((c) => c !== "dark")
    .join(" ")
  doc.open()
  doc.write(
    `<!doctype html><html lang="${html.lang}" class="${htmlClass}" style="color-scheme:light"><head><meta charset="utf-8"><base href="${document.baseURI}">${styles}<style>html,body{margin:0;padding:0;background:transparent}</style></head><body class="${document.body.className}"><div id="cogniva-export-root"></div></body></html>`
  )
  doc.close()

  // i fogli di stile esterni vanno caricati prima di misurare qualsiasi cosa
  await Promise.all(
    Array.from(
      doc.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]')
    ).map((link) =>
      link.sheet
        ? Promise.resolve()
        : new Promise<void>((resolve) => {
            link.addEventListener("load", () => resolve(), { once: true })
            link.addEventListener("error", () => resolve(), { once: true })
            setTimeout(resolve, 5000)
          })
    )
  )

  const root = doc.getElementById("cogniva-export-root") as HTMLElement
  return {
    doc,
    root,
    mount: async (node, width) => {
      frame.style.width = `${Math.ceil(width)}px`
      const adopted = doc.importNode(node, true) as HTMLElement
      root.replaceChildren(adopted)
      // una lettura forza l'impaginazione, poi i caratteri che servono
      void adopted.offsetHeight
      await settleFonts(doc)
      return adopted
    },
    settle: async (node) => {
      void node.offsetHeight
      await settleFonts(doc)
    },
    dispose: () => frame.remove(),
  }
}

async function settleFonts(doc: Document) {
  try {
    await (doc as Document & { fonts?: FontFaceSet }).fonts?.ready
  } catch {
    // senza FontFaceSet si prosegue con quello che c'è
  }
  await new Promise((r) => setTimeout(r, 30))
}

/* ------------------------------- disegno ------------------------------- */

/** Rasterizza una fascia verticale di un elemento della stanza isolata */
export async function captureBand(
  node: HTMLElement,
  band: {
    top: number
    height: number
    width: number
    scale: number
    background: string
    signal?: AbortSignal
  }
) {
  const { default: html2canvas } = await import("html2canvas-pro")
  return html2canvas(node, {
    x: 0,
    y: band.top,
    width: band.width,
    height: band.height,
    scale: band.scale,
    backgroundColor: band.background,
    windowWidth: band.width,
    windowHeight: node.ownerDocument.defaultView?.innerHeight ?? 900,
    useCORS: true,
    logging: false,
    imageTimeout: 15000,
    signal: band.signal,
    onclone: removeEmptyPseudos,
  } as Parameters<typeof html2canvas>[1])
}

/**
 * html2canvas trasforma ::before e ::after in elementi veri, anche quando non
 * disegnano nulla. Messi come primo o ultimo figlio rompono le regole come
 * «:first-child { margin-top: 0 }» e il contenuto scivola in basso: quelli
 * vuoti e senza dimensioni si tolgono prima di disegnare.
 */
export function removeEmptyPseudos(doc: Document) {
  const pseudos = Array.from(
    doc.getElementsByTagName("html2canvaspseudoelement")
  )
  for (const el of pseudos) {
    // il contenuto «""» diventa un nodo di testo vuoto: conta come vuoto
    if (el.children.length || el.textContent) continue
    const rect = el.getBoundingClientRect()
    if (rect.width === 0 || rect.height === 0) el.remove()
  }
}

/** Bianco e nero, sul posto */
export function grayscale(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) return
  const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const px = image.data
  for (let i = 0; i < px.length; i += 4) {
    const y = Math.round(
      px[i] * 0.2126 + px[i + 1] * 0.7152 + px[i + 2] * 0.0722
    )
    px[i] = px[i + 1] = px[i + 2] = y
  }
  ctx.putImageData(image, 0, 0)
}

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: "image/png" | "image/jpeg",
  quality?: number
) {
  return new Promise<Blob>((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("canvas"))),
      type,
      quality
    )
  )
}

/** I pixel della pagina come immagine per il PDF */
export async function pdfImage(
  canvas: HTMLCanvasElement,
  opts: { lossless: boolean; gray: boolean; jpeg: number }
): Promise<PdfImage> {
  const { width, height } = canvas
  if (opts.lossless) {
    const ctx = canvas.getContext("2d", { willReadFrequently: true })
    if (ctx) {
      const px = ctx.getImageData(0, 0, width, height).data
      const channels = opts.gray ? 1 : 3
      const raw = new Uint8Array(width * height * channels)
      for (let i = 0, j = 0; i < px.length; i += 4) {
        // pixel trasparenti: la pagina è bianca
        const a = px[i + 3] / 255
        const r = Math.round(px[i] * a + 255 * (1 - a))
        if (channels === 1) {
          raw[j++] = r
        } else {
          raw[j++] = r
          raw[j++] = Math.round(px[i + 1] * a + 255 * (1 - a))
          raw[j++] = Math.round(px[i + 2] * a + 255 * (1 - a))
        }
      }
      const packed = await deflate(raw)
      if (packed)
        return { kind: "flate", data: packed, width, height, gray: opts.gray }
    }
  }
  const blob = await canvasToBlob(canvas, "image/jpeg", opts.jpeg)
  return {
    kind: "jpeg",
    data: new Uint8Array(await blob.arrayBuffer()),
    width,
    height,
  }
}

/** Un canvas nuovo, già riempito con il colore della carta */
export function paperCanvas(width: number, height: number, background: string) {
  const canvas = document.createElement("canvas")
  canvas.width = Math.max(1, Math.round(width))
  canvas.height = Math.max(1, Math.round(height))
  const ctx = canvas.getContext("2d")
  if (ctx && background !== "transparent") {
    ctx.fillStyle = background
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  return canvas
}
