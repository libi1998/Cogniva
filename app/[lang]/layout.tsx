import type { Metadata, Viewport } from "next"
import { notFound } from "next/navigation"
import { lang as langParam } from "next/root-params"
import { Geist_Mono } from "next/font/google"

import "../globals.css"
// i cento caratteri aggiuntivi, salvati nel progetto: le @font-face non
// scaricano nulla finché un testo non li usa
import "@/fonts/fonts.css"
import { InlineScript } from "@/components/inline-script"
import { Providers } from "@/components/providers"
import { BOOT_SCRIPT } from "@/lib/boot-script"
import { fontClassNames } from "@/lib/fonts"
import { cn } from "@/lib/utils"
import { I18nProvider } from "@/lib/i18n/client"
import {
  DEFAULT_LOCALE,
  isLocale,
  LOCALE_REGIONS,
  LOCALES,
} from "@/lib/i18n/config"
import { getMessages } from "@/lib/i18n/messages"
import { DESCRIPTIONS } from "@/lib/i18n/descriptions"

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }))
}

// il titolo dei file lo scrivono le pagine nel browser (useDocumentTitle): i
// nomi dei file esistono solo lì, il server non li conosce. La descrizione
// nella lingua giusta la mette la home: qui sta la parte uguale per tutti,
// perché le rotte con un id non possono calcolare i metadati prima del tempo.
export const metadata: Metadata = {
  title: "Cogniva",
  description: DESCRIPTIONS[DEFAULT_LOCALE],
  applicationName: "Cogniva",
  appleWebApp: { capable: true, title: "Cogniva", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
  alternates: {
    languages: Object.fromEntries(
      LOCALES.map((l) => [LOCALE_REGIONS[l], `/${l}`])
    ),
  },
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // su iPhone con notch l'app usa tutto lo schermo; i margini sicuri li
  // rispettano le barre (env(safe-area-inset-*))
  viewportFit: "cover",
  // la tastiera virtuale restringe il layout invece di coprire barre e
  // barra degli strumenti mentre si scrive
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
}

export default async function RootLayout({ children }: LayoutProps<"/[lang]">) {
  const lang = await langParam()
  if (!isLocale(lang)) notFound()
  return (
    <html
      lang={lang}
      suppressHydrationWarning
      className={cn("h-full antialiased", fontMono.variable, fontClassNames)}
    >
      <head>
        {/* gira durante la lettura dell'HTML, prima di ogni bundle: tema
            senza lampi e lettura dello spazio di lavoro già avviata */}
        <InlineScript html={BOOT_SCRIPT} />
      </head>
      <body className="min-h-full font-sans">
        <I18nProvider locale={lang} messages={getMessages(lang, "app")}>
          <Providers>{children}</Providers>
        </I18nProvider>
      </body>
    </html>
  )
}
