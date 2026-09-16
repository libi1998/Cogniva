import type { Metadata } from "next"
import { lang as langParam } from "next/root-params"

import { HomeScreen } from "@/components/home/home-screen"
import { DESCRIPTIONS } from "@/lib/i18n/descriptions"
import { DEFAULT_LOCALE, isLocale } from "@/lib/i18n/config"

/** La descrizione nella lingua della pagina: qui i metadati si prerendono */
export async function generateMetadata(): Promise<Metadata> {
  "use cache"
  const lang = await langParam()
  return { description: DESCRIPTIONS[isLocale(lang) ? lang : DEFAULT_LOCALE] }
}

// il titolo «Cogniva» arriva dal layout; la home lo rimette da sola quando
// torna visibile (useDocumentTitle)
export default function Page() {
  return <HomeScreen />
}
