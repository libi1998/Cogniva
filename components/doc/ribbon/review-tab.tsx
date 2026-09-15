"use client"

import * as React from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { nanoid } from "nanoid"
import {
  Accessibility,
  BookA,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  CircleCheck,
  FileDiff,
  Globe,
  Languages,
  ListTodo,
  Lock,
  MessageSquareOff,
  MessageSquarePlus,
  MessagesSquare,
  PenOff,
  SpellCheck,
  Trash2,
  UserPen,
  WholeWord,
  X,
  FilePenLine,
  Eye,
} from "lucide-react"
import type { JSONContent } from "@tiptap/core"
import { Fragment, Slice } from "@tiptap/pm/model"
import { toast } from "sonner"
import { useShallow } from "zustand/react/shallow"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { newDocTheme } from "@/lib/doc-design"
import { fileHref } from "@/lib/import-files"
import {
  checkAccessibility,
  compareDocuments,
  browserTranslation,
  createTranslator,
  PROOFING_LANGUAGES,
  TRANSLATE_LANGUAGES,
  translateContent,
  type A11yIssue,
  type BrowserAvailability,
  type DocTranslator,
  type TranslateEngine,
  type TranslateProgress,
} from "@/lib/review-tools"
import { getWorkspace, useStore } from "@/lib/store"
import { listChanges, type ChangeInfo } from "@/lib/track-changes"
import type { DocMarkup, DocProtection, WFile } from "@/lib/types"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { setAuthor, useAuthor } from "@/lib/author"
import { wordAtSelection } from "@/lib/word-at"
import { ReadAloudGroup } from "../read-aloud"
import { RibbonButton, RibbonGroup, RibbonMenu, RibbonRows } from "./ribbon-ui"
import type { RibbonCtx } from "./shared"

/** «Conteggio parole» di Word: tutto quello che si conta in un documento */
function WordCount({ ctx }: { ctx: RibbonCtx }) {
  const [stats, setStats] = React.useState<[string, number][]>([])
  const measure = () => {
    const { doc } = ctx.editor.state
    const lines: string[] = []
    const count = { paragraphs: 0 }
    doc.descendants((node) => {
      if (node.isTextblock) {
        const t = node.textContent
        if (t.trim()) count.paragraphs += 1
        lines.push(t)
      }
      return true
    })
    const text = lines.map((t) => `${t}\n`).join("")
    const paragraphs = count.paragraphs
    const words = text.match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) ?? []
    setStats([
      ["Pagine", ctx.pages],
      ["Parole", words.length],
      ["Caratteri (spazi esclusi)", text.replace(/\s/g, "").length],
      ["Caratteri (spazi inclusi)", text.replace(/\n/g, "").length],
      ["Paragrafi", paragraphs],
    ])
  }

  return (
    <Popover onOpenChange={(open) => open && measure()}>
      <PopoverTrigger
        render={
          <RibbonButton
            large
            label="Conteggio parole"
            icon={<WholeWord className="size-5" />}
          />
        }
      />
      <PopoverContent
        align="start"
        className="w-64 p-3"
        initialFocus={false}
        finalFocus={false}
      >
        <p className="mb-2 text-xs font-semibold">Conteggio parole</p>
        <dl className="grid grid-cols-[1fr_auto] gap-x-3 gap-y-1 text-xs">
          {stats.map(([label, value]) => (
            <React.Fragment key={label}>
              <dt className="text-muted-foreground">{label}</dt>
              <dd className="text-right tabular-nums">
                {value.toLocaleString("it-IT")}
              </dd>
            </React.Fragment>
          ))}
        </dl>
      </PopoverContent>
    </Popover>
  )
}

function AuthorName() {
  const author = useAuthor()
  const [draft, setDraft] = React.useState<string | null>(null)
  return (
    <Popover
      onOpenChange={(open) => {
        if (!open && draft !== null) setAuthor(draft)
        setDraft(null)
      }}
    >
      <PopoverTrigger
        render={
          <RibbonButton
            label={author}
            title="Il nome con cui firmi commenti e risposte"
            icon={<UserPen className="size-4" />}
            className="max-w-[140px] justify-start"
          />
        }
      />
      <PopoverContent align="start" className="w-60 p-3">
        <label className="text-xs font-medium" htmlFor="doc-author">
          Nome autore
        </label>
        <Input
          id="doc-author"
          className="mt-1.5 h-8 text-xs"
          value={draft ?? author}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") setAuthor(draft ?? author)
          }}
        />
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          Resta in questo browser, per tutti i documenti.
        </p>
      </PopoverContent>
    </Popover>
  )
}

/* ------------------------------ leggi ad alta voce ----------------------- */

/* ----------------------------- accessibilità ----------------------------- */

function AccessibilityDialog({
  open,
  onClose,
  ctx,
}: {
  open: boolean
  onClose: () => void
  ctx: RibbonCtx
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[520px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Verifica accessibilità</DialogTitle>
          <DialogDescription>
            Quello che rende il documento difficile da leggere per chi usa un
            lettore di schermo o vede poco.
          </DialogDescription>
        </DialogHeader>
        {open ? <AccessibilityList ctx={ctx} onClose={onClose} /> : null}
      </DialogContent>
    </Dialog>
  )
}

function AccessibilityList({
  ctx,
  onClose,
}: {
  ctx: RibbonCtx
  onClose: () => void
}) {
  const { editor, theme } = ctx
  const paper =
    theme.paper && theme.paper.startsWith("#") ? theme.paper : "#ffffff"
  const [issues, setIssues] = React.useState<A11yIssue[]>(() =>
    checkAccessibility(editor.state.doc, paper)
  )
  const [alts, setAlts] = React.useState<Record<string, string>>({})
  const refresh = () => setIssues(checkAccessibility(editor.state.doc, paper))
  const labels = { error: "Errore", warning: "Avviso", tip: "Suggerimento" }

  return (
    <div>
      <div className="max-h-[60dvh] space-y-2 overflow-y-auto px-5 py-4">
        {issues.length ? (
          issues.map((issue) => (
            <div
              key={issue.id}
              className="rounded-lg border border-border p-3 text-sm"
            >
              <div className="flex items-start gap-2">
                <span
                  className={cn(
                    "mt-0.5 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase",
                    issue.level === "error"
                      ? "bg-destructive/15 text-destructive"
                      : issue.level === "warning"
                        ? "bg-amber-500/15 text-amber-600"
                        : "bg-muted text-muted-foreground"
                  )}
                >
                  {labels[issue.level]}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{issue.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {issue.detail}
                  </p>
                </div>
                {issue.pos !== null ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs"
                    onClick={() => {
                      const node = editor.state.doc.nodeAt(issue.pos!)
                      const chain = editor.chain().focus()
                      if (node && (node.isAtom || node.type.name === "table")) {
                        chain.setNodeSelection(issue.pos!)
                      } else {
                        chain.setTextSelection(
                          issue.pos! + (node?.isText ? 0 : 1)
                        )
                      }
                      chain.scrollIntoView().run()
                      onClose()
                    }}
                  >
                    Vai
                  </Button>
                ) : null}
              </div>
              {issue.fix === "alt" && issue.pos !== null ? (
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault()
                    const alt = (alts[issue.id] ?? "").trim()
                    if (!alt) return
                    editor
                      .chain()
                      .setNodeSelection(issue.pos!)
                      .updateAttributes("image", { alt })
                      .run()
                    refresh()
                  }}
                >
                  <input
                    value={alts[issue.id] ?? ""}
                    onChange={(e) =>
                      setAlts({ ...alts, [issue.id]: e.target.value })
                    }
                    placeholder="Es. Grafico delle vendite in crescita"
                    className="h-8 flex-1 rounded-md border border-input bg-transparent px-2 text-sm"
                  />
                  <Button type="submit" size="sm" className="h-8">
                    Salva
                  </Button>
                </form>
              ) : null}
            </div>
          ))
        ) : (
          <p className="flex items-center gap-2 py-6 text-sm">
            <Check className="size-4 text-emerald-500" /> Nessun problema di
            accessibilità trovato.
          </p>
        )}
      </div>
      <DialogFooter className="border-t border-border px-5 py-3">
        <Button type="button" variant="outline" onClick={refresh}>
          Ricontrolla
        </Button>
        <Button type="button" onClick={onClose}>
          Chiudi
        </Button>
      </DialogFooter>
    </div>
  )
}

/* -------------------------------- traduci -------------------------------- */

function TranslateDialog({
  open,
  onClose,
  ctx,
  scope,
}: {
  open: boolean
  onClose: () => void
  ctx: RibbonCtx
  scope: "selection" | "document"
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>
            {scope === "selection" ? "Traduci selezione" : "Traduci documento"}
          </DialogTitle>
          <DialogDescription>
            La traduzione avviene sul tuo dispositivo: il testo non viene
            inviato a nessun servizio.
          </DialogDescription>
        </DialogHeader>
        {open ? (
          <TranslateForm ctx={ctx} scope={scope} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

/** Il traduttore sul dispositivo si scarica solo quando si apre la finestra */
const loadLocalTranslator = () => import("@/lib/translate/local")

const ENGINES: { value: TranslateEngine; label: string }[] = [
  { value: "auto", label: "Automatico" },
  { value: "browser", label: "Browser" },
  { value: "device", label: "Modello Cogniva" },
]

function readEngine(): TranslateEngine {
  try {
    const saved = localStorage.getItem("cogniva:translate-engine")
    return saved === "browser" || saved === "device" ? saved : "auto"
  } catch {
    return "auto"
  }
}

function saveEngine(engine: TranslateEngine) {
  try {
    localStorage.setItem("cogniva:translate-engine", engine)
  } catch {
    // la scelta vale solo per questa volta
  }
}

/** Mette il testo tradotto al posto della selezione, con la stessa struttura */
function replaceWithTranslation(
  editor: RibbonCtx["editor"],
  range: { from: number; to: number; openStart: number; openEnd: number },
  translated: JSONContent
) {
  try {
    const fragment = Fragment.fromJSON(editor.schema, translated.content ?? [])
    const tr = editor.state.tr.replace(
      range.from,
      range.to,
      new Slice(fragment, range.openStart, range.openEnd)
    )
    editor.view.dispatch(tr.scrollIntoView())
    editor.commands.focus()
    return true
  } catch {
    return false
  }
}

function previewText(editor: RibbonCtx["editor"], content: JSONContent) {
  try {
    const node = editor.schema.nodeFromJSON(content)
    return node.textBetween(0, node.content.size, "\n")
  } catch {
    return ""
  }
}

function TranslateForm({
  ctx,
  scope,
  onClose,
}: {
  ctx: RibbonCtx
  scope: "selection" | "document"
  onClose: () => void
}) {
  const { editor, theme } = ctx
  const router = useRouter()
  const [source, setSource] = React.useState(
    (theme.language || "it-IT").slice(0, 2)
  )
  const [target, setTarget] = React.useState(source === "en" ? "it" : "en")
  const [engine, setEngine] = React.useState<TranslateEngine>(readEngine)
  const [busy, setBusy] = React.useState(false)
  const [progress, setProgress] = React.useState<TranslateProgress | null>(null)
  const [result, setResult] = React.useState<JSONContent | null>(null)
  const [browserState, setBrowserState] =
    React.useState<BrowserAvailability | null>(null)
  const [download, setDownload] = React.useState<number | null>(null)
  const running = React.useRef<DocTranslator | null>(null)
  const [selection] = React.useState(() => {
    const { from, to } = editor.state.selection
    const slice = editor.state.doc.slice(from, to)
    return {
      from,
      to,
      openStart: slice.openStart,
      openEnd: slice.openEnd,
      content: { type: "doc", content: slice.content.toJSON() ?? [] },
      text: editor.state.doc.textBetween(from, to, "\n"),
    }
  })
  const select =
    "h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm"

  React.useEffect(() => {
    let live = true
    void browserTranslation(source, target).then((state) => {
      if (live) setBrowserState(state)
    })
    void loadLocalTranslator().then(async (local) => {
      const mb = local.canTranslateLocally(source, target)
        ? await local.downloadNeeded(source, target)
        : -1
      if (live) setDownload(mb)
    })
    return () => {
      live = false
    }
  }, [source, target])

  // chiudere la finestra ferma anche il lavoro in corso
  React.useEffect(() => () => running.current?.destroy(), [])

  const browserReady =
    browserState === "available" || browserState === "downloadable"
  const deviceReady = download !== null && download >= 0
  const uses: "browser" | "device" | null =
    engine === "browser"
      ? browserReady
        ? "browser"
        : null
      : engine === "device"
        ? deviceReady
          ? "device"
          : null
        : browserReady
          ? "browser"
          : deviceReady
            ? "device"
            : null
  const checking = browserState === null || download === null

  const run = () => {
    setBusy(true)
    setResult(null)
    setProgress(null)
    saveEngine(engine)
    createTranslator(source, target, { engine, onProgress: setProgress })
      .then(async (translator) => {
        running.current = translator
        const translated = await translateContent(
          scope === "selection" ? selection.content : editor.getJSON(),
          translator.translate,
          setProgress
        )
        running.current = null
        // i modelli sul dispositivo restano caricati per la prossima volta
        if (translator.engine === "browser") translator.destroy()
        if (scope === "selection") {
          setResult(translated)
          return
        }
        const now = Date.now()
        const file: WFile = {
          id: nanoid(10),
          kind: "doc",
          title: `${ctx.title || "Documento"} (${TRANSLATE_LANGUAGES.find((l) => l.code === target)?.label ?? target})`,
          icon: "file-text",
          createdAt: now,
          updatedAt: now,
          data: {
            content: translated,
            theme: { ...newDocTheme(), ...theme, language: target },
          },
        }
        const id = getWorkspace().addFile(file)
        toast.success("Traduzione pronta in un nuovo documento")
        onClose()
        router.push(fileHref({ kind: "doc", id }) as Route)
      })
      .catch((error: unknown) => {
        if (error instanceof DOMException && error.name === "AbortError") return
        toast.error(
          error instanceof Error ? error.message : "Traduzione non riuscita"
        )
      })
      .finally(() => {
        running.current = null
        setBusy(false)
        setProgress(null)
      })
  }

  const cancel = () => {
    running.current?.destroy()
    running.current = null
    setBusy(false)
    setProgress(null)
  }

  const fraction = !progress
    ? null
    : progress.phase === "download"
      ? progress.fraction
      : progress.total
        ? progress.done / progress.total
        : 0

  return (
    <div>
      <div className="space-y-3 px-5 py-4 text-sm">
        <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)] gap-3">
          <label className="block min-w-0 space-y-1">
            <span className="text-xs text-muted-foreground">Da</span>
            <select
              value={source}
              disabled={busy}
              onChange={(e) => {
                setSource(e.target.value)
                setResult(null)
                if (e.target.value === target)
                  setTarget(e.target.value === "en" ? "it" : "en")
              }}
              className={select}
            >
              {TRANSLATE_LANGUAGES.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block min-w-0 space-y-1">
            <span className="text-xs text-muted-foreground">A</span>
            <select
              value={target}
              disabled={busy}
              onChange={(e) => {
                setTarget(e.target.value)
                setResult(null)
              }}
              className={select}
            >
              {TRANSLATE_LANGUAGES.filter((l) => l.code !== source).map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">Traduttore</span>
          <div
            role="radiogroup"
            aria-label="Traduttore"
            className="grid grid-cols-3 gap-1 rounded-md bg-muted p-0.5"
          >
            {ENGINES.map((e) => (
              <button
                key={e.value}
                type="button"
                role="radio"
                aria-checked={engine === e.value}
                disabled={busy}
                onClick={() => setEngine(e.value)}
                className={cn(
                  "h-7 truncate rounded px-2 text-xs transition",
                  engine === e.value
                    ? "bg-background font-medium shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {e.label}
              </button>
            ))}
          </div>
          <p
            className={cn(
              "text-xs",
              !checking && !uses
                ? "text-amber-700 dark:text-amber-400"
                : "text-muted-foreground"
            )}
          >
            {checking
              ? "Controllo i traduttori disponibili…"
              : uses === "browser"
                ? browserState === "available"
                  ? "Traduttore integrato del browser, pronto."
                  : "Traduttore integrato del browser: la prima volta scarica la coppia di lingue."
                : uses === "device"
                  ? download
                    ? `Modello OPUS-MT sul dispositivo: la prima volta scarica circa ${download} MB, poi funziona anche offline.`
                    : "Modello OPUS-MT sul dispositivo, già scaricato: funziona anche offline."
                  : engine === "browser"
                    ? browserState === "missing"
                      ? "Questo browser non ha un traduttore integrato: scegli «Modello Cogniva»."
                      : "Il traduttore del browser non ha questa coppia di lingue."
                    : "Per questa coppia di lingue non c'è un modello sul dispositivo."}
          </p>
        </div>

        {scope === "selection" ? (
          <>
            <p className="max-h-24 overflow-y-auto rounded-md border border-border bg-muted/40 p-2 text-xs whitespace-pre-wrap">
              {selection.text || "Seleziona prima del testo nel documento."}
            </p>
            {result !== null ? (
              <p
                data-testid="translation-result"
                className="max-h-40 overflow-y-auto rounded-md border border-primary/40 bg-accent/40 p-2 whitespace-pre-wrap"
              >
                {previewText(editor, result)}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-xs text-muted-foreground">
            Si crea un nuovo documento tradotto con la stessa formattazione:
            l&apos;originale non cambia.
          </p>
        )}

        {busy ? (
          <div className="space-y-1" aria-live="polite">
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>
                {!progress
                  ? "Preparo il traduttore…"
                  : progress.phase === "download"
                    ? "Scarico il modello di traduzione…"
                    : `Traduco ${progress.done} di ${progress.total}…`}
              </span>
              {fraction !== null ? (
                <span className="tabular-nums">
                  {Math.round(fraction * 100)}%
                </span>
              ) : null}
            </div>
            <div
              role="progressbar"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={
                fraction === null ? undefined : Math.round(fraction * 100)
              }
              className="h-1.5 overflow-hidden rounded-full bg-muted"
            >
              <div
                className={cn(
                  "h-full rounded-full bg-primary transition-[width]",
                  fraction === null && "w-1/3 animate-pulse"
                )}
                style={
                  fraction === null
                    ? undefined
                    : { width: `${fraction * 100}%` }
                }
              />
            </div>
          </div>
        ) : null}
      </div>
      <DialogFooter className="border-t border-border px-5 py-3">
        {busy ? (
          <Button type="button" variant="ghost" onClick={cancel}>
            Annulla
          </Button>
        ) : (
          <Button type="button" variant="ghost" onClick={onClose}>
            Chiudi
          </Button>
        )}
        {result !== null ? (
          <>
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                void navigator.clipboard
                  ?.writeText(previewText(editor, result))
                  .then(() => toast.success("Traduzione copiata"))
              }}
            >
              Copia
            </Button>
            <Button
              type="button"
              onClick={() => {
                if (!replaceWithTranslation(editor, selection, result)) {
                  toast.error("Il documento è cambiato: ripeti la traduzione")
                  return
                }
                onClose()
              }}
            >
              Sostituisci
            </Button>
          </>
        ) : (
          <Button
            type="button"
            disabled={
              busy ||
              checking ||
              !uses ||
              (scope === "selection" && !selection.text.trim())
            }
            onClick={run}
          >
            {busy ? "Traduzione…" : "Traduci"}
          </Button>
        )}
      </DialogFooter>
    </div>
  )
}

/* ------------------------------- confronta ------------------------------- */

function CompareDialog({
  open,
  onClose,
  ctx,
  fileId,
}: {
  open: boolean
  onClose: () => void
  ctx: RibbonCtx
  fileId: string | null
}) {
  const router = useRouter()
  const author = useAuthor()
  const docs = useStore(
    useShallow((s) =>
      s.files.filter((f) => f.kind === "doc" && !f.deletedAt && f.id !== fileId)
    )
  )
  const [revised, setRevised] = React.useState<string>("")
  const [direction, setDirection] = React.useState<
    "this-original" | "this-revised"
  >("this-original")

  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="gap-0 p-0 sm:max-w-[460px]">
        <DialogHeader className="border-b border-border px-5 py-4">
          <DialogTitle>Confronta documenti</DialogTitle>
          <DialogDescription>
            Le differenze diventano revisioni in un documento nuovo: le accetti
            o le rifiuti una per una.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3 px-5 py-4 text-sm">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">Confronta con</span>
            <select
              value={revised}
              onChange={(e) => setRevised(e.target.value)}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-sm"
            >
              <option value="">Scegli un documento…</option>
              {docs.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.title}
                </option>
              ))}
            </select>
          </label>
          {(["this-original", "this-revised"] as const).map((value) => (
            <label key={value} className="flex items-center gap-2">
              <input
                type="radio"
                checked={direction === value}
                onChange={() => setDirection(value)}
              />
              {value === "this-original"
                ? "Questo è l'originale, l'altro la revisione"
                : "L'altro è l'originale, questo la revisione"}
            </label>
          ))}
        </div>
        <DialogFooter className="border-t border-border px-5 py-3">
          <Button type="button" variant="ghost" onClick={onClose}>
            Annulla
          </Button>
          <Button
            type="button"
            disabled={!revised}
            onClick={() => {
              const other = getWorkspace().files.find((f) => f.id === revised)
              if (!other || other.kind !== "doc") return
              const mine = ctx.editor.getJSON()
              const [a, b] =
                direction === "this-original"
                  ? [mine, other.data.content as never]
                  : [other.data.content as never, mine]
              const now = Date.now()
              const file: WFile = {
                id: nanoid(10),
                kind: "doc",
                title: `Confronto — ${ctx.title} / ${other.title}`,
                icon: "file-text",
                createdAt: now,
                updatedAt: now,
                data: {
                  content: compareDocuments(a, b, other.title || author),
                  theme: { ...newDocTheme(), ...ctx.theme, markup: "all" },
                },
              }
              const id = getWorkspace().addFile(file)
              onClose()
              router.push(fileHref({ kind: "doc", id }) as Route)
            }}
          >
            Confronta
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

/* ---------------------------- riquadro revisioni -------------------------- */

function ChangesPane({ ctx }: { ctx: RibbonCtx }) {
  const { editor } = ctx
  const [changes, setChanges] = React.useState<ChangeInfo[]>([])
  const refresh = () => setChanges(listChanges(editor.state.doc))
  const select = (c: ChangeInfo) =>
    editor
      .chain()
      .focus()
      .setTextSelection({ from: c.from, to: c.to })
      .scrollIntoView()
      .run()
  return (
    <Popover onOpenChange={(open) => open && refresh()}>
      <PopoverTrigger
        render={
          <RibbonButton
            compact
            label="Riquadro revisioni"
            icon={<ListTodo className="size-4" />}
            className="justify-start"
          />
        }
      />
      <PopoverContent align="start" className="w-80 p-0" finalFocus={false}>
        <p className="border-b border-border px-3 py-2 text-xs font-medium">
          Revisioni: {changes.filter((c) => c.kind === "insertion").length}{" "}
          inserimenti, {changes.filter((c) => c.kind === "deletion").length}{" "}
          eliminazioni
        </p>
        <div className="max-h-80 overflow-y-auto p-1">
          {changes.length ? (
            changes.map((c, i) => (
              <div
                key={`${c.from}-${i}`}
                className="group rounded-md px-2 py-1.5 hover:bg-muted"
              >
                <button
                  type="button"
                  onClick={() => select(c)}
                  className="block w-full text-left"
                >
                  <span className="block text-[11px] text-muted-foreground">
                    {c.author || "Autore"} ·{" "}
                    {c.kind === "insertion" ? "Inserito" : "Eliminato"}
                    {c.date
                      ? ` · ${new Date(c.date).toLocaleString("it-IT", { dateStyle: "short", timeStyle: "short" })}`
                      : ""}
                  </span>
                  <span
                    className={cn(
                      "line-clamp-2 text-sm",
                      c.kind === "deletion" ? "line-through" : "underline"
                    )}
                  >
                    {c.text}
                  </span>
                </button>
                <div className="mt-1 flex gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => {
                      select(c)
                      editor.chain().acceptChange().run()
                      refresh()
                    }}
                  >
                    <Check className="size-3" /> Accetta
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-6 px-2 text-[11px]"
                    onClick={() => {
                      select(c)
                      editor.chain().rejectChange().run()
                      refresh()
                    }}
                  >
                    <X className="size-3" /> Rifiuta
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <p className="px-2 py-3 text-xs text-muted-foreground">
              Nessuna revisione.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}

const MARKUPS: { value: DocMarkup; label: string; hint: string }[] = [
  {
    value: "simple",
    label: "Revisioni semplici",
    hint: "Testo finale, una riga rossa accanto",
  },
  {
    value: "all",
    label: "Tutti i commenti con markup",
    hint: "Inserimenti e eliminazioni colorati",
  },
  {
    value: "none",
    label: "Nessun markup",
    hint: "Il documento come sarà accettando tutto",
  },
  {
    value: "original",
    label: "Originale",
    hint: "Il documento prima delle revisioni",
  },
]

const PROTECTIONS: { value: DocProtection; label: string; hint: string }[] = [
  {
    value: "none",
    label: "Nessuna restrizione",
    hint: "Tutti possono modificare",
  },
  {
    value: "tracked",
    label: "Solo revisioni",
    hint: "Ogni modifica viene rilevata",
  },
  {
    value: "comments",
    label: "Solo commenti",
    hint: "Il testo non si modifica, si commenta",
  },
  { value: "readonly", label: "Sola lettura", hint: "Nessuna modifica" },
]

export function ReviewTab({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st, theme, setTheme, comments } = ctx
  const current = comments.list.find((c) => c.id === comments.active)
  const resolved = comments.list.filter((c) => c.resolved).length
  const [dialog, setDialog] = React.useState<
    "a11y" | "translate-selection" | "translate-document" | "compare" | null
  >(null)
  const close = () => setDialog(null)
  const fileId = ctx.fileId
  const tracking = theme.trackChanges || theme.protection === "tracked"
  const accept = (mode: "next" | "this" | "all" | "all-stop") => {
    const chain = editor.chain().focus()
    if (mode === "all" || mode === "all-stop") chain.acceptAllChanges()
    else chain.acceptChange()
    const done = chain.run()
    if (!done) toast.info("Nessuna revisione qui")
    if (mode === "next") editor.chain().focus().goToChange(1).run()
    if (mode === "all-stop") setTheme({ trackChanges: false })
  }
  const reject = (mode: "next" | "this" | "all" | "all-stop") => {
    const chain = editor.chain().focus()
    if (mode === "all" || mode === "all-stop") chain.rejectAllChanges()
    else chain.rejectChange()
    const done = chain.run()
    if (!done) toast.info("Nessuna revisione qui")
    if (mode === "next") editor.chain().focus().goToChange(1).run()
    if (mode === "all-stop") setTheme({ trackChanges: false })
  }

  return (
    <>
      <RibbonGroup label="Strumenti di correzione" safe>
        <RibbonButton
          large
          label="Ortografia"
          title="Sottolinea le parole sconosciute mentre scrivi"
          active={theme.spellcheck}
          icon={<SpellCheck className="size-5" />}
          onClick={() => setTheme({ spellcheck: !theme.spellcheck })}
        />
        <RibbonButton
          large
          label="Thesaurus"
          title="Sinonimi della parola selezionata (Maiusc+F7)"
          active={ctx.taskPane?.kind === "thesaurus"}
          icon={<BookA className="size-5" />}
          onClick={() =>
            ctx.taskPane?.kind === "thesaurus"
              ? ctx.closeTaskPane()
              : ctx.openTaskPane({
                  kind: "thesaurus",
                  word: wordAtSelection(ctx.editor)?.text ?? "",
                  nonce: Date.now(),
                })
          }
        />
        <WordCount ctx={ctx} />
      </RibbonGroup>

      <ReadAloudGroup editor={ctx.editor} language={ctx.theme.language} />

      <RibbonGroup label="Accessibilità" safe>
        <RibbonButton
          large
          label="Verifica accessibilità"
          icon={<Accessibility className="size-5" />}
          onClick={() => setDialog("a11y")}
        />
      </RibbonGroup>

      <RibbonGroup label="Lingua" safe>
        <RibbonMenu
          className="w-56"
          trigger={
            <RibbonButton
              large
              chevron
              label="Traduci"
              icon={<Languages className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={() => setDialog("translate-selection")}>
            Traduci selezione
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("translate-document")}>
            Traduci documento
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Lingua"
              icon={<Globe className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Lingua di correzione</DropdownMenuLabel>
          {PROOFING_LANGUAGES.map((l) => (
            <DropdownMenuItem
              key={l.code}
              onClick={() => setTheme({ language: l.code })}
              className={cn(theme.language === l.code && "bg-accent")}
            >
              {l.label}
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup label="Commenti">
        <RibbonButton
          large
          label="Nuovo commento"
          title="Commenta il testo selezionato (⌥⌘M)"
          icon={<MessageSquarePlus className="size-5" />}
          onClick={() => {
            if (!theme.comments) setTheme({ comments: true })
            comments.add()
          }}
        />
        <RibbonRows>
          <RibbonMenu
            className="w-64"
            trigger={
              <RibbonButton
                chevron
                label="Elimina"
                disabled={comments.list.length === 0}
                icon={<Trash2 className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem
              disabled={!current}
              onClick={() => current && comments.remove(current.id)}
            >
              Elimina questo commento
            </DropdownMenuItem>
            <DropdownMenuItem
              disabled={resolved === 0}
              onClick={() => comments.removeAll(true)}
            >
              Elimina i commenti risolti ({resolved})
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => comments.removeAll(false)}>
              Elimina tutti i commenti
            </DropdownMenuItem>
          </RibbonMenu>
          <RibbonButton
            label="Precedente"
            disabled={comments.list.length === 0}
            icon={<ChevronLeft className="size-4" />}
            className="justify-start"
            onClick={() => comments.step(-1)}
          />
          <RibbonButton
            label="Successivo"
            disabled={comments.list.length === 0}
            icon={<ChevronRight className="size-4" />}
            className="justify-start"
            onClick={() => comments.step(1)}
          />
        </RibbonRows>
        <RibbonRows>
          <RibbonButton
            label={current?.resolved ? "Riapri" : "Risolvi"}
            disabled={!current}
            icon={<CircleCheck className="size-4" />}
            className="justify-start"
            onClick={() =>
              current && comments.resolve(current.id, !current.resolved)
            }
          />
          <RibbonButton
            data-safe=""
            label={theme.comments ? "Nascondi commenti" : "Mostra commenti"}
            icon={
              theme.comments ? (
                <MessageSquareOff className="size-4" />
              ) : (
                <MessagesSquare className="size-4" />
              )
            }
            className="justify-start"
            onClick={() => setTheme({ comments: !theme.comments })}
          />
          <AuthorName />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Rilevamento">
        <RibbonButton
          large
          data-safe=""
          label="Revisioni"
          title="Rileva inserimenti ed eliminazioni di chi scrive"
          active={tracking}
          disabled={theme.protection === "tracked"}
          icon={<FilePenLine className="size-5" />}
          onClick={() => setTheme({ trackChanges: !theme.trackChanges })}
        />
        <RibbonRows>
          <RibbonMenu
            className="w-64"
            trigger={
              <RibbonButton
                compact
                chevron
                data-safe=""
                label={
                  MARKUPS.find((m) => m.value === (theme.markup ?? "all"))
                    ?.label ?? "Markup"
                }
                icon={<Eye className="size-4" />}
                className="justify-start"
              />
            }
          >
            {MARKUPS.map((m) => (
              <DropdownMenuItem
                key={m.value}
                onClick={() => setTheme({ markup: m.value })}
                className={cn(
                  (theme.markup ?? "all") === m.value && "bg-accent"
                )}
              >
                <div className="flex flex-col">
                  <span>{m.label}</span>
                  <span className="text-[11px] text-muted-foreground">
                    {m.hint}
                  </span>
                </div>
              </DropdownMenuItem>
            ))}
          </RibbonMenu>
          <ChangesPane ctx={ctx} />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Modifiche">
        <ChangeMenu
          label="Accetta"
          icon={<Check className="size-5" />}
          onPick={accept}
          active={st.onChange}
        />
        <ChangeMenu
          label="Rifiuta"
          icon={<X className="size-5" />}
          onPick={reject}
          active={st.onChange}
        />
        <RibbonRows>
          <RibbonButton
            compact
            label="Precedente"
            icon={<ChevronLeft className="size-4" />}
            className="justify-start"
            onClick={() =>
              editor.chain().focus().goToChange(-1).run() ||
              toast.info("Nessuna revisione")
            }
          />
          <RibbonButton
            compact
            label="Successiva"
            icon={<ChevronRight className="size-4" />}
            className="justify-start"
            onClick={() =>
              editor.chain().focus().goToChange(1).run() ||
              toast.info("Nessuna revisione")
            }
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Confronta" safe>
        <RibbonButton
          large
          label="Confronta"
          title="Confronta questo documento con un altro dell'area di lavoro"
          icon={<FileDiff className="size-5" />}
          onClick={() => setDialog("compare")}
        />
      </RibbonGroup>

      <RibbonGroup label="Proteggi" safe>
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label="Limita modifica"
              active={theme.protection !== "none"}
              icon={<Lock className="size-5" />}
            />
          }
        >
          {PROTECTIONS.map((p) => (
            <DropdownMenuItem
              key={p.value}
              onClick={() => setTheme({ protection: p.value })}
              className={cn(theme.protection === p.value && "bg-accent")}
            >
              <div className="flex flex-col">
                <span>{p.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {p.hint}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup label="Input penna" safe>
        <RibbonButton
          large
          label={
            theme.inkVisible ? "Nascondi input penna" : "Mostra input penna"
          }
          active={!theme.inkVisible}
          icon={<PenOff className="size-5" />}
          onClick={() => setTheme({ inkVisible: !theme.inkVisible })}
        />
      </RibbonGroup>

      <AccessibilityDialog open={dialog === "a11y"} onClose={close} ctx={ctx} />
      <TranslateDialog
        open={
          dialog === "translate-selection" || dialog === "translate-document"
        }
        onClose={close}
        ctx={ctx}
        scope={dialog === "translate-document" ? "document" : "selection"}
      />
      <CompareDialog
        open={dialog === "compare"}
        onClose={close}
        ctx={ctx}
        fileId={fileId}
      />
    </>
  )
}

function ChangeMenu({
  label,
  icon,
  onPick,
  active,
}: {
  label: "Accetta" | "Rifiuta"
  icon: React.ReactNode
  onPick: (mode: "next" | "this" | "all" | "all-stop") => void
  active: boolean
}) {
  const verb = label.toLowerCase()
  return (
    <span className="flex flex-col items-center">
      <RibbonButton
        large
        label={label}
        title={`${label} la revisione e passa alla successiva`}
        active={active}
        icon={icon}
        className="h-[42px]"
        onClick={() => onPick("next")}
      />
      <RibbonMenu
        className="w-64"
        trigger={
          <RibbonButton
            title={`Altre opzioni: ${verb}`}
            className="h-4 w-full"
            icon={<ChevronDown className="size-3 opacity-60" />}
          />
        }
      >
        <DropdownMenuItem onClick={() => onPick("next")}>
          {label} e sposta alla successiva
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("this")}>
          {label} questa modifica
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => onPick("all")}>
          {label} tutte le modifiche
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onPick("all-stop")}>
          {label} tutte le modifiche e interrompi rilevamento
        </DropdownMenuItem>
      </RibbonMenu>
    </span>
  )
}
