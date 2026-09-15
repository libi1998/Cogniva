"use client"

import * as React from "react"

/**
 * Titolo della scheda del browser.
 *
 * Con Cache Components le pagine visitate restano montate ma nascoste, e
 * ognuna lascia nel <head> il suo `<title>`; in più quello dei metadata arriva
 * in streaming dopo che la pagina si è disegnata. Il browser mostra il primo,
 * spesso quello di una pagina nascosta. Qui si ricorda il titolo della pagina
 * visibile e un osservatore sul <head> lo rimette ogni volta che qualcuno
 * aggiunge o cambia un `<title>`.
 */
let desired: string | null = null
let observer: MutationObserver | null = null

function apply() {
  if (desired === null) return
  const title = desired
  const nodes = document.head.querySelectorAll("title")
  if (!nodes.length) document.title = title
  nodes.forEach((el) => {
    // si scrive solo se serve: la scrittura stessa sveglia l'osservatore
    if (el.textContent !== title) el.textContent = title
  })
}

export function useDocumentTitle(title: string) {
  React.useEffect(() => {
    desired = title
    if (!observer) {
      observer = new MutationObserver(apply)
      observer.observe(document.head, {
        childList: true,
        subtree: true,
        characterData: true,
      })
    }
    apply()
  }, [title])
}
