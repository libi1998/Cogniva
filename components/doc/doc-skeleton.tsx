"use client"

import { Ribbon } from "@/components/doc/ribbon/ribbon"
import {
  PanelSkeleton,
  TopBarSkeleton,
} from "@/components/shared/workspace-states"

/**
 * Il documento prima che lo spazio di lavoro sia caricato: la barra a schede
 * è quella vera (ricorda anche se era compressa), il foglio è un segnaposto.
 */
export function DocSkeleton() {
  return (
    <div
      className="flex h-dvh flex-col bg-muted"
      aria-busy="true"
      aria-label="Carico il documento"
    >
      <TopBarSkeleton />
      <Ribbon ctx={null} />
      <div className="relative flex min-h-0 flex-1">
        <div
          className="flex min-w-0 flex-1 flex-col"
          style={{ background: "var(--doc-bg-auto)" }}
        >
          <div className="min-h-0 flex-1 overflow-hidden px-3 py-6 sm:px-4 sm:py-8">
            <div
              className="mx-auto flex min-h-[60vh] w-full max-w-[760px] flex-col gap-3 rounded-xl p-6 shadow-sm sm:p-14"
              style={{ background: "var(--paper-auto)" }}
            >
              <span className="mb-4 h-9 w-2/3 skeleton" />
              <span className="h-3.5 w-full skeleton" />
              <span className="h-3.5 w-[92%] skeleton" />
              <span className="h-3.5 w-[84%] skeleton" />
              <span className="mt-6 h-6 w-1/3 skeleton" />
              <span className="h-3.5 w-full skeleton" />
              <span className="h-3.5 w-3/4 skeleton" />
            </div>
          </div>
          <div className="shrink-0 border-t border-border bg-card safe-bottom">
            <div className="h-7" />
          </div>
        </div>
        <PanelSkeleton width={280} />
      </div>
    </div>
  )
}
