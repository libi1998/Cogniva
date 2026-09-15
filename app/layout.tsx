import type { Metadata, Viewport } from "next"
import { Geist_Mono } from "next/font/google"

import "./globals.css"
// i cento caratteri aggiuntivi, salvati nel progetto: le @font-face non
// scaricano nulla finché un testo non li usa
import "@/fonts/fonts.css"
import { InlineScript } from "@/components/inline-script"
import { Providers } from "@/components/providers"
import { BOOT_SCRIPT } from "@/lib/boot-script"
import { fontClassNames } from "@/lib/fonts"
import { cn } from "@/lib/utils"

const fontMono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

// il titolo dei file lo scrivono le pagine nel browser (useDocumentTitle): i
// nomi dei file esistono solo lì, il server non li conosce
export const metadata: Metadata = {
  title: "Cogniva",
  description:
    "Board e documenti in un'unica app: diagrammi, wireframe e documenti come in Word, tutto in locale.",
  applicationName: "Cogniva",
  appleWebApp: { capable: true, title: "Cogniva", statusBarStyle: "default" },
  formatDetection: { telephone: false, email: false, address: false },
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

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="it"
      suppressHydrationWarning
      className={cn("h-full antialiased", fontMono.variable, fontClassNames)}
    >
      <head>
        {/* gira durante la lettura dell'HTML, prima di ogni bundle: tema
            senza lampi e lettura dello spazio di lavoro già avviata */}
        <InlineScript html={BOOT_SCRIPT} />
      </head>
      <body className="min-h-full font-sans">
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
