"use client"

import * as React from "react"
import { STORAGE, readStorage } from "./storage"

/**
 * Il nome con cui si firmano commenti e risposte. È una preferenza di chi usa
 * l'app, non del documento: vive nel browser.
 */
const KEY = STORAGE.author
const FALLBACK = "Io"

let cache: string | null = null
const listeners = new Set<() => void>()

function read() {
  if (cache !== null) return cache
  try {
    cache = readStorage(KEY)?.trim() || FALLBACK
  } catch {
    cache = FALLBACK
  }
  return cache
}

export function setAuthor(name: string) {
  cache = name.trim() || FALLBACK
  try {
    localStorage.setItem(KEY, cache)
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
    () => FALLBACK
  )
}
