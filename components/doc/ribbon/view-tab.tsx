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

import { useT, tr, hrefFor } from "@/lib/i18n/client"
const VIEWS: {
  value: DocView
  label: string
  title: string
  icon: React.ReactNode
}[] = [
  {
    value: "print",
    get label() {
      return tr("Layout di stampa")
    },
    get title() {
      return tr("Le pagine come verranno stampate")
    },
    icon: <RectangleVertical className="size-5" />,
  },
  {
    value: "web",
    get label() {
      return tr("Layout Web")
    },
    get title() {
      return tr("Il testo a tutta larghezza, senza pagine")
    },
    icon: <Globe className="size-5" />,
  },
  {
    value: "outline",
    get label() {
      return tr("Struttura")
    },
    get title() {
      return tr("I titoli rientrati per livello, da riordinare")
    },
    icon: <ListTree className="size-5" />,
  },
  {
    value: "draft",
    get label() {
      return tr("Bozza")
    },
    get title() {
      return tr(
        "Solo il testo: niente intestazioni, filigrana e oggetti liberi"
      )
    },
    icon: <AlignJustify className="size-5" />,
  },
]

export function ViewTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
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
      <RibbonGroup label={t("Visualizzazioni")} safe>
        <RibbonButton
          large
          label={t("Modalità lettura")}
          title={t(
            "Solo lettura, testo più grande, niente barre (Esc per uscire)"
          )}
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

      <RibbonGroup label={t("Immersive")} safe>
        <RibbonButton
          large
          label={t("Modalità focus")}
          title={t("Solo il foglio, senza distrazioni (Esc per uscire)")}
          icon={<Focus className="size-5" />}
          onClick={() => ctx.setMode("focus")}
        />
        <RibbonButton
          large
          label={t("Lettura immersiva")}
          title={t(
            "Larghezza della colonna, colore della pagina, spaziatura e messa a fuoco della riga"
          )}
          icon={<TextSelect className="size-5" />}
          onClick={() => ctx.setMode("immersive")}
        />
      </RibbonGroup>

      {view === "outline" ? (
        <RibbonGroup label={t("Struttura")}>
          <RibbonRows>
            <div className="flex items-center gap-0.5">
              <RibbonButton
                title={t("Alza a Titolo 1")}
                icon={<ChevronsLeft className="size-4" />}
                onClick={() => applyDocStyle(editor, theme, "heading1")}
              />
              <RibbonButton
                title={t("Promuovi")}
                icon={<ArrowUp className="size-4 -rotate-90" />}
                onClick={promote}
              />
              <span className="w-16 text-center text-xs text-muted-foreground">
                {level ? t("Livello {level}", { level }) : t("Corpo")}
              </span>
              <RibbonButton
                title={t("Retrocedi")}
                icon={<ArrowDown className="size-4 -rotate-90" />}
                onClick={demote}
              />
              <RibbonButton
                title={t("Abbassa a corpo del testo")}
                icon={<ChevronsRight className="size-4" />}
                onClick={() => applyDocStyle(editor, theme, "normal")}
              />
            </div>
            <div className="flex items-center gap-0.5">
              <RibbonButton
                title={t("Sposta su")}
                icon={<ArrowUp className="size-4" />}
                onClick={() => editor.chain().focus().moveBlock("up").run()}
              />
              <RibbonButton
                title={t("Sposta giù")}
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
                        ? t("Livello {outlineLevel}", {
                            outlineLevel: ctx.outlineLevel,
                          })
                        : t("Tutti i livelli")
                    }
                  />
                }
              >
                <DropdownMenuLabel>{t("Mostra livello")}</DropdownMenuLabel>
                {[0, 1, 2, 3].map((n) => (
                  <DropdownMenuItem
                    key={n}
                    onClick={() => ctx.setOutlineLevel(n)}
                    className={cn(ctx.outlineLevel === n && "bg-accent")}
                  >
                    {n ? t("Livello {n}", { n }) : t("Tutti i livelli")}
                  </DropdownMenuItem>
                ))}
              </RibbonMenu>
            </div>
          </RibbonRows>
          <RibbonButton
            large
            data-safe=""
            label={t("Chiudi Struttura")}
            icon={<X className="size-5" />}
            onClick={() => {
              ctx.setOutlineLevel(0)
              setTheme({ view: "print" })
            }}
          />
        </RibbonGroup>
      ) : null}

      <RibbonGroup label={t("Mostra")} safe>
        <RibbonButton
          large
          label={t("Righello")}
          active={theme.ruler}
          icon={<RulerIcon className="size-5" />}
          onClick={() => setTheme({ ruler: !theme.ruler })}
        />
        <RibbonButton
          large
          label={t("Griglia")}
          active={theme.grid}
          icon={<Grid3x3 className="size-5" />}
          onClick={() => setTheme({ grid: !theme.grid })}
        />
        <RibbonButton
          large
          label={t("Riquadro di spostamento")}
          active={ctx.outline}
          icon={<PanelsTopLeft className="size-5" />}
          onClick={() => ctx.setOutline(!ctx.outline)}
        />
        <RibbonButton
          large
          label={
            theme.inkVisible
              ? t("Nascondi input penna")
              : t("Mostra input penna")
          }
          active={!theme.inkVisible}
          icon={<SquarePen className="size-5" />}
          onClick={() => setTheme({ inkVisible: !theme.inkVisible })}
        />
      </RibbonGroup>

      <RibbonGroup label={t("Zoom")} safe>
        <RibbonMenu
          className="w-40"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Zoom")}
              title={t("Zoom: {percent}%", { percent: Math.round(zoom * 100) })}
              icon={<Search className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Zoom")}</DropdownMenuLabel>
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
            label={t("Una pagina")}
            disabled={!paged || view !== "print"}
            title={
              paged
                ? t("Mostra la pagina intera")
                : t("Serve un formato di pagina")
            }
            icon={<RectangleVertical className="size-4" />}
            className="justify-start"
            onClick={() => ctx.fitPage()}
          />
          <RibbonButton
            compact
            label={t("Più pagine")}
            disabled={!paged || view !== "print"}
            title={t("Rimpicciolisce finché si vedono due pagine")}
            icon={<Columns2 className="size-4" />}
            className="justify-start"
            onClick={() => ctx.fitPage(2)}
          />
          <RibbonButton
            compact
            label={t("Larghezza pagina")}
            icon={<Maximize2 className="size-4" />}
            className="justify-start"
            onClick={ctx.fitWidth}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label={t("Finestra")} safe>
        <RibbonButton
          large
          label={t("Nuova finestra")}
          title={t("Apre lo stesso documento in un'altra finestra")}
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
              label={t("Cambia finestra")}
              icon={<Columns2 className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Documenti recenti")}</DropdownMenuLabel>
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
          <DropdownMenuItem onClick={() => router.push(hrefFor("/") as Route)}>
            {t("Tutti i file")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonButton
          large
          label={t("Schermo intero")}
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
