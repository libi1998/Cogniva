"use client"

import type { Route } from "next"
import { useRouter } from "next/navigation"
import {
  AlignJustify,
  AppWindow,
  ArrowDown,
  ArrowUp,
  BookOpen,
  ChevronsLeft,
  ChevronsRight,
  Columns2,
  Focus,
  Fullscreen,
  Globe,
  Grid3x3,
  ListTree,
  Maximize2,
  PanelsTopLeft,
  RectangleVertical,
  Ruler as RulerIcon,
  Search,
  SquarePen,
  TextSelect,
  X,
} from "lucide-react"
import { useShallow } from "zustand/react/shallow"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { fileHref } from "@/lib/import-files"
import { useStore } from "@/lib/store"
import { PAGE_FORMATS, ZOOM_STEPS, type DocView } from "@/lib/types"
import { cn } from "@/lib/utils"
import { applyDocStyle } from "../style-actions"
import { RibbonButton, RibbonGroup, RibbonMenu, RibbonRows } from "./ribbon-ui"
import type { RibbonCtx } from "./shared"

const VIEWS: {
  value: DocView
  label: string
  title: string
  icon: React.ReactNode
}[] = [
  {
    value: "print",
    label: "Layout di stampa",
    title: "Le pagine come verranno stampate",
    icon: <RectangleVertical className="size-5" />,
  },
  {
    value: "web",
    label: "Layout Web",
    title: "Il testo a tutta larghezza, senza pagine",
    icon: <Globe className="size-5" />,
  },
  {
    value: "outline",
    label: "Struttura",
    title: "I titoli rientrati per livello, da riordinare",
    icon: <ListTree className="size-5" />,
  },
  {
    value: "draft",
    label: "Bozza",
    title: "Solo il testo: niente intestazioni, filigrana e oggetti liberi",
    icon: <AlignJustify className="size-5" />,
  },
]

export function ViewTab({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st, theme, setTheme, zoom, setZoom } = ctx
  const router = useRouter()
  const paged = Boolean(PAGE_FORMATS[theme.format].mm)
  const view = theme.view ?? "print"
  const docs = useStore(
    useShallow((s) =>
      s.files
        .filter((f) => f.kind === "doc" && !f.deletedAt)
        .sort((a, b) => b.updatedAt - a.updatedAt)
        .slice(0, 12)
    )
  )

  const level = st.heading1 ? 1 : st.heading2 ? 2 : st.heading3 ? 3 : 0
  // Promuovi e Retrocedi: Normale ↔ Titolo 3 ↔ Titolo 2 ↔ Titolo 1
  const promote = () =>
    applyDocStyle(
      editor,
      theme,
      level === 0 ? "heading3" : `heading${Math.max(1, level - 1)}`
    )
  const demote = () =>
    applyDocStyle(
      editor,
      theme,
      level === 0 || level === 3 ? "normal" : `heading${level + 1}`
    )

  return (
    <>
      <RibbonGroup label="Visualizzazioni" safe>
        <RibbonButton
          large
          label="Modalità lettura"
          title="Solo lettura, testo più grande, niente barre (Esc per uscire)"
          icon={<BookOpen className="size-5" />}
          onClick={() => ctx.setMode("reading")}
        />
        {VIEWS.map((v) => (
          <RibbonButton
            key={v.value}
            large
            label={v.label}
            title={v.title}
            active={view === v.value}
            icon={v.icon}
            onClick={() => setTheme({ view: v.value })}
          />
        ))}
      </RibbonGroup>

      <RibbonGroup label="Immersive" safe>
        <RibbonButton
          large
          label="Modalità focus"
          title="Solo il foglio, senza distrazioni (Esc per uscire)"
          icon={<Focus className="size-5" />}
          onClick={() => ctx.setMode("focus")}
        />
        <RibbonButton
          large
          label="Lettura immersiva"
          title="Larghezza della colonna, colore della pagina, spaziatura e messa a fuoco della riga"
          icon={<TextSelect className="size-5" />}
          onClick={() => ctx.setMode("immersive")}
        />
      </RibbonGroup>

      {view === "outline" ? (
        <RibbonGroup label="Struttura">
          <RibbonRows>
            <div className="flex items-center gap-0.5">
              <RibbonButton
                title="Alza a Titolo 1"
                icon={<ChevronsLeft className="size-4" />}
                onClick={() => applyDocStyle(editor, theme, "heading1")}
              />
              <RibbonButton
                title="Promuovi"
                icon={<ArrowUp className="size-4 -rotate-90" />}
                onClick={promote}
              />
              <span className="w-16 text-center text-xs text-muted-foreground">
                {level ? `Livello ${level}` : "Corpo"}
              </span>
              <RibbonButton
                title="Retrocedi"
                icon={<ArrowDown className="size-4 -rotate-90" />}
                onClick={demote}
              />
              <RibbonButton
                title="Abbassa a corpo del testo"
                icon={<ChevronsRight className="size-4" />}
                onClick={() => applyDocStyle(editor, theme, "normal")}
              />
            </div>
            <div className="flex items-center gap-0.5">
              <RibbonButton
                title="Sposta su"
                icon={<ArrowUp className="size-4" />}
                onClick={() => editor.chain().focus().moveBlock("up").run()}
              />
              <RibbonButton
                title="Sposta giù"
                icon={<ArrowDown className="size-4" />}
                onClick={() => editor.chain().focus().moveBlock("down").run()}
              />
              <RibbonMenu
                className="w-48"
                trigger={
                  <RibbonButton
                    data-safe=""
                    chevron
                    label={
                      ctx.outlineLevel
                        ? `Livello ${ctx.outlineLevel}`
                        : "Tutti i livelli"
                    }
                  />
                }
              >
                <DropdownMenuLabel>Mostra livello</DropdownMenuLabel>
                {[0, 1, 2, 3].map((n) => (
                  <DropdownMenuItem
                    key={n}
                    onClick={() => ctx.setOutlineLevel(n)}
                    className={cn(ctx.outlineLevel === n && "bg-accent")}
                  >
                    {n ? `Livello ${n}` : "Tutti i livelli"}
                  </DropdownMenuItem>
                ))}
              </RibbonMenu>
            </div>
          </RibbonRows>
          <RibbonButton
            large
            data-safe=""
            label="Chiudi Struttura"
            icon={<X className="size-5" />}
            onClick={() => {
              ctx.setOutlineLevel(0)
              setTheme({ view: "print" })
            }}
          />
        </RibbonGroup>
      ) : null}

      <RibbonGroup label="Mostra" safe>
        <RibbonButton
          large
          label="Righello"
          active={theme.ruler}
          icon={<RulerIcon className="size-5" />}
          onClick={() => setTheme({ ruler: !theme.ruler })}
        />
        <RibbonButton
          large
          label="Griglia"
          active={theme.grid}
          icon={<Grid3x3 className="size-5" />}
          onClick={() => setTheme({ grid: !theme.grid })}
        />
        <RibbonButton
          large
          label="Riquadro di spostamento"
          active={ctx.outline}
          icon={<PanelsTopLeft className="size-5" />}
          onClick={() => ctx.setOutline(!ctx.outline)}
        />
        <RibbonButton
          large
          label={
            theme.inkVisible ? "Nascondi input penna" : "Mostra input penna"
          }
          active={!theme.inkVisible}
          icon={<SquarePen className="size-5" />}
          onClick={() => setTheme({ inkVisible: !theme.inkVisible })}
        />
      </RibbonGroup>

      <RibbonGroup label="Zoom" safe>
        <RibbonMenu
          className="w-40"
          trigger={
            <RibbonButton
              large
              chevron
              label="Zoom"
              title={`Zoom: ${Math.round(zoom * 100)}%`}
              icon={<Search className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Zoom</DropdownMenuLabel>
          {ZOOM_STEPS.map((z) => (
            <DropdownMenuItem
              key={z}
              onClick={() => setZoom(z)}
              className={cn(Math.abs(z - zoom) < 0.001 && "font-semibold")}
            >
              {Math.round(z * 100)}%
            </DropdownMenuItem>
          ))}
        </RibbonMenu>
        <RibbonButton
          large
          label="100%"
          active={Math.abs(zoom - 1) < 0.001}
          icon={<span className="text-sm leading-5 font-semibold">1:1</span>}
          onClick={() => setZoom(1)}
        />
        <RibbonRows>
          <RibbonButton
            compact
            label="Una pagina"
            disabled={!paged || view !== "print"}
            title={
              paged ? "Mostra la pagina intera" : "Serve un formato di pagina"
            }
            icon={<RectangleVertical className="size-4" />}
            className="justify-start"
            onClick={() => ctx.fitPage()}
          />
          <RibbonButton
            compact
            label="Più pagine"
            disabled={!paged || view !== "print"}
            title="Rimpicciolisce finché si vedono due pagine"
            icon={<Columns2 className="size-4" />}
            className="justify-start"
            onClick={() => ctx.fitPage(2)}
          />
          <RibbonButton
            compact
            label="Larghezza pagina"
            icon={<Maximize2 className="size-4" />}
            className="justify-start"
            onClick={ctx.fitWidth}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Finestra" safe>
        <RibbonButton
          large
          label="Nuova finestra"
          title="Apre lo stesso documento in un'altra finestra"
          icon={<AppWindow className="size-5" />}
          onClick={() =>
            window.open(window.location.href, "_blank", "noopener")
          }
        />
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label="Cambia finestra"
              icon={<Columns2 className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>Documenti recenti</DropdownMenuLabel>
          {docs.map((d) => (
            <DropdownMenuItem
              key={d.id}
              onClick={() => router.push(fileHref(d) as Route)}
              className={cn(d.id === ctx.fileId && "bg-accent")}
            >
              <span className="truncate">{d.title}</span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push("/")}>
            Tutti i file
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonButton
          large
          label="Schermo intero"
          icon={<Fullscreen className="size-5" />}
          onClick={() => {
            if (document.fullscreenElement) void document.exitFullscreen()
            else void document.documentElement.requestFullscreen?.()
          }}
        />
      </RibbonGroup>
    </>
  )
}
