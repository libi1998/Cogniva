"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { sortTarget, type SortOptions } from "@/lib/doc-typography"

/** «Ordina testo», come in Word: paragrafi, voci di elenco o righe di tabella */
export function SortDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[420px]">
        {open ? <SortForm editor={editor} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function SortForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  // cosa si ordina si decide all'apertura: il cursore non si muove intanto
  const [target] = React.useState(() => sortTarget(editor.state))
  const columns =
    target.kind === "table" ? (target.node.firstChild?.childCount ?? 1) : 0
  const headers =
    target.kind === "table"
      ? Array.from({ length: columns }, (_, i) => {
          const text = target.node.firstChild?.maybeChild(i)?.textContent.trim()
          return text || `Colonna ${i + 1}`
        })
      : []
  const [options, setOptions] = React.useState<SortOptions>(() => {
    let column = 0
    if (target.kind === "table") {
      const { $from } = editor.state.selection
      for (let depth = $from.depth; depth > 0; depth -= 1) {
        const name = $from.node(depth).type.name
        if (name === "tableCell" || name === "tableHeader") {
          column = $from.index(depth - 1)
          break
        }
      }
    }
    return {
      by: "text",
      direction: "asc",
      column,
      header:
        target.kind === "table" &&
        target.node.firstChild?.firstChild?.type.name === "tableHeader",
    }
  })
  const set = (patch: Partial<SortOptions>) =>
    setOptions((o) => ({ ...o, ...patch }))

  const what =
    target.kind === "table"
      ? "le righe della tabella"
      : target.kind === "list"
        ? "le voci dell'elenco"
        : target.start === target.end
          ? "il paragrafo"
          : `${target.end - target.start + 1} paragrafi`

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const done = editor.chain().focus().sortBlocks(options).run()
        if (!done) toast.info("Serve più di un elemento da ordinare")
        onClose()
      }}
    >
      <DialogHeader className="border-b border-border px-5 py-4">
        <DialogTitle>Ordina testo</DialogTitle>
        <DialogDescription>Si ordinano {what}.</DialogDescription>
      </DialogHeader>
      <div className="space-y-3 px-5 py-4 text-sm">
        {target.kind === "table" ? (
          <label className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">Ordina per</span>
            <select
              value={options.column}
              onChange={(e) => set({ column: Number(e.target.value) })}
              className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm"
            >
              {headers.map((h, i) => (
                <option key={i} value={i}>
                  {h}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Tipo</span>
          <select
            value={options.by}
            onChange={(e) => set({ by: e.target.value as SortOptions["by"] })}
            className="h-8 w-48 rounded-md border border-input bg-transparent px-2 text-sm"
          >
            <option value="text">Testo</option>
            <option value="number">Numero</option>
            <option value="date">Data</option>
          </select>
        </label>
        <div className="flex items-center justify-between gap-3">
          <span className="text-muted-foreground">Ordine</span>
          <div className="flex w-48 flex-col gap-1">
            {(
              [
                ["asc", "Crescente (A → Z)"],
                ["desc", "Decrescente (Z → A)"],
              ] as const
            ).map(([value, label]) => (
              <label key={value} className="flex items-center gap-2">
                <input
                  type="radio"
                  name="sort-direction"
                  checked={options.direction === value}
                  onChange={() => set({ direction: value })}
                />
                {label}
              </label>
            ))}
          </div>
        </div>
        {target.kind === "table" ? (
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(options.header)}
              onChange={(e) => set({ header: e.target.checked })}
            />
            La prima riga è l&apos;intestazione
          </label>
        ) : null}
      </div>
      <DialogFooter className="border-t border-border px-5 py-3">
        <Button type="button" variant="ghost" onClick={onClose}>
          Annulla
        </Button>
        <Button type="submit">Ordina</Button>
      </DialogFooter>
    </form>
  )
}
