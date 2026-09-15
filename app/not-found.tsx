import type { Metadata } from "next"
import Link from "next/link"
import { Compass } from "lucide-react"
import { DocumentTitle } from "@/components/document-title"
import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export const metadata: Metadata = {
  title: "Pagina non trovata · Cogniva",
}

export default function NotFound() {
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-muted px-6 text-center">
      <DocumentTitle title="Pagina non trovata · Cogniva" />
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <Compass className="size-6" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h1 className="text-base font-semibold text-foreground">
          Questa pagina non esiste
        </h1>
        <p className="text-sm text-muted-foreground">
          L&apos;indirizzo potrebbe essere sbagliato. I tuoi file sono tutti
          nell&apos;elenco.
        </p>
      </div>
      <Link href="/" className={cn(buttonVariants())}>
        Tutti i file
      </Link>
    </main>
  )
}
