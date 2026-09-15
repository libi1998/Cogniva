"use client"

import * as React from "react"
import { BoardEditor } from "@/components/board/board-editor"
import {
  BoardSkeleton,
  FileMissing,
} from "@/components/shared/workspace-states"
import { useStore } from "@/lib/store"

type Params = Promise<{ id: string }>

/**
 * La pagina di una board. Sul server (e nel prerender) lo spazio di lavoro non
 * esiste: si disegna lo scheletro senza leggere i parametri, così la shell
 * resta statica e uguale per ogni board. L'id si legge solo nel browser.
 */
export function BoardRoute({ params }: { params: Params }) {
  const hydrated = useStore((s) => s.hydrated)
  if (!hydrated) return <BoardSkeleton />
  return (
    <React.Suspense fallback={<BoardSkeleton />}>
      <BoardFromParams params={params} />
    </React.Suspense>
  )
}

function BoardFromParams({ params }: { params: Params }) {
  const { id } = React.use(params)
  const exists = useStore((s) =>
    s.files.some((f) => f.id === id && f.kind === "board")
  )
  if (!exists) return <FileMissing kind="board" />
  // la chiave rimonta l'editor passando da una board all'altra: cronologia,
  // selezione e vista non devono trascinarsi dietro
  return <BoardEditor key={id} fileId={id} />
}
