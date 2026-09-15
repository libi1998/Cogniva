"use client"

/**
 * Script in linea che gira mentre il browser legge l'HTML.
 *
 * Sul server esce come script vero; nel browser React lo vede come testo
 * (`text/plain`), così non avvisa di uno script creato da un componente e non
 * lo riesegue. `suppressHydrationWarning` accetta la differenza di tipo.
 */
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === "undefined" ? "text/javascript" : "text/plain"}
      suppressHydrationWarning
      dangerouslySetInnerHTML={{ __html: html }}
    />
  )
}
