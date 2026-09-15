"use client"

import * as React from "react"
import { useIsDark } from "@/lib/use-theme"

/**
 * Durante stampa ed esportazione il foglio «automatico» si disegna chiaro,
 * anche con l'app in tema scuro: un documento stampato è bianco. Chi dentro al
 * foglio sceglie i colori in base al tema legge questo contesto.
 */
export const ForceLightContext = React.createContext(false)

export function useDocDark() {
  const dark = useIsDark()
  const forced = React.useContext(ForceLightContext)
  return dark && !forced
}

/**
 * Altezza esatta della pagina quando il documento è impaginato, altrimenti 0.
 * Le immagini libere salvano la loro altezza «sulla carta», senza gli stacchi
 * fra i fogli che si vedono a schermo, e la riconvertono per disegnarsi.
 */
export const DocPageContext = React.createContext(0)

/** Il foglio è scuro: grafici e disegni scelgono i colori del testo */
export const PaperDarkContext = React.createContext(false)

/** Larghezza del testo sul foglio: i grafici si disegnano a quella misura */
export const DocContentWidthContext = React.createContext(640)
