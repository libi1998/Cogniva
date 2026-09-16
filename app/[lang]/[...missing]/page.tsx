import { notFound } from "next/navigation"

/** Un indirizzo che non esiste mostra la pagina «non trovata» nella lingua giusta */
export default function Missing() {
  notFound()
}
