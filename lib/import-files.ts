"use client"

import type { Route } from "next"
import { toast } from "sonner"
import { importWorkspace, useStore } from "./store"
import type { WFile } from "./types"

export const fileHref = (f: Pick<WFile, "kind" | "id">) =>
  (f.kind === "board" ? `/board/${f.id}` : `/doc/${f.id}`) as Route

/** Tipi di file che si possono importare, per i selettori di file */
export const IMPORTABLE = ".docx,.md,.markdown,.txt,.html,.htm,.json"

/**
 * Importa i file scelti o trascinati: documenti Word, Markdown, HTML e testo
 * diventano documenti, i .json sono spazi di lavoro esportati.
 */
export async function importFiles(
  list: File[],
  open: (href: Route) => void
): Promise<void> {
  let opened: WFile | null = null
  let count = 0
  for (const file of list) {
    const id = toast.loading(`Importo «${file.name}»…`)
    try {
      if (file.name.toLowerCase().endsWith(".json")) {
        const added = importWorkspace(await file.text())
        toast.success(`Aggiunti ${added} file dallo spazio di lavoro`, { id })
        continue
      }
      const { importDocumentFile } = await import("@/lib/import-doc")
      const result = await importDocumentFile(file)
      useStore.getState().addFile(result.file)
      opened = result.file
      count++
      toast.success(`«${result.file.title}» importato`, {
        id,
        description: result.warnings
          ? "Qualche formattazione di Word non ha un equivalente ed è stata semplificata."
          : undefined,
      })
    } catch (err) {
      toast.error(`Non riesco a importare «${file.name}»`, {
        id,
        description: err instanceof Error ? err.message : undefined,
      })
    }
  }
  if (count === 1 && opened) open(fileHref(opened))
}

/** Apre il selettore di file del sistema e importa quello che si sceglie */
export function pickAndImport(open: (href: Route) => void) {
  const input = document.createElement("input")
  input.type = "file"
  input.multiple = true
  input.accept = IMPORTABLE
  input.onchange = () => {
    const list = Array.from(input.files ?? [])
    if (list.length) void importFiles(list, open)
  }
  input.click()
}
