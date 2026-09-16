/**
 * Le lingue dell'interfaccia. I testi sono scritti in italiano direttamente
 * nel codice (`t("Annulla")`): l'italiano è la lingua di partenza e le altre
 * lingue traducono quelle frasi nei cataloghi di `lib/i18n/catalog`.
 *
 * Questo modulo non dipende da React né dal browser: lo usano proxy, layout
 * del server e componenti.
 */

export const LOCALES = ["it", "en", "es", "fr", "de", "pt"] as const
export type Locale = (typeof LOCALES)[number]

/** La lingua dei testi nel codice */
export const SOURCE_LOCALE: Locale = "it"
/** Chi usa una lingua che l'app non ha vede l'inglese */
export const DEFAULT_LOCALE: Locale = "en"

/** Il cookie che ricorda la lingua scelta a mano */
export const LOCALE_COOKIE = "cogniva-locale"

export const LOCALE_NAMES: Record<Locale, string> = {
  it: "Italiano",
  en: "English",
  es: "Español",
  fr: "Français",
  de: "Deutsch",
  pt: "Português",
}

/** La variante regionale usata per date, numeri e lingua dei nuovi documenti */
export const LOCALE_REGIONS: Record<Locale, string> = {
  it: "it-IT",
  en: "en-US",
  es: "es-ES",
  fr: "fr-FR",
  de: "de-DE",
  pt: "pt-BR",
}

export const isLocale = (value: unknown): value is Locale =>
  typeof value === "string" && (LOCALES as readonly string[]).includes(value)

/**
 * La lingua preferita secondo l'intestazione Accept-Language del browser
 * («fr-CH, fr;q=0.9, en;q=0.8»): la prima, per peso, che l'app conosce.
 */
export function negotiateLocale(header: string | null | undefined): Locale {
  if (!header) return DEFAULT_LOCALE
  const ranked = header
    .split(",")
    .map((part, index) => {
      const [tag = "", ...params] = part.trim().split(";")
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="))
      const weight = q ? Number(q.slice(2)) : 1
      return {
        base: tag.trim().toLowerCase().split("-")[0] ?? "",
        weight: Number.isFinite(weight) ? weight : 0,
        index,
      }
    })
    .filter((entry) => entry.base && entry.base !== "*" && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  return ranked.map((entry) => entry.base).find(isLocale) ?? DEFAULT_LOCALE
}

/** «/it/doc/x» → { locale: "it", rest: "/doc/x" } */
export function splitLocalePath(pathname: string): {
  locale: Locale | null
  rest: string
} {
  const [, first = "", ...others] = pathname.split("/")
  if (!isLocale(first)) return { locale: null, rest: pathname || "/" }
  const rest = `/${others.join("/")}`
  return { locale: first, rest: rest === "/" ? "/" : rest.replace(/\/$/, "") }
}

/** «/doc/x» nella lingua data → «/en/doc/x» */
export function localePath(locale: Locale, path: string) {
  const clean = path.startsWith("/") ? path : `/${path}`
  return clean === "/" ? `/${locale}` : `/${locale}${clean}`
}

/**
 * Segna una frase per i cataloghi senza tradurla subito: serve alle costanti
 * che si traducono più tardi con `t()` o `tr()`.
 */
export const N_ = (source: string) => source

/**
 * Una frase può avere un contesto dopo «||», per distinguere parole uguali
 * con significati diversi: «Annulla||annulla l'ultima modifica» (Undo) e
 * «Annulla» (Cancel). In italiano il contesto non si vede.
 */
export const stripContext = (source: string) => {
  const at = source.indexOf("||")
  return at < 0 ? source : source.slice(0, at)
}

/** Sostituisce {nome} con i valori: «Pagina {page} di {total}» */
export function interpolate(
  template: string,
  values?: Record<string, string | number>
) {
  if (!values) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) =>
    name in values ? String(values[name]) : match
  )
}
