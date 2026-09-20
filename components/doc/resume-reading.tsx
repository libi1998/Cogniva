"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { BookmarkCheck, X } from "lucide-react"
import { pageAt } from "@/lib/pagination"
import { STORAGE, readStorage, writeStorage } from "@/lib/storage"

import { useT, timeAgo } from "@/lib/i18n/client"

/**
 * «Riprendi la lettura» di Word: riaprendo un documento lasciato a metà, un
 * segnalibro propone di tornare dove si era arrivati. Il punto resta in questo
 * browser, come tutto il resto.
 */

type Mark = { pos: number; at: number; page: number; total: number }

const KEY = STORAGE.resume

/** Sotto questa soglia non si era andati da nessuna parte */
const MIN_POS = 120
/** Quanto in là bisogna essere arrivati in un documento di una pagina sola */
const MIN_SHARE = 0.3

/**
 * Vale la pena riprendere da qui? Sì se si era oltre la prima pagina, oppure
 * (in un documento senza pagine) se si era già a buon punto: riaprire sulla
 * seconda riga non è «riprendere».
 */
const worthResuming = (m: Mark) =>
  m.pos >= MIN_POS && (m.page > 1 || m.pos / Math.max(1, m.total) > MIN_SHARE)
/** Prima di tanto è la stessa sessione di lettura: non si propone niente */
const MIN_AGE = 3 * 60 * 1000
/** Un segnalibro più vecchio di un mese non interessa più */
const MAX_AGE = 30 * 24 * 60 * 60 * 1000
/** Quanto resta a video prima di sparire da solo */
const SHOW_FOR = 14_000

function readAll(): Record<string, Mark> {
  try {
    const raw = readStorage(KEY)
    const parsed: unknown = raw ? JSON.parse(raw) : null
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, Mark>)
      : {}
  } catch {
    return {}
  }
}

function write(fileId: string, mark: Mark) {
  const all = readAll()
  all[fileId] = mark
  // i documenti che non si aprono da un mese escono dall'elenco
  const now = Date.now()
  for (const [id, m] of Object.entries(all)) {
    if (!m || typeof m.at !== "number" || now - m.at > MAX_AGE) delete all[id]
  }
  writeStorage(KEY, JSON.stringify(all))
}

export function ResumeReading({
  editor,
  fileId,
}: {
  editor: Editor | null
  fileId: string
}) {
  const t = useT()
  const [mark, setMark] = React.useState<Mark | null>(null)

  // il segnalibro di quando si era usciti: si legge a documento aperto, non
  // durante il primo disegno (nel browser la pagina arriva già disegnata)
  React.useEffect(() => {
    const timer = setTimeout(() => {
      const saved = readAll()[fileId]
      const age = saved ? Date.now() - saved.at : 0
      if (
        saved &&
        typeof saved.pos === "number" &&
        worthResuming(saved) &&
        age > MIN_AGE &&
        age < MAX_AGE
      ) {
        setMark(saved)
      }
    }, 700)
    return () => clearTimeout(timer)
  }, [fileId])

  // sparisce da solo: è un invito, non un avviso da chiudere per forza
  React.useEffect(() => {
    if (!mark) return
    const timer = setTimeout(() => setMark(null), SHOW_FOR)
    return () => clearTimeout(timer)
  }, [mark])

  // dove si sta leggendo adesso, salvato quando si smette di muoversi
  React.useEffect(() => {
    if (!editor) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const save = () => {
      timer = null
      if (editor.isDestroyed) return
      const pos = editor.state.selection.head
      const mark = {
        pos,
        at: Date.now(),
        page: pageAt(editor.state, pos),
        total: editor.state.doc.content.size,
      }
      if (worthResuming(mark)) write(fileId, mark)
    }
    const schedule = () => {
      if (timer) clearTimeout(timer)
      timer = setTimeout(save, 1500)
    }
    editor.on("selectionUpdate", schedule)
    editor.on("update", schedule)
    window.addEventListener("pagehide", save)
    return () => {
      if (timer) clearTimeout(timer)
      editor.off("selectionUpdate", schedule)
      editor.off("update", schedule)
      window.removeEventListener("pagehide", save)
      save()
    }
  }, [editor, fileId])

  if (!mark || !editor) return null

  return (
    <div className="fixed right-4 bottom-20 z-40 flex items-center gap-1 rounded-xl border border-border bg-card/95 py-1.5 pr-1 pl-3 shadow-lg backdrop-blur print:hidden">
      <button
        type="button"
        className="flex items-center gap-2 text-left text-xs"
        onClick={() => {
          const pos = Math.min(mark.pos, editor.state.doc.content.size - 1)
          editor.chain().setTextSelection(pos).scrollIntoView().focus().run()
          setMark(null)
        }}
      >
        <BookmarkCheck className="size-4 shrink-0 text-primary" />
        <span>
          <span className="block font-medium">{t("Riprendi la lettura")}</span>
          <span className="block text-muted-foreground">
            {t("Pagina {page} · {when}", {
              page: mark.page,
              when: timeAgo(mark.at),
            })}
          </span>
        </span>
      </button>
      <button
        type="button"
        onClick={() => setMark(null)}
        aria-label={t("Chiudi")}
        className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  )
}
