"use client"

import * as React from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import {
  Download,
  FileUp,
  House,
  Keyboard,
  Monitor,
  Moon,
  Plus,
  Shapes,
  Sun,
} from "lucide-react"
import {
  Command,
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Kbd } from "@/components/ui/kbd"
import { Glyph } from "@/components/board/glyph"
import { fileHref, pickAndImport } from "@/lib/import-files"
import { normalizeSearch } from "@/lib/search"
import { download } from "@/lib/export"
import { exportWorkspace, getWorkspace } from "@/lib/store"
import { STORAGE, readStorage, writeStorage } from "@/lib/storage"
import { setThemePreference } from "@/lib/use-theme"

/**
 * Palette dei comandi (⌘K) e finestra delle scorciatoie (?).
 *
 * Le pagine registrano i loro comandi con useCommandSource: la palette li
 * legge solo quando si apre, così registrarli non costa niente mentre si
 * lavora.
 */

export type PaletteCommand = {
  id: string
  label: string
  group: string
  icon?: React.ReactNode
  shortcut?: string
  keywords?: string[]
  run: () => void
}

type Source = { current: () => PaletteCommand[] }
const sources = new Map<string, Source>()

type Overlay = "palette" | "shortcuts" | null
let overlay: Overlay = null
const listeners = new Set<() => void>()

function setOverlay(next: Overlay) {
  overlay = next
  listeners.forEach((l) => l())
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

export function openCommandPalette() {
  setOverlay("palette")
}

function openShortcuts() {
  setOverlay("shortcuts")
}

/** Aggiunge alla palette i comandi della pagina finché è montata */
export function useCommandSource(key: string, get: () => PaletteCommand[]) {
  const latest = React.useRef(get)
  React.useEffect(() => {
    latest.current = get
  })
  React.useEffect(() => {
    sources.set(key, latest)
    return () => {
      sources.delete(key)
    }
  }, [key])
}

function isTyping(target: EventTarget | null) {
  const el = target as HTMLElement | null
  return Boolean(
    el &&
    (el.tagName === "INPUT" ||
      el.tagName === "TEXTAREA" ||
      el.tagName === "SELECT" ||
      el.isContentEditable)
  )
}

const RECENT_LIMIT = 5
const ID_SEPARATOR = "\u241f"

/**
 * Punteggio della ricerca: conta il nome, poi le parole chiave. Niente
 * corrispondenze sparse lettera per lettera, che su un elenco lungo facevano
 * comparire comandi senza relazione con quello che si scrive.
 */
function score(value: string, search: string, keywords?: string[]) {
  const query = normalizeSearch(search.trim())
  if (!query) return 1
  const label = normalizeSearch(
    value.split(ID_SEPARATOR)[0].replace(/^recent:/, "")
  )
  if (label.startsWith(query)) return 1
  const words = query.split(/\s+/)
  if (label.includes(query)) return 0.9
  if (
    words.every((w) => label.split(/\s+/).some((part) => part.startsWith(w)))
  ) {
    return 0.8
  }
  const extra = normalizeSearch((keywords ?? []).join(" "))
  if (words.every((w) => extra.includes(w) || label.includes(w))) return 0.5
  return 0
}

function readRecent(): string[] {
  try {
    const raw = JSON.parse(readStorage(STORAGE.commands) ?? "[]")
    return Array.isArray(raw) ? raw.filter((x) => typeof x === "string") : []
  } catch {
    return []
  }
}

export function CommandLayer() {
  const router = useRouter()
  const current = React.useSyncExternalStore(
    subscribe,
    () => overlay,
    () => null
  )

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (mod && !e.shiftKey && !e.altKey && e.key.toLowerCase() === "k") {
        e.preventDefault()
        setOverlay(overlay === "palette" ? null : "palette")
        return
      }
      if (mod && e.key === "/") {
        e.preventDefault()
        setOverlay(overlay === "shortcuts" ? null : "shortcuts")
        return
      }
      if (e.key === "?" && !mod && !isTyping(e.target)) {
        e.preventDefault()
        setOverlay("shortcuts")
      }
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [])

  return (
    <>
      <CommandDialog
        open={current === "palette"}
        onOpenChange={(open) => setOverlay(open ? "palette" : null)}
        title="Comandi"
        description="Cerca un comando, un file o un'azione"
        // sul telefono in alto: la tastiera virtuale occupa la metà di sotto
        className="top-[max(1rem,env(safe-area-inset-top))] sm:top-1/3 sm:max-w-xl"
      >
        {current === "palette" ? (
          <PaletteBody onNavigate={(href) => router.push(href)} />
        ) : null}
      </CommandDialog>
      <ShortcutsDialog
        open={current === "shortcuts"}
        onOpenChange={(open) => setOverlay(open ? "shortcuts" : null)}
      />
    </>
  )
}

function PaletteBody({ onNavigate }: { onNavigate: (href: Route) => void }) {
  // la fotografia si prende all'apertura: i comandi non cambiano mentre si cerca
  const [snapshot] = React.useState(() => {
    const page = [...sources.values()].flatMap((s) => s.current())
    const files = getWorkspace()
      .files.filter((f) => !f.deletedAt)
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 60)
    return { page, files, recent: readRecent() }
  })

  const global: PaletteCommand[] = [
    {
      id: "app.new-board",
      label: "Nuova board",
      group: "Generale",
      icon: <Shapes />,
      keywords: ["crea", "diagramma", "lavagna"],
      run: () =>
        onNavigate(
          fileHref({ kind: "board", id: getWorkspace().createFile("board") })
        ),
    },
    {
      id: "app.new-doc",
      label: "Nuovo documento",
      group: "Generale",
      icon: <Plus />,
      keywords: ["crea", "word", "testo"],
      run: () =>
        onNavigate(
          fileHref({ kind: "doc", id: getWorkspace().createFile("doc") })
        ),
    },
    {
      id: "app.import",
      label: "Importa Word, Markdown o spazio di lavoro…",
      group: "Generale",
      icon: <FileUp />,
      keywords: ["docx", "md", "apri", "carica"],
      run: () => pickAndImport(onNavigate),
    },
    {
      id: "app.export-workspace",
      label: "Esporta tutto lo spazio di lavoro (.json)",
      group: "Generale",
      icon: <Download />,
      keywords: ["backup", "copia", "salva", "esporta"],
      run: () => {
        const blob = new Blob([exportWorkspace()], { type: "application/json" })
        download(blob, `cogniva-${new Date().toISOString().slice(0, 10)}.json`)
      },
    },
    {
      id: "app.home",
      label: "Vai a tutti i file",
      group: "Generale",
      icon: <House />,
      keywords: ["home", "inizio", "cestino"],
      run: () => onNavigate("/"),
    },
    {
      id: "app.shortcuts",
      label: "Scorciatoie da tastiera",
      group: "Generale",
      icon: <Keyboard />,
      shortcut: "?",
      keywords: ["tasti", "aiuto"],
      run: openShortcuts,
    },
    {
      id: "theme.light",
      label: "Tema chiaro",
      group: "Aspetto",
      icon: <Sun />,
      run: () => setThemePreference("light"),
    },
    {
      id: "theme.dark",
      label: "Tema scuro",
      group: "Aspetto",
      icon: <Moon />,
      run: () => setThemePreference("dark"),
    },
    {
      id: "theme.system",
      label: "Tema di sistema",
      group: "Aspetto",
      icon: <Monitor />,
      run: () => setThemePreference("system"),
    },
  ]

  const all = [...snapshot.page, ...global]
  const byId = new Map(all.map((c) => [c.id, c]))
  const recent = snapshot.recent
    .map((id) => byId.get(id))
    .filter((c): c is PaletteCommand => Boolean(c))

  const groups = new Map<string, PaletteCommand[]>()
  for (const command of all) {
    const list = groups.get(command.group) ?? []
    list.push(command)
    groups.set(command.group, list)
  }

  const run = (command: PaletteCommand) => {
    const next = [
      command.id,
      ...snapshot.recent.filter((id) => id !== command.id),
    ]
    writeStorage(STORAGE.commands, JSON.stringify(next.slice(0, RECENT_LIMIT)))
    setOverlay(null)
    // prima si chiude la finestra e il fuoco torna dov'era, poi si agisce:
    // un comando che sposta il cursore nel documento non viene annullato
    window.setTimeout(command.run, 40)
  }

  const item = (command: PaletteCommand, prefix = "") => (
    <CommandItem
      key={prefix + command.id}
      value={`${prefix}${command.label}${ID_SEPARATOR}${command.id}`}
      keywords={[command.group, ...(command.keywords ?? [])]}
      onSelect={() => run(command)}
    >
      {command.icon ?? <span className="size-4" />}
      <span className="truncate">{command.label}</span>
      {command.shortcut ? (
        <CommandShortcut>{command.shortcut}</CommandShortcut>
      ) : null}
    </CommandItem>
  )

  return (
    <Command loop filter={score}>
      <CommandInput autoFocus placeholder="Cerca comandi e file…" />
      <CommandList className="max-h-[min(60dvh,440px)]">
        <CommandEmpty>Nessun risultato.</CommandEmpty>
        {recent.length ? (
          <CommandGroup heading="Usati di recente">
            {recent.map((c) => item(c, "recent:"))}
          </CommandGroup>
        ) : null}
        {[...groups].map(([group, commands]) => (
          <CommandGroup key={group} heading={group}>
            {commands.map((c) => item(c))}
          </CommandGroup>
        ))}
        {snapshot.files.length ? (
          <CommandGroup heading="File">
            {snapshot.files.map((f) => (
              <CommandItem
                key={f.id}
                value={`${f.title}${ID_SEPARATOR}${f.id}`}
                keywords={[f.kind === "board" ? "board" : "documento"]}
                onSelect={() => {
                  setOverlay(null)
                  onNavigate(fileHref(f))
                }}
              >
                <Glyph name={f.icon} size={16} strokeWidth={1.9} />
                <span className="truncate">{f.title}</span>
                <CommandShortcut className="tracking-normal">
                  {f.kind === "board" ? "Board" : "Documento"}
                </CommandShortcut>
              </CommandItem>
            ))}
          </CommandGroup>
        ) : null}
      </CommandList>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-[11px] text-muted-foreground pointer-coarse:hidden">
        <span className="flex items-center gap-1">
          <Kbd>↑</Kbd>
          <Kbd>↓</Kbd> per scegliere
        </span>
        <span className="flex items-center gap-1">
          <Kbd>↵</Kbd> per eseguire
        </span>
        <span className="ml-auto flex items-center gap-1">
          <Kbd>esc</Kbd> per chiudere
        </span>
      </div>
    </Command>
  )
}

/* ------------------------------ scorciatoie ------------------------------ */

const SHORTCUTS: { title: string; items: [string, string][] }[] = [
  {
    title: "Ovunque",
    items: [
      ["⌘ K", "Palette dei comandi"],
      ["?", "Questa finestra"],
      ["⌘ /", "Scorciatoie da tastiera"],
    ],
  },
  {
    title: "Board",
    items: [
      ["V", "Seleziona"],
      ["H  ·  Spazio", "Mano, sposta la vista"],
      ["R  ·  O  ·  D", "Rettangolo, ellisse, rombo"],
      ["S  ·  T", "Nota, testo"],
      ["C", "Collega con una freccia"],
      ["F  ·  G", "Frame, sezione"],
      ["B  ·  K", "Tabella, grafico"],
      ["P  ·  E", "Penna, gomma"],
      ["Invio", "Scrivi nell'elemento selezionato"],
      ["Frecce  ·  ⇧ Frecce", "Sposta di 1 o 10 px"],
      ["⌘ D", "Duplica"],
      ["⌘ C  ·  ⌘ X  ·  ⌘ V", "Copia, taglia, incolla"],
      ["⌘ ]  ·  ⌘ [", "Porta avanti, manda indietro"],
      ["⌘ A", "Seleziona tutto"],
      ["⌘ Z  ·  ⇧ ⌘ Z", "Annulla, ripristina"],
      ["⌫", "Elimina la selezione"],
    ],
  },
  {
    title: "Documento",
    items: [
      ["⌘ B  ·  ⌘ I  ·  ⌘ U", "Grassetto, corsivo, sottolineato"],
      ["⌘ ⇧ S  ·  ⌘ ⇧ H", "Barrato, evidenziato"],
      ["⌘ .  ·  ⌘ ,", "Apice, pedice"],
      [
        "⌘ ⇧ L  ·  E  ·  R  ·  J",
        "Allinea a sinistra, al centro, a destra, giustifica",
      ],
      ["⌘ ⌥ 1 … 3", "Titolo 1, 2, 3"],
      ["⌘ ⇧ 7  ·  8  ·  9", "Elenco numerato, puntato, di controllo"],
      ["⌘ ⇧ B", "Citazione"],
      ["⌘ F", "Trova e sostituisci"],
      ["⌘ ⇧ V", "Incolla solo il testo"],
      ["⌘ ⌥ F  ·  ⌘ ⌥ D", "Nota a piè di pagina, nota di chiusura"],
      ["⌥ ↑  ·  ⌥ ↓", "Sposta il paragrafo"],
      ["⌘ Invio", "Dal titolo al corpo del testo"],
      ["⌘ +  ·  ⌘ −  ·  ⌘ 0", "Zoom"],
      ["⌥ clic", "Seleziona un'immagine dietro al testo"],
    ],
  },
]

function ShortcutsDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[86dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Scorciatoie da tastiera</DialogTitle>
          <DialogDescription>
            Su Windows e Linux usa Ctrl al posto di ⌘ e Alt al posto di ⌥.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-6 md:grid-cols-3">
          {SHORTCUTS.map((section) => (
            <section key={section.title} className="space-y-2">
              <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                {section.title}
              </h3>
              <dl className="space-y-1.5">
                {section.items.map(([keys, label]) => (
                  <div
                    key={label}
                    className="flex items-start justify-between gap-3 text-[13px]"
                  >
                    <dt className="text-foreground/90">{label}</dt>
                    <dd className="shrink-0 text-right">
                      <Kbd className="h-auto min-h-5 py-0.5 whitespace-nowrap">
                        {keys}
                      </Kbd>
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  )
}
