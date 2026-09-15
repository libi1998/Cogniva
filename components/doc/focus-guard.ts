"use client"

import type { MouseEvent } from "react"
import type { Editor } from "@tiptap/react"

/**
 * I comandi dell'editor non devono partire quando si sta scrivendo altrove.
 *
 * Tutti i pulsanti annullano il `mousedown` per non rubare il fuoco, quindi al
 * momento del clic il fuoco è ancora dove l'aveva messo l'utente. Se è su un
 * altro campo di testo — il nome del file nella barra in alto, il testo
 * alternativo di un'immagine — `editor.chain().focus()` riporterebbe il cursore
 * nel documento e applicherebbe il comando all'ultima selezione, cioè a un
 * punto qualsiasi del testo.
 */
export function typingOutside(
  editor: Editor | null,
  container?: HTMLElement | null
): boolean {
  if (!editor || editor.isDestroyed) return true
  if (typeof document === "undefined") return false
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body) return false
  if (editor.view.dom.contains(el)) return false
  if (container?.contains(el)) return false
  return (
    el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable
  )
}

/**
 * ProseMirror legge la selezione dal DOM su `selectionchange`, che arriva un
 * attimo dopo il doppio clic. Chi seleziona una parola e preme subito un
 * pulsante rischia quindi di applicarlo alla selezione precedente: qui la
 * rileggo prima di eseguire il comando.
 */
function syncSelection(editor: Editor | null) {
  if (!editor || editor.isDestroyed) return
  const view = editor.view as unknown as {
    domObserver?: { flush?: () => void }
  }
  try {
    view.domObserver?.flush?.()
  } catch {
    // se l'API interna cambia si continua con la selezione già nota
  }
}

/**
 * Da usare come `onClickCapture` sul contenitore dei comandi: ferma il clic
 * prima che arrivi al pulsante, così non succede nulla invece di scrivere nel
 * posto sbagliato.
 */
export function guardClicks(editor: Editor | null) {
  return (event: MouseEvent<HTMLElement>) => {
    // i comandi marcati `data-safe` non agiscono sulla selezione del testo
    // (cercare, cambiare il formato del file…): passano sempre
    const target = event.target as HTMLElement
    if (target.closest("[data-safe]")) return
    // le finestre delle schede (didascalia, simboli…) sono in un portale ma
    // il clic risale l'albero di React fin qui: hanno i loro campi e pulsanti
    if (target.closest('[role="dialog"], [data-slot="dialog-content"]')) return
    // dentro un riquadro a comparsa (collegamento, intestazione…) si scrive in
    // un campo e poi si preme «Applica»: è la stessa operazione, non va fermata
    const popover = target.closest(
      '[data-slot="popover-content"], [data-slot="dropdown-menu-content"]'
    )
    if (popover && popover.contains(document.activeElement)) {
      syncSelection(editor)
      return
    }
    if (typingOutside(editor, event.currentTarget)) {
      event.preventDefault()
      event.stopPropagation()
      return
    }
    syncSelection(editor)
  }
}
