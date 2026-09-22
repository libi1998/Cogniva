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

/**
 * Rimette il fuoco appena una finestra o un menu si chiude, senza aspettare
 * che finisca di sparire: chi riprende subito a scrivere non perde la prima
 * lettera. Guarda lo stato invece dell'evento di chiusura, così vale anche
 * per i pulsanti che chiudono da sé — «Annulla», «Salva», «Chiudi».
 *
 * `finalFocus` resta comunque: è lui a dire a Base UI dove mettere il fuoco
 * quando il riquadro se ne va davvero.
 */
export function useFocusBackWhenClosed(open: boolean | undefined) {
  const target = useFinalFocus()
  const wasOpen = React.useRef(false)
  React.useEffect(() => {
    if (wasOpen.current && !open) {
      target?.current?.focus({ preventScroll: true })
    }
    wasOpen.current = Boolean(open)
  }, [open, target])
}
