"use client"

import * as React from "react"
import {
  BookMarked,
  Captions,
  FileSearch,
  Gavel,
  Images,
  RefreshCw,
  TextQuote,
  Type,
  ArrowDownToLine,
  BookOpenText,
  BookPlus,
  Library,
  Palette,
  Quote,
  ListOrdered,
  ListTree,
  NotebookPen,
  StickyNote,
  Trash2,
} from "lucide-react"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { toast } from "sonner"
import { CITATION_STYLES, inTextCitation, sourceLabel } from "@/lib/citations"
import { cn } from "@/lib/utils"
import { CrossRefDialog } from "../insert-dialogs"
import { CaptionDialog, MarkEntryDialog } from "../reference-dialogs"
import { applyDocStyle } from "../style-actions"
import { CAPTION_LABELS } from "@/lib/doc-fields"
import type { IndexKind } from "@/lib/doc-references"
import { RibbonButton, RibbonGroup, RibbonMenu, RibbonRows } from "./ribbon-ui"
import { atBody, type RibbonCtx } from "./shared"

function positionsOf(ctx: RibbonCtx, type: string) {
  const out: number[] = []
  ctx.editor.state.doc.descendants((n, pos) => {
    if (n.type.name === type) out.push(pos)
    return true
  })
  return out
}

type RefDialog = "caption" | "crossref" | "index" | "authority" | null

export function ReferencesTab({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st, theme, setTheme } = ctx
  const tocs = positionsOf(ctx, "toc")
  const notes = positionsOf(ctx, "footnote")
  const [dialog, setDialog] = React.useState<RefDialog>(null)
  const close = () => setDialog(null)
  const removeNodes = (type: string) => {
    const positions = positionsOf(ctx, type)
    const chain = editor.chain().focus()
    ;[...positions].reverse().forEach((pos) =>
      chain.command(({ tr }) => {
        const node = tr.doc.nodeAt(pos)
        if (node) tr.delete(pos, pos + node.nodeSize)
        return true
      })
    )
    chain.run()
  }
  const refresh = (what: string) => {
    // gli indici si ricalcolano a ogni modifica: qui si ridisegnano e basta
    editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false))
    toast.success(`${what} aggiornato`)
  }
  const indexKinds: [IndexKind, string][] = [
    ["index", "Indice analitico"],
    ["authority", "Indice delle autorità"],
  ]

  return (
    <>
      <RibbonGroup label="Sommario">
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label="Sommario"
              title="Sommario dai titoli: si aggiorna da solo mentre scrivi"
              icon={<ListTree className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Predefiniti</DropdownMenuLabel>
          {(
            [
              ["card", "Automatico 1", "Riquadro colorato, senza pagine"],
              ["classic", "Automatico 2", "Puntini e numeri di pagina"],
              ["simple", "Semplice", "Solo i titoli"],
            ] as const
          ).map(([variant, label, hint]) => (
            <DropdownMenuItem
              key={variant}
              onClick={() =>
                atBody(editor, st).setTableOfContents({ variant }).run()
              }
            >
              <div className="flex flex-col">
                <span>{label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {hint}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Livelli mostrati</DropdownMenuLabel>
          {[1, 2, 3].map((levels) => (
            <DropdownMenuItem
              key={levels}
              disabled={!tocs.length}
              onClick={() =>
                editor
                  .chain()
                  .command(({ tr }) => {
                    for (const pos of tocs) {
                      const node = tr.doc.nodeAt(pos)
                      if (node)
                        tr.setNodeMarkup(pos, undefined, {
                          ...node.attrs,
                          levels,
                        })
                    }
                    return true
                  })
                  .run()
              }
            >
              {levels === 1
                ? "Solo Titolo 1"
                : `Titoli fino al livello ${levels}`}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!tocs.length}
            onClick={() => removeNodes("toc")}
          >
            <Trash2 /> Rimuovi sommario
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonRows>
          <RibbonMenu
            className="w-52"
            trigger={
              <RibbonButton
                compact
                chevron
                label="Aggiungi testo"
                title="Il paragrafo compare nel sommario al livello scelto"
                icon={<Type className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem
              onClick={() => applyDocStyle(editor, theme, "normal")}
              className={cn(
                !st.heading1 && !st.heading2 && !st.heading3 && "bg-accent"
              )}
            >
              Non mostrare nel sommario
            </DropdownMenuItem>
            {([1, 2, 3] as const).map((level) => (
              <DropdownMenuItem
                key={level}
                onClick={() => applyDocStyle(editor, theme, `heading${level}`)}
                className={cn(
                  (level === 1
                    ? st.heading1
                    : level === 2
                      ? st.heading2
                      : st.heading3) && "bg-accent"
                )}
              >
                Livello {level}
              </DropdownMenuItem>
            ))}
          </RibbonMenu>
          <RibbonButton
            compact
            data-safe=""
            label="Aggiorna sommario"
            disabled={!tocs.length}
            icon={<RefreshCw className="size-4" />}
            className="justify-start"
            onClick={() => refresh("Sommario")}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Citazioni e bibliografia">
        <RibbonMenu
          className="w-72"
          trigger={
            <RibbonButton
              large
              chevron
              label="Inserisci citazione"
              icon={<Quote className="size-5" />}
            />
          }
        >
          {ctx.sources.length ? (
            <>
              <DropdownMenuLabel>Fonti del documento</DropdownMenuLabel>
              <div className="max-h-72 overflow-y-auto">
                {ctx.sources.map((source) => (
                  <DropdownMenuItem
                    key={source.id}
                    onClick={() =>
                      editor.chain().focus().insertCitation(source.id).run()
                    }
                    className="flex flex-col items-start gap-0"
                  >
                    <span className="line-clamp-1 text-xs">
                      {sourceLabel(source)}
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      {inTextCitation(theme.citationStyle, source)}
                    </span>
                  </DropdownMenuItem>
                ))}
              </div>
              <DropdownMenuSeparator />
            </>
          ) : null}
          <DropdownMenuItem onClick={() => ctx.openSources(null, true)}>
            <BookPlus className="size-4" /> Aggiungi nuova fonte…
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            data-safe=""
            label="Gestisci fonti"
            icon={<Library className="size-4" />}
            className="justify-start"
            onClick={() => ctx.openSources()}
          />
          <RibbonMenu
            className="w-56"
            trigger={
              <RibbonButton
                data-safe=""
                chevron
                label={`Stile: ${CITATION_STYLES.find((x) => x.value === theme.citationStyle)?.label.split(" ")[0] ?? "APA"}`}
                icon={<Palette className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>Stile delle citazioni</DropdownMenuLabel>
            {CITATION_STYLES.map((option) => (
              <DropdownMenuItem
                key={option.value}
                onClick={() => setTheme({ citationStyle: option.value })}
                className={cn(
                  theme.citationStyle === option.value && "font-semibold"
                )}
              >
                {option.label}
              </DropdownMenuItem>
            ))}
          </RibbonMenu>
          <RibbonButton
            label="Bibliografia"
            title="Elenco delle fonti citate, ordinato e formattato nello stile scelto"
            icon={<BookOpenText className="size-4" />}
            className="justify-start"
            onClick={() => {
              ctx.openPanel()
              atBody(editor, st).insertBibliography().run()
            }}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Note">
        <RibbonButton
          large
          label="Inserisci nota a piè di pagina"
          title="Nota numerata nel testo, scritta in fondo alla sua pagina (⌥⌘F)"
          icon={<NotebookPen className="size-5" />}
          onClick={() => {
            ctx.openPanel()
            editor.chain().focus().insertFootnote("", "footnote").run()
          }}
        />
        <RibbonRows>
          <RibbonButton
            label="Inserisci nota di chiusura"
            title="Nota raccolta in fondo al documento, numerata i, ii, iii (⌥⌘D)"
            icon={<ArrowDownToLine className="size-4" />}
            className="justify-start"
            onClick={() => {
              ctx.openPanel()
              editor.chain().focus().insertFootnote("", "endnote").run()
            }}
          />
          <RibbonButton
            label="Nota successiva"
            disabled={notes.length === 0}
            icon={<StickyNote className="size-4" />}
            className="justify-start"
            onClick={() => {
              const from = editor.state.selection.from
              const next = notes.find((p) => p > from) ?? notes[0]
              editor
                .chain()
                .focus()
                .setNodeSelection(next)
                .scrollIntoView()
                .run()
            }}
          />
          <RibbonButton
            data-safe=""
            label="Mostra note"
            disabled={notes.length === 0}
            icon={<ListOrdered className="size-4" />}
            className="justify-start"
            onClick={() =>
              document
                .querySelector(".doc-page-notes, .doc-notes")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
          />
        </RibbonRows>
      </RibbonGroup>
      <RibbonGroup label="Didascalie">
        <RibbonButton
          large
          label="Inserisci didascalia"
          title="Etichetta numerata sotto o sopra figure, tabelle ed equazioni"
          icon={<Captions className="size-5" />}
          onClick={() => setDialog("caption")}
        />
        <RibbonRows>
          <RibbonMenu
            className="w-56"
            trigger={
              <RibbonButton
                compact
                chevron
                label="Inserisci indice delle figure"
                icon={<Images className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>Etichetta</DropdownMenuLabel>
            {CAPTION_LABELS.map((label) => (
              <DropdownMenuItem
                key={label}
                onClick={() =>
                  atBody(editor, st).insertFigureIndex(label).run()
                }
              >
                {label === "Figura"
                  ? "Figure"
                  : label === "Tabella"
                    ? "Tabelle"
                    : "Equazioni"}
              </DropdownMenuItem>
            ))}
          </RibbonMenu>
          <RibbonButton
            compact
            data-safe=""
            label="Aggiorna tabella"
            disabled={!positionsOf(ctx, "figureIndex").length}
            icon={<RefreshCw className="size-4" />}
            className="justify-start"
            onClick={() => refresh("Indice delle figure")}
          />
          <RibbonButton
            compact
            label="Riferimento incrociato"
            icon={<TextQuote className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("crossref")}
          />
        </RibbonRows>
      </RibbonGroup>

      {indexKinds.map(([kind, label]) => {
        const count = positionsOf(ctx, "docIndex").length
        return (
          <RibbonGroup key={kind} label={label}>
            <RibbonButton
              large
              label={kind === "authority" ? "Segna citazione" : "Segna voce"}
              title="Seleziona il testo e segnalo per l'indice"
              icon={
                kind === "authority" ? (
                  <Gavel className="size-5" />
                ) : (
                  <BookMarked className="size-5" />
                )
              }
              onClick={() => setDialog(kind)}
            />
            <RibbonRows>
              <RibbonButton
                compact
                label={
                  kind === "authority"
                    ? "Inserisci indice delle autorità"
                    : "Inserisci indice"
                }
                icon={<FileSearch className="size-4" />}
                className="justify-start"
                onClick={() => atBody(editor, st).insertDocIndex(kind).run()}
              />
              <RibbonButton
                compact
                data-safe=""
                label="Aggiorna indice"
                disabled={!count}
                icon={<RefreshCw className="size-4" />}
                className="justify-start"
                onClick={() => refresh(label)}
              />
              <RibbonButton
                compact
                label="Togli le voci segnate"
                icon={<Trash2 className="size-4" />}
                className="justify-start"
                onClick={() => {
                  if (!editor.chain().focus().removeIndexEntries(kind).run()) {
                    toast.info("Nessuna voce segnata")
                  }
                }}
              />
            </RibbonRows>
          </RibbonGroup>
        )
      })}

      <CaptionDialog
        open={dialog === "caption"}
        onClose={close}
        editor={editor}
      />
      <CrossRefDialog
        open={dialog === "crossref"}
        onClose={close}
        editor={editor}
      />
      <MarkEntryDialog
        open={dialog === "index" || dialog === "authority"}
        onClose={close}
        editor={editor}
        kind={dialog === "authority" ? "authority" : "index"}
      />
    </>
  )
}
