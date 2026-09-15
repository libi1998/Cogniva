import { fontStack } from "./fonts"
import type { DocTheme, DocWatermark } from "./types"

/**
 * La filigrana disegnata come immagine grande quanto la pagina, per Word: un
 * PNG trasparente dietro al testo, nell'intestazione di ogni pagina. È lo
 * stesso disegno che si vede a schermo (stesso carattere, corpo, colore,
 * trasparenza e inclinazione), quindi il file aperto in Word è identico.
 */

/** La famiglia vera del carattere: le variabili CSS di next/font risolte */
function resolvedFamily(stack: string) {
  const probe = document.createElement("span")
  probe.style.fontFamily = stack
  probe.style.position = "absolute"
  probe.style.visibility = "hidden"
  document.body.appendChild(probe)
  const family = getComputedStyle(probe).fontFamily
  probe.remove()
  return family || "sans-serif"
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("Immagine della filigrana non valida"))
    img.src = src
  })
}

export async function renderWatermark(
  watermark: DocWatermark,
  theme: DocTheme,
  widthPx: number,
  heightPx: number
): Promise<Uint8Array | null> {
  const scale = 2
  const canvas = document.createElement("canvas")
  canvas.width = Math.round(widthPx * scale)
  canvas.height = Math.round(heightPx * scale)
  const ctx = canvas.getContext("2d")
  if (!ctx) return null
  ctx.scale(scale, scale)
  ctx.globalAlpha = Math.max(0.02, Math.min(1, watermark.opacity))

  if (watermark.image) {
    const img = await loadImage(watermark.image)
    const w = widthPx * watermark.scale
    const h = Math.min(heightPx * 0.9, (img.height / img.width) * w)
    const drawW = (img.width / img.height) * h
    ctx.drawImage(img, (widthPx - drawW) / 2, (heightPx - h) / 2, drawW, h)
  } else {
    const text = watermark.text.trim()
    if (!text) return null
    const n = Math.max(4, text.length)
    // le stesse proporzioni del CSS (cqh/cqw) usato a schermo
    const size =
      watermark.layout === "diagonal"
        ? Math.min((120 / n / 100) * heightPx, (165 / n / 100) * widthPx)
        : (110 / n / 100) * widthPx
    const family = resolvedFamily(
      fontStack(watermark.font ?? theme.headingFont ?? theme.font)
    )
    ctx.font = `700 ${size}px ${family}`
    try {
      await document.fonts.load(ctx.font, text)
    } catch {
      // senza il carattere si usa quello di riserva, come a schermo
    }
    ctx.font = `700 ${size}px ${family}`
    if ("letterSpacing" in ctx) {
      ;(
        ctx as CanvasRenderingContext2D & { letterSpacing: string }
      ).letterSpacing = `${size * 0.04}px`
    }
    ctx.fillStyle = watermark.color || "#a1a1aa"
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.translate(widthPx / 2, heightPx / 2)
    if (watermark.layout === "diagonal") ctx.rotate(-Math.PI / 4)
    ctx.fillText(text, 0, 0)
  }

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/png")
  )
  return blob ? new Uint8Array(await blob.arrayBuffer()) : null
}
