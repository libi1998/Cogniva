"use client"

import * as React from "react"
import { nanoid } from "nanoid"
import { BookPlus, Quote, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  SOURCE_KINDS,
  emptySource,
  inTextCitation,
  referenceEntry,
  sourceLabel,
} from "@/lib/citations"
import { useStore } from "@/lib/store"
import type { CitationStyle, DocSource, SourceKind } from "@/lib/types"
import { cn } from "@/lib/utils"

const NO_SOURCES: DocSource[] = []

export function useDocSources(fileId: string) {
  return useStore((s) => {
    const f = s.files.find((x) => x.id === fileId)
    return f && f.kind === "doc" ? (f.data.sources ?? NO_SOURCES) : NO_SOURCES
  })
}

/** Le etichette dei campi cambiano con il tipo di fonte, come in Word */
function fieldsFor(kind: SourceKind) {
  return {
    publisher:
      kind === "article"
        ? "Rivista"
        : kind === "web"
          ? "Nome del sito"
          : "Editore",
    showCity: kind === "book" || kind === "report",
    showVolume: kind === "article",
    showPages: kind === "article",
    showUrl: true,
    showAccessed: kind === "web",
  }
}

function Field({
  label,
  children,
  className,
}: {
  label: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <label className={cn("block space-y-1", className)}>
      <span className="text-[11px] font-medium text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  )
}

/**
 * «Gestisci fonti» di Word: l'elenco delle fonti del documento a sinistra e la
 * scheda della fonte a destra, con l'anteprima di citazione e voce nello stile
 * scelto. Le modifiche si salvano mentre si scrive.
 */
export function SourcesDialog({
  open,
  onOpenChange,
  fileId,
  style,
  initialId,
  onCite,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  fileId: string
  style: CitationStyle
  initialId?: string | null
  /** se presente, il pulsante «Cita» inserisce la fonte nel testo */
  onCite?: (id: string) => void
}) {
  const sources = useDocSources(fileId)
  const update = useStore((s) => s.updateDocSources)
  const [picked, setPicked] = React.useState<string | null>(null)
  const currentId = picked ?? initialId ?? sources[0]?.id ?? null
  const current = sources.find((s) => s.id === currentId) ?? null

  const patch = (changes: Partial<DocSource>) => {
    if (!current) return
    update(fileId, (list) =>
      list.map((s) => (s.id === current.id ? { ...s, ...changes } : s))
    )
  }
  const create = () => {
    const id = nanoid(8)
    update(fileId, (list) => [...list, emptySource(id)])
    setPicked(id)
  }
  const remove = () => {
    if (!current) return
    const index = sources.findIndex((s) => s.id === current.id)
    update(fileId, (list) => list.filter((s) => s.id !== current.id))
    setPicked(sources[index + 1]?.id ?? sources[index - 1]?.id ?? null)
  }

  const f = fieldsFor(current?.kind ?? "book")

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        onOpenChange(v)
        if (!v) setPicked(null)
      }}
    >
      <DialogContent className="max-h-[88dvh] overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-b border-border px-5 pt-4 pb-3">
          <DialogTitle>Gestisci fonti</DialogTitle>
          <DialogDescription>
            Le fonti di questo documento: citale nel testo e raccoglile nella
            bibliografia.
          </DialogDescription>
        </DialogHeader>

        <div className="grid min-h-0 grid-cols-1 sm:grid-cols-[230px_1fr]">
          <div className="flex min-h-0 flex-col border-b border-border sm:border-r sm:border-b-0">
            <div className="max-h-[46dvh] min-h-[120px] flex-1 overflow-y-auto p-2">
              {sources.length ? (
                sources.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => setPicked(s.id)}
                    className={cn(
                      "block w-full rounded-md px-2 py-1.5 text-left text-xs",
                      s.id === currentId
                        ? "bg-accent text-accent-foreground"
                        : "hover:bg-muted"
                    )}
                  >
                    <span className="line-clamp-2">{sourceLabel(s)}</span>
                  </button>
                ))
              ) : (
                <p className="px-2 py-3 text-xs text-muted-foreground">
                  Nessuna fonte. Aggiungi la prima.
                </p>
              )}
            </div>
            <div className="flex gap-1.5 border-t border-border p-2">
              <Button
                size="sm"
                className="h-8 flex-1 gap-1.5 text-xs"
                onClick={create}
              >
                <BookPlus className="size-3.5" /> Nuova fonte
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs text-destructive hover:text-destructive"
                disabled={!current}
                onClick={remove}
                title="Elimina la fonte"
                aria-label="Elimina la fonte"
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          </div>

          {current ? (
            <div className="max-h-[62dvh] space-y-3 overflow-y-auto p-5">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Tipo di fonte">
                  <Select
                    items={SOURCE_KINDS}
                    value={current.kind}
                    onValueChange={(v) => patch({ kind: v as SourceKind })}
                  >
                    <SelectTrigger className="h-8 w-full text-xs" size="sm">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_KINDS.map((k) => (
                        <SelectItem key={k.value} value={k.value}>
                          {k.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Anno">
                  <Input
                    className="h-8 text-xs"
                    inputMode="numeric"
                    value={current.year}
                    placeholder="2024"
                    onChange={(e) => patch({ year: e.target.value })}
                  />
                </Field>
              </div>
              <Field label="Autori (Cognome, Nome; Cognome, Nome)">
                <Input
                  autoFocus={!current.title && !current.authors}
                  className="h-8 text-xs"
                  value={current.authors}
                  placeholder="Rossi, Mario; Bianchi, Luca"
                  onChange={(e) => patch({ authors: e.target.value })}
                />
              </Field>
              <Field label="Titolo">
                <Input
                  className="h-8 text-xs"
                  value={current.title}
                  onChange={(e) => patch({ title: e.target.value })}
                />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label={f.publisher}
                  className={f.showCity ? "" : "col-span-2"}
                >
                  <Input
                    className="h-8 text-xs"
                    value={current.publisher}
                    onChange={(e) => patch({ publisher: e.target.value })}
                  />
                </Field>
                {f.showCity ? (
                  <Field label="Città">
                    <Input
                      className="h-8 text-xs"
                      value={current.city}
                      onChange={(e) => patch({ city: e.target.value })}
                    />
                  </Field>
                ) : null}
              </div>
              {f.showVolume ? (
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Volume">
                    <Input
                      className="h-8 text-xs"
                      value={current.volume}
                      onChange={(e) => patch({ volume: e.target.value })}
                    />
                  </Field>
                  <Field label="Pagine">
                    <Input
                      className="h-8 text-xs"
                      value={current.pages}
                      placeholder="12-34"
                      onChange={(e) => patch({ pages: e.target.value })}
                    />
                  </Field>
                </div>
              ) : null}
              <div className="grid grid-cols-2 gap-3">
                <Field
                  label="URL"
                  className={f.showAccessed ? "" : "col-span-2"}
                >
                  <Input
                    className="h-8 text-xs"
                    value={current.url}
                    placeholder="https://…"
                    onChange={(e) => patch({ url: e.target.value })}
                  />
                </Field>
                {f.showAccessed ? (
                  <Field label="Consultato il">
                    <Input
                      className="h-8 text-xs"
                      value={current.accessed}
                      placeholder="3 marzo 2025"
                      onChange={(e) => patch({ accessed: e.target.value })}
                    />
                  </Field>
                ) : null}
              </div>

              <div className="rounded-lg border border-border bg-muted/40 p-3 text-xs">
                <p className="mb-1 font-medium text-muted-foreground">
                  Anteprima
                </p>
                <p>{inTextCitation(style, current, "")}</p>
                <p className="mt-1.5 pl-6 -indent-6 leading-relaxed">
                  {referenceEntry(style, current).map((piece, i) =>
                    piece.italic ? (
                      <em key={i}>{piece.text}</em>
                    ) : (
                      <React.Fragment key={i}>{piece.text}</React.Fragment>
                    )
                  )}
                </p>
              </div>

              {onCite ? (
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    className="h-8 gap-1.5 text-xs"
                    onClick={() => {
                      onCite(current.id)
                      onOpenChange(false)
                    }}
                  >
                    <Quote className="size-3.5" /> Cita questa fonte
                  </Button>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="flex items-center justify-center p-10 text-xs text-muted-foreground">
              Scegli una fonte o creane una nuova.
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
