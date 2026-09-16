import type { Metadata, Route } from "next"
import Link from "next/link"
import { lang } from "next/root-params"
import { Compass } from "lucide-react"
import { DocumentTitle } from "@/components/document-title"
import { buttonVariants } from "@/components/ui/button"
import {
  interpolate,
  isLocale,
  SOURCE_LOCALE,
  stripContext,
} from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { cn } from "@/lib/utils"

async function translator() {
  const value = await lang()
  const locale = isLocale(value) ? value : SOURCE_LOCALE
  const messages = getMessages(locale, "app")
  return {
    locale,
    t: (source: string, values?: Record<string, string | number>) =>
      interpolate(messages[source] ?? stripContext(source), values),
  }
}

export async function generateMetadata(): Promise<Metadata> {
  "use cache"
  const { t } = await translator()
  return { title: t("Pagina non trovata · Cogniva") }
}

export default async function NotFound() {
  const { t, locale } = await translator()
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-muted px-6 text-center">
      <DocumentTitle title={t("Pagina non trovata · Cogniva")} />
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Compass className="size-6" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h1 className="text-base font-semibold text-foreground">
          {t("Questa pagina non esiste")}
        </h1>
        <p className="text-sm text-muted-foreground">
          {t(
            "L'indirizzo potrebbe essere sbagliato. I tuoi file sono tutti nell'elenco."
          )}
        </p>
      </div>
      <Link href={`/${locale}` as Route} className={cn(buttonVariants())}>
        {t("Tutti i file")}
      </Link>
    </main>
  )
}
