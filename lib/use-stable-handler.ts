"use client"

import * as React from "react"

/**
 * Un gestore di eventi con identità fissa che chiama sempre l'ultima versione
 * della funzione.
 *
 * Serve ai componenti ripetuti migliaia di volte (gli elementi del canvas):
 * se ogni ridisegno passasse loro funzioni nuove, `React.memo` non servirebbe
 * a nulla e trascinare un elemento ridisegnerebbe tutta la board. Da non
 * chiamare durante il render: solo nei gestori di eventi.
 */
export function useStableHandler<Args extends unknown[], Result>(
  handler: (...args: Args) => Result
): (...args: Args) => Result {
  const latest = React.useRef(handler)
  // prima di ogni altro effetto: un evento che arriva subito dopo il commit
  // trova già la funzione aggiornata
  React.useInsertionEffect(() => {
    latest.current = handler
  })
  return React.useCallback((...args: Args) => latest.current(...args), [])
}
