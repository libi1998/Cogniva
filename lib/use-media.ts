"use client"

import * as React from "react"

/**
 * `true` quando la finestra è più stretta di `max`.
 *
 * Serve a far sparire i pannelli laterali dal flusso e a farli tornare come
 * sovrapposizione: sotto una certa larghezza 280px fissi lasciavano al foglio
 * una colonna inutilizzabile.
 */
export function useNarrow(max: number): boolean {
  const query = `(max-width: ${max}px)`
  const subscribe = React.useCallback(
    (onChange: () => void) => {
      const mq = window.matchMedia(query)
      mq.addEventListener("change", onChange)
      return () => mq.removeEventListener("change", onChange)
    },
    [query]
  )
  return React.useSyncExternalStore(
    subscribe,
    () => window.matchMedia(query).matches,
    () => false
  )
}

/**
 * Pannello laterale chiuso di partenza sulle finestre strette e aperto sulle
 * altre, finché l'utente non decide: da quel momento vale la sua scelta.
 *
 * Niente effetti né aggiustamenti di stato: il valore si ricava dal render.
 */
export function useCollapsingPanel(tight: boolean) {
  const [choice, setChoice] = React.useState<boolean | null>(null)
  return [choice ?? !tight, setChoice] as const
}
