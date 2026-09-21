"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogBody,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { captionLabels } from "@/lib/doc-fields"
import {
  authorityCategories,
  captionContent,
  captionTarget,
  type CaptionOptions,
  type IndexKind,
} from "@/lib/doc-references"
import { PAGE_NUMBER_FORMATS } from "@/lib/header-footer"
import { cn } from "@/lib/utils"

import { useT } from "@/lib/i18n/client"
const selectClass =
  "h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"

const LABELS_KEY = "cogniva.caption.labels"

function readLabels(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(LABELS_KEY) ?? "[]")
    return Array.isArray(raw)
      ? raw.filter((l) => typeof l === "string" && l.trim()).slice(0, 12)
      : []
  } catch {
    return []
  }
}

function saveLabels(labels: string[]) {
  try {
    localStorage.setItem(LABELS_KEY, JSON.stringify(labels))
  } catch {
    // senza localStorage l'etichetta vale per questa volta
  }
}

/** Un id per collegare didascalia e riferimenti incrociati */
function captionId() {
  return Math.random().toString(36).slice(2, 10)
}

/* ------------------------------- didascalia ------------------------------ */

export function CaptionDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("Didascalia")}</DialogTitle>
          <DialogDescription>
            {t(
              "Il numero si aggiorna da solo quando aggiungi o sposti figure e tabelle."
            )}
          </DialogDescription>
        </DialogHeader>
        {open ? <CaptionForm editor={editor} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function CaptionForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const [target] = React.useState(() => captionTarget(editor.state))
  const [custom, setCustom] = React.useState<string[]>(readLabels)
  const [newLabel, setNewLabel] = React.useState<string | null>(null)
  const [options, setOptions] = React.useState<CaptionOptions>(() => ({
    label:
      target.kind === "table"
        ? t("Tabella")
        : target.kind === "mathBlock"
          ? t("Equazione")
          : t("Figura"),
    text: "",
    // come in Word: le tabelle hanno la didascalia sopra, le figure sotto
    position: target.kind === "table" ? "above" : "below",
    format: "arabic",
    excludeLabel: false,
  }))
  const set = (patch: Partial<CaptionOptions>) =>
    setOptions((o) => ({ ...o, ...patch }))
  const labels = [
    ...captionLabels(),
    ...custom.filter((l) => !captionLabels().includes(l)),
  ]

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        const content = captionContent(options, captionId())
        const at = options.position === "above" ? target.pos : target.end
        editor.chain().focus().insertContentAt(at, content).run()
        onClose()
      }}
    >
      <DialogBody className="space-y-3">
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
          {options.excludeLabel ? "" : `${options.label} `}
          <b>1</b>
          {options.text.trim() ? `: ${options.text.trim()}` : ""}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Testo della didascalia")}
          </span>
          <Input
            autoFocus
            value={options.text}
            onChange={(e) => set({ text: e.target.value })}
            placeholder={t("Es. Andamento delle vendite nel 2026")}
            className="h-8 text-sm"
          />
        </label>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {t("Etichetta")}
            </span>
            <select
              value={options.label}
              onChange={(e) => set({ label: e.target.value })}
              className={selectClass}
            >
              {labels.map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {t("Posizione")}
            </span>
            <select
              value={options.position}
              onChange={(e) =>
                set({ position: e.target.value as CaptionOptions["position"] })
              }
              className={selectClass}
            >
              <option value="above">{t("Sopra l'elemento selezionato")}</option>
              <option value="below">{t("Sotto l'elemento selezionato")}</option>
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {t("Numerazione")}
            </span>
            <select
              value={options.format}
              onChange={(e) => set({ format: e.target.value })}
              className={selectClass}
            >
              {PAGE_NUMBER_FORMATS.filter((f) => f.value !== "dash").map(
                (f) => (
                  <option key={f.value} value={f.value}>
                    {f.label}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="flex items-end gap-2 pb-1.5 text-sm">
            <input
              type="checkbox"
              checked={options.excludeLabel}
              onChange={(e) => set({ excludeLabel: e.target.checked })}
            />
            {t("Escludi l'etichetta")}
          </label>
        </div>
        {newLabel === null ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setNewLabel("")}
          >
            {t("Nuova etichetta…")}
          </Button>
        ) : (
          <div className="flex items-center gap-2">
            <Input
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              placeholder={t("Es. Grafico, Schema, Foto")}
              className="h-8 text-sm"
            />
            <Button
              type="button"
              size="sm"
              disabled={!newLabel.trim()}
              onClick={() => {
                const label = newLabel.trim()
                const next = [...new Set([...custom, label])]
                setCustom(next)
                saveLabels(next)
                set({ label })
                setNewLabel(null)
              }}
            >
              {t("Aggiungi")}
            </Button>
          </div>
        )}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("Annulla")}
        </Button>
        <Button type="submit">{t("Inserisci")}</Button>
      </DialogFooter>
    </form>
  )
}

/* ------------------------------- segna voce ------------------------------ */

export function MarkEntryDialog({
  open,
  onClose,
  editor,
  kind,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
  kind: IndexKind
}) {
  const t = useT()
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>
            {kind === "authority"
              ? t("Segna citazione")
              : t("Segna voce di indice")}
          </DialogTitle>
          <DialogDescription>
            {kind === "authority"
              ? t(
                  "La citazione compare nell'indice delle autorità, divisa per categoria."
                )
              : t(
                  "La voce compare nell'indice analitico con il numero di pagina."
                )}
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <MarkEntryForm editor={editor} kind={kind} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function MarkEntryForm({
  editor,
  kind,
  onClose,
}: {
  editor: Editor
  kind: IndexKind
  onClose: () => void
}) {
  const t = useT()
  const [selected] = React.useState(() =>
    editor.state.doc
      .textBetween(editor.state.selection.from, editor.state.selection.to, " ")
      .trim()
  )
  const [entry, setEntry] = React.useState(selected)
  const [sub, setSub] = React.useState("")
  const [category, setCategory] = React.useState(() => authorityCategories()[0])

  const mark = (all: boolean) => {
    if (!selected) {
      toast.info(t("Seleziona prima il testo da segnare"))
      return
    }
    const done = editor
      .chain()
      .focus()
      .markIndexEntry({ entry, sub, kind, category, all })
      .run()
    if (done) {
      toast.success(
        all
          ? t("«{selected}» segnata ovunque", { selected })
          : t("Voce segnata")
      )
      onClose()
    }
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        mark(false)
      }}
    >
      <DialogBody className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {kind === "authority" ? t("Citazione breve") : t("Voce principale")}
          </span>
          <Input
            autoFocus
            value={entry}
            onChange={(e) => setEntry(e.target.value)}
            className="h-8 text-sm"
          />
        </label>
        {kind === "authority" ? (
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {t("Categoria")}
            </span>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className={selectClass}
            >
              {authorityCategories().map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {t("Sottovoce")}
            </span>
            <Input
              value={sub}
              onChange={(e) => setSub(e.target.value)}
              placeholder={t("Facoltativa")}
              className="h-8 text-sm"
            />
          </label>
        )}
        {!selected ? (
          <p className={cn("text-xs text-destructive")}>
            {t(
              "Nessun testo selezionato: chiudi, seleziona una parola e riprova."
            )}
          </p>
        ) : null}
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("Chiudi")}
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!selected || !entry.trim()}
          onClick={() => mark(true)}
        >
          {t("Segna tutto")}
        </Button>
        <Button type="submit" disabled={!selected || !entry.trim()}>
          {t("Segna")}
        </Button>
      </DialogFooter>
    </form>
  )
}
