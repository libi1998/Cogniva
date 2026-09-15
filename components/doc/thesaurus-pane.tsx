"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  ArrowLeft,
  BookA,
  Copy,
  CornerDownLeft,
  LoaderCircle,
  Search,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Input } from "@/components/ui/input"
import { THESAURI, thesaurusFor } from "@/lib/thesaurus/catalog"
import {
  cleanTerm,
  lookupSynonyms,
  matchCase,
  termNote,
  thesaurusDownloaded,
  type LookupResult,
} from "@/lib/thesaurus/client"
import { cn } from "@/lib/utils"
import { wordAtSelection } from "@/lib/word-at"

/**
 * Il riquadro Thesaurus di Word (Maiusc+F7): sinonimi raggruppati per
 * significato. Un clic su una parola la cerca, «Inserisci» la mette nel testo
 * al posto della parola selezionata, con le stesse maiuscole.
 */

type State =
  | { status: "idle" }
  | { status: "loading"; download: number | null }
  | { status: "done"; result: LookupResult }
  | { status: "error"; message: string }

export function ThesaurusPane({
  editor,
  language,
  initialWord,
  onClose,
}: {
  editor: Editor
  language: string
  initialWord: string
  onClose: () => void
}) {
  const [lang, setLang] = React.useState(
    () => thesaurusFor(language)?.lang ?? "it"
  )
  const [query, setQuery] = React.useState(initialWord)
  const [history, setHistory] = React.useState<string[]>([])
  const [state, setState] = React.useState<State>(() =>
    initialWord.trim()
      ? { status: "loading", download: null }
      : { status: "idle" }
  )
  const [cached, setCached] = React.useState<boolean | null>(null)
  const request = React.useRef(0)
  const source = thesaurusFor(lang)

  /** Interroga il dizionario; lo stato cambia solo quando arriva la risposta */
  const run = React.useCallback((word: string, target: string) => {
    const id = ++request.current
    lookupSynonyms(target, word, (fraction) => {
      if (id === request.current)
        setState({ status: "loading", download: fraction })
    })
      .then((result) => {
        if (id !== request.current) return
        setState({ status: "done", result })
        setCached(true)
      })
      .catch((error: unknown) => {
        if (id !== request.current) return
        setState({
          status: "error",
          message:
            error instanceof Error ? error.message : "Ricerca non riuscita",
        })
      })
  }, [])

  const search = (word: string, target = lang) => {
    const clean = word.trim()
    if (!clean) return
    setQuery(clean)
    setState({ status: "loading", download: null })
    run(clean, target)
  }

  // la parola arriva dal documento all'apertura: il riquadro si rimonta
  // (con una chiave) quando se ne cerca un'altra dal testo
  const started = React.useRef(false)
  React.useEffect(() => {
    if (started.current) return
    started.current = true
    if (initialWord.trim()) run(initialWord.trim(), lang)
  }, [initialWord, lang, run])

  React.useEffect(() => {
    let live = true
    void thesaurusDownloaded(lang).then((value) => live && setCached(value))
    return () => {
      live = false
    }
  }, [lang])

  const lookUp = (word: string) => {
    const current = state.status === "done" ? state.result.word : query
    if (current && current !== word) setHistory((h) => [...h, current])
    search(word)
  }

  const back = () => {
    const previous = history[history.length - 1]
    if (!previous) return
    setHistory((h) => h.slice(0, -1))
    search(previous)
  }

  const insert = (term: string) => {
    const value = cleanTerm(term)
    const target = wordAtSelection(editor)
    const range =
      target &&
      (!editor.state.selection.empty ||
        target.text.toLocaleLowerCase() ===
          (state.status === "done"
            ? state.result.word.toLocaleLowerCase()
            : query.toLocaleLowerCase()))
        ? target
        : null
    const text = range ? matchCase(range.text, value) : value
    const { from, to } = range ?? editor.state.selection
    const marks = editor.state.doc.resolve(from).marks()
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.replaceWith(from, to, editor.schema.text(text, marks))
        return true
      })
      .setTextSelection({ from, to: from + text.length })
      .run()
  }

  const copy = (term: string) => {
    void navigator.clipboard
      ?.writeText(cleanTerm(term))
      .then(() => toast.success("Copiato"))
  }

  return (
    <div className="flex h-full w-full flex-col" aria-label="Thesaurus">
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border pr-1 pl-4">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <BookA className="size-3.5" /> Thesaurus
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi il thesaurus"
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <form
        className="flex shrink-0 items-center gap-1 border-b border-border p-2"
        onSubmit={(e) => {
          e.preventDefault()
          lookUp(query)
        }}
      >
        <button
          type="button"
          onClick={back}
          disabled={!history.length}
          aria-label="Parola precedente"
          title="Parola precedente"
          className="flex size-8 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-30"
        >
          <ArrowLeft className="size-4" />
        </button>
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            aria-label="Cerca sinonimi"
            className="h-8 pl-7 text-sm"
            value={query}
            placeholder="Cerca una parola"
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          aria-label="Lingua del thesaurus"
          value={lang}
          onChange={(e) => {
            setLang(e.target.value)
            if (query.trim()) search(query, e.target.value)
          }}
          className="h-8 w-[74px] shrink-0 rounded-md border border-input bg-transparent px-1 text-xs"
        >
          {THESAURI.map((t) => (
            <option key={t.lang} value={t.lang}>
              {t.label}
            </option>
          ))}
        </select>
      </form>

      <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {state.status === "idle" ? (
          <p className="px-2 py-6 text-center text-xs text-muted-foreground">
            Seleziona una parola nel documento o scrivila qui sopra.
            {source && cached === false ? (
              <span className="mt-2 block">
                La prima ricerca scarica il dizionario{" "}
                {source.label.toLowerCase()} (
                {Math.max(1, Math.round(source.bytes / 1_000_000))} MB), poi
                funziona offline.
              </span>
            ) : null}
          </p>
        ) : state.status === "loading" ? (
          <div
            className="px-2 py-6 text-center text-xs text-muted-foreground"
            aria-live="polite"
          >
            <LoaderCircle className="mx-auto mb-2 size-5 animate-spin" />
            {state.download !== null && state.download < 1 ? (
              <>
                Scarico il dizionario… {Math.round(state.download * 100)}%
                <span
                  role="progressbar"
                  aria-label="Download del dizionario"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={Math.round(state.download * 100)}
                  className="mx-auto mt-2 block h-1 w-40 overflow-hidden rounded-full bg-muted"
                >
                  <span
                    className="block h-full bg-primary"
                    style={{ width: `${Math.round(state.download * 100)}%` }}
                  />
                </span>
              </>
            ) : (
              "Cerco…"
            )}
          </div>
        ) : state.status === "error" ? (
          <p className="px-2 py-6 text-center text-xs text-destructive">
            {state.message}
          </p>
        ) : state.result.meanings.length ? (
          <div className="space-y-3" data-testid="thesaurus-results">
            {state.result.entries.some(
              (e) =>
                e.toLocaleLowerCase() !== state.result.word.toLocaleLowerCase()
            ) ? (
              <p className="px-2 text-[11px] text-muted-foreground">
                Risultati per{" "}
                {state.result.entries.map((e) => `«${e}»`).join(", ")}
              </p>
            ) : null}
            {state.result.meanings.map((meaning, i) => (
              <section key={i}>
                <h3 className="flex items-baseline gap-1.5 px-2 pb-0.5 text-xs font-semibold">
                  {cleanTerm(meaning.terms[0] ?? "")}
                  {meaning.pos || state.result.entries.length > 1 ? (
                    <span className="font-normal text-muted-foreground">
                      (
                      {[
                        state.result.entries.length > 1 ? meaning.entry : "",
                        meaning.pos,
                      ]
                        .filter(Boolean)
                        .join(", ")}
                      )
                    </span>
                  ) : null}
                </h3>
                <ul>
                  {meaning.terms.map((term) => (
                    <li
                      key={term}
                      className="group flex items-center rounded-md hover:bg-muted"
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate px-2 py-1 text-left text-sm"
                        title={`Cerca i sinonimi di «${cleanTerm(term)}»`}
                        onClick={() => lookUp(cleanTerm(term))}
                        onDoubleClick={() => insert(term)}
                      >
                        {cleanTerm(term)}
                        {termNote(term) ? (
                          <span className="ml-1 text-[11px] text-muted-foreground">
                            {termNote(term)}
                          </span>
                        ) : null}
                      </button>
                      <button
                        type="button"
                        title="Copia"
                        aria-label={`Copia «${cleanTerm(term)}»`}
                        onClick={() => copy(term)}
                        className="flex size-7 shrink-0 items-center justify-center rounded text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:text-foreground focus:opacity-100 pointer-coarse:opacity-100"
                      >
                        <Copy className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        title="Inserisci nel testo"
                        aria-label={`Inserisci «${cleanTerm(term)}»`}
                        onClick={() => insert(term)}
                        className="mr-0.5 flex h-7 shrink-0 items-center gap-1 rounded px-1.5 text-[11px] text-muted-foreground opacity-0 group-focus-within:opacity-100 group-hover:opacity-100 hover:bg-background hover:text-foreground focus:opacity-100 pointer-coarse:opacity-100"
                      >
                        <CornerDownLeft className="size-3.5" /> Inserisci
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        ) : (
          <div className="px-2 py-4 text-xs text-muted-foreground">
            <p>Nessun sinonimo per «{state.result.word}».</p>
            {state.result.nearby.length ? (
              <>
                <p className="mt-3 mb-1 font-medium text-foreground">
                  Parole vicine
                </p>
                <div className="flex flex-wrap gap-1">
                  {state.result.nearby.map((w) => (
                    <button
                      key={w}
                      type="button"
                      onClick={() => lookUp(w)}
                      className="rounded-full border border-border px-2 py-0.5 text-xs text-foreground hover:bg-muted"
                    >
                      {w}
                    </button>
                  ))}
                </div>
              </>
            ) : null}
          </div>
        )}
      </div>

      {source ? (
        <p
          className={cn(
            "shrink-0 border-t border-border px-3 py-2 text-[10px] leading-snug text-muted-foreground"
          )}
        >
          Dizionario {source.label.toLowerCase()} di LibreOffice ·{" "}
          {source.credit} ·{" "}
          <a
            href={source.home}
            target="_blank"
            rel="noopener noreferrer"
            className="underline"
          >
            {source.license}
          </a>
        </p>
      ) : null}
    </div>
  )
}
