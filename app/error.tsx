"use client"

import * as React from "react"
import Link from "next/link"
import { RotateCcw, TriangleAlert } from "lucide-react"
import { Button, buttonVariants } from "@/components/ui/button"
import { flushWorkspace } from "@/lib/store"
import { useDocumentTitle } from "@/lib/use-document-title"
import { cn } from "@/lib/utils"

/**
 * Un errore dentro una pagina. Le modifiche già fatte sono nello store: prima
 * di tutto si scrivono su disco, poi si offre di riprovare.
 */
export default function ErrorPage({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useDocumentTitle("Qualcosa è andato storto · Cogniva")
  React.useEffect(() => {
    console.error(error)
    void flushWorkspace()
  }, [error])

  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-muted px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10 text-destructive">
        <TriangleAlert className="size-6" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h1 className="text-base font-semibold text-foreground">
          Qualcosa è andato storto
        </h1>
        <p className="text-sm text-muted-foreground">
          Le modifiche fatte fin qui sono salvate in questo browser. Riprova, o
          torna all&apos;elenco dei file.
        </p>
        {error.digest ? (
          <p className="font-mono text-[11px] text-muted-foreground/70">
            {error.digest}
          </p>
        ) : null}
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={() => retry()}>
          <RotateCcw className="size-4" /> Riprova
        </Button>
        <Link href="/" className={cn(buttonVariants({ variant: "outline" }))}>
          Tutti i file
        </Link>
      </div>
    </main>
  )
}
