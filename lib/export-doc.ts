"use client"

import {
  collectFontCss,
  download,
  elementToPngBlob,
  elementToSvg,
  safeName,
  safeScale,
  svgToBlob,
} from "./export"
import { PAGE_FORMATS, type DocTheme } from "./types"
import { fontFromCss, fontMap } from "./fonts"

import { tr } from "@/lib/i18n/client"
const MM_TO_PX = 96 / 25.4

export function pageSizePx(theme: DocTheme) {
  const mm = PAGE_FORMATS[theme.format]?.mm
  if (!mm) return null
  const [w, h] = theme.orientation === "landscape" ? [mm[1], mm[0]] : mm
  return { w: Math.round(w * MM_TO_PX), h: Math.round(h * MM_TO_PX) }
}

/** Come pageSizePx ma senza arrotondare: le pagine devono tornare con la carta */
export function pageSizeExact(theme: DocTheme) {
  const mm = PAGE_FORMATS[theme.format]?.mm
  if (!mm) return null
  const [w, h] = theme.orientation === "landscape" ? [mm[1], mm[0]] : mm
  return { w: w * MM_TO_PX, h: h * MM_TO_PX }
}

export type DocExportFormat = "png" | "svg" | "print"

/**
 * I caratteri da incorporare nell'SVG: quello del documento, quelli scelti a
 * mano su parti del testo e i caratteri delle formule. Incorporare tutti i
 * cento caratteri renderebbe il file enorme.
 */
function usedFamilies(sheet: HTMLElement, theme: DocTheme) {
  const out = new Set<string>()
  const add = (family: string | undefined) => family && out.add(family)
  add(fontMap[theme.font]?.family)
  sheet
    .querySelectorAll<HTMLElement>("[style*='font-family']")
    .forEach((el) => {
      // per i caratteri compatibili con Word si incorpora il gemello libero
      add(fontFromCss(el.style.fontFamily)?.family)
    })
  // il codice usa JetBrains Mono
  if (sheet.querySelector("code, pre")) add("JetBrains Mono")
  if (sheet.querySelector(".katex")) add("KaTeX")
  return [...out]
}

/** Prepara la copia del foglio: niente ombre né guide, campi resi come testo */
export function prepareSheet(
  node: HTMLElement,
  height: number,
  source: HTMLElement
) {
  // gli stili si leggono dall'elemento vivo: su un clone staccato dal documento
  // getComputedStyle non restituisce nulla
  const liveInputs = Array.from(source.querySelectorAll("input"))
  node.style.height = `${height}px`
  node.style.minHeight = `${height}px`
  node.style.boxShadow = "none"
  node.style.borderRadius = "0"
  node.style.margin = "0"
  node.querySelectorAll("[data-guide]").forEach((g) => g.remove())
  // la maniglia degli oggetti, le maniglie e il contorno dell'oggetto
  // selezionato e i segni di formattazione restano a video: con una forma
  // selezionata finivano nel PDF i quadratini per ridimensionarla
  node
    .querySelectorAll(
      "[data-block-handle], .doc-block-drop, .doc-mark, [data-band-editor], .doc-image-handle"
    )
    .forEach((g) => g.remove())
  node.classList.remove("doc-marks")
  node
    .querySelectorAll(".ProseMirror-selectednode")
    .forEach((el) => el.classList.remove("ProseMirror-selectednode"))
  // la copia per l'SVG ha già perso le classi: si riconoscono dagli attributi
  node.querySelectorAll<HTMLElement>("[data-find-match]").forEach((m) => {
    m.classList.remove("find-match", "find-match-active")
    m.style.background = "none"
    m.style.color = "inherit"
    m.style.boxShadow = "none"
  })
  // i commenti restano a video: sulla carta il testo è pulito
  node.querySelectorAll<HTMLElement>("[data-comment]").forEach((m) => {
    m.classList.remove("doc-comment")
    m.style.background = "none"
    m.style.borderBottom = "0"
  })
  // i modelli 3D si esportano con la loro anteprima: il canvas WebGL clonato
  // sarebbe vuoto
  node
    .querySelectorAll(
      ".doc-model3d-canvas, .doc-model3d-badge, .doc-model3d-hint, .doc-model3d-grip"
    )
    .forEach((el) => el.remove())
  node.querySelectorAll<HTMLElement>(".doc-model3d-poster").forEach((img) => {
    img.classList.remove("is-hidden")
    img.style.visibility = "visible"
  })
  // numeri di riga e fasce degli spaziatori seguono lo stacco zero
  node.style.setProperty("--page-gap", "0px")

  Array.from(node.querySelectorAll("input")).forEach((input, idx) => {
    const i = input as HTMLInputElement
    const live = (liveInputs[idx] as HTMLInputElement) ?? i
    const cs = window.getComputedStyle(live)

    if (live.type === "checkbox") {
      // le checkbox con appearance:none non si rasterizzano: le ridisegno
      const box = document.createElement("span")
      const size = cs.width && cs.width !== "auto" ? cs.width : "1em"
      box.style.cssText = [
        "display:inline-block",
        `width:${size}`,
        `height:${cs.height && cs.height !== "auto" ? cs.height : size}`,
        `border:${cs.borderTopWidth} solid ${live.checked ? cs.backgroundColor : cs.borderTopColor}`,
        `border-radius:${cs.borderTopLeftRadius}`,
        `background:${live.checked ? cs.backgroundColor : "transparent"}`,
        `margin-top:${cs.marginTop}`,
        "position:relative",
        "flex:0 0 auto",
        "box-sizing:border-box",
      ].join(";")
      if (live.checked) {
        const tick = document.createElement("span")
        tick.style.cssText =
          "position:absolute;left:50%;top:44%;width:0.5em;height:0.26em;margin-left:-0.25em;margin-top:-0.16em;border-left:2px solid #fff;border-bottom:2px solid #fff;transform:rotate(-45deg)"
        box.appendChild(tick)
      }
      i.replaceWith(box)
      return
    }

    const span = document.createElement("span")
    span.style.cssText = [
      "display:block",
      `font-family:${cs.fontFamily}`,
      `font-size:${cs.fontSize}`,
      `font-weight:${cs.fontWeight}`,
      `font-style:${cs.fontStyle}`,
      `line-height:${cs.lineHeight}`,
      `letter-spacing:${cs.letterSpacing}`,
      `color:${cs.color}`,
      `text-align:${cs.textAlign}`,
      `margin:${cs.margin}`,
      `padding:${cs.padding}`,
      `width:${cs.width}`,
      "white-space:pre-wrap",
    ].join(";")
    span.textContent = live.value
    i.replaceWith(span)
  })
}

export async function exportDoc({
  title,
  filename,
  theme,
  format,
  paper,
  sheet,
  scale = 2.5,
}: {
  title: string
  /** nome scelto nella sezione Esporta, senza estensione */
  filename?: string
  theme: DocTheme
  format: DocExportFormat
  paper: string
  /**
   * il foglio da esportare. Con Cache Components altri documenti possono
   * restare montati (nascosti) e cercarlo per id troverebbe il primo, non
   * quello aperto
   */
  sheet: HTMLElement | null
  scale?: number
}) {
  if (format === "print") {
    // la stampa vera, su carta: il PDF invece si costruisce nella sezione Esporta
    window.print()
    return
  }

  const el = sheet
  if (!el || !el.offsetWidth) throw new Error(tr("Documento non trovato"))

  // offsetWidth e scrollHeight ignorano lo zoom del foglio, il rettangolo del
  // client no: con la vista al 150% l'esportazione usciva una volta e mezza
  const width = el.offsetWidth
  const height = Math.round(el.scrollHeight)
  const name = filename || safeName(title)

  if (format === "svg") {
    const fontCss = await collectFontCss(usedFamilies(el, theme))
    const svg = elementToSvg(
      el,
      { width, height, background: paper, fontCss },
      (clone) => prepareSheet(clone, height, el)
    )
    download(svgToBlob(svg), `${name}.svg`)
    return
  }

  const holder = document.createElement("div")
  holder.style.cssText = `position:fixed;left:-100000px;top:0;width:${width}px;height:${height}px;overflow:hidden;background:${paper};`
  const clone = el.cloneNode(true) as HTMLElement
  clone.removeAttribute("id")
  prepareSheet(clone, height, el)
  holder.appendChild(clone)
  document.body.appendChild(holder)

  let shot: { blob: Blob; width: number; height: number }
  try {
    shot = await elementToPngBlob(holder, {
      width,
      height,
      background: paper,
      scale: safeScale(width, height, scale),
    })
  } finally {
    holder.remove()
  }

  download(shot.blob, `${name}.png`)
}
