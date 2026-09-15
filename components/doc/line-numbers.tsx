"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { measureLines } from "@/lib/pagination"
import type { DocTheme } from "@/lib/types"

/** Blocchi che Word non numera: tabelle, sommario, note */
const SKIP = new Set(["table", "docTitle", "toc"])

/**
 * Numeri di riga nel margine sinistro, come «Layout › Numeri di riga» di
 * Word. Si ridisegnano quando si smette di scrivere per un attimo: contare le
 * righe vuol dire misurare tutto il testo. I numeri sono semplici elementi
 * del DOM, senza React: su un documento lungo sono migliaia.
 */
export function LineNumbers({
  editor,
  mode,
  marginLeft,
}: {
  editor: Editor | null
  mode: DocTheme["lineNumbers"]
  marginLeft: number
}) {
  const ref = React.useRef<HTMLDivElement>(null)

  React.useEffect(() => {
    if (!editor || mode === "none") return
    let timer: ReturnType<typeof setTimeout> | null = null

    const draw = () => {
      timer = null
      const host = ref.current
      const sheet = host?.parentElement
      if (!host || !sheet || editor.isDestroyed) return
      const box = sheet.getBoundingClientRect()
      const scale = box.width / sheet.offsetWidth || 1
      const toSheet = (v: number) => (v - box.top) / scale
      const style = getComputedStyle(sheet)
      const H = parseFloat(style.getPropertyValue("--page-h")) || 0
      const G = parseFloat(style.getPropertyValue("--page-gap")) || 0
      const step = sheet.classList.contains("doc-paginated") ? H + G : 0

      const out = document.createDocumentFragment()
      // contatori in un oggetto: il React Compiler non gestisce `n++` su
      // variabili catturate da una funzione
      const count = { n: 0, page: -1 }
      editor.state.doc.descendants((node, pos) => {
        if (SKIP.has(node.type.name)) return false
        if (!node.isTextblock) return true
        const el = editor.view.nodeDOM(pos)
        if (!(el instanceof HTMLElement)) return false
        for (const line of measureLines(el, toSheet)) {
          if (mode === "page" && step) {
            const k = Math.floor(line.t / step)
            if (k !== count.page) {
              count.page = k
              count.n = 0
            }
          }
          count.n += 1
          const label = document.createElement("span")
          label.textContent = String(count.n)
          // come le immagini libere: l'altezza sulla carta più gli stacchi fra
          // i fogli sopra, così in stampa (stacco zero) il numero resta sulla
          // sua riga
          const k = step ? Math.floor(line.t / step) : 0
          label.style.top = k
            ? `calc(${line.t - k * G}px + ${k} * var(--page-gap, 0px))`
            : `${line.t}px`
          label.style.height = `${line.b - line.t}px`
          out.appendChild(label)
        }
        return false
      })
      host.replaceChildren(out)
    }

    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(draw, 150)
    }
    draw()
    // anche le transazioni senza modifiche contano: l'impaginazione sposta
    // le righe da un foglio all'altro
    editor.on("transaction", schedule)
    const ro = new ResizeObserver(schedule)
    ro.observe(editor.view.dom)
    return () => {
      if (timer) clearTimeout(timer)
      editor.off("transaction", schedule)
      ro.disconnect()
    }
  }, [editor, mode])

  if (mode === "none") return null
  return (
    <div
      ref={ref}
      aria-hidden
      className="doc-line-numbers"
      style={{ left: Math.max(4, marginLeft - 44), width: 32 }}
    />
  )
}
