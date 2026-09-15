"use client"

import { BoardRoute } from "@/components/board/board-route"

/**
 * Pagina client: con Cache Components i `params` arrivano dal segmento, non
 * dall'indirizzo attuale. Una board rimasta viva ma nascosta (dopo essere
 * tornati alla home) continua così a sapere quale file mostra; `useParams()`
 * le avrebbe dato i parametri della pagina visibile.
 */
export default function BoardPage({ params }: PageProps<"/board/[id]">) {
  return <BoardRoute params={params} />
}
