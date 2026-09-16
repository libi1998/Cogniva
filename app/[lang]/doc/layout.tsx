import { I18nProvider } from "@/lib/i18n/client"
import { isLocale, SOURCE_LOCALE } from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"

/** I testi dell'editor dei documenti arrivano solo quando se ne apre uno */
export default async function DocLayout({
  children,
  params,
}: LayoutProps<"/[lang]/doc">) {
  const { lang } = await params
  const locale = isLocale(lang) ? lang : SOURCE_LOCALE
  return (
    <I18nProvider locale={locale} messages={getMessages(locale, "doc")}>
      {children}
    </I18nProvider>
  )
}
