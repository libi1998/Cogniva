"use client"

import * as React from "react"
import { CommandLayer } from "@/components/shared/command-palette"
import { Toaster } from "@/components/ui/sonner"
import { TooltipProvider } from "@/components/ui/tooltip"
import { syncTheme } from "@/lib/use-theme"
import { useStore } from "@/lib/store"

/**
 * Niente attesa bloccante: le pagine arrivano già disegnate dal prerender e
 * mostrano uno scheletro finché lo spazio di lavoro non è caricato (la
 * lettura parte da sola, vedi store.ts e boot-script.ts).
 */
export function Providers({ children }: { children: React.ReactNode }) {
  const hydrate = useStore((s) => s.hydrate)

  React.useLayoutEffect(() => {
    syncTheme()
  }, [])

  React.useEffect(() => {
    // di norma è già partita al caricamento del modulo: qui non costa niente
    void hydrate()
  }, [hydrate])

  return (
    <TooltipProvider delay={350}>
      {children}
      <CommandLayer />
      <Toaster position="bottom-right" />
    </TooltipProvider>
  )
}
