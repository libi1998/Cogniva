"use client"

import * as React from "react"
import { STORAGE, readStorage } from "./storage"
import { tr } from "@/lib/i18n/client"

/**
 * Il nome con cui si firmano commenti e risposte. È una preferenza di chi usa
 * l'app, non del documento: vive nel browser.
 */
const KEY = STORAGE.author
/** chi non ha scritto un nome firma «Io», nella lingua dell'app */
const fallback = () => tr("Io")

/** il nome scritto da chi usa l'app, vuoto se non l'ha mai scelto */
let cache: string | null = null
const listeners = new Set<() => void>()

function saved() {
  if (cache !== null) return cache
  try {
    const name = readStorage(KEY)?.trim() ?? ""
    // le versioni precedenti salvavano «Io» al posto del nome vuoto
    cache = name === "Io" ? "" : name
  } catch {
    cache = ""
  }
  return cache
}

const read = () => saved() || fallback()

export function setAuthor(name: string) {
  cache = name.trim()
  try {
    if (cache) localStorage.setItem(KEY, cache)
    else localStorage.removeItem(KEY)
  } catch {
    // senza localStorage il nome vale solo per questa sessione
  }
  listeners.forEach((l) => l())
}

export function getAuthor() {
  return read()
}

export function useAuthor() {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    fallback
  )
}
