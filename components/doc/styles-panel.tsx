"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import {
  ChevronDown,
  Copy,
  Eye,
  EyeOff,
  MoreHorizontal,
  Paintbrush,
  Pencil,
  Plus,
  RemoveFormatting,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  listStyles,
  newStyleId,
  resolveStyle,
  styleFontStack,
  type DocStyle,
} from "@/lib/doc-styles"
import { docAccent } from "@/lib/palette"
import type { DocTheme } from "@/lib/types"
import { cn } from "@/lib/utils"
import type { StyleDialogRequest } from "./style-dialog"
import {
  applyDocStyle,
  clearFormatting,
  dropDirectFormatting,
  propsFromSelection,
  withStyle,
} from "./style-actions"

export type StyleTools = {
  editor: Editor
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  /** lo stile del blocco del cursore */
  current: string
  openDialog: (request: StyleDialogRequest) => void
}

function swatchColor(theme: DocTheme, value: string) {
  if (!value) return undefined
  if (value === "accent") return docAccent(theme.accent).solid
  if (value === "muted") return "#71717a"
  return value
}

/** Il testo di una scheda nello stile: carattere, peso, colore, maiuscole */
function styleLook(theme: DocTheme, style: DocStyle, maxPx: number) {
  const p = style.props
  const normal = resolveStyle(theme, "normal").props.size
  return {
    fontFamily: styleFontStack(theme, p.font),
    fontWeight: p.bold ? 700 : 400,
    fontStyle: p.italic ? "italic" : "normal",
    textDecoration: p.underline ? "underline" : undefined,
    textTransform: p.caps === "all" ? "uppercase" : undefined,
    fontVariantCaps: p.caps === "small" ? "small-caps" : undefined,
    color: swatchColor(theme, p.color),
    // le proporzioni fra gli stili restano, ma la scheda ha un'altezza fissa
    fontSize: Math.max(11, Math.min(maxPx, 13 * Math.sqrt(p.size / normal))),
  } as React.CSSProperties
}

/** Come in Word: più grande è il corpo, più corto il campione nella scheda */
function sampleText(theme: DocTheme, style: DocStyle) {
  const ratio = style.props.size / resolveStyle(theme, "normal").props.size
  if (ratio >= 1.6) return "AaBb"
  if (ratio >= 1.15 || style.props.caps === "all") return "AaBbCc"
  return "AaBbCcDd"
}

/* ------------------------------ azioni --------------------------------- */

function removeStyleFromDoc(editor: Editor, id: string) {
  editor
    .chain()
    .command(({ tr, state }) => {
      state.doc.descendants((node, pos) => {
        if (node.attrs.styleId === id) {
          tr.setNodeMarkup(pos, undefined, { ...node.attrs, styleId: null })
        }
        return true
      })
      return true
    })
    .run()
}

export function useStyleActions(tools: StyleTools) {
  const { editor, theme, setTheme, openDialog } = tools
  return {
    apply: (id: string) => applyDocStyle(editor, theme, id),
    modify: (id: string) => openDialog({ mode: "modify", id }),
    create: () => openDialog({ mode: "new", baseId: tools.current }),
    updateFromSelection: (id: string) => {
      const style = resolveStyle(theme, id)
      const found = propsFromSelection(editor, theme, id)
      setTheme(
        withStyle(theme, id, { ...(theme.styles?.[id] ?? {}), ...found })
      )
      // il paragrafo ora segue lo stile: la formattazione diretta non serve
      if (tools.current === style.id) dropDirectFormatting(editor, found)
    },
    duplicate: (id: string) => {
      const style = resolveStyle(theme, id)
      const copyId = newStyleId(`${style.name} copia`, theme)
      setTheme(
        withStyle(theme, copyId, {
          ...style.own,
          name: `${style.name} (copia)`,
          kind: style.kind,
          level: style.level,
          basedOn: style.basedOn,
          next: style.next === id ? copyId : style.next,
        })
      )
    },
    toggleGallery: (id: string) => {
      const style = resolveStyle(theme, id)
      setTheme(
        withStyle(theme, id, {
          ...(theme.styles?.[id] ?? {}),
          hidden: !style.hidden,
        })
      )
    },
    reset: (id: string) => setTheme(withStyle(theme, id, null)),
    remove: (id: string) => {
      removeStyleFromDoc(editor, id)
      // chi era basato su questo stile passa a «Normale»
      const styles = { ...(theme.styles ?? {}) }
      delete styles[id]
      for (const [key, def] of Object.entries(styles)) {
        if (def.basedOn === id) styles[key] = { ...def, basedOn: "normal" }
        if (def.next === id) styles[key] = { ...styles[key], next: key }
      }
      setTheme({ styles })
    },
    clear: () => clearFormatting(editor),
  }
}

/** Le voci del menu di uno stile, come il clic destro sulla raccolta di Word */
function StyleMenuItems({
  style,
  tools,
}: {
  style: DocStyle
  tools: StyleTools
}) {
  const actions = useStyleActions(tools)
  const overridden = Boolean(tools.theme.styles?.[style.id])
  return (
    <>
      <DropdownMenuLabel className="truncate">{style.name}</DropdownMenuLabel>
      <DropdownMenuItem onClick={() => actions.apply(style.id)}>
        <Paintbrush className="size-4" /> Applica
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => actions.updateFromSelection(style.id)}>
        <RotateCcw className="size-4 -scale-x-100" />
        <span className="truncate">Aggiorna in base alla selezione</span>
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => actions.modify(style.id)}>
        <Pencil className="size-4" /> Modifica…
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => actions.duplicate(style.id)}>
        <Copy className="size-4" /> Duplica
      </DropdownMenuItem>
      <DropdownMenuItem onClick={() => actions.toggleGallery(style.id)}>
        {style.hidden ? (
          <Eye className="size-4" />
        ) : (
          <EyeOff className="size-4" />
        )}
        {style.hidden ? "Aggiungi alla raccolta" : "Rimuovi dalla raccolta"}
      </DropdownMenuItem>
      {style.builtin && overridden ? (
        <DropdownMenuItem onClick={() => actions.reset(style.id)}>
          <RotateCcw className="size-4" /> Ripristina predefinito
        </DropdownMenuItem>
      ) : null}
      {!style.builtin ? (
        <>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => actions.remove(style.id)}
          >
            <Trash2 className="size-4" /> Elimina lo stile
          </DropdownMenuItem>
        </>
      ) : null}
    </>
  )
}

/* ------------------------ raccolta della barra --------------------------- */

function StyleCard({
  style,
  tools,
  compact,
  onApply,
}: {
  style: DocStyle
  tools: StyleTools
  compact?: boolean
  onApply: () => void
}) {
  const [menu, setMenu] = React.useState<{ x: number; y: number } | null>(null)
  const active = tools.current === style.id
  return (
    <>
      <button
        type="button"
        title={`${style.name} · clic destro per modificare`}
        onMouseDown={(e) => e.preventDefault()}
        onClick={onApply}
        onContextMenu={(e) => {
          e.preventDefault()
          setMenu({ x: e.clientX, y: e.clientY })
        }}
        className={cn(
          "flex shrink-0 flex-col items-stretch justify-center overflow-hidden rounded-md border bg-background px-1.5 text-center transition",
          compact ? "h-[58px] w-[88px]" : "h-14 w-full",
          active
            ? "border-primary/70 ring-1 ring-primary/40"
            : "border-border hover:border-foreground/30"
        )}
      >
        <span
          className="block truncate leading-tight"
          style={styleLook(tools.theme, style, 18)}
        >
          {sampleText(tools.theme, style)}
        </span>
        <span className="mt-1 block truncate text-[10px] text-muted-foreground">
          {style.name}
        </span>
      </button>
      {menu ? (
        <DropdownMenu open onOpenChange={(open) => !open && setMenu(null)}>
          <DropdownMenuTrigger
            nativeButton={false}
            render={
              <span
                aria-hidden
                style={{
                  position: "fixed",
                  left: menu.x,
                  top: menu.y,
                  width: 1,
                  height: 1,
                }}
              />
            }
          />
          <DropdownMenuContent className="w-64" finalFocus={false}>
            <StyleMenuItems style={style} tools={tools} />
          </DropdownMenuContent>
        </DropdownMenu>
      ) : null}
    </>
  )
}

/** La raccolta «Stili» della scheda Home */
export function StyleGallery({
  tools,
  onOpenPane,
}: {
  tools: StyleTools
  onOpenPane: () => void
}) {
  const actions = useStyleActions(tools)
  const styles = listStyles(tools.theme)
  const shown = styles.filter((s) => !s.hidden)
  // la raccolta tiene a vista lo stile del cursore, anche se non è fra i primi
  const first = shown.slice(0, 4)
  const current = styles.find((s) => s.id === tools.current)
  const row =
    current && !first.some((s) => s.id === current.id)
      ? [...first.slice(0, 3), current]
      : first

  return (
    <div className="flex items-center gap-1">
      {row.map((style) => (
        <StyleCard
          key={style.id}
          style={style}
          tools={tools}
          compact
          onApply={() => actions.apply(style.id)}
        />
      ))}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <button
              type="button"
              title="Tutti gli stili"
              aria-label="Tutti gli stili"
              onMouseDown={(e) => e.preventDefault()}
              className="flex h-[58px] w-5 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
            />
          }
        >
          <ChevronDown className="size-3.5" />
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          className="w-[300px] p-2"
          finalFocus={false}
        >
          <DropdownMenuLabel className="px-0">Stili</DropdownMenuLabel>
          <div className="grid max-h-[320px] grid-cols-3 gap-1.5 overflow-y-auto p-0.5">
            {shown.map((style) => (
              <StyleCard
                key={style.id}
                style={style}
                tools={tools}
                onApply={() => actions.apply(style.id)}
              />
            ))}
          </div>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={actions.create}>
            <Plus className="size-4" /> Crea uno stile…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={actions.clear}>
            <RemoveFormatting className="size-4" /> Cancella formattazione
          </DropdownMenuItem>
          <DropdownMenuItem onClick={onOpenPane}>
            <Pencil className="size-4" /> Riquadro Stili…
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  )
}

/* ----------------------------- riquadro --------------------------------- */

/** Il riquadro Stili: tutti gli stili, con anteprima e menu per ognuno */
export function StylesPane({
  tools,
  onClose,
}: {
  tools: StyleTools
  onClose: () => void
}) {
  const actions = useStyleActions(tools)
  const [preview, setPreview] = React.useState(true)
  // il menu di una riga si apre anche con il clic destro, come in Word
  const [menuFor, setMenuFor] = React.useState<string | null>(null)
  const styles = listStyles(tools.theme)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-11 shrink-0 items-center justify-between border-b border-border px-3">
        <span className="text-sm font-semibold">Stili</span>
        <button
          type="button"
          onClick={onClose}
          aria-label="Chiudi il riquadro Stili"
          className="flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 space-y-0.5 overflow-y-auto p-2">
        {styles.map((style) => {
          const active = tools.current === style.id
          return (
            <div
              key={style.id}
              onContextMenu={(e) => {
                e.preventDefault()
                setMenuFor(style.id)
              }}
              className={cn(
                "group flex items-center gap-1 rounded-md pr-1",
                active ? "bg-accent text-accent-foreground" : "hover:bg-muted"
              )}
            >
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => actions.apply(style.id)}
                className="min-w-0 flex-1 truncate px-2 py-1.5 text-left"
                style={
                  preview ? styleLook(tools.theme, style, 18) : { fontSize: 13 }
                }
                title={style.name}
              >
                {style.name}
              </button>
              {style.hidden ? (
                <EyeOff
                  className="size-3 shrink-0 text-muted-foreground"
                  aria-label="Non in raccolta"
                />
              ) : null}
              <DropdownMenu
                open={menuFor === style.id}
                onOpenChange={(open) => setMenuFor(open ? style.id : null)}
              >
                <DropdownMenuTrigger
                  render={
                    <button
                      type="button"
                      aria-label={`Opzioni per ${style.name}`}
                      className="flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground opacity-0 transition group-hover:opacity-100 hover:bg-background focus-visible:opacity-100 data-popup-open:opacity-100 pointer-coarse:opacity-100"
                    />
                  }
                >
                  <MoreHorizontal className="size-4" />
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="end"
                  className="w-64"
                  finalFocus={false}
                >
                  <StyleMenuItems style={style} tools={tools} />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
      <div className="shrink-0 space-y-1 border-t border-border p-2">
        <label className="flex items-center gap-2 px-1 py-1 text-xs text-muted-foreground">
          <input
            type="checkbox"
            checked={preview}
            onChange={(e) => setPreview(e.target.checked)}
          />
          Mostra anteprima
        </label>
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={actions.create}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-xs hover:bg-muted"
          >
            <Plus className="size-3.5" /> Nuovo stile
          </button>
          <button
            type="button"
            onClick={actions.clear}
            className="flex h-8 flex-1 items-center justify-center gap-1.5 rounded-md border border-border text-xs hover:bg-muted"
          >
            <RemoveFormatting className="size-3.5" /> Cancella formato
          </button>
        </div>
      </div>
    </div>
  )
}
