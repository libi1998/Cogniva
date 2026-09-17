"use client"

import * as React from "react"
import {
  interpolate,
  isLocale,
  LOCALE_COOKIE,
  LOCALE_REGIONS,
  localePath,
  SOURCE_LOCALE,
  splitLocalePath,
  stripContext,
  type Locale,
} from "./config"
import type { Messages } from "./messages"

/**
 * Traduzioni nei componenti. Il layout di ogni parte dell'app (comune, board,
 * documenti) passa i suoi messaggi; i provider annidati li uniscono.
 *
 * - `useT()` nei componenti: `const t = useT()`, poi `t("Annulla")` oppure
 *   `t("Pagina {page} di {total}", { page, total })`.
 * - `tr()` fuori da React (gestori, librerie, messaggi): legge la lingua
 *   della pagina aperta. Non va usata mentre si disegna, dove serve `useT()`.
 */

export type TFunction = (
  source: string,
  values?: Record<string, string | number>
) => string

type I18nValue = { locale: Locale; messages: Messages }

const I18nContext = React.createContext<I18nValue>({
  locale: SOURCE_LOCALE,
  messages: {},
})

/* ---------------------- lingua attiva fuori da React --------------------- */

const registry = new Map<Locale, Messages>()
let activeLocale: Locale | null = null

function register(locale: Locale, messages: Messages) {
  if (typeof window === "undefined") return
  activeLocale = locale
  const current = registry.get(locale)
  if (!current) registry.set(locale, { ...messages })
  else Object.assign(current, messages)
}

/** La lingua della pagina: dal provider, oppure da <html lang> */
export function currentLocale(): Locale {
  if (activeLocale) return activeLocale
  if (typeof document !== "undefined") {
    const lang = document.documentElement.lang.slice(0, 2)
    if (isLocale(lang)) return lang
  }
  return SOURCE_LOCALE
}

/** Traduce fuori da React (gestori di eventi, librerie, toast) */
export const tr: TFunction = (source, values) => {
  const locale = currentLocale()
  const translated =
    locale === SOURCE_LOCALE ? undefined : registry.get(locale)?.[source]
  // in italiano (o senza traduzione) il contesto dopo «||» non si vede
  return interpolate(translated ?? stripContext(source), values)
}

/** «it-IT», «en-US»…: per date, numeri e nuovi documenti */
export const currentRegion = () => LOCALE_REGIONS[currentLocale()]

/** «5 min fa», «ieri», «12 set»: il tempo trascorso nella lingua attiva */
export function timeAgo(time: number, now = Date.now()) {
  const region = currentRegion()
  const seconds = Math.round((time - now) / 1000)
  const abs = Math.abs(seconds)
  const rtf = new Intl.RelativeTimeFormat(region, {
    numeric: "auto",
    style: "short",
  })
  if (abs < 45) return rtf.format(0, "second")
  if (abs < 3600) return rtf.format(Math.round(seconds / 60), "minute")
  if (abs < 86400) return rtf.format(Math.round(seconds / 3600), "hour")
  if (abs < 604800) return rtf.format(Math.round(seconds / 86400), "day")
  return new Date(time).toLocaleDateString(region, {
    day: "numeric",
    month: "short",
    year:
      new Date(time).getFullYear() === new Date(now).getFullYear()
        ? undefined
        : "numeric",
  })
}

/** Il nome di una lingua nella lingua dell'interfaccia: «de» → «Tedesco» */
export function languageName(code: string, locale: Locale = currentLocale()) {
  try {
    const name = new Intl.DisplayNames([LOCALE_REGIONS[locale]], {
      type: "language",
    }).of(code)
    return name
      ? name.charAt(0).toLocaleUpperCase(locale) + name.slice(1)
      : code
  } catch {
    return code
  }
}

/** Un percorso dell'app nella lingua attiva: «/doc/x» → «/en/doc/x» */
export const hrefFor = (path: string) => localePath(currentLocale(), path)

/* -------------------------------- provider ------------------------------- */

export function I18nProvider({
  locale,
  messages,
  children,
}: {
  locale: Locale
  messages: Messages
  children: React.ReactNode
}) {
  const parent = React.useContext(I18nContext)
  const value = React.useMemo<I18nValue>(
    () => ({
      locale,
      messages:
        parent.locale === locale && Object.keys(parent.messages).length
          ? { ...parent.messages, ...messages }
          : messages,
    }),
    [locale, messages, parent]
  )
  // i messaggi servono anche a `tr()`: si registrano prima che i figli li usino
  register(locale, value.messages)
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useLocale(): Locale {
  return React.useContext(I18nContext).locale
}

export function useT(): TFunction {
  const { locale, messages } = React.useContext(I18nContext)
  return React.useCallback<TFunction>(
    (source, values) =>
      interpolate(
        locale === SOURCE_LOCALE
          ? stripContext(source)
          : (messages[source] ?? stripContext(source)),
        values
      ),
    [locale, messages]
  )
}

/** «it-IT», «en-US»… della lingua attiva, per `Intl` e `toLocale…` */
export function useRegion() {
  return LOCALE_REGIONS[useLocale()]
}

/** Costruisce i link dell'app nella lingua attiva */
export function useHref() {
  const locale = useLocale()
  return React.useCallback((path: string) => localePath(locale, path), [locale])
}

/**
 * Cambia lingua: la ricorda in un cookie (vale anche aprendo «/») e porta la
 * pagina attuale nella nuova lingua.
 */
export function switchLocale(next: Locale) {
  document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
  const { rest } = splitLocalePath(window.location.pathname)
  return `${localePath(next, rest)}${window.location.search}${window.location.hash}`
}
