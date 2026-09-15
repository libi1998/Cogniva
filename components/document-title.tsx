"use client"

import { useDocumentTitle } from "@/lib/use-document-title"

/** Il titolo della scheda per le pagine server (vedi useDocumentTitle) */
export function DocumentTitle({ title }: { title: string }) {
  useDocumentTitle(title)
  return null
}
