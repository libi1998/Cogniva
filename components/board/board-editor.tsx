"use client"

import * as React from "react"
import {
  ChartColumn,
  Download,
  FileImage,
  FileText,
  LayoutTemplate,
  Maximize2,
  Minus,
  MousePointer2,
  PanelRight,
  PenLine,
  Plus,
  Redo2,
  Shapes,
  Spline,
  Square,
  StickyNote,
  Table,
  Type,
  Undo2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import {
  BoardCanvas,
  MAX_ZOOM,
  MIN_ZOOM,
  type Selection,
  type Viewport,
} from "./board-canvas"
import { BoardInspector } from "./inspector"
import { BoardToolbar } from "./toolbar"
import type { Tool } from "./tools"
import { useCommandSource } from "@/components/shared/command-palette"
import { TopBar } from "@/components/shared/top-bar"
import { ThemeToggle } from "@/components/shared/theme-toggle"
import { Button } from "@/components/ui/button"
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { getWorkspace, useStore } from "@/lib/store"
import { exportBoard, type ExportFormat } from "@/lib/export-board"
import { AUTO_CANVAS, resolveColor, useIsDark } from "@/lib/use-theme"
import { formatPx } from "@/lib/page"
import { useCollapsingPanel, useNarrow } from "@/lib/use-media"
import type { SwatchKey } from "@/lib/palette"
import type { BoardData, BoardMode } from "@/lib/types"
import { cn } from "@/lib/utils"

const MODES: {
  value: BoardMode
  label: string
  icon: React.ReactNode
  hint: string
}[] = [
  {
    value: "diagram",
    label: "Diagramma",
    icon: <Shapes className="size-4" />,
    hint: "Forme e connettori",
  },
  {
    value: "wireframe",
    label: "Wireframe",
    icon: <LayoutTemplate className="size-4" />,
    hint: "Componenti e frame",
  },
  {
    value: "card",
    label: "Card",
    icon: <StickyNote className="size-4" />,
    hint: "Post-it e card",
  },
]

/**
 * Esporta fuori dal componente: il React Compiler non gestisce ancora
 * `try … finally`, e un blocco così dentro al componente gli faceva saltare
 * l'ottimizzazione di tutto l'editor.
 */
async function runExport(
  format: ExportFormat,
  data: BoardData,
  title: string,
  background: string
) {
  const id = toast.loading(
    format === "pdf" ? "Preparo il PDF…" : `Esporto in ${format.toUpperCase()}…`
  )
  try {
    // lascia respirare l'interfaccia (via timeout: rAF non scatta a scheda nascosta)
    await new Promise((r) => setTimeout(r, 60))
    await exportBoard({ data, title, format, background })
    if (format === "pdf") {
      toast.success("PDF pronto", {
        id,
        description: "Nella finestra di stampa scegli «Salva come PDF».",
      })
    } else {
      toast.success(`Esportato in ${format.toUpperCase()}`, { id })
    }
  } catch (err) {
    console.error(err)
    toast.error("Esportazione non riuscita", {
      id,
      description: err instanceof Error ? err.message : undefined,
    })
  }
}

export function BoardEditor({ fileId }: { fileId: string }) {
  const file = useStore((s) => s.files.find((f) => f.id === fileId))
  const historyTick = useStore((s) => s.historyTick)
  const dark = useIsDark()
  const viewportRef = React.useRef<HTMLDivElement>(null)

  const [tool, setTool] = React.useState<Tool>({ t: "select" })
  const [selection, setSelection] = React.useState<Selection>({
    nodes: [],
    edges: [],
  })
  // ≥ 1180: pannello nella colonna · 640–1180: galleggia sopra il canvas ·
  // < 640: foglio dal basso, come sui telefoni
  const narrow = useNarrow(1180)
  const compact = useNarrow(639)
  const [panel, setPanel] = useCollapsingPanel(useNarrow(900))
  const [busy, setBusy] = React.useState(false)
  const [vp, setVp] = React.useState<Viewport>(
    () =>
      (file && file.kind === "board" && file.data.viewport) || {
        x: 80,
        y: 60,
        zoom: 1,
      }
  )
  // il pannello non deve rincorrere ogni fotogramma di un trascinamento: React
  // lo ridisegna quando ha tempo, il canvas resta fluido
  const data = file?.kind === "board" ? file.data : null
  const panelData = React.useDeferredValue(data)

  React.useEffect(() => {
    const t = setTimeout(() => getWorkspace().setViewport(fileId, vp), 400)
    return () => clearTimeout(t)
  }, [vp, fileId])

  const doExport = async (format: ExportFormat) => {
    const current = getWorkspace().files.find((f) => f.id === fileId)
    if (!current || current.kind !== "board") return
    setSelection({ nodes: [], edges: [] })
    setBusy(true)
    await runExport(
      format,
      current.data,
      current.title,
      resolveColor(current.data.theme.background, dark, AUTO_CANVAS)
    )
    setBusy(false)
  }

  const viewportSize = () => {
    const rect = viewportRef.current?.getBoundingClientRect()
    return { width: rect?.width || 1200, height: rect?.height || 800 }
  }

  const fit = () => {
    const current = getWorkspace().files.find((f) => f.id === fileId)
    if (!current || current.kind !== "board") return
    const board = current.data
    const page = formatPx(board.theme.page.format, board.theme.page.orientation)
    if (!page && !board.nodes.length) {
      setVp({ x: 80, y: 60, zoom: 1 })
      return
    }
    // con una pagina impostata si inquadra il foglio, altrimenti il contenuto
    let minX = page ? 0 : Infinity
    let minY = page ? -30 : Infinity
    let maxX = page ? page.w : -Infinity
    let maxY = page ? page.h : -Infinity
    if (!page) {
      for (const n of board.nodes) {
        minX = Math.min(minX, n.x)
        minY = Math.min(minY, n.y)
        maxX = Math.max(maxX, n.x + n.w)
        maxY = Math.max(maxY, n.y + n.h)
      }
    }
    const { width, height } = viewportSize()
    // margini proporzionati allo schermo: 200px fissi su un telefono
    // lasciavano pochissimo spazio al contenuto
    const padX = Math.min(200, width * 0.16)
    const padY = Math.min(160, height * 0.16)
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min(
          (width - padX) / (maxX - minX || 1),
          (height - padY) / (maxY - minY || 1)
        )
      )
    )
    setVp({
      zoom,
      x: width / 2 - ((minX + maxX) / 2) * zoom,
      y: height / 2 - ((minY + maxY) / 2) * zoom,
    })
  }

  const zoomBy = (f: number) => {
    const { width, height } = viewportSize()
    setVp((v) => {
      const next = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.zoom * f))
      const cx = width / 2
      const cy = height / 2
      const wx = (cx - v.x) / v.zoom
      const wy = (cy - v.y) / v.zoom
      return { zoom: next, x: cx - wx * next, y: cy - wy * next }
    })
  }

  // i comandi della board nella palette (⌘K)
  useCommandSource("board", () => {
    const current = getWorkspace().files.find((f) => f.id === fileId)
    if (!current || current.kind !== "board") return []
    const group = "Board"
    const tools = "Strumenti"
    const exportGroup = "Esporta"
    const pick = (
      label: string,
      next: Tool,
      key: string,
      icon: React.ReactNode
    ) => ({
      id: `board.tool.${key}`,
      group: tools,
      label,
      shortcut: key.toUpperCase(),
      icon,
      run: () => setTool(next),
    })
    return [
      {
        id: "board.undo",
        group,
        label: "Annulla",
        shortcut: "⌘Z",
        icon: <Undo2 />,
        run: () => getWorkspace().undo(fileId),
      },
      {
        id: "board.redo",
        group,
        label: "Ripristina",
        shortcut: "⇧⌘Z",
        icon: <Redo2 />,
        run: () => getWorkspace().redo(fileId),
      },
      {
        id: "board.fit",
        group,
        label: "Adatta alla finestra",
        icon: <Maximize2 />,
        keywords: ["zoom", "inquadra"],
        run: fit,
      },
      {
        id: "board.zoom100",
        group,
        label: "Zoom al 100%",
        icon: <Plus />,
        run: () => setVp((v) => ({ ...v, zoom: 1 })),
      },
      {
        id: "board.panel",
        group,
        label: panel
          ? "Nascondi il pannello Stile"
          : "Mostra il pannello Stile",
        icon: <PanelRight />,
        run: () => setPanel(!panel),
      },
      {
        id: "board.select-all",
        group,
        label: "Seleziona tutto",
        shortcut: "⌘A",
        icon: <Shapes />,
        run: () =>
          setSelection({
            nodes: current.data.nodes.map((n) => n.id),
            edges: current.data.edges.map((e) => e.id),
          }),
      },
      ...MODES.map((m) => ({
        id: `board.mode.${m.value}`,
        group,
        label: `Modalità ${m.label.toLowerCase()}`,
        icon: m.icon,
        keywords: [m.hint],
        run: () => getWorkspace().setBoardTheme(fileId, { mode: m.value }),
      })),
      pick("Seleziona", { t: "select" }, "v", <MousePointer2 />),
      pick("Rettangolo", { t: "shape", shape: "rounded" }, "r", <Square />),
      pick("Nota", { t: "shape", shape: "note" }, "s", <StickyNote />),
      pick("Testo", { t: "shape", shape: "text" }, "t", <Type />),
      pick("Connettore", { t: "connect" }, "c", <Spline />),
      pick("Tabella", { t: "table" }, "b", <Table />),
      pick("Grafico", { t: "chart" }, "k", <ChartColumn />),
      pick("Penna", { t: "draw", mode: "pen" }, "p", <PenLine />),
      {
        id: "board.export.png",
        group: exportGroup,
        label: "Esporta in PNG",
        icon: <FileImage />,
        run: () => void doExport("png"),
      },
      {
        id: "board.export.svg",
        group: exportGroup,
        label: "Esporta in SVG",
        icon: <FileImage />,
        run: () => void doExport("svg"),
      },
      {
        id: "board.export.pdf",
        group: exportGroup,
        label: "Esporta in PDF",
        icon: <FileText />,
        run: () => void doExport("pdf"),
      },
    ]
  })

  if (!data || !panelData) return null

  // la cronologia vive fuori da React: il contatore dice quando rileggerla
  const canUndo = historyTick >= 0 && getWorkspace().canUndo(fileId)
  const canRedo = historyTick >= 0 && getWorkspace().canRedo(fileId)
  const mode = data.theme.mode
  const currentMode = MODES.find((m) => m.value === mode)

  const inspector = (
    <BoardInspector
      fileId={fileId}
      data={panelData}
      selection={selection}
      setSelection={setSelection}
    />
  )

  return (
    <div className="flex h-dvh flex-col bg-muted">
      <TopBar
        fileId={fileId}
        right={
          <>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 gap-1.5 px-2 text-xs sm:px-2.5"
                    aria-label={`Modalità: ${currentMode?.label}`}
                  />
                }
              >
                {currentMode?.icon}
                <span className="hidden md:inline">{currentMode?.label}</span>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Modalità della board</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {MODES.map((m) => (
                  <DropdownMenuItem
                    key={m.value}
                    onClick={() =>
                      getWorkspace().setBoardTheme(fileId, { mode: m.value })
                    }
                    className={cn(
                      mode === m.value && "bg-accent text-accent-foreground"
                    )}
                  >
                    {m.icon}
                    <div className="flex flex-col">
                      <span>{m.label}</span>
                      <span className="text-[11px] text-muted-foreground">
                        {m.hint}
                      </span>
                    </div>
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>

            <div className="mx-1 hidden h-5 w-px bg-border sm:block" />

            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Annulla"
                    disabled={!canUndo}
                    onClick={() => getWorkspace().undo(fileId)}
                  />
                }
              >
                <Undo2 className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Annulla ⌘Z</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Ripristina"
                    disabled={!canRedo}
                    onClick={() => getWorkspace().redo(fileId)}
                  />
                }
              >
                <Redo2 className="size-4" />
              </TooltipTrigger>
              <TooltipContent>Ripristina ⇧⌘Z</TooltipContent>
            </Tooltip>

            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-8"
                    aria-label="Esporta"
                    disabled={busy}
                  />
                }
              >
                <Download className="size-4" />
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-44">
                <DropdownMenuLabel>Esporta board</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => doExport("png")}>
                  <FileImage className="size-4" /> PNG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport("svg")}>
                  <FileImage className="size-4" /> SVG
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => doExport("pdf")}>
                  <FileText className="size-4" />
                  <div className="flex flex-col">
                    <span>PDF</span>
                    <span className="text-[11px] text-muted-foreground">
                      vettoriale, dalla stampa
                    </span>
                  </div>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <ThemeToggle className="hidden sm:flex" />

            <Button
              variant={panel ? "secondary" : "ghost"}
              size="sm"
              className="h-8 gap-1.5 px-2 text-xs sm:px-2.5"
              aria-label="Pannello Stile"
              aria-pressed={panel}
              onClick={() => setPanel(!panel)}
            >
              <PanelRight className="size-4" />
              <span className="hidden sm:inline">Stile</span>
            </Button>
          </>
        }
      />

      <div className="relative flex min-h-0 flex-1">
        <div ref={viewportRef} className="relative min-w-0 flex-1">
          <BoardCanvas
            fileId={fileId}
            data={data}
            tool={tool}
            setTool={setTool}
            selection={selection}
            setSelection={setSelection}
            vp={vp}
            setVp={setVp}
            dark={dark}
          />

          <BoardToolbar
            tool={tool}
            onTool={setTool}
            mode={mode}
            color={data.theme.defaultColor}
            onColor={(c: SwatchKey) => {
              const store = getWorkspace()
              if (selection.nodes.length) {
                store.snapshot(fileId)
                store.updateNodes(fileId, selection.nodes, { color: c })
              }
              store.setBoardTheme(fileId, { defaultColor: c })
            }}
          />

          <div className="pointer-events-auto absolute bottom-[max(0.75rem,env(safe-area-inset-bottom))] left-[max(0.75rem,env(safe-area-inset-left))] z-20 flex items-center gap-0.5 rounded-xl border border-black/5 bg-card/95 p-1 shadow-[0_8px_28px_-8px_rgba(9,9,11,0.16)] backdrop-blur sm:bottom-4 sm:left-4 dark:border-white/10 dark:shadow-[0_8px_28px_-8px_rgba(0,0,0,0.6)]">
            <button
              type="button"
              onClick={() => zoomBy(1 / 1.2)}
              aria-label="Riduci"
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted pointer-coarse:size-9"
            >
              <Minus className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => setVp((v) => ({ ...v, zoom: 1 }))}
              title="Zoom al 100%"
              className="min-w-[52px] rounded-lg px-1 py-1 text-xs font-medium text-foreground tabular-nums hover:bg-muted"
            >
              {Math.round(vp.zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={() => zoomBy(1.2)}
              aria-label="Ingrandisci"
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted pointer-coarse:size-9"
            >
              <Plus className="size-4" />
            </button>
            <div className="mx-0.5 h-4 w-px bg-border" />
            <button
              type="button"
              onClick={fit}
              title="Adatta alla vista"
              aria-label="Adatta alla vista"
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted pointer-coarse:size-9"
            >
              <Maximize2 className="size-4" />
            </button>
          </div>

          <div className="pointer-events-none absolute bottom-4 left-1/2 z-10 hidden max-w-[calc(100%-26rem)] -translate-x-1/2 truncate rounded-full bg-card/80 px-3 py-1 text-[11px] text-muted-foreground shadow-sm backdrop-blur pointer-fine:xl:block">
            doppio clic per creare · trascina i pallini per collegare · tasto
            destro per il menu · spazio + trascina per spostarti
          </div>
        </div>

        {compact ? (
          panel ? (
            <aside
              aria-label="Stile"
              className="fixed inset-x-0 bottom-0 z-40 flex max-h-[min(70dvh,560px)] flex-col overflow-hidden rounded-t-2xl border-t border-border bg-card pb-[env(safe-area-inset-bottom)] shadow-[0_-12px_40px_-12px_rgba(0,0,0,0.35)]"
            >
              <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
                <span className="text-sm font-semibold">Stile</span>
                <button
                  type="button"
                  onClick={() => setPanel(false)}
                  aria-label="Chiudi il pannello"
                  className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                >
                  <X className="size-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1">{inspector}</div>
            </aside>
          ) : null
        ) : (
          <aside
            className={cn(
              "shrink-0 border-l border-border bg-card",
              // sotto i 1180px il pannello galleggia sopra il canvas invece di
              // rubargli un terzo della larghezza
              narrow
                ? panel
                  ? "absolute inset-y-0 right-0 z-20 w-[272px] shadow-xl"
                  : "hidden"
                : cn(
                    "transition-[width] duration-200",
                    panel ? "w-[272px]" : "w-0 overflow-hidden"
                  )
            )}
          >
            {panel ? inspector : null}
          </aside>
        )}
      </div>
    </div>
  )
}
