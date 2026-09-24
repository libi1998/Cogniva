"use client"

import type { Route } from "next"
import * as React from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  ArrowDownWideNarrow,
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

function exportAll() {
  const blob = new Blob([exportWorkspace()], { type: "application/json" })
  download(blob, `cogniva-${localDateStamp()}.json`)
  toast.success(tr("Spazio di lavoro esportato"), {
    description: tr(
      "Il file .json si reimporta da «Importa» anche su un altro computer."
    ),
  })
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
  const [dragging, setDragging] = React.useState(false)
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
              onClick={() => setFilter(n.key)}
            />
          ))}
          <div className="my-2 h-px bg-border" />
          <NavButton
            active={filter === "trash"}
            icon={<Trash2 className="size-4" />}
            label={t("Cestino")}
            count={counts.trash}
            onClick={() => setFilter("trash")}
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
            onClick={exportAll}
            disabled={!hydrated}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm text-muted-foreground transition hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-50"
          >
            <Download className="size-4" /> {t("Esporta tutto")}
          </button>
          <p className="px-2.5 pt-2 text-[11px] leading-snug text-muted-foreground">
            {t(
              "Tutto resta in questo browser. Trascina qui un file Word o Markdown per aprirlo."
            )}
          </p>
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
                  <DropdownMenuItem onClick={exportAll} disabled={!hydrated}>
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
                    onClick={() => setFilter(n.key)}
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

        {filter === "trash" ? (
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
              onImport={pickFiles}
            />
          ) : (
            <div className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3 sm:grid-cols-[repeat(auto-fill,minmax(228px,1fr))] sm:gap-4">
              {visible.map((f) => (
                <FileCard
                  key={f.id}
                  file={f}
                  query={q}
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
  onImport,
}: {
  filter: Filter
  searching: boolean
  onCreate: (kind: FileKind) => void
  onImport: () => void
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
          <Button size="sm" variant="ghost" onClick={onImport}>
            {t("Importa da Word")}
          </Button>
        </div>
      ) : null}
    </div>
  )
}

function FileCard({
  file: f,
  query,
  onRename,
  onTrash,
}: {
  file: WFile
  query: string
  onRename: () => void
  onTrash: () => void
}) {
  const t = useT()
  const inTrash = Boolean(f.deletedAt)
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
      className={cn(
        // le card fuori schermo non si disegnano: con molti file le anteprime
        // delle board pesano
        "group relative overflow-hidden rounded-2xl border border-border bg-card transition [contain-intrinsic-size:auto_260px] [content-visibility:auto] hover:border-primary/40 hover:shadow-lg",
        inTrash && "opacity-80"
      )}
    >
      {inTrash ? (
        <div>{body}</div>
      ) : (
        <Link
          href={fileHref(f)}
          className="block rounded-2xl outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          {body}
        </Link>
      )}

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
