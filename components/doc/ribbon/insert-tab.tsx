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
import { NodeSelection, type Transaction } from "@tiptap/pm/state"
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
  shapeImageAttrs,
  shapeLook,
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
import {
  displayTitle,
  PAGE_FORMATS,
  type PageNumberPosition,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  RibbonRows,
  useCloseRibbonMenu,
} from "./ribbon-ui"
import { EMOJI, SYMBOLS, applyLink, atBody, type RibbonCtx } from "./shared"
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

import { useT, tr, currentRegion } from "@/lib/i18n/client"
/** Griglia per scegliere righe e colonne passandoci sopra, come in Word */
function TableGrid({
  onPick,
}: {
  onPick: (rows: number, cols: number) => void
}) {
  const t = useT()
  const [hover, setHover] = React.useState({ r: 0, c: 0 })
  const close = useCloseRibbonMenu()
  return (
    <div className="p-2">
      <p className="mb-1.5 text-xs text-muted-foreground">
        {hover.r && hover.c
          ? t("Tabella {columns}×{rows}", { columns: hover.c, rows: hover.r })
          : t("Inserisci tabella")}
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
              aria-label={t("{columns} colonne per {rows} righe", {
                columns: c,
                rows: r,
              })}
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
  const t = useT()
  const { editor, st } = ctx
  const [open, setOpen] = React.useState(false)
  const [url, setUrl] = React.useState("")
  // i segnalibri si leggono all'apertura: sono i punti del documento
  const [bookmarks, setBookmarks] = React.useState<
    ReturnType<typeof listBookmarks>
  >([])

  const apply = () => {
    // indirizzi come «javascript:…» non diventano collegamenti: prima il
    // riquadro si chiudeva e non succedeva niente, senza dire perché
    if (!applyLink(editor, url)) {
      toast.error(t("Indirizzo non valido"), {
        description: t(
          "Un collegamento può portare a un sito, a un'e-mail o a un punto del documento."
        ),
      })
      return
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
            label={t("Collegamento")}
            title={t("Inserisci collegamento")}
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
        <p className="text-xs font-medium">{t("Indirizzo del collegamento")}</p>
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
              {t("Posizione nel documento")}
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
              {t("Rimuovi")}
            </Button>
          ) : null}
          <Button size="sm" className="h-7 text-xs" onClick={apply}>
            {t("Applica")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

function VideoPopover({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
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
            label={t("Video online")}
            title={t("YouTube, Vimeo, Loom, Dailymotion o un file video")}
            icon={<Video className="size-5" />}
          />
        }
      />
      <PopoverContent
        align="start"
        className="w-80 space-y-2 p-3"
        finalFocus={false}
      >
        <p className="text-xs font-medium">{t("Indirizzo del video")}</p>
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
              ? t("Video {provider} riconosciuto", {
                  provider:
                    info.provider === "File"
                      ? "da file"
                      : `di ${info.provider}`,
                })
              : t("Indirizzo non riconosciuto")
            : t(
                "Incolla il link di YouTube, Vimeo, Loom, Dailymotion o di un file .mp4"
              )}
        </p>
        <div className="flex justify-end">
          <Button
            size="sm"
            className="h-7 text-xs"
            disabled={!info}
            onClick={apply}
          >
            {t("Inserisci")}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  )
}

const PAGE_NUMBERS: { value: PageNumberPosition; label: string }[] = [
  {
    value: "top-left",
    get label() {
      return tr("Inizio pagina, a sinistra")
    },
  },
  {
    value: "top-center",
    get label() {
      return tr("Inizio pagina, al centro")
    },
  },
  {
    value: "top-right",
    get label() {
      return tr("Inizio pagina, a destra")
    },
  },
  {
    value: "bottom-left",
    get label() {
      return tr("Fine pagina, a sinistra")
    },
  },
  {
    value: "bottom-center",
    get label() {
      return tr("Fine pagina, al centro")
    },
  },
  {
    value: "bottom-right",
    get label() {
      return tr("Fine pagina, a destra")
    },
  },
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
    toast.error(tr("Il browser non permette di catturare lo schermo"))
    return null
  }
  let stream: MediaStream | null = null
  const asked = performance.now()
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
    const denied =
      error instanceof DOMException && error.name === "NotAllowedError"
    // «NotAllowedError» arriva sia da chi annulla la scelta della finestra sia
    // da un browser (o un criterio aziendale) che la cattura non la permette
    // proprio. Chi annulla ha visto il selettore, quindi ci ha messo un
    // momento: una risposta immediata vuol dire che il selettore non è mai
    // comparso, e allora va detto invece di non fare niente.
    if (denied && performance.now() - asked > 250) return null
    toast.error(
      denied
        ? tr("Il browser non permette di catturare lo schermo")
        : tr("Schermata non riuscita")
    )
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
  const t = useT()
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
        aria-label={t("Scegli un modello 3D")}
        data-testid="model3d-file"
        onChange={(e) => {
          const file = e.target.files?.[0]
          e.target.value = ""
          if (!file) return
          readModelFile(file)
            .then((src) => insert({ src, name: file.name }))
            .catch((error: unknown) =>
              toast.error(
                error instanceof Error ? error.message : t("File non valido")
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
            label={t("Modelli 3D")}
            title={t(
              "Modelli glTF da ruotare nel documento, o forme 3D pronte"
            )}
            icon={<Rotate3d className="size-5" />}
          />
        }
      >
        <DropdownMenuItem onClick={() => input.current?.click()}>
          {t("Da questo dispositivo… (.glb, .gltf)")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            const url = window.prompt(
              t("Indirizzo del modello (.glb)"),
              "https://"
            )
            const src = url ? safeModelSrc(url) : ""
            if (src) insert({ src, name: src.split("/").pop() ?? "" })
            else if (url)
              toast.error(t("Serve un indirizzo https a un file .glb o .gltf"))
          }}
        >
          {t("Da un indirizzo web…")}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>{t("Forme 3D")}</DropdownMenuLabel>
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

/**
 * Dopo l'inserimento l'oggetto resta selezionato, come in Word: la sua
 * scheda si apre e si può subito spostare, ridimensionare o colorare.
 */
function selectInserted(type: string) {
  return ({ tr }: { tr: Transaction }) => {
    const $from = tr.selection.$from
    const start = $from.depth ? $from.before(1) : $from.pos
    const prev = tr.doc.resolve(start).nodeBefore
    if (prev?.type.name === type) {
      tr.setSelection(NodeSelection.create(tr.doc, start - prev.nodeSize))
    }
    return true
  }
}

/**
 * Una forma davanti al testo non sta dentro una frase: va subito dopo il
 * paragrafo (o la tabella) del cursore e resta selezionata. Inserita dove
 * c'era il cursore spezzava il paragrafo in due («Un d» / «ocumento…»).
 */
function insertFloating(attrs: Record<string, unknown>) {
  return ({ tr }: { tr: Transaction }) => {
    const type = tr.doc.type.schema.nodes.image
    if (!type) return false
    const $from = tr.selection.$from
    const pos = $from.depth ? $from.after(1) : $from.pos
    tr.insert(pos, type.create(attrs))
    tr.setSelection(NodeSelection.create(tr.doc, pos))
    tr.scrollIntoView()
    return true
  }
}

export function InsertTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, st, theme, setTheme } = ctx
  // le board nel cestino non si incorporano
  const boards = useStore(
    useShallow((s) => s.files.filter((f) => f.kind === "board" && !f.deletedAt))
  )
  const [dialog, setDialog] = React.useState<InsertDialog>(null)
  const fileRef = React.useRef<HTMLInputElement>(null)
  const body = () => atBody(editor, st)
  // una pagina vuota o un salto pagina si vedono solo con i fogli veri: un
  // documento «Schermo» è una striscia sola, e passa all'A4 come in Word
  const paged = () => {
    if (PAGE_FORMATS[theme.format].mm) return
    setTheme({ format: "a4" })
    toast(t("Il documento ora è impaginato su fogli A4"))
  }
  const accent = docAccent(theme.accent)
  const close = () => setDialog(null)

  const today = () =>
    new Date().toLocaleDateString(currentRegion(), {
      day: "numeric",
      month: "long",
      year: "numeric",
    })

  const insertCover = (design: string) => {
    const title = docTitleText(editor.state.doc) ?? ""
    const parts = coverContent(design, {
      title,
      author: getAuthor() || tr("[Nome dell'autore]"),
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
    // come in Word: il frontespizio resta pulito, senza intestazione, piè di
    // pagina e numero
    if (!theme.differentFirstPage) setTheme({ differentFirstPage: true })
  }

  const insertImage = (src: string, alt: string, width: string) =>
    body()
      .insertContent({ type: "image", attrs: { src, alt, width } })
      .command(selectInserted("image"))
      .run()

  const insertSmartArt = (id: string) => {
    const template = SMARTART_TEMPLATES.find((t) => t.id === id)
    const store = getWorkspace()
    const boardId = store.createFile(
      "board",
      `SmartArt — ${template?.label ?? t("Elemento grafico")}`
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
    toast.success(t("SmartArt inserito: aprilo per modificare testi e colori"))
  }

  const insertFromFile = (file: File) =>
    readDocNodes(file)
      .then((nodes) => {
        if (nodes.length) body().insertContent(nodes).run()
        else toast.info(t("Il file non contiene testo da inserire"))
      })
      .catch((error: unknown) =>
        toast.error(
          error instanceof Error
            ? error.message
            : t("Non riesco a leggere il file")
        )
      )

  return (
    <>
      <RibbonGroup label={t("Pagine")} icon={<FilePlus2 className="size-5" />}>
        <RibbonMenu
          className="w-[300px]"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Frontespizio")}
              title={t(
                "Una prima pagina con titolo, sottotitolo, autore e data"
              )}
              icon={<FilePlus2 className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Predefiniti")}</DropdownMenuLabel>
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
            <Trash2 /> {t("Rimuovi frontespizio corrente")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Pagina vuota")}
            title={t("Una pagina bianca nel punto del cursore")}
            icon={<RectangleHorizontal className="size-4 rotate-90" />}
            className="justify-start"
            onClick={() => {
              paged()
              body()
                .insertContent([
                  { type: "pageBreak" },
                  { type: "paragraph" },
                  { type: "pageBreak" },
                ])
                .run()
            }}
          />
          <RibbonButton
            compact
            label={t("Interruzione di pagina")}
            title={t("Il testo riparte dalla pagina successiva ⌘↵")}
            icon={<SquareSplitVertical className="size-4" />}
            className="justify-start"
            onClick={() => {
              paged()
              body().setPageBreak().run()
            }}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label={t("Tabelle")} icon={<Table2 className="size-5" />}>
        <RibbonMenu
          className="w-auto"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Tabella")}
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
                  t(
                    "Seleziona righe con le colonne separate da tabulazione, «;» o «|»"
                  )
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
            <Table2 /> {t("Converti testo in tabella")}
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <Sparkles /> {t("Tabelle veloci")}
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent className="w-56">
              {(
                [
                  [
                    t("Elenco con intestazioni"),
                    [
                      t("Voce||riga di una tabella"),
                      t("Descrizione"),
                      t("Stato"),
                    ],
                    4,
                  ],
                  ["Matrice 3×3", ["", t("Colonna A"), t("Colonna B")], 3],
                  [
                    t("Settimana"),
                    [t("Lun"), t("Mar"), t("Mer"), t("Gio"), t("Ven")],
                    2,
                  ],
                  [
                    "Budget",
                    [
                      t("Voce||riga di una tabella"),
                      t("Previsto"),
                      t("Effettivo"),
                      t("Differenza"),
                    ],
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

      <RibbonGroup
        label={t("Illustrazioni")}
        icon={<ImageIcon className="size-5" />}
      >
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Immagini")}
              icon={<ImageIcon className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={ctx.pickImage}>
            {t("Da questo dispositivo…")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              const url = window
                .prompt(t("Indirizzo dell'immagine"), "https://")
                ?.trim()
              if (!url || url === "https://") return
              if (/^https:\/\/\S+$/i.test(url)) {
                body().setImage({ src: url }).run()
              } else {
                // prima un indirizzo http:// o scritto male non faceva niente,
                // senza dire perché
                toast.error(t("Serve un indirizzo https a un'immagine"))
              }
            }}
          >
            {t("Da un indirizzo web…")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-[292px]"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Forme")}
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
                    const look = shapeLook(shape.kind, accent.solid)
                    const svg = shapeSvg(
                      shape.kind,
                      look.fill,
                      look.stroke,
                      look
                    )
                    return (
                      <GridButton
                        key={shape.kind}
                        title={shape.label}
                        className="size-8"
                        onPick={() => {
                          ctx.openPanel()
                          // come in Word: colore pieno, davanti al testo e
                          // libera di spostarsi sul foglio
                          body()
                            .command(
                              insertFloating({
                                ...shapeImageAttrs(shape.kind, look),
                                alt: shape.label,
                                width: `${svg.width}%`,
                                wrap: "front",
                              })
                            )
                            .run()
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
            label={t("Icone")}
            icon={<Star className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("icons")}
          />
          <RibbonButton
            compact
            label={t("SmartArt")}
            title={t("Elenchi, processi, cicli, gerarchie e matrici")}
            icon={<Network className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("smartart")}
          />
          <RibbonButton
            compact
            label={t("Schermata")}
            title={t("Cattura una finestra o lo schermo e inseriscila")}
            icon={<MonitorUp className="size-4" />}
            className="justify-start"
            onClick={async () => {
              const src = await captureScreen()
              if (src) {
                ctx.openPanel()
                insertImage(src, t("Schermata"), "100%")
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
              label={t("Grafico")}
              title={t(
                "Istogrammi, linee, torte e altro: i dati si incollano da Excel"
              )}
              icon={<ChartColumnBig className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Inserisci grafico")}</DropdownMenuLabel>
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
              label={t("Board")}
              title={t("Incorpora una board")}
              icon={<Puzzle className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Incorpora una board")}</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {boards.length ? (
            boards.map((b) => (
              <DropdownMenuItem
                key={b.id}
                onClick={() => ctx.onInsertBoard(b.id)}
              >
                <Glyph name={b.icon} size={15} strokeWidth={1.9} />
                <span className="truncate">{displayTitle(b)}</span>
              </DropdownMenuItem>
            ))
          ) : (
            <DropdownMenuItem disabled>{t("Nessuna board")}</DropdownMenuItem>
          )}
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup
        label={t("Elementi multimediali")}
        icon={<Video className="size-5" />}
      >
        <VideoPopover ctx={ctx} />
      </RibbonGroup>

      <RibbonGroup
        label={t("Collegamenti")}
        icon={<Link2 className="size-5" />}
      >
        <LinkPopover ctx={ctx} />
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Segnalibro")}
            icon={<BookMarked className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("bookmark")}
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

      <RibbonGroup
        label={t("Commenti")}
        icon={<MessageSquarePlus className="size-5" />}
      >
        <RibbonButton
          large
          label={t("Commento")}
          title={t("Aggiungi un commento al testo selezionato")}
          icon={<MessageSquarePlus className="size-5" />}
          onClick={() => ctx.comments.add()}
        />
      </RibbonGroup>

      <RibbonGroup
        label={t("Intestazione e piè di pagina")}
        icon={<PanelTop className="size-5" />}
        safe
      >
        <BandMenu
          label={t("Intestazione")}
          icon={<PanelTop className="size-5" />}
          active={Boolean(theme.header)}
          presets={HEADER_PRESETS}
          onPick={(value) => setTheme({ header: value })}
          // come in Word si scrive sul foglio; la finestra resta per i
          // documenti senza pagine
          onEdit={() => ctx.editBand("header") || setDialog("header")}
          onRemove={() => setTheme({ header: "" })}
        />
        <BandMenu
          label={t("Piè di pagina")}
          icon={<PanelBottom className="size-5" />}
          active={Boolean(theme.footer)}
          presets={FOOTER_PRESETS}
          onPick={(value) => setTheme({ footer: value })}
          onEdit={() => ctx.editBand("footer") || setDialog("footer")}
          onRemove={() => setTheme({ footer: "" })}
        />
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Numero di pagina")}
              active={theme.pageNumbers !== "none"}
              icon={<Hash className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Posizione")}</DropdownMenuLabel>
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
            {t("Posizione corrente (campo nel testo)")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              {t("Formato numeri di pagina")}
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
                {t("Inizia da…")}
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem
            disabled={theme.pageNumbers === "none"}
            onClick={() => setTheme({ pageNumbers: "none" })}
          >
            <Trash2 /> {t("Rimuovi numeri di pagina")}
          </DropdownMenuItem>
        </RibbonMenu>
      </RibbonGroup>

      <RibbonGroup
        label={t("Testo")}
        icon={<SquareDashedText className="size-5" />}
      >
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Casella di testo")}
              icon={<SquareDashedText className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Caselle predefinite")}</DropdownMenuLabel>
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
                <Trash2 /> {t("Togli la casella (il testo resta)")}
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
                label={t("Parti rapide")}
                icon={<FileInput className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                {t("Proprietà documento")}
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="w-48">
                {(
                  [
                    ["title", t("Titolo")],
                    ["author", t("Autore")],
                    ["date", t("Data")],
                    ["pages", t("Numero di pagine")],
                    ["words", t("Numero di parole")],
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
              {t("Campo…")}
            </DropdownMenuItem>
          </RibbonMenu>
          <RibbonMenu
            className="w-[268px]"
            trigger={
              <RibbonButton
                compact
                chevron
                label={t("WordArt")}
                icon={<WholeWord className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>{t("WordArt")}</DropdownMenuLabel>
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
                    {t("A")}
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
                label={t("Capolettera")}
                icon={<CaseUpper className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setDropCap(null).run()}
            >
              {t("Nessuno")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setDropCap("drop").run()}
            >
              {t("Interno")}
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => editor.chain().focus().setDropCap("margin").run()}
            >
              {t("Nel margine")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setDialog("dropcap")}>
              {t("Opzioni capolettera…")}
            </DropdownMenuItem>
          </RibbonMenu>
        </RibbonRows>
        <RibbonRows>
          <RibbonButton
            compact
            label={t("Riga della firma")}
            icon={<PenLine className="size-4" />}
            className="justify-start"
            onClick={() => setDialog("signature")}
          />
          <RibbonButton
            compact
            label={t("Data e ora")}
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
                label={t("Oggetto")}
                icon={<FileInput className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem onClick={() => fileRef.current?.click()}>
              {t("Testo da file… (.docx, .md, .txt, .html)")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => body().setHorizontalRule().run()}>
              <Minus /> {t("Linea orizzontale")}
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

      <RibbonGroup label={t("Simboli")} icon={<Omega className="size-5" />}>
        <RibbonMenu
          className="w-[320px]"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Equazione")}
              title={t(
                "Formule matematiche; scrivendo $x^2$ nel testo diventa una formula"
              )}
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
            {t("Inserisci nuova equazione")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => {
              ctx.openPanel()
              editor.chain().focus().insertMath("", false).run()
            }}
          >
            {t("Equazione nel testo")}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("Predefinite")}</DropdownMenuLabel>
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
              label={t("Simbolo")}
              icon={<Omega className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Simboli")}</DropdownMenuLabel>
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
            <Omega /> {t("Altri simboli…")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-[282px]"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Emoji")}
              icon={<Smile className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Emoji")}</DropdownMenuLabel>
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
  const t = useT()
  return (
    <RibbonMenu
      className="w-64"
      trigger={
        <RibbonButton large chevron label={label} active={active} icon={icon} />
      }
    >
      <DropdownMenuLabel>{t("Predefiniti")}</DropdownMenuLabel>
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
        {t("Modifica {item}…", { item: label.toLocaleLowerCase() })}
      </DropdownMenuItem>
      <DropdownMenuItem disabled={!active} onClick={onRemove}>
        <Trash2 /> {t("Rimuovi {item}", { item: label.toLocaleLowerCase() })}
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
