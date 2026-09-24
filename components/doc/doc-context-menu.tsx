"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { insertPlainText, pasteFromClipboard } from "./plain-paste"
import {
  Bold,
  CaseLower,
  CaseUpper,
  ClipboardPaste,
  ClipboardType,
  MessageSquarePlus,
  Copy,
  Heading1,
  Heading2,
  Italic,
  Link2,
  List,
  ListChecks,
  Quote,
  Scissors,
  Shapes,
  Strikethrough,
  BookA,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Glyph } from "@/components/board/glyph"
import { useShallow } from "zustand/react/shallow"
import { useStore } from "@/lib/store"
import { displayTitle } from "@/lib/types"
import { thesaurusFor } from "@/lib/thesaurus/catalog"
import {
  cleanTerm,
  lookupSynonyms,
  matchCase,
  thesaurusDownloaded,
} from "@/lib/thesaurus/client"
import { wordAtSelection } from "@/lib/word-at"
import { toast } from "sonner"
import { applyLink } from "./ribbon/shared"

import { useT } from "@/lib/i18n/client"
export function DocContextMenu({
  editor,
  point,
  onClose,
  onInsertBoard,
  onComment,
  language,
  onThesaurus,
}: {
  editor: Editor | null
  point: { x: number; y: number } | null
  onClose: () => void
  onInsertBoard: (boardId: string) => void
  onComment: () => void
  language: string
  onThesaurus: (word: string) => void
}) {
  const t = useT()
  // confronto superficiale: il menu non si ridisegna a ogni salvataggio
  // le board nel cestino non si incorporano
  const boards = useStore(
    useShallow((s) => s.files.filter((f) => f.kind === "board" && !f.deletedAt))
  )
  if (!point || !editor) return null

  const run = (fn: () => void) => () => {
    fn()
    onClose()
  }
  const hasSelection = !editor.state.selection.empty

  return (
    <DropdownMenu open onOpenChange={(o) => !o && onClose()}>
      <DropdownMenuTrigger
        nativeButton={false}
        render={
          <span
            aria-hidden
            style={{
              position: "fixed",
              left: point.x,
              top: point.y,
              width: 1,
              height: 1,
            }}
          />
        }
      />
      <DropdownMenuContent
        align="start"
        side="bottom"
        sideOffset={2}
        className="w-56"
      >
        <DropdownMenuItem
          disabled={!hasSelection}
          onClick={run(() => document.execCommand("copy"))}
        >
          <Copy className="size-4" /> {t("Copia")}
          <DropdownMenuShortcut>⌘C</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasSelection}
          onClick={run(() => document.execCommand("cut"))}
        >
          <Scissors className="size-4" /> {t("Taglia")}
          <DropdownMenuShortcut>⌘X</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          // con la formattazione, come ⌘V: prima incollava solo il testo
          onClick={run(() => void pasteFromClipboard(editor))}
        >
          <ClipboardPaste className="size-4" /> {t("Incolla")}
          <DropdownMenuShortcut>⌘V</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={run(async () => {
            try {
              // solo il testo: niente grassetti o colori portati da fuori
              const text = await navigator.clipboard.readText()
              insertPlainText(editor, text)
            } catch {
              editor.chain().focus().run()
            }
          })}
        >
          <ClipboardType className="size-4" />{" "}
          {t("Incolla senza formattazione")}
          <DropdownMenuShortcut>⇧⌘V</DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem onClick={run(onComment)}>
          <MessageSquarePlus className="size-4" /> {t("Nuovo commento")}
          <DropdownMenuShortcut>⌥⌘M</DropdownMenuShortcut>
        </DropdownMenuItem>

        <SynonymsMenu
          editor={editor}
          language={language}
          onPick={run}
          onThesaurus={(word) => {
            onThesaurus(word)
            onClose()
          }}
        />

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={run(() => editor.chain().focus().toggleBold().run())}
        >
          <Bold className="size-4" /> {t("Grassetto")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={run(() => editor.chain().focus().toggleItalic().run())}
        >
          <Italic className="size-4" /> {t("Corsivo")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={run(() => editor.chain().focus().toggleStrike().run())}
        >
          <Strikethrough className="size-4" /> {t("Barrato")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasSelection}
          onClick={run(() => editor.chain().focus().changeCase("upper").run())}
        >
          <CaseUpper className="size-4" /> {t("TUTTO MAIUSCOLO")}
        </DropdownMenuItem>
        <DropdownMenuItem
          disabled={!hasSelection}
          onClick={run(() => editor.chain().focus().changeCase("lower").run())}
        >
          <CaseLower className="size-4" /> {t("tutto minuscolo")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={run(() => {
            const current = String(editor.getAttributes("link").href ?? "")
            const url = window.prompt(
              t("Indirizzo del link"),
              current || "https://"
            )
            // come dalla scheda Inserisci: «cogniva.app» diventa un sito, un
            // indirizzo che non porta da nessuna parte lo si dice. Prima
            // finiva nel collegamento così com'era, e senza selezione non si
            // vedeva niente
            if (url === null || url.trim() === "https://") return
            if (!applyLink(editor, url)) {
              toast.error(t("Indirizzo non valido"), {
                description: t(
                  "Un collegamento può portare a un sito, a un'e-mail o a un punto del documento."
                ),
              })
            }
          })}
        >
          <Link2 className="size-4" /> {t("Link")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Heading1 className="size-4" /> {t("Trasforma in")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            <DropdownMenuItem
              onClick={run(() => editor.chain().focus().setParagraph().run())}
            >
              {t("Paragrafo")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() =>
                editor.chain().focus().toggleHeading({ level: 1 }).run()
              )}
            >
              <Heading1 className="size-4" /> {t("Titolo 1")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() =>
                editor.chain().focus().toggleHeading({ level: 2 }).run()
              )}
            >
              <Heading2 className="size-4" /> {t("Titolo 2")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() =>
                editor.chain().focus().toggleBulletList().run()
              )}
            >
              <List className="size-4" /> {t("Elenco")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() => editor.chain().focus().toggleTaskList().run())}
            >
              <ListChecks className="size-4" /> {t("Da fare")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={run(() =>
                editor.chain().focus().toggleBlockquote().run()
              )}
            >
              <Quote className="size-4" /> {t("Citazione")}
            </DropdownMenuItem>
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <Shapes className="size-4" /> {t("Inserisci board")}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="max-h-64 overflow-y-auto">
            {boards.length ? (
              boards.map((b) => (
                <DropdownMenuItem
                  key={b.id}
                  onClick={run(() => onInsertBoard(b.id))}
                >
                  <Glyph name={b.icon} size={15} strokeWidth={1.9} />
                  <span className="truncate">{displayTitle(b)}</span>
                </DropdownMenuItem>
              ))
            ) : (
              <DropdownMenuItem disabled>{t("Nessuna board")}</DropdownMenuItem>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

/**
 * «Sinonimi» del menu contestuale di Word: i primi sinonimi della parola sotto
 * il cursore, se il dizionario è già sul dispositivo (un clic destro non deve
 * far partire un download), e il riquadro Thesaurus.
 */
function SynonymsMenu({
  editor,
  language,
  onPick,
  onThesaurus,
}: {
  editor: Editor
  language: string
  onPick: (fn: () => void) => () => void
  onThesaurus: (word: string) => void
}) {
  const t = useT()
  const [target] = React.useState(() => wordAtSelection(editor))
  const [terms, setTerms] = React.useState<string[] | null>(null)
  const available = Boolean(thesaurusFor(language))

  React.useEffect(() => {
    if (!target || !available) return
    let live = true
    void thesaurusDownloaded(language)
      .then((ready) => (ready ? lookupSynonyms(language, target.text) : null))
      .then((result) => {
        if (!live) return
        const seen = new Set<string>()
        const list: string[] = []
        for (const meaning of result?.meanings ?? []) {
          for (const term of meaning.terms) {
            const clean = cleanTerm(term)
            const key = clean.toLocaleLowerCase()
            if (!clean || seen.has(key)) continue
            seen.add(key)
            list.push(clean)
          }
        }
        setTerms(list.slice(0, 8))
      })
      .catch(() => live && setTerms([]))
    return () => {
      live = false
    }
  }, [target, available, language])

  if (!target || !available) return null
  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <BookA className="size-4" /> {t("Sinonimi")}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent className="w-52">
        {terms === null ? null : terms.length ? (
          terms.map((term) => (
            <DropdownMenuItem
              key={term}
              onClick={onPick(() => {
                const text = matchCase(target.text, term)
                // la formattazione della parola, non del testo prima
                const marks = editor.state.doc
                  .resolve(Math.min(target.from + 1, target.to))
                  .marks()
                editor
                  .chain()
                  .focus()
                  .command(({ tr }) => {
                    tr.replaceWith(
                      target.from,
                      target.to,
                      editor.schema.text(text, marks)
                    )
                    return true
                  })
                  .run()
              })}
            >
              {term}
            </DropdownMenuItem>
          ))
        ) : (
          <DropdownMenuItem disabled>
            {t("Nessun suggerimento")}
          </DropdownMenuItem>
        )}
        {terms?.length ? <DropdownMenuSeparator /> : null}
        <DropdownMenuItem onClick={() => onThesaurus(target.text)}>
          <BookA className="size-4" /> {t("Thesaurus…")}
          <DropdownMenuShortcut>⇧F7</DropdownMenuShortcut>
        </DropdownMenuItem>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}
