"use client"

import { flushSync } from "react-dom"
import { pageSizeExact, prepareSheet } from "@/lib/export-doc"
import type { DocSnapshot } from "@/lib/export-studio/session"
import type { DocTheme } from "@/lib/types"
import { AUTO_PAPER, resolveColor } from "@/lib/use-theme"

/**
 * Fotografa il foglio per la sezione Esporta: per un momento il documento si
 * disegna come in stampa (chiaro, con le pagine vere e senza stacchi fra i
 * fogli), si clona e poi torna com'era. Il clone è statico: l'anteprima non
 * rallenta l'editor e l'editor non cambia l'anteprima.
 */
export async function takeDocSnapshot({
  sheet,
  theme,
  setPrintMode,
}: {
  sheet: HTMLElement | null
  theme: DocTheme
  setPrintMode: (on: boolean) => void
}): Promise<DocSnapshot> {
  if (!sheet) throw new Error("sheet")
  // si parte da un compito nuovo: flushSync non funziona dentro un effetto
  await new Promise((r) => setTimeout(r, 0))
  // più fotografie insieme (React in sviluppo avvia gli effetti due volte):
  // la modalità stampa resta accesa finché non ha finito l'ultima
  if (active++ === 0) flushSync(() => setPrintMode(true))
  try {
    await settled(sheet)
    const height = Math.round(sheet.scrollHeight)
    const clone = sheet.cloneNode(true) as HTMLElement
    clone.removeAttribute("id")
    prepareSheet(clone, height, sheet)
    const page = pageSizeExact(theme)
    const paginated = sheet.classList.contains("doc-paginated")
    const pages = page
      ? paginated
        ? Number(sheet.style.getPropertyValue("--pages")) || 1
        : Math.max(1, Math.ceil((height - 1) / page.h))
      : 1
    return {
      clone,
      page,
      pages,
      margins: theme.margins,
      paper: resolveColor(theme.paper, false, AUTO_PAPER),
      columns: theme.columns,
    }
  } finally {
    if (--active === 0) setPrintMode(false)
  }
}

let active = 0

/**
 * Aspetta che l'impaginazione si fermi: passando alla visualizzazione di
 * stampa le pagine si ricalcolano in uno o due giri.
 */
async function settled(sheet: HTMLElement) {
  const read = () =>
    `${sheet.scrollHeight}:${sheet.style.getPropertyValue("--pages")}`
  let last = ""
  let stable = 0
  for (let i = 0; i < 40 && stable < 3; i++) {
    await new Promise((r) => setTimeout(r, 40))
    const now = read()
    stable = now === last ? stable + 1 : 0
    last = now
  }
  try {
    await document.fonts?.ready
  } catch {
    // si prosegue con i caratteri già pronti
  }
}

/** La pagina che si sta guardando, da 0 */
export function visiblePage(
  sheet: HTMLElement | null,
  scroller: HTMLElement | null,
  pages: number
) {
  if (!sheet || !scroller || pages <= 1) return 0
  const rect = sheet.getBoundingClientRect()
  const view = scroller.getBoundingClientRect()
  const center = view.top + view.height / 2
  const fraction = (center - rect.top) / Math.max(1, rect.height)
  return Math.max(0, Math.min(pages - 1, Math.floor(fraction * pages)))
}
