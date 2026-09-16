import app from "./catalog/app.json"
import doc from "./catalog/doc.json"
import { SOURCE_LOCALE, type Locale } from "./config"

/**
 * I cataloghi, letti solo sul server: ogni voce ha la frase italiana come
 * chiave e le traduzioni nelle altre lingue. Alla pagina arriva solo la lingua
 * che serve, e solo per la parte dell'app che si sta aprendo.
 */

/**
 * «app»: tutto quello che serve a home e board (e quindi anche ai documenti);
 * «doc»: i testi che esistono solo nell'editor dei documenti.
 */
export type Namespace = "app" | "doc"
export type Messages = Record<string, string>

type Catalog = Record<string, Partial<Record<Locale, string>>>

const CATALOGS: Record<Namespace, Catalog> = {
  app: app as Catalog,
  doc: doc as Catalog,
}

export function getMessages(locale: Locale, namespace: Namespace): Messages {
  if (locale === SOURCE_LOCALE) return {}
  const out: Messages = {}
  for (const [source, translations] of Object.entries(CATALOGS[namespace])) {
    const value = translations[locale]
    if (value) out[source] = value
  }
  return out
}
