"use client"

import * as React from "react"
import { STORAGE, readStorage } from "./storage"

/**
 * I caratteri usati di recente, come la sezione in cima all'elenco di Word.
 * È una preferenza di chi usa l'app: vive nel browser.
 */
const KEY = STORAGE.recentFonts
const MAX = 6
const EMPTY: string[] = []

let cache: string[] | null = null
const listeners = new Set<() => void>()

function read(): string[] {
  if (cache) return cache
  try {
    const raw = JSON.parse(readStorage(KEY) ?? "[]")
    cache = Array.isArray(raw) ? raw.filter((k) => typeof k === "string") : []
  } catch {
    cache = []
  }
  return cache ?? EMPTY
}

export function rememberFont(key: string) {
  const next = [key, ...read().filter((k) => k !== key)].slice(0, MAX)
  cache = next
  try {
    localStorage.setItem(KEY, JSON.stringify(next))
  } catch {
    // senza localStorage l'elenco vale per questa sessione
  }
  listeners.forEach((l) => l())
}

export function useRecentFonts() {
  return React.useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    read,
    () => EMPTY
  )
}
