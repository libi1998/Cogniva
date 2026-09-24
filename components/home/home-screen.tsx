"use client"

import type { Route } from "next"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownWideNarrow,
  Check,
  CheckSquare,
  Clock,
  Copy,
  Download,
  FileText,
  FileType2,
  FileUp,
  LayoutGrid,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  RotateCcw,
  Search,
  Shapes,
  Star,
  Trash2,
  Upload,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Glyph } from "@/components/board/glyph"
import { BoardThumb, DocThumb } from "@/components/home/file-thumb"
import { FileGridSkeleton } from "@/components/home/file-grid-skeleton"
import { LogoMark } from "@/components/shared/logo"
import { ThemeToggle } from "@/components/shared/theme-toggle"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import { Kbd } from "@/components/ui/kbd"
import { openCommandPalette } from "@/components/shared/command-palette"
import { download } from "@/lib/export"
import { normalizeSearch, searchSnippet, searchText } from "@/lib/search"
import { IMPORTABLE, fileHref, importFiles } from "@/lib/import-files"
import { exportWorkspace, getWorkspace, useStore } from "@/lib/store"
import { displayTitle, type FileKind, type WFile } from "@/lib/types"
import { useDocumentTitle } from "@/lib/use-document-title"
import { cn, localDateStamp } from "@/lib/utils"

import {
  useT,
  useHref,
  tr,
  hrefFor,
  timeAgo,
  currentLocale,
} from "@/lib/i18n/client"
import { N_ } from "@/lib/i18n/config"
type Filter = "all" | "board" | "doc" | "starred" | "trash"
type Sort = "updated" | "created" | "name"

const SORTS: { value: Sort; label: string }[] = [
  {
    value: "updated",
    label: N_("Modificati di recente"),
  },
  {
    value: "created",
    label: N_("Creati di recente"),
  },
  {
    value: "name",
    label: N_("Nome"),
  },
]

const NAV: {
  key: Filter
  label: string
  short: string
  icon: React.ReactNode
}[] = [
  {
    key: "all",
    label: N_("Tutti i file"),
    short: N_("Tutti"),
    icon: <LayoutGrid className="size-4" />,
  },
  {
    key: "board",
    label: N_("Board"),
    short: N_("Board"),
    icon: <Shapes className="size-4" />,
  },
  {
    key: "doc",
    label: N_("Documenti"),
    short: N_("Documenti"),
    icon: <FileText className="size-4" />,
  },
  {
    key: "starred",
    label: N_("Preferiti"),
    short: N_("Preferiti"),
    icon: <Star className="size-4" />,
  },
]

/** Il confronto fra i titoli, costruito una volta per lingua */
let collator: { locale: string; value: Intl.Collator } | null = null
function titleCollator() {
  const locale = currentLocale()
  if (collator?.locale !== locale) {
    collator = {
      locale,
      value: new Intl.Collator(locale, { numeric: true, sensitivity: "base" }),
    }
  }
  return collator.value
}

/** Tutto lo spazio di lavoro in .json, oppure solo i file dati */
function exportAll(ids?: readonly string[]) {
  const blob = new Blob([exportWorkspace(ids)], { type: "application/json" })
  download(blob, `cogniva-${localDateStamp()}.json`)
  toast.success(
    ids
      ? ids.length === 1
        ? tr("1 file esportato")
        : tr("{count} file esportati", { count: ids.length })
      : tr("Spazio di lavoro esportato"),
    {
      description: tr(
        "Il file .json si reimporta da «Importa» anche su un altro computer."
      ),
    }
  )
}

/** Un tasto premuto in un campo di testo non è un comando della home */
function typing(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(
    el &&
    (el.isContentEditable ||
      el.localName === "input" ||
      el.localName === "textarea" ||
      el.localName === "select")
  )
}

export function HomeScreen() {
  const t = useT()
  const href = useHref()
  const router = useRouter()
  const hydrated = useStore((s) => s.hydrated)
  const files = useStore((s) => s.files)
  const [q, setQ] = React.useState("")
  const [filter, setFilter] = React.useState<Filter>("all")
  const [sort, setSort] = React.useState<Sort>("updated")
  const [renaming, setRenaming] = React.useState<{
    id: string
    value: string
  } | null>(null)
  const [confirmEmpty, setConfirmEmpty] = React.useState(false)
  const [confirmDelete, setConfirmDelete] = React.useState<string[] | null>(
    null
  )
  const [dragging, setDragging] = React.useState(false)
  // la selezione: i file scelti e, per i dispositivi touch, la modalità in
  // cui un tocco sceglie invece di aprire
  const [selected, setSelected] = React.useState<ReadonlySet<string>>(
    () => new Set()
  )
  const [selecting, setSelecting] = React.useState(false)
  const anchor = React.useRef<string | null>(null)
  const root = React.useRef<HTMLDivElement>(null)
  const fileInput = React.useRef<HTMLInputElement>(null)
  // la home resta montata (nascosta) mentre si lavora su un file: tornando
  // qui il titolo della scheda va rimesso
  useDocumentTitle("Cogniva")

  const live = files.filter((f) => !f.deletedAt)
  const trash = files.filter((f) => f.deletedAt)
  const query = normalizeSearch(q.trim())

  // un ordinamento per nome confronta n·log(n) volte: con la lingua passata a
  // ogni confronto il browser costruisce ogni volta le regole della lingua
  const byName = titleCollator()
  const visible = (filter === "trash" ? trash : live)
    .filter((f) =>
      filter === "all" || filter === "trash"
        ? true
        : filter === "starred"
          ? f.starred
          : f.kind === filter
    )
    .filter((f) => !query || searchText(f).includes(query))
    .sort((a, b) =>
      sort === "name"
        ? byName.compare(a.title, b.title)
        : sort === "created"
          ? b.createdAt - a.createdAt
          : b.updatedAt - a.updatedAt
    )

  // si sceglie fra i file che si vedono: cambiando filtro la selezione riparte
  const picked = visible.filter((f) => selected.has(f.id))
  const pickedIds = picked.map((f) => f.id)
  const selectMode = selecting || picked.length > 0
  const clearSelection = () => {
    setSelected(new Set())
    setSelecting(false)
    anchor.current = null
  }
  const showFilter = (next: Filter) => {
    setFilter(next)
    clearSelection()
  }

  /**
   * Un clic su un file mentre si sceglie: da solo lo aggiunge o lo toglie,
   * con Maiuscole prende tutti quelli fra l'ultimo scelto e questo
   */
  const pick = (id: string, range: boolean) => {
    const from = range && anchor.current ? anchor.current : null
    const a = from ? visible.findIndex((f) => f.id === from) : -1
    const b = visible.findIndex((f) => f.id === id)
    setSelected((prev) => {
      const next = new Set(prev)
      if (a >= 0 && b >= 0) {
        for (const f of visible.slice(Math.min(a, b), Math.max(a, b) + 1))
          next.add(f.id)
      } else if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
    if (!range || !anchor.current) anchor.current = id
  }
  const selectAll = () => {
    setSelected(new Set(visible.map((f) => f.id)))
    anchor.current = visible[0]?.id ?? null
  }

  const trashPicked = (ids: string[]) => {
    if (!ids.length) return
    getWorkspace().trashFiles(ids)
    clearSelection()
    toast.success(
      ids.length === 1
        ? t("1 file spostato nel cestino")
        : t("{count} file spostati nel cestino", { count: ids.length }),
      {
        action: {
          label: t("Annulla||annulla l'ultima modifica"),
          onClick: () => getWorkspace().restoreFiles(ids),
        },
      }
    )
  }

  // Esc toglie la selezione, ⌘A sceglie tutto, Canc sposta nel cestino. La
  // home resta montata (nascosta) mentre si lavora su un file: i tasti
  // valgono solo quando si vede
  const onKey = React.useEffectEvent((event: KeyboardEvent) => {
    const el = root.current
    if (!el || !(el.checkVisibility?.() ?? el.offsetParent !== null)) return
    if (typing(event.target) || document.querySelector('[role="dialog"]'))
      return
    const mod = event.metaKey || event.ctrlKey
    if (event.key === "Escape" && selectMode) {
      clearSelection()
    } else if (mod && event.key.toLowerCase() === "a" && visible.length) {
      event.preventDefault()
      selectAll()
    } else if (
      (event.key === "Delete" || event.key === "Backspace") &&
      picked.length
    ) {
      event.preventDefault()
      if (filter === "trash") setConfirmDelete(pickedIds)
      else trashPicked(pickedIds)
    }
  })
  React.useEffect(() => {
    const listener = (event: KeyboardEvent) => onKey(event)
    window.addEventListener("keydown", listener)
    return () => window.removeEventListener("keydown", listener)
  }, [])

  const create = (kind: FileKind) => {
    const id = getWorkspace().createFile(kind)
    router.push(
      hrefFor(kind === "board" ? `/board/${id}` : `/doc/${id}`) as Route
    )
  }

  const pickFiles = () => fileInput.current?.click()

  const trashFile = (f: WFile) => {
    getWorkspace().trashFile(f.id)
    toast.success(
      t("«{title}» spostato nel cestino", { title: displayTitle(f) }),
      {
        action: {
          label: t("Annulla||annulla l'ultima modifica"),
          onClick: () => getWorkspace().restoreFile(f.id),
        },
      }
    )
  }

  // i conteggi si mostrano solo a spazio di lavoro caricato: prima sarebbero
  // tutti zero
  const counts: Record<Filter, number | null> = hydrated
    ? {
        all: live.length,
        board: live.filter((f) => f.kind === "board").length,
        doc: live.filter((f) => f.kind === "doc").length,
        starred: live.filter((f) => f.starred).length,
        trash: trash.length,
      }
    : { all: null, board: null, doc: null, starred: null, trash: null }

  const sortMenu = (
    <DropdownMenu>
      <DropdownMenuTrigger
        render={
          <Button
            variant="ghost"
            size="sm"
            className="h-8 gap-1.5 text-xs"
            aria-label={t("Ordina||ordina l'elenco dei file")}
          />
        }
      >
        <ArrowDownWideNarrow className="size-4" />
        <span className="hidden lg:inline">
          {t(SORTS.find((s) => s.value === sort)?.label ?? "")}
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel>{t("Ordina per")}</DropdownMenuLabel>
        {SORTS.map((s) => (
          <DropdownMenuItem
            key={s.value}
            onClick={() => setSort(s.value)}
            className={cn(sort === s.value && "font-semibold")}
          >
            {t(s.label)}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  return (
    <div
      ref={root}
      className="flex h-dvh bg-muted"
      onDragOver={(e) => {
        if (!e.dataTransfer.types.includes("Files")) return
        e.preventDefault()
        setDragging(true)
      }}
      onDragLeave={(e) => {
        if (e.currentTarget.contains(e.relatedTarget as Node | null)) return
        setDragging(false)
      }}
      onDrop={(e) => {
        if (!e.dataTransfer.files.length) return
        e.preventDefault()
        setDragging(false)
        void importFiles(Array.from(e.dataTransfer.files), router.push)
      }}
    >
      <aside className="hidden w-[236px] shrink-0 flex-col border-r border-border bg-card p-3 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))] pl-[max(0.75rem,env(safe-area-inset-left))] md:flex">
        <Link
          href={href("/") as Route}
          className="mb-5 flex items-center gap-2 px-2 pt-2"
        >
          <LogoMark />
          <span className="text-[15px] font-bold tracking-[-0.01em] text-foreground">
            Cogniva
          </span>
        </Link>

        <div className="mb-4 space-y-1.5">
          <Button
            className="h-9 w-full justify-start gap-2"
            onClick={() => create("board")}
          >
            <Plus className="size-4" /> {t("Nuova board")}
          </Button>
          <Button
            variant="outline"
            className="h-9 w-full justify-start gap-2"
            onClick={() => create("doc")}
          >
            <FileText className="size-4" /> {t("Nuovo documento")}
          </Button>
        </div>

        <nav className="space-y-0.5" aria-label={t("Filtri")}>
          {NAV.map((n) => (
            <NavButton
              key={n.key}
              active={filter === n.key}
              icon={n.icon}
              label={t(n.label)}
              count={counts[n.key]}
              onClick={() => showFilter(n.key)}
            />
          ))}
          <div className="my-2 h-px bg-border" />
          <NavButton
            active={filter === "trash"}
            icon={<Trash2 className="size-4" />}
            label={t("Cestino")}
            count={counts.trash}
            onClick={() => showFilter("trash")}
          />
        </nav>

        <div className="mt-auto space-y-0.5 border-t border-border pt-3">
          <DropdownMenu>
            <DropdownMenuTrigger
              render={
                <button
                  type="button"
                  className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground"
                />
              }
            >
              <Upload className="size-4" /> {t("Importa")}
            </DropdownMenuTrigger>
            <DropdownMenuContent side="top" align="start" className="w-64">
              <ImportItems onPick={pickFiles} />
            </DropdownMenuContent>
          </DropdownMenu>
          <button
            type="button"
            onClick={() => exportAll()}
            disabled={!hydrated}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="size-4" /> {t("Esporta tutto")}
          </button>
        </div>
      </aside>

      <input
        ref={fileInput}
        type="file"
        multiple
        accept={IMPORTABLE}
        className="hidden"
        onChange={(e) => {
          const list = Array.from(e.target.files ?? [])
          e.target.value = ""
          if (list.length) void importFiles(list, router.push)
        }}
      />

      <main className="relative flex min-w-0 flex-1 flex-col">
        <header className="shrink-0 border-b border-border bg-card pt-[env(safe-area-inset-top)] safe-x md:px-5">
          <div className="flex h-14 items-center gap-2 sm:gap-3">
            <Link
              href={href("/") as Route}
              className="flex shrink-0 items-center gap-2 md:hidden"
              aria-label="Cogniva"
            >
              <LogoMark className="size-7" />
              <span className="hidden text-[15px] font-bold tracking-[-0.01em] text-foreground min-[400px]:inline">
                Cogniva
              </span>
            </Link>

            <SearchField
              value={q}
              onChange={setQ}
              className="hidden max-w-md flex-1 md:block"
            />

            <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1.5">
              <Button
                variant={selectMode ? "secondary" : "ghost"}
                size="sm"
                className="h-8 gap-1.5 text-xs"
                aria-pressed={selectMode}
                aria-label={selectMode ? t("Fine") : t("Seleziona")}
                title={
                  selectMode
                    ? t("Fine")
                    : t("Seleziona più file (⌘/Ctrl o Maiuscole + clic)")
                }
                disabled={!hydrated || (!selectMode && visible.length === 0)}
                onClick={() =>
                  selectMode ? clearSelection() : setSelecting(true)
                }
              >
                <CheckSquare className="size-4" />
                <span className="hidden lg:inline">
                  {selectMode ? t("Fine") : t("Seleziona")}
                </span>
              </Button>
              {sortMenu}
              <ThemeToggle />
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={
                    <Button
                      variant="ghost"
                      size="icon"
                      className="md:hidden"
                      aria-label={t("Altre azioni")}
                    />
                  }
                >
                  <MoreVertical className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-64">
                  <ImportItems onPick={pickFiles} />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => exportAll()}
                    disabled={!hydrated}
                  >
                    <Download className="size-4" /> {t("Esporta tutto")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={openCommandPalette}>
                    <Search className="size-4" /> {t("Tutti i comandi")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
              <DropdownMenu>
                <DropdownMenuTrigger
                  render={<Button size="sm" className="ml-1 h-8 md:hidden" />}
                >
                  <Plus className="size-4" /> {t("Nuovo")}
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <DropdownMenuItem onClick={() => create("board")}>
                    <Shapes className="size-4" /> {t("Nuova board")}
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => create("doc")}>
                    <FileText className="size-4" /> {t("Nuovo documento")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          <div className="space-y-2 pb-2.5 md:hidden">
            <SearchField value={q} onChange={setQ} />
            <nav
              aria-label={t("Filtri")}
              className="-mx-[max(0.5rem,env(safe-area-inset-left))] flex [scrollbar-width:none] gap-1.5 overflow-x-auto px-[max(0.5rem,env(safe-area-inset-left))] sm:-mx-3 sm:px-3"
            >
              {[...NAV, { key: "trash" as const, short: N_("Cestino") }].map(
                (n) => (
                  <button
                    key={n.key}
                    type="button"
                    onClick={() => showFilter(n.key)}
                    aria-current={filter === n.key ? "page" : undefined}
                    className={cn(
                      "flex h-8 shrink-0 items-center gap-1.5 rounded-full border px-3 text-xs font-medium transition",
                      filter === n.key
                        ? "border-transparent bg-foreground text-background"
                        : "border-border bg-background text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {t(n.short)}
                    {counts[n.key] !== null ? (
                      <span className="tabular-nums opacity-60">
                        {counts[n.key]}
                      </span>
                    ) : null}
                  </button>
                )
              )}
            </nav>
          </div>
        </header>

        {selectMode ? (
          <SelectionBar
            count={picked.length}
            total={visible.length}
            inTrash={filter === "trash"}
            allStarred={picked.length > 0 && picked.every((f) => f.starred)}
            onClose={clearSelection}
            onSelectAll={selectAll}
            onStar={(starred) => getWorkspace().setStarred(pickedIds, starred)}
            onDuplicate={() => {
              const made = getWorkspace().duplicateFiles(pickedIds)
              setSelected(new Set(made))
              toast.success(
                made.length === 1
                  ? t("1 copia creata")
                  : t("{count} copie create", { count: made.length })
              )
            }}
            onExport={() => exportAll(pickedIds)}
            onTrash={() => trashPicked(pickedIds)}
            onRestore={() => {
              getWorkspace().restoreFiles(pickedIds)
              clearSelection()
              toast.success(
                pickedIds.length === 1
                  ? t("1 file ripristinato")
                  : t("{count} file ripristinati", { count: pickedIds.length })
              )
            }}
            onDelete={() => setConfirmDelete(pickedIds)}
          />
        ) : null}

        {filter === "trash" && !selectMode ? (
          <div className="flex min-h-11 flex-wrap items-center gap-x-3 gap-y-1 border-b border-border bg-card/60 py-2 safe-x text-xs text-muted-foreground md:px-6">
            <Clock className="size-3.5 shrink-0" />
            <span className="min-w-0 flex-1">
              {t("I file nel cestino si eliminano da soli dopo 30 giorni.")}
            </span>
            {trash.length ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-xs text-destructive hover:text-destructive"
                onClick={() => setConfirmEmpty(true)}
              >
                {t("Svuota il cestino")}
              </Button>
            ) : null}
          </div>
        ) : null}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-[max(0.75rem,env(safe-area-inset-left))] pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:p-6">
          {!hydrated ? (
            <FileGridSkeleton />
          ) : visible.length === 0 ? (
            <EmptyState
              filter={filter}
              searching={Boolean(query)}
              onCreate={create}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(228px,1fr))] sm:gap-4">
              {visible.map((f) => (
                <FileCard
                  key={f.id}
                  file={f}
                  query={q}
                  selected={selected.has(f.id)}
                  selectMode={selectMode}
                  onPick={(range) => pick(f.id, range)}
                  onRename={() => setRenaming({ id: f.id, value: f.title })}
                  onTrash={() => trashFile(f)}
                />
              ))}
            </div>
          )}
        </div>

        {dragging ? (
          <div className="pointer-events-none absolute inset-3 z-30 flex items-center justify-center rounded-2xl border-2 border-dashed border-primary bg-primary/10 p-6 text-center text-sm font-medium text-primary backdrop-blur-[1px]">
            {t(
              "Rilascia per importare documenti Word, Markdown o uno spazio di lavoro"
            )}
          </div>
        ) : null}
      </main>

      <Dialog open={!!renaming} onOpenChange={(o) => !o && setRenaming(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Rinomina")}</DialogTitle>
          </DialogHeader>
          <form
            className="contents"
            onSubmit={(e) => {
              e.preventDefault()
              if (renaming?.value.trim()) {
                getWorkspace().renameFile(renaming.id, renaming.value.trim())
              }
              setRenaming(null)
            }}
          >
            <DialogBody>
              <Input
                autoFocus
                aria-label={t("Nuovo nome")}
                value={renaming?.value ?? ""}
                enterKeyHint="done"
                onChange={(e) =>
                  setRenaming((r) => (r ? { ...r, value: e.target.value } : r))
                }
              />
            </DialogBody>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setRenaming(null)}
              >
                {t("Annulla")}
              </Button>
              <Button type="submit">{t("Salva")}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmEmpty} onOpenChange={setConfirmEmpty}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Svuotare il cestino?")}</DialogTitle>
            <DialogDescription>
              {trash.length === 1
                ? t("Il file verrà eliminato per sempre.")
                : t("I {count} file verranno eliminati per sempre.", {
                    count: trash.length,
                  })}{" "}
              {t("Non si può annullare.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmEmpty(false)}>
              {t("Annulla")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                getWorkspace().emptyTrash()
                setConfirmEmpty(false)
                toast.success(t("Cestino svuotato"))
              }}
            >
              {t("Elimina per sempre")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
      >
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t("Eliminare per sempre?")}</DialogTitle>
            <DialogDescription>
              {confirmDelete?.length === 1
                ? t("Il file verrà eliminato per sempre.")
                : t("I {count} file verranno eliminati per sempre.", {
                    count: confirmDelete?.length ?? 0,
                  })}{" "}
              {t("Non si può annullare.")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmDelete(null)}>
              {t("Annulla")}
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                if (confirmDelete)
                  getWorkspace().deleteFilesForever(confirmDelete)
                setConfirmDelete(null)
                clearSelection()
                toast.success(t("Eliminato per sempre"))
              }}
            >
              {t("Elimina per sempre")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

/**
 * La barra dei file scelti, al posto di un menu per ciascuno: preferiti,
 * copie, esportazione e cestino per tutti insieme
 */
function SelectionBar({
  count,
  total,
  inTrash,
  allStarred,
  onClose,
  onSelectAll,
  onStar,
  onDuplicate,
  onExport,
  onTrash,
  onRestore,
  onDelete,
}: {
  count: number
  total: number
  inTrash: boolean
  allStarred: boolean
  onClose: () => void
  onSelectAll: () => void
  onStar: (starred: boolean) => void
  onDuplicate: () => void
  onExport: () => void
  onTrash: () => void
  onRestore: () => void
  onDelete: () => void
}) {
  const t = useT()
  const none = count === 0
  const action = "h-8 gap-1.5 text-xs"
  return (
    <div
      role="toolbar"
      aria-label={t("File selezionati")}
      className="flex min-h-12 flex-wrap items-center gap-1 border-b border-primary/30 bg-accent/60 py-1.5 safe-x md:px-5"
    >
      <Button
        variant="ghost"
        size="icon"
        className="size-8"
        aria-label={t("Annulla selezione")}
        title={t("Annulla selezione (Esc)")}
        onClick={onClose}
      >
        <X className="size-4" />
      </Button>
      <span
        className="min-w-0 px-1 text-sm font-medium text-foreground tabular-nums"
        aria-live="polite"
      >
        {none
          ? t("Scegli i file")
          : count === 1
            ? t("1 selezionato")
            : t("{count} selezionati", { count })}
      </span>
      {count < total ? (
        <Button
          variant="ghost"
          size="sm"
          className={action}
          onClick={onSelectAll}
          title={t("Seleziona tutti (⌘A)")}
        >
          {t("Seleziona tutti")}
        </Button>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-1">
        {inTrash ? (
          <>
            <Button
              variant="outline"
              size="sm"
              className={action}
              disabled={none}
              onClick={onRestore}
            >
              <RotateCcw className="size-3.5" /> {t("Ripristina")}
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(action, "text-destructive hover:text-destructive")}
              disabled={none}
              onClick={onDelete}
            >
              <Trash2 className="size-3.5" /> {t("Elimina per sempre")}
            </Button>
          </>
        ) : (
          <>
            <Button
              variant="ghost"
              size="sm"
              className={action}
              disabled={none}
              onClick={() => onStar(!allStarred)}
            >
              <Star
                className={cn(
                  "size-3.5",
                  allStarred && "fill-amber-400 text-amber-500"
                )}
              />
              <span className="hidden sm:inline">
                {allStarred
                  ? t("Rimuovi dai preferiti")
                  : t("Aggiungi ai preferiti")}
              </span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={action}
              disabled={none}
              onClick={onDuplicate}
            >
              <Copy className="size-3.5" />
              <span className="hidden sm:inline">{t("Duplica")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={action}
              disabled={none}
              onClick={onExport}
            >
              <Download className="size-3.5" />
              <span className="hidden sm:inline">{t("Esporta")}</span>
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className={cn(action, "text-destructive hover:text-destructive")}
              disabled={none}
              onClick={onTrash}
            >
              <Trash2 className="size-3.5" />
              <span className="hidden sm:inline">
                {t("Sposta nel cestino")}
              </span>
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function SearchField({
  value,
  onChange,
  className,
}: {
  value: string
  onChange: (value: string) => void
  className?: string
}) {
  const t = useT()
  return (
    <div className={cn("relative w-full", className)}>
      <Search className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={t("Cerca nei titoli e nel testo…")}
        aria-label={t("Cerca")}
        enterKeyHint="search"
        className="h-9 border-transparent bg-muted pl-8 text-sm focus-visible:bg-background pointer-fine:pr-14 [&::-webkit-search-cancel-button]:hidden"
      />
      <button
        type="button"
        onClick={openCommandPalette}
        title={t("Tutti i comandi")}
        className="absolute top-1/2 right-2 hidden -translate-y-1/2 pointer-fine:block"
      >
        <Kbd>⌘K</Kbd>
      </button>
    </div>
  )
}

function ImportItems({ onPick }: { onPick: () => void }) {
  const t = useT()
  return (
    <>
      <DropdownMenuLabel>{t("Apri come documento")}</DropdownMenuLabel>
      <DropdownMenuItem onClick={onPick}>
        <FileType2 className="size-4" />
        <div className="flex flex-col">
          <span>{t("Word, Markdown, HTML o testo")}</span>
          <span className="text-[11px] text-muted-foreground">
            {t(".docx · .md · .html · .txt")}
          </span>
        </div>
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onPick}>
        <FileUp className="size-4" />
        <div className="flex flex-col">
          <span>{t("Spazio di lavoro")}</span>
          <span className="text-[11px] text-muted-foreground">
            {t(".json esportato da Cogniva")}
          </span>
        </div>
      </DropdownMenuItem>
    </>
  )
}

function NavButton({
  active,
  icon,
  label,
  count,
  onClick,
}: {
  active: boolean
  icon: React.ReactNode
  label: string
  count: number | null
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition",
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {icon}
      {label}
      <span className="ml-auto min-w-4 text-right text-xs font-normal tabular-nums opacity-60">
        {count}
      </span>
    </button>
  )
}

function EmptyState({
  filter,
  searching,
  onCreate,
}: {
  filter: Filter
  searching: boolean
  onCreate: (kind: FileKind) => void
}) {
  const t = useT()
  const message = searching
    ? t("Nessun file contiene quello che cerchi.")
    : filter === "trash"
      ? t("Il cestino è vuoto.")
      : filter === "starred"
        ? t("Nessun preferito: aggiungili dal menu di un file.")
        : t("Non c'è ancora niente qui.")
  return (
    <div className="flex h-full min-h-72 flex-col items-center justify-center gap-3 px-4 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        {filter === "trash" ? (
          <Trash2 className="size-6" />
        ) : (
          <Shapes className="size-6" />
        )}
      </div>
      <p className="text-sm text-muted-foreground">{message}</p>
      {!searching && filter !== "trash" && filter !== "starred" ? (
        <div className="flex flex-wrap justify-center gap-2">
          <Button size="sm" onClick={() => onCreate("board")}>
            {t("Crea una board")}
          </Button>
          <Button size="sm" variant="outline" onClick={() => onCreate("doc")}>
            {t("Crea un documento")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function FileCard({
  file: f,
  query,
  selected,
  selectMode,
  onPick,
  onRename,
  onTrash,
}: {
  file: WFile
  query: string
  selected: boolean
  /** si stanno scegliendo file: un clic sceglie invece di aprire */
  selectMode: boolean
  /** `range`: con Maiuscole, fino all'ultimo file scelto */
  onPick: (range: boolean) => void
  onRename: () => void
  onTrash: () => void
}) {
  const t = useT()
  const inTrash = Boolean(f.deletedAt)
  // ⌘/Ctrl o Maiuscole con un clic scelgono, come nel Finder e in Esplora
  // risorse; mentre si sceglie basta il clic
  const onCardClick = (event: React.MouseEvent) => {
    const range = event.shiftKey
    if (!selectMode && !range && !event.metaKey && !event.ctrlKey) return
    event.preventDefault()
    onPick(range)
  }
  const snippet = query ? searchSnippet(f, query) : ""
  const body = (
    <>
      <div className="aspect-[4/3] w-full overflow-hidden border-b border-border">
        {f.kind === "board" ? (
          <BoardThumb data={f.data} />
        ) : (
          <DocThumb data={f.data} />
        )}
      </div>
      <div className="flex items-start gap-2 p-2.5 sm:p-3">
        <Glyph
          name={f.icon}
          size={17}
          strokeWidth={1.9}
          className="mt-px hidden shrink-0 text-muted-foreground min-[400px]:block"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-semibold text-foreground sm:text-sm">
            {displayTitle(f)}
          </p>
          <p className="mt-0.5 truncate text-[11px] text-muted-foreground">
            {f.kind === "board" ? t("Board") : t("Documento")} ·{" "}
            {inTrash
              ? t("eliminato {timeAgo}", { timeAgo: timeAgo(f.deletedAt!) })
              : timeAgo(f.updatedAt)}
          </p>
          {snippet ? (
            <p className="mt-1 line-clamp-2 text-[11px] leading-snug text-muted-foreground">
              {snippet}
            </p>
          ) : null}
        </div>
      </div>
    </>
  )

  return (
    <div
      data-selected={selected ? "" : undefined}
      className={cn(
        // le card fuori schermo non si disegnano: con molti file le anteprime
        // delle board pesano
        "group relative overflow-hidden rounded-2xl border border-border bg-card transition [contain-intrinsic-size:auto_260px] [content-visibility:auto] hover:border-primary/40 hover:shadow-lg",
        inTrash && !selected && "opacity-80",
        selected && "border-primary ring-2 ring-primary/60"
      )}
    >
      {inTrash ? (
        <div
          onClick={onCardClick}
          className={cn(selectMode && "cursor-pointer select-none")}
        >
          {body}
        </div>
      ) : (
        <Link
          href={fileHref(f)}
          onClick={onCardClick}
          className={cn(
            "block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
            selectMode && "select-none"
          )}
        >
          {body}
        </Link>
      )}

      <button
        type="button"
        role="checkbox"
        aria-checked={selected}
        aria-label={t("Seleziona {title}", { title: displayTitle(f) })}
        onClick={(event) => onPick(event.shiftKey)}
        className={cn(
          "absolute top-2 left-2 flex size-6 items-center justify-center rounded-md border shadow-sm backdrop-blur transition pointer-coarse:size-7",
          selected
            ? "border-primary bg-primary text-primary-foreground"
            : "border-border bg-card/90 text-transparent hover:text-muted-foreground",
          // senza scegliere si vede solo passandoci sopra; sui dispositivi
          // touch si entra con «Seleziona»
          selectMode || selected
            ? "opacity-100"
            : "opacity-0 group-hover:opacity-100 focus-visible:opacity-100 pointer-coarse:hidden"
        )}
      >
        <Check className="size-4" strokeWidth={3} />
      </button>

      {f.starred && !inTrash ? (
        <Star
          aria-label={t("Preferito")}
          className="pointer-events-none absolute top-2.5 right-10 size-4 fill-amber-400 text-amber-500"
        />
      ) : null}

      {inTrash ? (
        <div className="flex gap-1.5 border-t border-border p-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 min-w-0 flex-1 gap-1 text-xs"
            onClick={() => {
              getWorkspace().restoreFile(f.id)
              toast.success(
                t("«{title}» ripristinato", { title: displayTitle(f) })
              )
            }}
          >
            <RotateCcw className="size-3.5" />
            <span className="truncate">{t("Ripristina")}</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs text-destructive hover:text-destructive"
            aria-label={t("Elimina per sempre")}
            onClick={() => {
              getWorkspace().deleteForever(f.id)
              toast.success(t("Eliminato per sempre"))
            }}
          >
            <Trash2 className="size-3.5" />
            <span className="hidden min-[400px]:inline">{t("Elimina")}</span>
          </Button>
        </div>
      ) : (
        <DropdownMenu>
          <DropdownMenuTrigger
            render={
              <button
                type="button"
                aria-label={t("Azioni per {title}", { title: displayTitle(f) })}
                // sui dispositivi senza hover il pulsante resta sempre a vista
                className="absolute top-2 right-2 flex size-7 items-center justify-center rounded-lg bg-card/90 text-muted-foreground opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:size-8 pointer-coarse:opacity-100"
              />
            }
          >
            <MoreHorizontal className="size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={onRename}>
              <Pencil className="size-4" /> {t("Rinomina")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => getWorkspace().duplicateFile(f.id)}
            >
              <Copy className="size-4" /> {t("Duplica")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => getWorkspace().toggleStar(f.id)}>
              <Star className="size-4" />
              {f.starred
                ? t("Rimuovi dai preferiti")
                : t("Aggiungi ai preferiti")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onClick={onTrash}>
              <Trash2 className="size-4" /> {t("Sposta nel cestino")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  )
}
