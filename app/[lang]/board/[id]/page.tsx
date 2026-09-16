import { Suspense } from "react"
import { connection } from "next/server"

import { BoardRoute } from "@/components/board/board-route"

/**
 * L'id del file si conosce solo al momento della richiesta: questo segnale lo
 * dice a Next, così il resto della pagina si prerende lo stesso.
 */
async function Connection() {
  await connection()
  return null
}

/**
 * La board è un componente client: con Cache Components i `params` arrivano dal
 * segmento, non dall'indirizzo attuale. Una board rimasta viva ma nascosta
 * (dopo essere tornati alla home) continua così a sapere quale file mostra;
 * `useParams()` le avrebbe dato i parametri della pagina visibile.
 */
export default function BoardPage({ params }: PageProps<"/[lang]/board/[id]">) {
  return (
    <>
      <BoardRoute params={params} />
      <Suspense>
        <Connection />
      </Suspense>
    </>
  )
}
