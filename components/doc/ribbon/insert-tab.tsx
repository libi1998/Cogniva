"use client"

import * as React from "react"
import {
  BookMarked,
  CalendarDays,
  ChartColumnBig,
  CaseUpper,
  FileInput,
  FilePlus2,
  Hash,
  Image as ImageIcon,
  Link2,
  MessageSquarePlus,
  Minus,
  MonitorUp,
  Network,
  Omega,
  PanelBottom,
  PanelTop,
  PenLine,
  Puzzle,
  RectangleHorizontal,
  Shapes,
  Sigma,
  Smile,
  Sparkles,
  SquareDashedText,
  SquareSplitVertical,
  Star,
  Table2,
  TextQuote,
  Trash2,
  Video,
  WholeWord,
} from "lucide-react"
import { toast } from "sonner"
import {
  Box,
  Circle,
  Cone,
  Cylinder,
  Diamond,
  Gem,
  Globe,
  Infinity as InfinityIcon,
  Pentagon,
  Pill,
  Pyramid,
  Rotate3d,
  Torus,
} from "lucide-react"
import {
  MODEL_ACCEPT,
  readModelFile,
  safeModelSrc,
  SHAPES_3D,
  type Shape3D,
} from "@/lib/model3d/catalog"
import { useShallow } from "zustand/react/shallow"
import { Fragment } from "@tiptap/pm/model"
import type { JSONContent } from "@tiptap/core"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Glyph } from "@/components/board/glyph"
import { getAuthor } from "@/lib/author"
import { hasCover, listBookmarks, TEXT_BOX_PRESETS } from "@/lib/doc-fields"
import {
  COVER_DESIGNS,
  coverContent,
  iconSvg,
  SHAPE_GROUPS,
  shapeSvg,
  smartArtBoard,
  SMARTART_TEMPLATES,
  WORDART_PRESETS,
  wordArtContent,
} from "@/lib/doc-inserts"
import { importDocumentFile } from "@/lib/import-doc"
import {
  FOOTER_PRESETS,
  HEADER_PRESETS,
  PAGE_NUMBER_FORMATS,
} from "@/lib/header-footer"
import { docAccent } from "@/lib/palette"
import { getWorkspace, useStore } from "@/lib/store"
import { docTitleText } from "@/lib/tiptap-extensions"
import type { PageNumberPosition } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  RibbonRows,
  useCloseRibbonMenu,
} from "./ribbon-ui"
import { EMOJI, SYMBOLS, atBody, type RibbonCtx } from "./shared"
import { BUILTIN_EQUATIONS, mathHtml } from "../math-node"
import { parseVideo } from "../video-node"
import {
  BookmarkDialog,
  CrossRefDialog,
  DateTimeDialog,
  DropCapDialog,
  FieldDialog,
  HeaderFooterDialog,
  IconsDialog,
  SignatureDialog,
  SmartArtDialog,
  SymbolDialog,
} from "../insert-dialogs"
import { CHART_ICONS } from "@/components/shared/chart-editor"
import { CHART_TYPES } from "@/lib/chart"

/** Griglia per scegliere righe e colonne passandoci sopra, come in Word */
function TableGrid({
  onPick,
}: {
  onPick: (rows: number, cols: number) => void
}) {
  const [hover, setHover] = React.useState({ r: 0, c: 0 })
  const close = useCloseRibbonMenu()
  return (
    <div className="p-2">
      <p className="mb-1.5 text-xs text-muted-foreground">
        {hover.r && hover.c
          ? `Tabella ${hover.c}×${hover.r}`
          : "Inserisci tabella"}
      </p>
      <div
        className="grid gap-[3px]"
        style={{ gridTemplateColumns: "repeat(10, 16px)" }}
        onMouseLeave={() => setHover({ r: 0, c: 0 })}
      >
        {Array.from({ length: 80 }).map((_, i) => {
          const r = Math.floor(i / 10) + 1
          const c = (i % 10) + 1
          const on = r <= hover.r && c <= hover.c
          return (
            <button
              key={i}
              type="button"
              aria-label={`${c} colonne per ${r} righe`}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setHover({ r, c })}
              onClick={() => {
                onPick(r, c)
                close?.()
              }}
              className={cn(
                "size-4 rounded-[3px] border transition-colors",
                on
                  ? "border-primary bg-primary/30"
                  : "border-border bg-background"
              )}
            />
          )
        })}
      </div>
    </div>
  )
}

function LinkPopover({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st } = ctx
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")
  // i segnalibri si leggono all'apertura: sono i punti del documento
  const [bookmarks, setBookmarks] = React.useState<
    ReturnType<typeof listBookmarks>
  >([])

  const apply = () => {
    const href = url.trim()
    if (!href) editor.chain().focus().extendMarkRange("link").unsetLink().run()
    else {
      const full = /^[a-z]+:|^\/|^#/i.test(href) ? href : `https://${href}`
      editor
        .chain()
        .focus()
        .extendMarkRange("link")
        .setLink({ href: full })
        .run()
    }
    setOpen(false)
  }

  return (
    <Popover
      open={open}
      onOpenChange={(v) => {
        setOpen(v)
        if (v) {
          setUrl(String(editor.getAttributes("link").href ?? ""))
          setBookmarks(listBookmarks(editor.state))
        }
      }}
    >
      <PopoverTrigger
        render={
          <RibbonButton
            large
            label="Collegamento"
            title="Inserisci collegamento"
            active={st.link}
            icon={<Link2 className="size-5" />}
          />
        }
      />
      <PopoverContent
        align="start"
        className="w-72 space-y-2 p-3"
        finalFocus={false}
      >
        <p className="text-xs font-medium">Indirizzo del collegamento</p>
        <Input
          autoFocus
          value={url}
          placeholder="https://…"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="h-8 text-xs"
        />
        {bookmarks.length ? (
          <div className="space-y-1">
            <p className="text-[11px] text-muted-foreground">
              Posizione nel documento
            </p>
            <div className="max-h-32 overflow-y-auto rounded-md border border-border">
              {bookmarks.map((b) => (
                <button
                  key={b.name}
                  type="button"
                  onClick={() => setUrl(`#bm-${b.name}`)}
                  className={cn(
                    "block w-full truncate px-2 py-1 text-left text-xs hover:bg-muted",
                    url === `#bm-${b.name}` && "bg-accent"
                  )}
                >
                  {b.name}
                  <span className="ml-1.5 text-muted-foreground">{b.text}</span>
                </button>
              ))}
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-1.5">
          {st.link ? (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs"
              onClick={() => {
                setUrl("")
                editor.chain().focus().extendMarkRange("link").unsetLink().run()
                setOpen(false)
              }}
            >
              Rimuovi
            </Button>
          ) : null}
          <Button size="sm" className="h-7 text-xs" onClick={apply}>
            Applica
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function VideoPopover({ ctx }: { ctx: RibbonCtx }) {
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")
  const info = url.trim() ? parseVideo(url) : null

  const apply = () => {
    if (!info) return
    ctx.openPanel()
    atBody(ctx.editor, ctx.st).insertVideo(url.trim()).run()
    setOpen(false)
    setUrl("")
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <RibbonButton
            large
            label="Video online"
            title="YouTube, Vimeo, Loom, Dailymotion o un file video"
            icon={<Video className="size-5" />}
          />
        }
      />
      <PopoverContent
        align="start"
        className="w-80 space-y-2 p-3"
        finalFocus={false}
      >
        <p className="text-xs font-medium">Indirizzo del video</p>
        <Input
          autoFocus
          value={url}
          placeholder="https://www.youtube.com/watch?v=…"
          onChange={(e) => setUrl(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && apply()}
          className="h-8 text-xs"
        />
        <p className="text-[11px] leading-snug text-muted-foreground">
          {url.trim()
            ? info
              ? `Video ${info.provider === "File" ? "da file" : `di ${info.provider}`} riconosciuto`
              : "Indirizzo non riconosciuto"
            : "Incolla il link di YouTube, Vimeo, Loom, Dailymotion o di un file .mp4"}
        </p>
        <div className="flex justify-end">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!info}
            onClick={apply}
          >
            Inserisci
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const PAGE_NUMBERS: { value: PageNumberPosition; label: string }[] = [
  { value: "top-left", label: "Inizio pagina, a sinistra" },
  { value: "top-center", label: "Inizio pagina, al centro" },
  { value: "top-right", label: "Inizio pagina, a destra" },
  { value: "bottom-left", label: "Fine pagina, a sinistra" },
  { value: "bottom-center", label: "Fine pagina, al centro" },
  { value: "bottom-right", label: "Fine pagina, a destra" },
]

type InsertDialog =
  | "bookmark"
  | "crossref"
  | "datetime"
  | "field"
  | "signature"
  | "symbols"
  | "icons"
  | "smartart"
  | "dropcap"
  | "header"
  | "footer"
  | null

/** Una schermata di una finestra o dello schermo, come immagine */
async function captureScreen(): Promise<string | null> {
  if (!navigator.mediaDevices?.getDisplayMedia) {
    toast.error("Il browser non permette di catturare lo schermo")
    return null
  }
  let stream: MediaStream | null = null
  try {
    stream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: false,
    })
    const video = document.createElement("video")
    video.srcObject = stream
    video.muted = true
    await video.play()
    // un fotogramma disegnato per davvero, non quello nero dell'avvio
    await new Promise((resolve) => setTimeout(resolve, 250))
    const scale = Math.min(1, 1920 / (video.videoWidth || 1920))
    const canvas = document.createElement("canvas")
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext("2d")?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL("image/jpeg", 0.9)
  } catch (error) {
    // chi annulla la scelta della finestra non ha fatto niente di sbagliato
    if (!(error instanceof DOMException && error.name === "NotAllowedError")) {
      toast.error("Schermata non riuscita")
    }
    return null
  } finally {
    stream?.getTracks().forEach((track) => track.stop())
  }
}

/** «Testo da file»: i blocchi di un documento, col titolo come Titolo 1 */
async function readDocNodes(file: File) {
  const { file: imported } = await importDocumentFile(file)
  const doc =
    imported.kind === "doc"
      ? (imported.data.content as { content?: JSONContent[] } | null)
      : null
  return (doc?.content ?? []).map((node) =>
    node.type === "docTitle"
      ? { ...node, type: "heading", attrs: { level: 1 } }
      : node
  )
}

/** Griglia di pulsanti dentro un menu della barra, che si chiude da sola */
function MenuGrid({
  columns,
  children,
}: {
  columns: number
  children: React.ReactNode
}) {
  return (
    <div
      className="grid gap-1 p-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </div>
  )
}

function GridButton({
  title,
  onPick,
  className,
  children,
}: {
  title: string
  onPick: () => void
  className?: string
  children: React.ReactNode
}) {
  const close = useCloseRibbonMenu()
  return (
    <button
      type="button"
      title={title}
      aria-label={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => {
        onPick()
        close?.()
      }}
      className={cn(
        "flex items-center justify-center rounded-md border border-transparent transition hover:border-border hover:bg-muted",
        className
      )}
    >
      {children}
    </button>
  )
}

const SHAPE_ICONS: Record<Shape3D, React.ReactNode> = {
  cube: <Box className="size-5" />,
  sphere: <Globe className="size-5" />,
  cylinder: <Cylinder className="size-5" />,
  cone: <Cone className="size-5" />,
  pyramid: <Pyramid className="size-5" />,
  torus: <Torus className="size-5" />,
  knot: <InfinityIcon className="size-5" />,
  capsule: <Pill className="size-5" />,
  gem: <Gem className="size-5" />,
  dodecahedron: <Pentagon className="size-5" />,
  octahedron: <Diamond className="size-5" />,
  ring: <Circle className="size-5" />,
}

/** «Modelli 3D»: un file glTF dal dispositivo o dal web, o una forma pronta */
function Models3DMenu({ ctx, accent }: { ctx: RibbonCtx; accent: string }) {
  const input = React.useRef<HTMLInputElement>(null)
  const insert = (
    attrs: Parameters<RibbonCtx["editor"]["commands"]["insertModel3d"]>[0]
  ) => {
    ctx.openPanel()
    atBody(ctx.editor, ctx.st).insertModel3d(attrs).run()
  }
  return (
    <>
      <input
        ref={input}
        type="file"
        accept={MODEL_ACCEPT}
        className="hidden"
        aria-label="Scegli un modello 3D"
        data-testid="model3d-file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          readModelFile(file)
            .then((src) => insert({ src, name: file.name }))
            .catch((error: unknown) =>
              toast.error(
                error instanceof Error ? error.message : "File non valido"
              )
            )
        }}
      />
      <RibbonMenu
        className="w-[232px]"
        trigger={
          <RibbonButton
            large
            chevron
            label="Modelli 3D"
            title="Modelli glTF da ruotare nel documento, o forme 3D pronte"
            icon={<Rotate3d className="size-5" />}
          />
        }
      >
        <DropdownMenuItem onClick={() => input.current?.click()}>
          Da questo dispositivo… (.glb, .gltf)
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const url = window.prompt(
              "Indirizzo del modello (.glb)",
              "https://"
            )
            const src = url ? safeModelSrc(url) : ""
            if (src) insert({ src, name: src.split("/").pop() ?? "" })
            else if (url)
              toast.error("Serve un indirizzo https a un file .glb o .gltf")
          }}
        >
          Da un indirizzo web…
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>Forme 3D</DropdownMenuLabel>
        <MenuGrid columns={4}>
          {SHAPES_3D.map((shape) => (
            <GridButton
              key={shape.value}
              title={shape.label}
              className="h-12 flex-col gap-0.5 text-[10px] text-muted-foreground"
              onPick={() =>
                insert({ shape: shape.value, color: accent, name: shape.label })
              }
            >
              {SHAPE_ICONS[shape.value]}
              {shape.label}
            </GridButton>
          ))}
        </MenuGrid>
      </RibbonMenu>
    </>
  )
}

export function InsertTab({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st, theme, setTheme } = ctx
  const boards = useStore(
    useShallow((s) => s.files.filter((f) => f.kind === "board"))
  )
  const [dialog, setDialog] = React.useState<InsertDialog>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const body = () => atBody(editor, st)
  const accent = docAccent(theme.accent)
  const close = () => setDialog(null)

  const today = () =>
    new Date().toLocaleDateString("it-IT", {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  const insertCover = (design: string) => {
    const title = docTitleText(editor.state.doc) ?? ""
    const parts = coverContent(design, {
      title,
      author: getAuthor() || "[Nome dell'autore]",
      date: today(),
    })
    const chain = editor.chain().focus()
    // un solo frontespizio: quello nuovo sostituisce il vecchio
    if (hasCover(editor.state)) chain.removeCover()
    chain
      .command(({ tr, state }) => {
        const schema = state.schema
        let first = tr.doc.firstChild
        if (!first || first.type.name !== "docTitle") {
          tr.insert(
            0,
            schema.nodes.docTitle.create(
              null,
              title ? schema.text(title) : null
            )
          )
          first = tr.doc.firstChild!
        }
        tr.setNodeMarkup(0, undefined, {
          ...first.attrs,
          ...parts.title,
          cover: true,
        })
        tr.insert(
          first.nodeSize,
          Fragment.fromArray(parts.after.map((j) => schema.nodeFromJSON(j)))
        )
        return true
      })
      .scrollIntoView()
      .run()
  }

  const insertImage = (src: string, alt: string, width: string) =>
    body().insertContent({ type: "image", attrs: { src, alt, width } }).run()

  const insertSmartArt = (id: string) => {
    const template = SMARTART_TEMPLATES.find((t) => t.id === id)
    const store = getWorkspace()
    const boardId = store.createFile(
      "board",
      `SmartArt — ${template?.label ?? "Elemento grafico"}`
    )
    const { drafts, edges } = smartArtBoard(id)
    const ids = store.addNodes(
      boardId,
      drafts.map((d) => d.node)
    )
    const byKey = new Map(drafts.map((d, i) => [d.key, ids[i]]))
    for (const edge of edges) {
      const from = byKey.get(edge.from)
      const to = byKey.get(edge.to)
      if (from && to) store.addEdge(boardId, { ...edge, from, to })
    }
    ctx.onInsertBoard(boardId)
    toast.success("SmartArt inserito: aprilo per modificare testi e colori")
  }

  const insertFromFile = (file: File) =>
    readDocNodes(file)
      .then((nodes) => {
        if (nodes.length) body().insertContent(nodes).run()
        else toast.info("Il file non contiene testo da inserire")
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error
            ? error.message
            : "Non riesco a leggere il file"
        )
      )

  return (
    <>
      <RibbonGroup label="Pagine">
        <RibbonMenu
          className="w-[300px]"
          trigger={
            <RibbonButton
              large
              chevron
              label="Frontespizio"
              title="Una prima pagina con titolo, sottotitolo, autore e data"
              icon={<FilePlus2 className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Predefiniti</DropdownMenuLabel>
          <MenuGrid columns={3}>
            {COVER_DESIGNS.map((design) => (
              <GridButton
                key={design.id}
                title={`${design.label}: ${design.hint}`}
                onPick={() => insertCover(design.id)}
                className="flex-col gap-1 p-1"
              >
                <CoverThumb design={design.id} accent={accent.solid} />
                <span className="text-[10px] text-muted-foreground">
                  {design.label}
                </span>
              </GridButton>
            ))}
          </MenuGrid>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={!hasCover(editor.state)}
            onClick={() => editor.chain().focus().removeCover().run()}
          >
            <Trash2 /> Rimuovi frontespizio corrente
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            label="Pagina vuota"
            title="Una pagina bianca nel punto del cursore"
            icon={<RectangleHorizontal className="size-4 rotate-90" />}
            className="justify-start"
            onClick={() =>
              body()
                .insertContent([
                  { type: "pageBreak" },
                  { type: "paragraph" },
                  { type: "pageBreak" },
                ])
                .run()
            }
          />
          <RibbonButton
            compact
            label="Interruzione di pagina"
            title="Il testo riparte dalla pagina successiva ⌘↵"
            icon={<SquareSplitVertical className="size-4" />}
            className="justify-start"
            onClick={() => body().setPageBreak().run()}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Tabelle">
        <RibbonMenu
          className="w-auto"
          trigger={
            <RibbonButton
              large
              chevron
              label="Tabella"
              icon={<Table2 className="size-5" />}
            />
          }
        >
          <TableGrid
            onPick={(rows, cols) =>
              body().insertTable({ rows, cols, withHeaderRow: true }).run()
            }
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={() => {
              const text = editor.state.doc.textBetween(
                editor.state.selection.from,
                editor.state.selection.to,
                "\n"
              )
              const rows = text
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean)
                .map((line) =>
                  line.split(line.includes("\t") ? "\t" : /\s*[;|]\s*/)
                )
              if (rows.length < 1 || rows.every((r) => r.length < 2)) {
                toast.info(
                  "Seleziona righe con le colonne separate da tabulazione, «;» o «|»"
                )
                return
              }
              const cols = Math.max(...rows.map((r) => r.length))
              const cell = (value: string, header: boolean) => ({
                type: header ? "tableHeader" : "tableCell",
                content: [
                  {
                    type: "paragraph",
                    content: value ? [{ type: "text", text: value }] : [],
                  },
                ],
              })
              editor
                .chain()
                .focus()
                .deleteSelection()
                .insertContent({
                  type: "table",
                  content: rows.map((row, r) => ({
                    type: "tableRow",
                    content: Array.from({ length: cols }, (_, c) =>
                      cell(row[c]?.trim() ?? "", r === 0)
                    ),
                  })),
                })
                .run()
            }}
          >
            <Table2 /> Converti testo in tabella
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sparkles /> Tabelle veloci
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {(
                [
                  [
                    "Elenco con intestazioni",
                    ["Voce", "Descrizione", "Stato"],
                    4,
                  ],
                  ["Matrice 3×3", ["", "Colonna A", "Colonna B"], 3],
                  ["Settimana", ["Lun", "Mar", "Mer", "Gio", "Ven"], 2],
                  [
                    "Budget",
                    ["Voce", "Previsto", "Effettivo", "Differenza"],
                    5,
                  ],
                ] as [string, string[], number][]
              ).map(([label, head, rows]) => (
                <DropdownMenuItem
                  key={label}
                  onClick={() =>
                    body()
                      .insertContent({
                        type: "table",
                        content: [
                          {
                            type: "tableRow",
                            content: head.map((h) => ({
                              type: "tableHeader",
                              content: [
                                {
                                  type: "paragraph",
                                  content: h ? [{ type: "text", text: h }] : [],
                                },
                              ],
                            })),
                          },
                          ...Array.from({ length: rows }, () => ({
                            type: "tableRow",
                            content: head.map(() => ({
                              type: "tableCell",
                              content: [{ type: "paragraph" }],
                            })),
                          })),
                        ],
                      })
                      .run()
                  }
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup label="Illustrazioni">
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Immagini"
              icon={<ImageIcon className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={ctx.pickImage}>
            Da questo dispositivo…
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const url = window.prompt("Indirizzo dell'immagine", "https://")
              if (url && /^https:\/\//i.test(url.trim())) {
                body().setImage({ src: url.trim() }).run()
              }
            }}
          >
            Da un indirizzo web…
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-[292px]"
          trigger={
            <RibbonButton
              large
              chevron
              label="Forme"
              icon={<Shapes className="size-5" />}
            />
          }
        >
          <div className="max-h-[60dvh] overflow-y-auto">
            {SHAPE_GROUPS.map((group) => (
              <div key={group.label}>
                <DropdownMenuLabel>{group.label}</DropdownMenuLabel>
                <MenuGrid columns={8}>
                  {group.shapes.map((shape) => {
                    const svg = shapeSvg(shape.kind, accent.fill, accent.solid)
                    return (
                      <GridButton
                        key={shape.kind}
                        title={shape.label}
                        className="size-8"
                        onPick={() => {
                          ctx.openPanel()
                          insertImage(svg.src, shape.label, `${svg.width}%`)
                        }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element -- anteprima SVG in data URI */}
                        <img
                          src={svg.src}
                          alt=""
                          className="max-h-6 max-w-6 object-contain"
                        />
                      </GridButton>
                    )
                  })}
                </MenuGrid>
              </div>
            ))}
          </div>
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            label="Icone"
            icon={<Star className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("icons")}
          />
          <RibbonButton
            compact
            label="SmartArt"
            title="Elenchi, processi, cicli, gerarchie e matrici"
            icon={<Network className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("smartart")}
          />
          <RibbonButton
            compact
            label="Schermata"
            title="Cattura una finestra o lo schermo e inseriscila"
            icon={<MonitorUp className="size-4" />}
            className="justify-start"
            onClick={async () => {
              const src = await captureScreen()
              if (src) {
                ctx.openPanel()
                insertImage(src, "Schermata", "100%")
              }
            }}
          />
        </RibbonRows>
        <RibbonMenu
          className="w-56"
          trigger={
            <RibbonButton
              large
              chevron
              label="Grafico"
              title="Istogrammi, linee, torte e altro: i dati si incollano da Excel"
              icon={<ChartColumnBig className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Inserisci grafico</DropdownMenuLabel>
          {CHART_TYPES.map((type) => (
            <DropdownMenuItem
              key={type.value}
              onClick={() => {
                ctx.openPanel()
                body().insertChart(type.value).run()
              }}
            >
              {CHART_ICONS[type.value]}
              {type.label}
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
        <Models3DMenu ctx={ctx} accent={accent.solid} />
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Board"
              title="Incorpora una board"
              icon={<Puzzle className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Incorpora una board</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {boards.length ? (
            boards.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => ctx.onInsertBoard(b.id)}
              >
                <Glyph name={b.icon} size={15} strokeWidth={1.9} />
                <span className="truncate">{b.title}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>Nessuna board</DropdownMenuItem>
          )}
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup label="Elementi multimediali">
        <VideoPopover ctx={ctx} />
      </RibbonGroup>

      <RibbonGroup label="Collegamenti">
        <LinkPopover ctx={ctx} />
        <RibbonRows>
          <RibbonButton
            compact
            label="Segnalibro"
            icon={<BookMarked className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("bookmark")}
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

      <RibbonGroup label="Commenti">
        <RibbonButton
          large
          label="Commento"
          title="Aggiungi un commento al testo selezionato"
          icon={<MessageSquarePlus className="size-5" />}
          onClick={() => ctx.comments.add()}
        />
      </RibbonGroup>

      <RibbonGroup label="Intestazione e piè di pagina" safe>
        <BandMenu
          label="Intestazione"
          icon={<PanelTop className="size-5" />}
          active={Boolean(theme.header)}
          presets={HEADER_PRESETS}
          onPick={(value) => setTheme({ header: value })}
          onEdit={() => setDialog("header")}
          onRemove={() => setTheme({ header: "" })}
        />
        <BandMenu
          label="Piè di pagina"
          icon={<PanelBottom className="size-5" />}
          active={Boolean(theme.footer)}
          presets={FOOTER_PRESETS}
          onPick={(value) => setTheme({ footer: value })}
          onEdit={() => setDialog("footer")}
          onRemove={() => setTheme({ footer: "" })}
        />
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Numero di pagina"
              active={theme.pageNumbers !== "none"}
              icon={<Hash className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Posizione</DropdownMenuLabel>
          {PAGE_NUMBERS.map((p) => (
            <DropdownMenuItem
              key={p.value}
              onClick={() => setTheme({ pageNumbers: p.value })}
              className={cn(theme.pageNumbers === p.value && "bg-accent")}
            >
              {p.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuItem
            onClick={() =>
              editor.chain().focus().insertField({ kind: "page" }).run()
            }
          >
            Posizione corrente (campo nel testo)
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              Formato numeri di pagina
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-48">
              {PAGE_NUMBER_FORMATS.map((f) => (
                <DropdownMenuItem
                  key={f.value}
                  onClick={() => setTheme({ pageNumberFormat: f.value })}
                  className={cn(
                    theme.pageNumberFormat === f.value && "bg-accent"
                  )}
                >
                  {f.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={() => setDialog("footer")}>
                Inizia da…
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            disabled={theme.pageNumbers === "none"}
            onClick={() => setTheme({ pageNumbers: "none" })}
          >
            <Trash2 /> Rimuovi numeri di pagina
          </DropdownMenuItem>
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup label="Testo">
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label="Casella di testo"
              icon={<SquareDashedText className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Caselle predefinite</DropdownMenuLabel>
          {TEXT_BOX_PRESETS.map((preset) => (
            <DropdownMenuItem
              key={preset.id}
              onClick={() =>
                body().insertTextBox(preset.attrs, preset.text).run()
              }
            >
              <div className="flex flex-col">
                <span>{preset.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {preset.hint}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
          {editor.isActive("textBox") ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => editor.chain().focus().removeTextBox().run()}
              >
                <Trash2 /> Togli la casella (il testo resta)
              </DropdownMenuItem>
            </>
          ) : null}
        </RibbonMenu>
        <RibbonRows>
          <RibbonMenu
            className="w-60"
            trigger={
              <RibbonButton
                compact
                chevron
                label="Parti rapide"
                icon={<FileInput className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                Proprietà documento
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {(
                  [
                    ["title", "Titolo"],
                    ["author", "Autore"],
                    ["date", "Data"],
                    ["pages", "Numero di pagine"],
                    ["words", "Numero di parole"],
                  ] as const
                ).map(([kind, label]) => (
                  <DropdownMenuItem
                    key={kind}
                    onClick={() =>
                      editor
                        .chain()
                        .focus()
                        .insertField({
                          kind,
                          format: kind === "date" ? "long" : "",
                        })
                        .run()
                    }
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuItem onClick={() => setDialog("field")}>
              Campo…
            </DropdownMenuItem>
          </RibbonMenu>
          <RibbonMenu
            className="w-[268px]"
            trigger={
              <RibbonButton
                compact
                chevron
                label="WordArt"
                icon={<WholeWord className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>WordArt</DropdownMenuLabel>
            <MenuGrid columns={4}>
              {WORDART_PRESETS.map((preset) => (
                <GridButton
                  key={preset.id}
                  title={preset.label}
                  className="h-12 bg-muted/40 text-2xl"
                  onPick={() => {
                    const selected = editor.state.doc.textBetween(
                      editor.state.selection.from,
                      editor.state.selection.to,
                      " "
                    )
                    body()
                      .insertContent(wordArtContent(preset.id, selected))
                      .run()
                  }}
                >
                  <span
                    style={{
                      fontWeight: preset.bold ? 700 : 400,
                      fontStyle: preset.italic ? "italic" : undefined,
                      color: preset.color,
                      textShadow: preset.style.textShadow ?? undefined,
                      WebkitTextStroke: preset.style.textStroke ?? undefined,
                      WebkitTextFillColor: preset.style.textFill
                        ? "transparent"
                        : undefined,
                      backgroundImage:
                        preset.style.textFill &&
                        preset.style.textFill !== "hollow"
                          ? preset.style.textFill
                          : undefined,
                      WebkitBackgroundClip:
                        preset.style.textFill &&
                        preset.style.textFill !== "hollow"
                          ? "text"
                          : undefined,
                    }}
                  >
                    A
                  </span>
                </GridButton>
              ))}
            </MenuGrid>
          </RibbonMenu>
          <RibbonMenu
            className="w-52"
            trigger={
              <RibbonButton
                compact
                chevron
                label="Capolettera"
                icon={<CaseUpper className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setDropCap(null).run()}
            >
              Nessuno
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setDropCap("drop").run()}
            >
              Interno
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setDropCap("margin").run()}
            >
              Nel margine
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDialog("dropcap")}>
              Opzioni capolettera…
            </DropdownMenuItem>
          </RibbonMenu>
        </RibbonRows>
        <RibbonRows>
          <RibbonButton
            compact
            label="Riga della firma"
            icon={<PenLine className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("signature")}
          />
          <RibbonButton
            compact
            label="Data e ora"
            icon={<CalendarDays className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("datetime")}
          />
          <RibbonMenu
            className="w-56"
            trigger={
              <RibbonButton
                compact
                chevron
                label="Oggetto"
                icon={<FileInput className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              Testo da file… (.docx, .md, .txt, .html)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => body().setHorizontalRule().run()}>
              <Minus /> Linea orizzontale
            </DropdownMenuItem>
          </RibbonMenu>
        </RibbonRows>
        <input
          ref={fileRef}
          type="file"
          accept=".docx,.md,.markdown,.txt,.html,.htm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            e.target.value = ""
            if (file) void insertFromFile(file)
          }}
        />
      </RibbonGroup>

      <RibbonGroup label="Simboli">
        <RibbonMenu
          className="w-[320px]"
          trigger={
            <RibbonButton
              large
              chevron
              label="Equazione"
              title="Formule matematiche; scrivendo $x^2$ nel testo diventa una formula"
              icon={<Sigma className="size-5" />}
            />
          }
        >
          <DropdownMenuItem
            onClick={() => {
              ctx.openPanel()
              body().insertMath("", true).run()
            }}
          >
            Inserisci nuova equazione
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              ctx.openPanel()
              editor.chain().focus().insertMath("", false).run()
            }}
          >
            Equazione nel testo
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Predefinite</DropdownMenuLabel>
          <div className="max-h-80 overflow-y-auto">
            {BUILTIN_EQUATIONS.map((eq) => (
              <DropdownMenuItem
                key={eq.label}
                onClick={() => {
                  ctx.openPanel()
                  body().insertMath(eq.latex, true).run()
                }}
                className="flex flex-col items-start gap-1"
              >
                <span className="text-[11px] font-medium text-muted-foreground">
                  {eq.label}
                </span>
                <span
                  className="max-w-full overflow-hidden text-sm"
                  dangerouslySetInnerHTML={{ __html: mathHtml(eq.latex) }}
                />
              </DropdownMenuItem>
            ))}
          </div>
        </RibbonMenu>
        <RibbonMenu
          className="w-[270px]"
          trigger={
            <RibbonButton
              large
              chevron
              label="Simbolo"
              icon={<Omega className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Simboli</DropdownMenuLabel>
          <div className="grid grid-cols-10 gap-0.5 p-1">
            {SYMBOLS.map((sym) => (
              <DropdownMenuItem
                key={sym}
                title={sym}
                onClick={() => editor.chain().focus().insertContent(sym).run()}
                className="flex size-6 justify-center p-0 text-sm"
              >
                {sym}
              </DropdownMenuItem>
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("symbols")}>
            <Omega /> Altri simboli…
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-[282px]"
          trigger={
            <RibbonButton
              large
              chevron
              label="Emoji"
              icon={<Smile className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Emoji</DropdownMenuLabel>
          <div className="grid grid-cols-10 gap-0.5 p-1">
            {EMOJI.map((emoji) => (
              <DropdownMenuItem
                key={emoji}
                onClick={() =>
                  editor.chain().focus().insertContent(emoji).run()
                }
                className="flex size-6 justify-center p-0 text-base"
              >
                {emoji}
              </DropdownMenuItem>
            ))}
          </div>
        </RibbonMenu>
      </RibbonGroup>

      <BookmarkDialog
        open={dialog === "bookmark"}
        onClose={close}
        editor={editor}
      />
      <CrossRefDialog
        open={dialog === "crossref"}
        onClose={close}
        editor={editor}
      />
      <DateTimeDialog
        open={dialog === "datetime"}
        onClose={close}
        editor={editor}
      />
      <FieldDialog open={dialog === "field"} onClose={close} editor={editor} />
      <SignatureDialog
        open={dialog === "signature"}
        onClose={close}
        editor={editor}
      />
      <SymbolDialog
        open={dialog === "symbols"}
        onClose={close}
        editor={editor}
      />
      <DropCapDialog
        open={dialog === "dropcap"}
        onClose={close}
        editor={editor}
        theme={theme}
      />
      <IconsDialog
        open={dialog === "icons"}
        onClose={close}
        theme={theme}
        onInsert={(names, color) => {
          ctx.openPanel()
          body()
            .insertContent(
              names.map((name) => ({
                type: "image",
                attrs: { src: iconSvg(name, color), alt: name, width: "12%" },
              }))
            )
            .run()
        }}
      />
      <SmartArtDialog
        open={dialog === "smartart"}
        onClose={close}
        onPick={insertSmartArt}
      />
      <HeaderFooterDialog
        open={dialog === "header" || dialog === "footer"}
        onClose={close}
        theme={theme}
        setTheme={setTheme}
        initial={dialog === "footer" ? "footer" : "header"}
      />
    </>
  )
}

/** Menu di intestazione o piè di pagina: modelli, modifica, rimozione */
function BandMenu({
  label,
  icon,
  active,
  presets,
  onPick,
  onEdit,
  onRemove,
}: {
  label: string
  icon: React.ReactNode
  active: boolean
  presets: { label: string; hint: string; value: string }[]
  onPick: (value: string) => void
  onEdit: () => void
  onRemove: () => void
}) {
  return (
    <RibbonMenu
      className="w-64"
      trigger={
        <RibbonButton large chevron label={label} active={active} icon={icon} />
      }
    >
      <DropdownMenuLabel>Predefiniti</DropdownMenuLabel>
      {presets.map((preset) => (
        <DropdownMenuItem
          key={preset.label}
          onClick={() => onPick(preset.value)}
        >
          <div className="flex flex-col">
            <span>{preset.label}</span>
            <span className="text-[11px] text-muted-foreground">
              {preset.hint}
            </span>
          </div>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onEdit}>
        Modifica {label.toLowerCase()}…
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!active} onClick={onRemove}>
        <Trash2 /> Rimuovi {label.toLowerCase()}
      </DropdownMenuItem>
    </RibbonMenu>
  )
}

/** Miniatura di un frontespizio */
function CoverThumb({ design, accent }: { design: string; accent: string }) {
  const center = ["classic", "band", "elegant"].includes(design)
  return (
    <span
      aria-hidden
      className="relative flex aspect-[1/1.35] w-full flex-col overflow-hidden rounded-sm border border-border bg-white p-1.5"
    >
      {design === "sidebar" ? (
        <span
          className="absolute inset-y-2 left-1 w-[3px] rounded-full"
          style={{ background: accent }}
        />
      ) : null}
      <span
        className={cn(
          "flex flex-col gap-[3px]",
          center && "items-center",
          design === "classic" || design === "elegant"
            ? "mt-[40%]"
            : design === "report"
              ? "mt-1"
              : "mt-[28%]"
        )}
        style={
          design === "band"
            ? {
                background: `${accent}33`,
                marginInline: -6,
                padding: "4px 6px",
              }
            : design === "elegant"
              ? { borderBlock: `1px solid ${accent}`, paddingBlock: 3 }
              : undefined
        }
      >
        <span className="h-[5px] w-3/4 rounded-full bg-zinc-800" />
        <span className="h-[3px] w-1/2 rounded-full bg-zinc-400" />
      </span>
      {design === "minimal" ? (
        <span className="mt-1 h-px w-full bg-zinc-400" />
      ) : null}
      {design === "report" ? (
        <span
          className="mt-2 h-4 w-full rounded-[2px]"
          style={{ background: `${accent}33` }}
        />
      ) : null}
      <span
        className={cn(
          "mt-auto flex flex-col gap-[2px]",
          center
            ? "items-center"
            : design === "minimal"
              ? "items-end"
              : "items-start"
        )}
      >
        <span className="h-[2px] w-1/3 rounded-full bg-zinc-400" />
        <span className="h-[2px] w-1/4 rounded-full bg-zinc-300" />
      </span>
    </span>
  )
}
