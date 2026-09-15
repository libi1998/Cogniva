"use client"

import * as React from "react"
import { DocEditor } from "@/components/doc/doc-editor"
import { DocSkeleton } from "@/components/doc/doc-skeleton"
import { FileMissing } from "@/components/shared/workspace-states"
import { useStore } from "@/lib/store"

type Params = Promise<{ id: string }>

/**
 * La pagina di un documento: come per le board, il server disegna solo lo
 * scheletro e l'id si legge nel browser, dove vivono i file.
 */
export function DocRoute({ params }: { params: Params }) {
  const hydrated = useStore((s) => s.hydrated)
  if (!hydrated) return <DocSkeleton />
  return (
    <React.Suspense fallback={<DocSkeleton />}>
      <DocFromParams params={params} />
    </React.Suspense>
  )
}

function DocFromParams({ params }: { params: Params }) {
  const { id } = React.use(params)
  const exists = useStore((s) =>
    s.files.some((f) => f.id === id && f.kind === "doc")
  )
  if (!exists) return <FileMissing kind="doc" />
  // la chiave rimonta l'editor passando da un documento all'altro: il
  // contenuto iniziale e la cronologia di Tiptap sono per file
  return <DocEditor key={id} fileId={id} />
}
