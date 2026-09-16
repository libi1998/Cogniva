import { Suspense } from "react"
import { connection } from "next/server"

import { DocRoute } from "@/components/doc/doc-route"

/**
 * L'id del file si conosce solo al momento della richiesta: questo segnale lo
 * dice a Next, così il resto della pagina si prerende lo stesso.
 */
async function Connection() {
  await connection()
  return null
}

/**
 * L'editor è un componente client: con Cache Components i `params` arrivano dal
 * segmento, non dall'indirizzo attuale. Un documento rimasto vivo ma nascosto
 * continua così a sapere quale file mostra; `useParams()` gli avrebbe dato i
 * parametri della pagina visibile.
 */
export default function DocPage({ params }: PageProps<"/[lang]/doc/[id]">) {
  return (
    <>
      <DocRoute params={params} />
      <Suspense>
        <Connection />
      </Suspense>
    </>
  )
}
