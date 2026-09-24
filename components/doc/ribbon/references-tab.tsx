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
import { captionLabels } from "@/lib/doc-fields"
import type { IndexKind } from "@/lib/doc-references"
import { RibbonButton, RibbonGroup, RibbonMenu, RibbonRows } from "./ribbon-ui"
import { atBody, type RibbonCtx } from "./shared"

import { useT } from "@/lib/i18n/client"
function positionsOf(
  ctx: RibbonCtx,
  type: string,
  attrs?: Record<string, unknown>
) {
  const out: number[] = []
  ctx.editor.state.doc.descendants((n, pos) => {
    if (
      n.type.name === type &&
      (!attrs ||
        Object.entries(attrs).every(([key, value]) => n.attrs[key] === value))
    ) {
      out.push(pos)
    }
    return true
  })
  return out
}

type RefDialog = "caption" | "crossref" | "index" | "authority" | null

export function ReferencesTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
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
  const refresh = (message: string) => {
    // gli indici si ricalcolano a ogni modifica: qui si ridisegnano e basta
    editor.view.dispatch(editor.state.tr.setMeta("addToHistory", false))
    toast.success(message)
  }
  const indexKinds: [IndexKind, string][] = [
    ["index", t("Indice analitico")],
    ["authority", t("Indice delle autorità")],
  ]

  return (
    <>
      <RibbonGroup label={t("Sommario")} icon={<ListTree className="size-5" />}>
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Sommario")}
              title={t(
                "Sommario dai titoli: si aggiorna da solo mentre scrivi"
              )}
              icon={<ListTree className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Predefiniti")}</DropdownMenuLabel>
          {(
            [
              ["classic", t("Automatico 1"), t("Puntini e numeri di pagina")],
              [
                "card",
                t("Automatico 2"),
                t("Riquadro colorato, con i numeri di pagina"),
              ],
              ["simple", t("Semplice"), t("Solo i titoli")],
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
          <DropdownMenuLabel>{t("Livelli mostrati")}</DropdownMenuLabel>
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
                ? t("Solo Titolo 1")
                : t("Titoli fino al livello {levels}", { levels })}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!tocs.length}
            onClick={() => removeNodes("toc")}
          >
            <Trash2 /> {t("Rimuovi sommario")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonRows>
          <RibbonMenu
            className="w-52"
            trigger={
              <RibbonButton
                compact
                chevron
                label={t("Aggiungi testo")}
                title={t("Il paragrafo compare nel sommario al livello scelto")}
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
              {t("Non mostrare nel sommario")}
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
                {t("Livello {level}", { level })}
              </DropdownMenuItem>
            ))}
          </RibbonMenu>
          <RibbonButton
            compact
            data-safe=""
            label={t("Aggiorna sommario")}
            disabled={!tocs.length}
            icon={<RefreshCw className="size-4" />}
            className="justify-start"
            onClick={() => refresh(t("Sommario aggiornato"))}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup
        label={t("Citazioni e bibliografia")}
        icon={<Quote className="size-5" />}
      >
        <RibbonMenu
          className="w-72"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Inserisci citazione")}
              icon={<Quote className="size-5" />}
            />
          }
        >
          {ctx.sources.length ? (
            <>
              <DropdownMenuLabel>{t("Fonti del documento")}</DropdownMenuLabel>
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
            <BookPlus className="size-4" /> {t("Aggiungi nuova fonte…")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            data-safe=""
            label={t("Gestisci fonti")}
            icon={<Library className="size-4" />}
            className="justify-start"
            onClick={() => ctx.openSources()}
          />
          <RibbonMenu
            className="w-56"
            trigger={
              <RibbonButton
                compact
                data-safe=""
                chevron
                label={t("Stile: {style}", {
                  style:
                    CITATION_STYLES.find(
                      (x) => x.value === theme.citationStyle
                    )?.label.split(" ")[0] ?? "APA",
                })}
                icon={<Palette className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>{t("Stile delle citazioni")}</DropdownMenuLabel>
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
            compact
            label={t("Bibliografia")}
            title={t(
              "Elenco delle fonti citate, ordinato e formattato nello stile scelto"
            )}
            icon={<BookOpenText className="size-4" />}
            className="justify-start"
            onClick={() => {
              ctx.openPanel()
              atBody(editor, st).insertBibliography().run()
            }}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label={t("Note")} icon={<NotebookPen className="size-5" />}>
        <RibbonButton
          large
          label={t("Inserisci nota a piè di pagina")}
          title={t(
            "Nota numerata nel testo, scritta in fondo alla sua pagina (⌥⌘F)"
          )}
          icon={<NotebookPen className="size-5" />}
          onClick={() => {
            ctx.openPanel()
            editor.chain().focus().insertFootnote("", "footnote").run()
          }}
        />
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Inserisci nota di chiusura")}
            title={t(
              "Nota raccolta in fondo al documento, numerata i, ii, iii (⌥⌘D)"
            )}
            icon={<ArrowDownToLine className="size-4" />}
            className="justify-start"
            onClick={() => {
              ctx.openPanel()
              editor.chain().focus().insertFootnote("", "endnote").run()
            }}
          />
          <RibbonButton
            compact
            label={t("Nota successiva")}
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
            compact
            data-safe=""
            label={t("Mostra note")}
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
      <RibbonGroup
        label={t("Didascalie")}
        icon={<Captions className="size-5" />}
      >
        <RibbonButton
          large
          label={t("Inserisci didascalia")}
          title={t(
            "Etichetta numerata sotto o sopra figure, tabelle ed equazioni"
          )}
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
                label={t("Inserisci indice delle figure")}
                icon={<Images className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>{t("Etichetta")}</DropdownMenuLabel>
            {captionLabels().map((label) => (
              <DropdownMenuItem
                key={label}
                onClick={() =>
                  atBody(editor, st).insertFigureIndex(label).run()
                }
              >
                {label === t("Figura")
                  ? t("Figure")
                  : label === t("Tabella")
                    ? t("Tabelle")
                    : t("Equazioni")}
              </DropdownMenuItem>
            ))}
          </RibbonMenu>
          <RibbonButton
            compact
            data-safe=""
            label={t("Aggiorna tabella")}
            disabled={!positionsOf(ctx, "figureIndex").length}
            icon={<RefreshCw className="size-4" />}
            className="justify-start"
            onClick={() => refresh(t("Indice delle figure aggiornato"))}
          />
          <RibbonButton
            compact
            label={t("Riferimento incrociato")}
            icon={<TextQuote className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("crossref")}
          />
        </RibbonRows>
      </RibbonGroup>

      {indexKinds.map(([kind, label]) => {
        // ogni indice si aggiorna per conto suo: «Aggiorna indice» resta
        // spento finché quel tipo di indice non è nel documento
        const count = positionsOf(ctx, "docIndex", { kind }).length
        return (
          <RibbonGroup
            key={kind}
            label={label}
            icon={
              kind === "authority" ? (
                <Gavel className="size-5" />
              ) : (
                <BookMarked className="size-5" />
              )
            }
          >
            <RibbonButton
              large
              label={
                kind === "authority" ? t("Segna citazione") : t("Segna voce")
              }
              title={t("Seleziona il testo e segnalo per l'indice")}
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
                    ? t("Inserisci indice delle autorità")
                    : t("Inserisci indice")
                }
                icon={<FileSearch className="size-4" />}
                className="justify-start"
                onClick={() => atBody(editor, st).insertDocIndex(kind).run()}
              />
              <RibbonButton
                compact
                data-safe=""
                label={t("Aggiorna indice")}
                disabled={!count}
                icon={<RefreshCw className="size-4" />}
                className="justify-start"
                onClick={() =>
                  refresh(
                    kind === "authority"
                      ? t("Indice delle autorità aggiornato")
                      : t("Indice analitico aggiornato")
                  )
                }
              />
              <RibbonButton
                compact
                label={t("Togli le voci segnate")}
                icon={<Trash2 className="size-4" />}
                className="justify-start"
                onClick={() => {
                  if (!editor.chain().focus().removeIndexEntries(kind).run()) {
                    toast.info(t("Nessuna voce segnata"))
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
