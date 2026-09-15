"use client"

import { DocRoute } from "@/components/doc/doc-route"

/**
 * Pagina client: con Cache Components i `params` arrivano dal segmento, non
 * dall'indirizzo attuale. Un documento rimasto vivo ma nascosto continua così
 * a sapere quale file mostra; `useParams()` gli avrebbe dato i parametri della
 * pagina visibile.
 */
export default function DocPage({ params }: PageProps<"/doc/[id]">) {
  return <DocRoute params={params} />
}
