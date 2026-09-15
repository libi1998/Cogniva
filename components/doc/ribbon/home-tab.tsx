"use client"

import * as React from "react"
import {
  AArrowDown,
  AArrowUp,
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Baseline,
  Bold,
  CaseSensitive,
  ChevronDown,
  ClipboardPaste,
  ClipboardType,
  Copy,
  Highlighter,
  Italic,
  List,
  ListChecks,
  ListIndentDecrease,
  ListIndentIncrease,
  ListOrdered,
  Mic,
  MousePointer2,
  PaintBucket,
  Paintbrush,
  Pilcrow,
  Redo2,
  RemoveFormatting,
  Replace,
  Scissors,
  Search,
  SquareDashed,
  Strikethrough,
  Subscript,
  Superscript,
  TextSelect,
  Underline,
  Undo2,
  UnfoldVertical,
  Palette,
  ArrowDownAZ,
  ListTree,
  Sparkles,
  Minus,
} from "lucide-react"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu"
import {
  BULLET_STYLES,
  GLOW_COLORS,
  glowShadow,
  LIGATURE_STYLES,
  LIST_LEVELS,
  NUMBER_STYLES,
  NUMERIC_STYLES,
  SHADOW_PRESETS,
  STYLISTIC_SETS,
  TEXT_EFFECT_PRESETS,
  UNDERLINE_STYLES,
  type TextEffectAttrs,
} from "@/lib/doc-typography"
import { FONTS } from "@/lib/fonts"
import type { CaseMode, ParagraphBorder } from "@/lib/tiptap-extensions"
import { cn } from "@/lib/utils"
import { FontCombo, SizeCombo, stepSize, toPt } from "./font-controls"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  RibbonRow,
  RibbonRows,
  SwatchGrid,
  useCloseRibbonMenu,
} from "./ribbon-ui"
import {
  HIGHLIGHTS,
  LINE_HEIGHTS,
  SHADINGS,
  TEXT_COLORS,
  type RibbonCtx,
} from "./shared"
import { insertPlainText } from "../plain-paste"
import { clearFormatting } from "../style-actions"
import { SortDialog } from "../sort-dialog"
import { AddinsGroup } from "../addins/addins-group"
import { StyleGallery, type StyleTools } from "../styles-panel"
import { resolveStyle, styleFontLabel, styleFontStack } from "@/lib/doc-styles"

/** Menu di un comando «diviso»: la parte grande applica, la freccia sceglie */
function SplitColor({
  icon,
  title,
  color,
  colors,
  current,
  onApply,
  onPick,
  active,
}: {
  icon: React.ReactNode
  title: string
  color: string
  colors: { label: string; value: string }[]
  current?: string
  onApply: () => void
  onPick: (value: string) => void
  active?: boolean
}) {
  return (
    <span className="flex items-center">
      <RibbonButton
        title={title}
        active={active}
        onClick={onApply}
        className="rounded-r-none"
        icon={
          <span className="relative flex flex-col items-center">
            {icon}
            <span
              className="-mt-0.5 h-[3px] w-4 rounded-full"
              style={{ background: color || "currentColor" }}
            />
          </span>
        }
      />
      <RibbonMenu
        className="w-[196px]"
        trigger={
          <RibbonButton
            title={`${title}: scegli il colore`}
            className="w-3.5 rounded-l-none"
            icon={<ChevronDown className="size-3 opacity-60" />}
          />
        }
      >
        <DropdownMenuLabel>{title}</DropdownMenuLabel>
        <SwatchGrid colors={colors} value={current} onPick={onPick} />
      </RibbonMenu>
    </span>
  )
}

/** Comando diviso con un menu qualsiasi: elenchi, sottolineatura */
function SplitMenu({
  icon,
  title,
  active,
  onApply,
  menuClassName,
  children,
}: {
  icon: React.ReactNode
  title: string
  active?: boolean
  onApply: () => void
  menuClassName?: string
  children: React.ReactNode
}) {
  return (
    <span className="flex items-center">
      <RibbonButton
        title={title}
        active={active}
        onClick={onApply}
        className="rounded-r-none"
        icon={icon}
      />
      <RibbonMenu
        className={menuClassName ?? "w-56"}
        trigger={
          <RibbonButton
            title={`${title}: altre opzioni`}
            className="w-3.5 rounded-l-none"
            icon={<ChevronDown className="size-3 opacity-60" />}
          />
        }
      >
        {children}
      </RibbonMenu>
    </span>
  )
}

/** Una griglia di scelte dentro un menu della barra, che si chiude da sola */
function PickGrid<T>({
  items,
  columns,
  isActive,
  onPick,
  render,
  label,
}: {
  items: T[]
  columns: number
  isActive: (item: T) => boolean
  onPick: (item: T) => void
  render: (item: T) => React.ReactNode
  label: (item: T) => string
}) {
  const close = useCloseRibbonMenu()
  return (
    <div
      className="grid gap-1.5 p-1.5"
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {items.map((item, i) => (
        <button
          key={i}
          type="button"
          title={label(item)}
          aria-label={label(item)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => {
            onPick(item)
            close?.()
          }}
          className={cn(
            "flex min-h-14 flex-col items-stretch justify-center rounded-md border bg-background p-1.5 text-left transition hover:border-foreground/30",
            isActive(item)
              ? "border-primary ring-1 ring-primary/40"
              : "border-border"
          )}
        >
          {render(item)}
        </button>
      ))}
    </div>
  )
}

/** Un campione di elenco: tre righe con il loro segno */
function ListSample({ marks, nested }: { marks: string[]; nested?: boolean }) {
  return (
    <span aria-hidden className="flex flex-col gap-1">
      {marks.map((mark, i) => (
        <span
          key={i}
          className="flex items-center gap-1"
          style={{ paddingLeft: nested ? i * 8 : 0 }}
        >
          <span className="min-w-3 text-[9px] leading-none whitespace-nowrap text-foreground/80">
            {mark}
          </span>
          <span className="h-[3px] flex-1 rounded-full bg-foreground/15" />
        </span>
      ))}
    </span>
  )
}

async function pasteRich(ctx: RibbonCtx) {
  const { editor } = ctx
  try {
    const items = await navigator.clipboard.read()
    for (const item of items) {
      const image = item.types.find((t) => t.startsWith("image/"))
      if (image) {
        const blob = await item.getType(image)
        const reader = new FileReader()
        reader.onload = () =>
          editor
            .chain()
            .focus()
            .setImage({ src: String(reader.result) })
            .run()
        reader.readAsDataURL(blob)
        return
      }
      if (item.types.includes("text/html")) {
        const html = await (await item.getType("text/html")).text()
        editor.chain().focus().insertContent(html).run()
        return
      }
      if (item.types.includes("text/plain")) {
        insertPlainText(editor, await (await item.getType("text/plain")).text())
        return
      }
    }
  } catch {
    // senza permesso di lettura resta la scorciatoia ⌘V
    editor.commands.focus()
  }
}

export function HomeTab({ ctx }: { ctx: RibbonCtx }) {
  const { editor, st, theme, painter, dictation } = ctx
  const [fontColor, setFontColor] = React.useState(TEXT_COLORS[1].value)
  const [highlight, setHighlight] = React.useState(HIGHLIGHTS[4].value)
  const [shading, setShading] = React.useState(SHADINGS[3].value)
  // carattere e corpo mostrati sono quelli dello stile del paragrafo, finché
  // il testo non ha una formattazione sua
  const blockStyle = resolveStyle(theme, st.styleId)
  const pt = toPt(st.fontSize, (blockStyle.props.size * 96) / 72)
  const styleTools: StyleTools = {
    editor,
    theme,
    setTheme: ctx.setTheme,
    current: st.styleId,
    openDialog: ctx.openStyleDialog,
  }
  const [sortOpen, setSortOpen] = React.useState(false)
  const effects = (attrs: Partial<TextEffectAttrs>) =>
    chain().setTextEffects(attrs).run()
  // spazio prima e dopo effettivi: quello del paragrafo o quello dello stile
  const PX_PER_PT = 96 / 72
  const before = st.spaceBeforeSet
    ? st.spaceBefore
    : blockStyle.props.spaceBefore * PX_PER_PT
  const after = st.spaceAfterSet
    ? st.spaceAfter
    : blockStyle.props.spaceAfter * PX_PER_PT
  const underlined = st.underline || st.decoration.startsWith("underline")
  // il colore della sottolineatura: l'ultima parola della decorazione
  const decorationColor = /#[0-9a-f]{3,8}$/i.exec(st.decoration)?.[0] ?? ""
  const setPt = (value: number) =>
    editor.chain().focus().setFontSize(`${value}pt`).run()
  const chain = () => editor.chain().focus()

  const setCase = (mode: CaseMode) => chain().changeCase(mode).run()
  const setBorder = (b: ParagraphBorder) => chain().setParagraphBorder(b).run()

  const selectObject = () => {
    // passa all'immagine successiva, ricominciando dall'inizio
    const positions: number[] = []
    editor.state.doc.descendants((n, pos) => {
      if (n.type.name === "image" || n.type.name === "boardEmbed")
        positions.push(pos)
      return true
    })
    if (!positions.length) return
    const from = editor.state.selection.from
    const next = positions.find((p) => p > from) ?? positions[0]
    editor.chain().focus().setNodeSelection(next).scrollIntoView().run()
  }

  return (
    <>
      <RibbonGroup label="Annulla">
        <RibbonRows>
          <RibbonButton
            title="Annulla ⌘Z"
            disabled={!st.canUndo}
            icon={<Undo2 className="size-4" />}
            onClick={() => chain().undo().run()}
          />
          <RibbonButton
            title="Ripristina ⇧⌘Z"
            disabled={!st.canRedo}
            icon={<Redo2 className="size-4" />}
            onClick={() => chain().redo().run()}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Appunti">
        <span className="flex flex-col items-center">
          <RibbonButton
            large
            label="Incolla"
            title="Incolla ⌘V"
            icon={<ClipboardPaste className="size-5" />}
            onClick={() => void pasteRich(ctx)}
            className="h-[42px]"
          />
          <RibbonMenu
            className="w-60"
            trigger={
              <RibbonButton
                title="Opzioni incolla"
                className="h-4 w-full"
                icon={<ChevronDown className="size-3 opacity-60" />}
              />
            }
          >
            <DropdownMenuItem onClick={() => void pasteRich(ctx)}>
              <ClipboardPaste className="size-4" /> Mantieni formattazione
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={async () => {
                try {
                  insertPlainText(editor, await navigator.clipboard.readText())
                } catch {
                  editor.commands.focus()
                }
              }}
            >
              <ClipboardType className="size-4" /> Mantieni solo il testo
            </DropdownMenuItem>
          </RibbonMenu>
        </span>
        <RibbonRows>
          <RibbonButton
            compact
            title="Taglia ⌘X"
            icon={<Scissors className="size-4" />}
            onClick={() => {
              editor.commands.focus()
              document.execCommand("cut")
            }}
          />
          <RibbonButton
            compact
            title="Copia ⌘C"
            icon={<Copy className="size-4" />}
            onClick={() => {
              editor.commands.focus()
              document.execCommand("copy")
            }}
          />
          <RibbonButton
            compact
            title={
              painter.armed
                ? "Seleziona il testo da formattare (⎋ annulla)"
                : "Copia formato"
            }
            active={painter.armed}
            icon={<Paintbrush className="size-4" />}
            onClick={() => (painter.armed ? painter.cancel() : painter.copy())}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Carattere">
        <RibbonRows>
          <RibbonRow>
            <FontCombo
              value={st.fontFamily}
              styleFont={{
                label: styleFontLabel(theme, blockStyle.props.font),
                stack: styleFontStack(theme, blockStyle.props.font),
              }}
              onPick={(key) => {
                const font = FONTS.find((f) => f.key === key)
                if (font) chain().setFontFamily(font.stack).run()
                else chain().unsetFontFamily().run()
              }}
            />
            <SizeCombo pt={pt} onPick={setPt} />
            <RibbonButton
              title="Aumenta dimensione carattere"
              icon={<AArrowUp className="size-4" />}
              onClick={() => setPt(stepSize(pt, 1))}
            />
            <RibbonButton
              title="Riduci dimensione carattere"
              icon={<AArrowDown className="size-4" />}
              onClick={() => setPt(stepSize(pt, -1))}
            />
            <RibbonButton
              title="Cancella tutta la formattazione"
              icon={<RemoveFormatting className="size-4" />}
              onClick={() => clearFormatting(editor)}
            />
          </RibbonRow>
          <RibbonRow>
            <RibbonButton
              title="Grassetto ⌘B"
              active={st.bold}
              icon={<Bold className="size-4" />}
              onClick={() => chain().toggleBold().run()}
            />
            <RibbonButton
              title="Corsivo ⌘I"
              active={st.italic}
              icon={<Italic className="size-4" />}
              onClick={() => chain().toggleItalic().run()}
            />
            <SplitMenu
              title="Sottolineato ⌘U"
              active={underlined}
              icon={<Underline className="size-4" />}
              onApply={() =>
                underlined
                  ? chain()
                      .unsetUnderline()
                      .setTextEffects({ decoration: null })
                      .run()
                  : chain().toggleUnderline().run()
              }
              menuClassName="w-52"
            >
              <DropdownMenuLabel>Stile sottolineatura</DropdownMenuLabel>
              {UNDERLINE_STYLES.map((u) => (
                <DropdownMenuItem
                  key={u.value}
                  onClick={() =>
                    chain()
                      .unsetUnderline()
                      .setTextEffects({
                        decoration: [u.value, decorationColor]
                          .filter(Boolean)
                          .join(" "),
                      })
                      .run()
                  }
                  className={cn(
                    st.decoration.startsWith(u.value) && "bg-accent"
                  )}
                >
                  <span
                    className="w-full text-sm"
                    style={{
                      textDecoration: u.value,
                      textUnderlineOffset: "0.2em",
                    }}
                  >
                    {u.label}
                  </span>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuLabel>Colore sottolineatura</DropdownMenuLabel>
              <SwatchGrid
                colors={TEXT_COLORS}
                value={decorationColor}
                onPick={(color) => {
                  const base =
                    st.decoration.replace(/\s*#[0-9a-f]{3,8}$/i, "") ||
                    "underline solid"
                  chain()
                    .unsetUnderline()
                    .setTextEffects({
                      decoration: [base, color].filter(Boolean).join(" "),
                    })
                    .run()
                }}
              />
            </SplitMenu>
            <RibbonButton
              title="Barrato"
              active={st.strike}
              icon={<Strikethrough className="size-4" />}
              onClick={() => chain().toggleStrike().run()}
            />
            <RibbonButton
              title="Pedice"
              active={st.subscript}
              icon={<Subscript className="size-4" />}
              onClick={() => chain().toggleSubscript().run()}
            />
            <RibbonButton
              title="Apice"
              active={st.superscript}
              icon={<Superscript className="size-4" />}
              onClick={() => chain().toggleSuperscript().run()}
            />
            <RibbonMenu
              className="w-56"
              trigger={
                <RibbonButton
                  title="Maiuscole/minuscole"
                  chevron
                  icon={<CaseSensitive className="size-4" />}
                />
              }
            >
              <DropdownMenuItem onClick={() => setCase("sentence")}>
                Normale frase.
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCase("title")}>
                Tutte Iniziali Maiuscole
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCase("lower")}>
                tutto minuscolo
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCase("upper")}>
                TUTTO MAIUSCOLO
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setCase("toggle")}>
                iNVERTI mAIUSCOLE/mINUSCOLE
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  effects({ smallCaps: st.smallCaps ? null : true })
                }
                className={cn(st.smallCaps && "bg-accent")}
              >
                <span style={{ fontVariantCaps: "small-caps" }}>
                  Maiuscoletto
                </span>
              </DropdownMenuItem>
            </RibbonMenu>
            <RibbonMenu
              className="w-[260px]"
              trigger={
                <RibbonButton
                  title="Effetti testo e tipografia"
                  chevron
                  active={Boolean(
                    st.textShadow || st.textStroke || st.textFill
                  )}
                  icon={<Sparkles className="size-4" />}
                />
              }
            >
              <DropdownMenuLabel>Effetti testo</DropdownMenuLabel>
              <PickGrid
                items={TEXT_EFFECT_PRESETS}
                columns={4}
                label={(p) => p.label}
                isActive={(p) =>
                  (p.attrs.textShadow ?? "") === st.textShadow &&
                  (p.attrs.textStroke ?? "") === st.textStroke &&
                  (p.attrs.textFill ?? "") === st.textFill
                }
                onPick={(p) =>
                  effects({
                    textShadow: null,
                    textStroke: null,
                    textFill: null,
                    ...p.attrs,
                  })
                }
                render={(p) => (
                  <span
                    className="text-center text-2xl leading-none font-bold"
                    style={{
                      textShadow: p.attrs.textShadow ?? undefined,
                      WebkitTextStroke: p.attrs.textStroke ?? undefined,
                      WebkitTextFillColor: p.attrs.textFill
                        ? "transparent"
                        : undefined,
                      backgroundImage:
                        p.attrs.textFill && p.attrs.textFill !== "hollow"
                          ? p.attrs.textFill
                          : undefined,
                      WebkitBackgroundClip:
                        p.attrs.textFill && p.attrs.textFill !== "hollow"
                          ? "text"
                          : undefined,
                    }}
                  >
                    A
                  </span>
                )}
              />
              <DropdownMenuSeparator />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Contorno</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-[196px]">
                  <DropdownMenuItem
                    onClick={() =>
                      effects({ textStroke: null, textFill: null })
                    }
                  >
                    Nessun contorno
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={() =>
                      effects({
                        textStroke: "1px currentColor",
                        textFill: "hollow",
                      })
                    }
                  >
                    Solo contorno (vuoto)
                  </DropdownMenuItem>
                  <DropdownMenuLabel>Colore del contorno</DropdownMenuLabel>
                  <SwatchGrid
                    colors={TEXT_COLORS.slice(1)}
                    value={st.textStroke.split(" ").slice(1).join(" ")}
                    onPick={(color) =>
                      effects({ textStroke: `0.8px ${color}` })
                    }
                  />
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Ombreggiatura</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-52">
                  {SHADOW_PRESETS.map((shadow) => (
                    <DropdownMenuItem
                      key={shadow.label}
                      onClick={() => effects({ textShadow: shadow.value })}
                      className={cn(
                        (shadow.value ?? "") === st.textShadow && "bg-accent"
                      )}
                    >
                      <span
                        className="w-5 text-center text-base font-bold"
                        style={{ textShadow: shadow.value ?? undefined }}
                      >
                        A
                      </span>
                      {shadow.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Bagliore</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-48">
                  {GLOW_COLORS.map((glow) => (
                    <DropdownMenuItem
                      key={glow.label}
                      onClick={() =>
                        effects({
                          textShadow: glow.value
                            ? glowShadow(glow.value)
                            : null,
                        })
                      }
                    >
                      <span
                        className="w-5 text-center text-base font-bold"
                        style={{
                          textShadow: glow.value
                            ? glowShadow(glow.value)
                            : undefined,
                        }}
                      >
                        A
                      </span>
                      {glow.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Stili numerici</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  {NUMERIC_STYLES.map((n) => (
                    <DropdownMenuItem
                      key={n.label}
                      onClick={() => effects({ numeric: n.value })}
                      className={cn(
                        (n.value ?? "") === st.numeric && "bg-accent"
                      )}
                    >
                      <span
                        className="w-14 tabular-nums"
                        style={{ fontVariantNumeric: n.value ?? undefined }}
                      >
                        1/2 0369
                      </span>
                      {n.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Legature</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-60">
                  {LIGATURE_STYLES.map((l) => (
                    <DropdownMenuItem
                      key={l.label}
                      onClick={() => effects({ ligatures: l.value })}
                      className={cn(
                        (l.value ?? "") === st.ligatures && "bg-accent"
                      )}
                    >
                      {l.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>Set stilistici</DropdownMenuSubTrigger>
                <DropdownMenuSubContent className="w-56">
                  {STYLISTIC_SETS.map((set) => (
                    <DropdownMenuItem
                      key={set.label}
                      onClick={() => effects({ stylistic: set.value })}
                      className={cn(
                        (set.value ?? "") === st.stylistic && "bg-accent"
                      )}
                    >
                      {set.label}
                    </DropdownMenuItem>
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => chain().clearTextEffects().run()}
              >
                <RemoveFormatting /> Cancella effetti testo
              </DropdownMenuItem>
            </RibbonMenu>
            <SplitColor
              title="Colore evidenziazione testo"
              icon={<Highlighter className="size-4" />}
              color={highlight}
              colors={HIGHLIGHTS}
              current={st.highlightColor}
              active={st.highlight}
              onApply={() =>
                st.highlight
                  ? chain().unsetHighlight().run()
                  : chain().setHighlight({ color: highlight }).run()
              }
              onPick={(v) => {
                if (v) {
                  setHighlight(v)
                  chain().setHighlight({ color: v }).run()
                } else chain().unsetHighlight().run()
              }}
            />
            <SplitColor
              title="Colore carattere"
              icon={<Baseline className="size-4" />}
              color={fontColor}
              colors={TEXT_COLORS}
              current={st.color}
              onApply={() => chain().setColor(fontColor).run()}
              onPick={(v) => {
                if (v) {
                  setFontColor(v)
                  chain().setColor(v).run()
                } else chain().unsetColor().run()
              }}
            />
          </RibbonRow>
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Paragrafo">
        <RibbonRows>
          <RibbonRow>
            <SplitMenu
              title="Elenco puntato"
              active={st.bulletList}
              icon={<List className="size-4" />}
              onApply={() => chain().toggleBulletList().run()}
              menuClassName="w-[236px]"
            >
              <DropdownMenuLabel>Raccolta punti elenco</DropdownMenuLabel>
              <PickGrid
                items={BULLET_STYLES}
                columns={4}
                label={(b) => b.label}
                isActive={(b) =>
                  st.bulletList && (b.value ?? "") === st.listStyle
                }
                onPick={(b) => chain().setListStyle("bullet", b.value).run()}
                render={(b) => (
                  <span className="text-center text-xl leading-none">
                    {b.glyph}
                  </span>
                )}
              />
              {st.bulletList ? (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => chain().toggleBulletList().run()}
                  >
                    <Minus /> Nessun elenco
                  </DropdownMenuItem>
                </>
              ) : null}
            </SplitMenu>
            <SplitMenu
              title="Elenco numerato"
              active={st.orderedList}
              icon={<ListOrdered className="size-4" />}
              onApply={() => chain().toggleOrderedList().run()}
              menuClassName="w-[260px]"
            >
              <DropdownMenuLabel>Raccolta numerazione</DropdownMenuLabel>
              <PickGrid
                items={NUMBER_STYLES}
                columns={4}
                label={(n) => n.label}
                isActive={(n) =>
                  st.orderedList && (n.value ?? "") === st.listStyle
                }
                onPick={(n) => chain().setListStyle("ordered", n.value).run()}
                render={(n) => <ListSample marks={n.sample} />}
              />
              {st.orderedList ? (
                <>
                  <DropdownMenuSeparator />
                  <div className="flex items-center justify-between gap-2 px-2 py-1.5 text-xs">
                    <span className="text-muted-foreground">
                      Imposta valore numerazione
                    </span>
                    <input
                      type="number"
                      min={0}
                      max={9999}
                      value={st.listStart}
                      onKeyDown={(e) => e.stopPropagation()}
                      onChange={(e) =>
                        editor
                          .chain()
                          .setListStart(Number(e.target.value) || 0)
                          .run()
                      }
                      className="h-7 w-16 rounded-md border border-input bg-background px-1.5 text-right tabular-nums"
                    />
                  </div>
                  <DropdownMenuItem
                    onClick={() => chain().setListStart(1).run()}
                  >
                    Ricomincia da 1
                  </DropdownMenuItem>
                </>
              ) : null}
            </SplitMenu>
            <RibbonMenu
              className="w-[284px]"
              trigger={
                <RibbonButton
                  title="Elenco a più livelli"
                  chevron
                  active={Boolean(st.listLevels)}
                  icon={<ListTree className="size-4" />}
                />
              }
            >
              <DropdownMenuLabel>Raccolta elenchi</DropdownMenuLabel>
              <PickGrid
                items={LIST_LEVELS}
                columns={3}
                label={(l) => l.label}
                isActive={(l) =>
                  (l.kind === "ordered" ? st.orderedList : st.bulletList) &&
                  (l.value ?? "") === st.listLevels
                }
                onPick={(l) => chain().setListLevels(l.kind, l.value).run()}
                render={(l) => <ListSample marks={l.sample} nested />}
              />
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => chain().sinkListItem("listItem").run()}
              >
                <ListIndentIncrease /> Livello successivo (Tab)
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => chain().liftListItem("listItem").run()}
              >
                <ListIndentDecrease /> Livello precedente (⇧Tab)
              </DropdownMenuItem>
            </RibbonMenu>
            <RibbonButton
              title="Elenco di controllo"
              active={st.taskList}
              icon={<ListChecks className="size-4" />}
              onClick={() => chain().toggleTaskList().run()}
            />
            <RibbonButton
              title="Riduci rientro ⇧Tab"
              icon={<ListIndentDecrease className="size-4" />}
              onClick={() => chain().outdent().run()}
            />
            <RibbonButton
              title="Aumenta rientro Tab"
              icon={<ListIndentIncrease className="size-4" />}
              onClick={() => chain().indent().run()}
            />
            <RibbonButton
              title="Ordina: paragrafi, voci di elenco o righe di tabella"
              icon={<ArrowDownAZ className="size-4" />}
              onClick={() => setSortOpen(true)}
            />
            <RibbonButton
              data-safe=""
              title="Mostra/nascondi segni di formattazione ¶"
              active={theme.marks}
              icon={<Pilcrow className="size-4" />}
              onClick={() => ctx.setTheme({ marks: !theme.marks })}
            />
          </RibbonRow>
          <RibbonRow>
            <RibbonButton
              title="Allinea a sinistra"
              active={st.align === "left"}
              icon={<AlignLeft className="size-4" />}
              onClick={() => chain().setTextAlign("left").run()}
            />
            <RibbonButton
              title="Centra"
              active={st.align === "center"}
              icon={<AlignCenter className="size-4" />}
              onClick={() => chain().setTextAlign("center").run()}
            />
            <RibbonButton
              title="Allinea a destra"
              active={st.align === "right"}
              icon={<AlignRight className="size-4" />}
              onClick={() => chain().setTextAlign("right").run()}
            />
            <RibbonButton
              title="Giustifica"
              active={st.align === "justify"}
              icon={<AlignJustify className="size-4" />}
              onClick={() => chain().setTextAlign("justify").run()}
            />
            <RibbonMenu
              className="w-44"
              trigger={
                <RibbonButton
                  title="Interlinea"
                  chevron
                  icon={<UnfoldVertical className="size-4" />}
                />
              }
            >
              <DropdownMenuLabel>Interlinea</DropdownMenuLabel>
              {LINE_HEIGHTS.map((l) => (
                <DropdownMenuItem
                  key={l.value}
                  onClick={() => chain().setLineHeight(l.value).run()}
                  className={cn(st.lineHeight === l.value && "font-semibold")}
                >
                  {l.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuItem onClick={() => chain().unsetLineHeight().run()}>
                Predefinita dello stile
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  chain()
                    .setSpaceBefore(before > 0 ? 0 : Math.round(12 * PX_PER_PT))
                    .run()
                }
              >
                {before > 0
                  ? "Rimuovi spazio prima del paragrafo"
                  : "Aggiungi spazio prima del paragrafo"}
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  chain()
                    .setSpaceAfter(after > 0 ? 0 : Math.round(12 * PX_PER_PT))
                    .run()
                }
              >
                {after > 0
                  ? "Rimuovi spazio dopo il paragrafo"
                  : "Aggiungi spazio dopo il paragrafo"}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() =>
                  ctx.openStyleDialog({ mode: "modify", id: st.styleId })
                }
              >
                Opzioni interlinea dello stile…
              </DropdownMenuItem>
            </RibbonMenu>
            <SplitColor
              title="Sfondo"
              icon={<PaintBucket className="size-4" />}
              color={shading}
              colors={SHADINGS}
              current={st.shading}
              active={Boolean(st.shading)}
              onApply={() =>
                chain()
                  .setShading(st.shading ? null : shading)
                  .run()
              }
              onPick={(v) => {
                if (v) setShading(v)
                chain()
                  .setShading(v || null)
                  .run()
              }}
            />
            <RibbonMenu
              className="w-48"
              trigger={
                <RibbonButton
                  title="Bordi"
                  chevron
                  active={st.paragraphBorder !== "none"}
                  icon={<SquareDashed className="size-4" />}
                />
              }
            >
              <DropdownMenuLabel>Bordi del paragrafo</DropdownMenuLabel>
              {(
                [
                  ["none", "Nessun bordo"],
                  ["bottom", "Bordo inferiore"],
                  ["top", "Bordo superiore"],
                  ["left", "Barra a sinistra"],
                  ["box", "Bordo esterno"],
                ] as [ParagraphBorder, string][]
              ).map(([value, label]) => (
                <DropdownMenuItem
                  key={value}
                  onClick={() => setBorder(value)}
                  className={cn(
                    st.paragraphBorder === value && "font-semibold"
                  )}
                >
                  <span
                    aria-hidden
                    className="size-3.5 rounded-[2px]"
                    style={{
                      border: "1px dashed currentColor",
                      opacity: 0.35,
                      ...(value === "bottom" && {
                        borderBottom: "2px solid currentColor",
                        opacity: 1,
                      }),
                      ...(value === "top" && {
                        borderTop: "2px solid currentColor",
                        opacity: 1,
                      }),
                      ...(value === "left" && {
                        borderLeft: "3px solid var(--primary)",
                        opacity: 1,
                      }),
                      ...(value === "box" && {
                        border: "1.5px solid currentColor",
                        opacity: 1,
                      }),
                    }}
                  />
                  {label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => chain().setHorizontalRule().run()}
              >
                <Minus /> Linea orizzontale
              </DropdownMenuItem>
            </RibbonMenu>
          </RibbonRow>
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Stili">
        <StyleGallery
          tools={styleTools}
          onOpenPane={() => ctx.setStylesPane(true)}
        />
        <RibbonButton
          large
          data-safe=""
          label="Riquadro Stili"
          title="Tutti gli stili: applica, modifica, crea"
          active={ctx.stylesPane}
          icon={<Palette className="size-5" />}
          onClick={() => ctx.setStylesPane(!ctx.stylesPane)}
        />
      </RibbonGroup>

      <RibbonGroup label="Modifica">
        <RibbonRows>
          <RibbonButton
            compact
            data-safe=""
            label="Trova"
            title="Trova ⌘F"
            icon={<Search className="size-4" />}
            onClick={() => ctx.onFind("find")}
            className="justify-start"
          />
          <RibbonButton
            compact
            data-safe=""
            label="Sostituisci"
            title="Sostituisci"
            icon={<Replace className="size-4" />}
            onClick={() => ctx.onFind("replace")}
            className="justify-start"
          />
          <RibbonMenu
            className="w-52"
            trigger={
              <RibbonButton
                compact
                label="Seleziona"
                chevron
                icon={<MousePointer2 className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem onClick={() => chain().selectAll().run()}>
              <TextSelect className="size-4" /> Seleziona tutto
              <span className="ml-auto text-xs text-muted-foreground">⌘A</span>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={selectObject}>
              <MousePointer2 className="size-4" /> Seleziona oggetti
            </DropdownMenuItem>
          </RibbonMenu>
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Voce">
        <RibbonButton
          large
          label={dictation.listening ? "In ascolto…" : "Dettatura"}
          title={
            dictation.supported
              ? dictation.listening
                ? "Interrompi la dettatura"
                : "Detta il testo al microfono. Punteggiatura a voce: «virgola», «punto», «a capo», «nuovo paragrafo»"
              : "Dettatura non disponibile in questo browser: usa Chrome, Edge o Safari"
          }
          disabled={!dictation.supported}
          active={dictation.listening}
          icon={
            <Mic
              className={cn(
                "size-5",
                dictation.listening && "animate-pulse text-rose-500"
              )}
            />
          }
          onClick={dictation.toggle}
        />
      </RibbonGroup>

      <AddinsGroup ctx={ctx} />

      <SortDialog
        open={sortOpen}
        onClose={() => setSortOpen(false)}
        editor={editor}
      />
    </>
  )
}
