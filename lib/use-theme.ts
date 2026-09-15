"use client"

import * as React from "react"
import { THEME_KEY } from "./boot-script"
import { AUTO_BG } from "./types"

/**
 * Tema chiaro, scuro o di sistema.
 *
 * La scelta sta in localStorage sotto «theme»; lo script in testa alla pagina
 * (vedi boot-script.ts) mette la classe `dark` prima del primo disegno, qui la si
 * tiene aggiornata e la si legge con useSyncExternalStore.
 */
export type ThemePreference = "light" | "dark" | "system"

const KEY = THEME_KEY
const listeners = new Set<() => void>()
let preference: ThemePreference | null = null
let media: MediaQueryList | null = null

function readPreference(): ThemePreference {
  if (preference) return preference
  try {
    const saved = localStorage.getItem(KEY)
    preference =
      saved === "light" || saved === "dark" || saved === "system"
        ? saved
        : "system"
  } catch {
    preference = "system"
  }
  return preference
}

/**
 * Rimette la classe del tema se qualcuno l'ha tolta: in sviluppo lo Strict
 * Mode di React rimonta <html> con i soli attributi del JSX e cancella quello
 * che lo script di avvio aveva messo. In produzione non cambia niente.
 */
export function syncTheme() {
  apply()
}

function apply() {
  const pref = readPreference()
  const dark =
    pref === "dark" ||
    (pref === "system" &&
      window.matchMedia("(prefers-color-scheme: dark)").matches)
  const root = document.documentElement
  if (root.classList.contains("dark") === dark) return
  // durante il cambio niente transizioni: colori e ombre cambiano insieme
  const style = document.createElement("style")
  style.textContent = "*,*::before,*::after{transition:none!important}"
  document.head.appendChild(style)
  root.classList.toggle("dark", dark)
  root.style.colorScheme = dark ? "dark" : "light"
  window.getComputedStyle(document.body)
  requestAnimationFrame(() => style.remove())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (!media) {
    media = window.matchMedia("(prefers-color-scheme: dark)")
    media.addEventListener("change", () => {
      apply()
      listeners.forEach((l) => l())
    })
  }
  return () => {
    listeners.delete(listener)
  }
}

export function setThemePreference(next: ThemePreference) {
  preference = next
  try {
    localStorage.setItem(KEY, next)
  } catch {
    // senza localStorage il tema vale per questa sessione
  }
  apply()
  listeners.forEach((l) => l())
}

export function useThemePreference(): ThemePreference {
  return React.useSyncExternalStore(subscribe, readPreference, () => "system")
}

/** true quando l'interfaccia è in tema scuro */
export function useIsDark() {
  return React.useSyncExternalStore(
    subscribe,
    () => document.documentElement.classList.contains("dark"),
    () => false
  )
}

const emptySubscribe = () => () => {}

/** true dopo l'idratazione lato client (senza setState in un effetto) */
export function useMounted() {
  return React.useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  )
}

export const AUTO_CANVAS = { light: "#fafafa", dark: "#0c0c0e" }
export const AUTO_DOC_BG = { light: "#f4f4f5", dark: "#09090b" }
export const AUTO_PAPER = { light: "#ffffff", dark: "#18181b" }

export function resolveColor(
  value: string,
  dark: boolean,
  auto: { light: string; dark: string }
) {
  if (!value || value === AUTO_BG) return dark ? auto.dark : auto.light
  return value
}
