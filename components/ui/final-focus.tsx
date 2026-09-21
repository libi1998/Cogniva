"use client"

import * as React from "react"

/**
 * Dove torna il fuoco quando si chiude una finestra, un menu o un riquadro.
 *
 * Senza questo torna da dov'era partito. Ma i comandi di una barra annullano
 * il `mousedown` apposta, per non rubare il fuoco al testo e non perdere la
 * selezione: «da dov'era» è quindi il corpo della pagina, e chi ricominciava
 * a scrivere subito perdeva il primo tasto. Chi ha un posto giusto — il
 * foglio di un documento — lo dice da qui, una volta per tutti i suoi menu.
 */
const FinalFocus =
  React.createContext<React.RefObject<HTMLElement | null> | null>(null)

export function FinalFocusProvider({
  target,
  children,
}: {
  target: React.RefObject<HTMLElement | null>
  children: React.ReactNode
}) {
  return <FinalFocus.Provider value={target}>{children}</FinalFocus.Provider>
}

/** Il posto dove rimettere il fuoco, se qualcuno l'ha indicato */
export function useFinalFocus() {
  return React.useContext(FinalFocus) ?? undefined
}
