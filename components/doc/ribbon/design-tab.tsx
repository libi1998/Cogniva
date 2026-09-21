"use client"

import * as React from "react"
import {
  ChevronDown,
  Droplet,
  Frame,
  PaintBucket,
  Palette,
  Pilcrow,
  RotateCcw,
  Stamp,
  Type,
  Pin,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
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
import { FontPicker } from "@/components/shared/font-picker"
import { CustomColor } from "@/components/shared/custom-color"
import {
  activeDesignTheme,
  activeSpacing,
  clearDesignDefaults,
  DESIGN_THEMES,
  FONT_PAIRS,
  newWatermark,
  saveDesignDefaults,
  SPACING_PRESETS,
  WATERMARK_PRESETS,
  withSpacing,
  withStyleSet,
} from "@/lib/doc-design"
import { resolveStyle, STYLE_SETS, styleFontStack } from "@/lib/doc-styles"
import { fontMap, fontStack } from "@/lib/fonts"
import { BACKGROUNDS, docAccent, SWATCHES, whim } from "@/lib/palette"
import {
  AUTO_BG,
  defaultDocTheme,
  type DocTheme,
  type PageBorder,
} from "@/lib/types"
import { cn } from "@/lib/utils"
import { WatermarkDialog, WatermarkPreview } from "../watermark-dialog"
import {
  RibbonButton,
  RibbonGroup,
  RibbonMenu,
  SwatchGrid,
  useCloseRibbonMenu,
} from "./ribbon-ui"
import type { RibbonCtx } from "./shared"

import { useT, tr } from "@/lib/i18n/client"
const PT = 96 / 72

const PAPERS = [
  {
    get label() {
      return tr("Automatico (segue il tema)")
    },
    value: "",
  },
  {
    get label() {
      return tr("Bianco")
    },
    value: "#ffffff",
  },
  {
    get label() {
      return tr("Carta")
    },
    value: whim.base[0],
  },
  {
    get label() {
      return tr("Avorio")
    },
    value: "#fffdf5",
  },
  {
    get label() {
      return tr("Nebbia")
    },
    value: whim.base[50],
  },
  {
    get label() {
      return tr("Blu")
    },
    value: whim.blue[50],
  },
  {
    get label() {
      return tr("Viola")
    },
    value: whim.purple[50],
  },
  {
    get label() {
      return tr("Giallo")
    },
    value: whim.yellow[50],
  },
  {
    get label() {
      return tr("Verde")
    },
    value: whim.green[50],
  },
  {
    get label() {
      return tr("Rosa")
    },
    value: whim.pink[50],
  },
  {
    get label() {
      return tr("Notte")
    },
    value: whim.base[900],
  },
]

const BORDERS: { value: PageBorder; label: string; css: string }[] = [
  {
    value: "none",
    get label() {
      return tr("Nessuno")
    },
    css: "1px dashed currentColor",
  },
  {
    value: "thin",
    get label() {
      return tr("Linea sottile")
    },
    css: "1px solid currentColor",
  },
  {
    value: "thick",
    get label() {
      return tr("Linea spessa")
    },
    css: "3px solid currentColor",
  },
  {
    value: "double",
    get label() {
      return tr("Doppia linea")
    },
    css: "3px double currentColor",
  },
  {
    value: "dashed",
    get label() {
      return tr("Tratteggiata")
    },
    css: "1.5px dashed currentColor",
  },
  {
    value: "dotted",
    get label() {
      return tr("Punteggiata")
    },
    css: "2px dotted currentColor",
  },
]

const BORDER_COLORS = [
  {
    get label() {
      return tr("Automatico")
    },
    value: "",
  },
  {
    get label() {
      return tr("Nero")
    },
    value: whim.base[900],
  },
  {
    get label() {
      return tr("Grigio")
    },
    value: whim.base[500],
  },
  ...SWATCHES.filter((s) => s.key !== "white" && s.key !== "gray").map((s) => ({
    label: s.label,
    value: s.solid,
  })),
]

/**
 * «Progettazione», come in Word: l'aspetto di tutto il documento. Temi, set
 * di stili, colori, tipi di carattere e spaziatura cambiano gli stili (e
 * quindi ogni paragrafo che li usa); filigrana, colore e bordi la pagina.
 */
export function DesignTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { theme, setTheme } = ctx
  const [fontsDialog, setFontsDialog] = React.useState(false)
  const [watermarkDialog, setWatermarkDialog] = React.useState(false)
  const accent = docAccent(theme.accent)

  return (
    <>
      <RibbonGroup
        label={t("Formattazione documento")}
        icon={<Palette className="size-5" />}
        safe
      >
        <ThemesMenu theme={theme} setTheme={setTheme} />
        <StyleSetGallery theme={theme} setTheme={setTheme} />

        <div className="flex flex-col items-start justify-center gap-0.5 pl-1">
          <RibbonMenu
            className="w-[260px]"
            trigger={
              <RibbonButton
                compact
                chevron
                label={t("Colori")}
                title={t(
                  "Colori del tema: accento di titoli, link e citazioni"
                )}
                icon={
                  <span className="relative">
                    <Palette className="size-3.5" />
                    <span
                      className="absolute -bottom-0.5 left-0 h-[2px] w-3.5 rounded-full"
                      style={{ background: accent.solid }}
                    />
                  </span>
                }
              />
            }
          >
            <ColorsMenu theme={theme} setTheme={setTheme} />
          </RibbonMenu>

          <RibbonMenu
            className="max-h-[70dvh] w-[280px] overflow-y-auto"
            trigger={
              <RibbonButton
                compact
                chevron
                label={t("Tipi di carattere")}
                title={t("Carattere dei titoli e del corpo del testo")}
                icon={<Type className="size-3.5" />}
              />
            }
          >
            <DropdownMenuLabel>{t("Tipi di carattere")}</DropdownMenuLabel>
            {FONT_PAIRS.map((pair) => {
              const active =
                theme.font === pair.body &&
                (theme.headingFont ?? theme.font) === pair.heading
              return (
                <DropdownMenuItem
                  key={pair.name}
                  onClick={() =>
                    setTheme({
                      font: pair.body,
                      headingFont:
                        pair.heading === pair.body ? null : pair.heading,
                    })
                  }
                  className={cn(
                    "flex-col items-stretch gap-0",
                    active && "bg-accent"
                  )}
                >
                  <span className="text-[10px] text-muted-foreground">
                    {pair.name}
                  </span>
                  <span
                    className="truncate text-[15px] leading-tight font-semibold"
                    style={{ fontFamily: fontStack(pair.heading) }}
                  >
                    {fontMap[pair.heading]?.label ?? pair.heading}
                  </span>
                  <span
                    className="truncate text-[13px] leading-tight"
                    style={{ fontFamily: fontStack(pair.body) }}
                  >
                    {fontMap[pair.body]?.label ?? pair.body}
                  </span>
                </DropdownMenuItem>
              )
            })}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => setFontsDialog(true)}>
              <Type /> {t("Personalizza tipi di carattere…")}
            </DropdownMenuItem>
          </RibbonMenu>

          <RibbonMenu
            className="w-[270px]"
            trigger={
              <RibbonButton
                compact
                chevron
                label={t("Spaziatura paragrafo")}
                title={t("Spazio fra i paragrafi e interlinea di «Normale»")}
                icon={<Pilcrow className="size-3.5" />}
              />
            }
          >
            <SpacingMenu ctx={ctx} />
          </RibbonMenu>
        </div>

        <RibbonButton
          large
          label={t("Imposta come predefinito")}
          title={t(
            "I documenti nuovi useranno questi stili, colori e caratteri"
          )}
          icon={<Pin className="size-5" />}
          onClick={() => {
            if (!saveDesignDefaults(theme)) {
              toast.error(t("Non riesco a salvare le impostazioni predefinite"))
              return
            }
            toast.success(
              t("I nuovi documenti useranno questa progettazione"),
              {
                action: {
                  label: t("Annulla||annulla l'ultima modifica"),
                  onClick: () => clearDesignDefaults(),
                },
              }
            )
          }}
        />
      </RibbonGroup>

      <RibbonGroup
        label={t("Sfondo pagina")}
        icon={<PaintBucket className="size-5" />}
        safe
      >
        <RibbonMenu
          className="w-[300px]"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Filigrana")}
              active={Boolean(theme.watermark)}
              icon={<Stamp className="size-5" />}
            />
          }
        >
          <WatermarkMenu
            theme={theme}
            setTheme={setTheme}
            onCustom={() => setWatermarkDialog(true)}
          />
        </RibbonMenu>

        <RibbonMenu
          className="w-[228px]"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Colore pagina")}
              icon={
                <span className="relative">
                  <PaintBucket className="size-5" />
                  <span
                    className="absolute -bottom-1 left-0 h-[3px] w-5 rounded-full ring-1 ring-foreground/15"
                    style={{
                      background:
                        theme.paper === AUTO_BG ? "transparent" : theme.paper,
                    }}
                  />
                </span>
              }
            />
          }
        >
          <PageColorMenu theme={theme} setTheme={setTheme} />
        </RibbonMenu>

        <RibbonMenu
          className="w-[228px]"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Bordi pagina")}
              active={theme.pageBorder !== "none"}
              icon={<Frame className="size-5" />}
            />
          }
        >
          <DropdownMenuLabel>{t("Stile del bordo")}</DropdownMenuLabel>
          {BORDERS.map((b) => (
            <DropdownMenuItem
              key={b.value}
              onClick={() => setTheme({ pageBorder: b.value })}
              className={cn(theme.pageBorder === b.value && "bg-accent")}
            >
              <span
                className="size-4 rounded-[2px]"
                style={{
                  border: b.css,
                  opacity: b.value === "none" ? 0.4 : 1,
                  color: theme.pageBorderColor || undefined,
                }}
              />
              {b.label}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{t("Colore del bordo")}</DropdownMenuLabel>
          <SwatchGrid
            columns={6}
            colors={BORDER_COLORS}
            value={theme.pageBorderColor}
            onPick={(value) =>
              setTheme({
                pageBorderColor: value,
                pageBorder:
                  theme.pageBorder === "none" ? "thin" : theme.pageBorder,
              })
            }
          />
          <div className="px-1.5 pb-1.5">
            <CustomColor
              value={theme.pageBorderColor || "#71717a"}
              onChange={(pageBorderColor) =>
                setTheme({
                  pageBorderColor,
                  pageBorder:
                    theme.pageBorder === "none" ? "thin" : theme.pageBorder,
                })
              }
            />
          </div>
        </RibbonMenu>
      </RibbonGroup>

      <FontsDialog
        open={fontsDialog}
        onClose={() => setFontsDialog(false)}
        theme={theme}
        setTheme={setTheme}
      />
      <WatermarkDialog
        open={watermarkDialog}
        onClose={() => setWatermarkDialog(false)}
        theme={theme}
        setTheme={setTheme}
      />
    </>
  )
}

/* --------------------------------- temi --------------------------------- */

function ThemesMenu({
  theme,
  setTheme,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  const t = useT()
  const current = activeDesignTheme(theme)
  return (
    <RibbonMenu
      className="w-[332px]"
      trigger={
        <RibbonButton
          large
          chevron
          label={t("Temi")}
          title={
            current
              ? t("Tema: {name}", { name: current.name })
              : t("Temi del documento")
          }
          icon={
            <span
              className="flex size-5 items-center justify-center rounded-[5px] text-[13px] leading-none font-bold text-white"
              style={{
                background: docAccent(theme.accent).solid,
                fontFamily: fontStack(theme.headingFont ?? theme.font),
              }}
            >
              Aa
            </span>
          }
        />
      }
    >
      <ThemesGrid theme={theme} setTheme={setTheme} />
    </RibbonMenu>
  )
}

function ThemesGrid({
  theme,
  setTheme,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  const t = useT()
  const close = useCloseRibbonMenu()
  const current = activeDesignTheme(theme)
  return (
    <>
      <DropdownMenuLabel>{t("Temi")}</DropdownMenuLabel>
      <div className="grid grid-cols-3 gap-1.5 p-1.5">
        {DESIGN_THEMES.map((t) => {
          const a = docAccent(t.accent)
          return (
            <button
              key={t.id}
              type="button"
              title={`${t.name} · ${fontMap[t.headingFont ?? t.font]?.label ?? ""} / ${fontMap[t.font]?.label ?? ""}`}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setTheme({
                  font: t.font,
                  headingFont: t.headingFont,
                  accent: t.accent,
                  ...withStyleSet(theme, t.styleSet),
                })
                close?.()
              }}
              className={cn(
                "flex flex-col overflow-hidden rounded-md border bg-background text-left transition hover:border-foreground/30",
                current?.id === t.id
                  ? "border-primary ring-1 ring-primary/40"
                  : "border-border"
              )}
            >
              <span className="flex h-11 items-end gap-1.5 px-2 pb-1.5">
                <span
                  className="text-[22px] leading-none font-bold"
                  style={{ fontFamily: fontStack(t.headingFont ?? t.font) }}
                >
                  Aa
                </span>
                <span className="mb-0.5 flex gap-0.5">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ background: a.solid }}
                  />
                  <span
                    className="size-2.5 rounded-full ring-1 ring-foreground/10"
                    style={{ background: a.fill }}
                  />
                </span>
              </span>
              <span
                className="h-[3px]"
                style={{ background: a.solid }}
                aria-hidden
              />
              <span className="truncate px-2 py-1 text-[10px] text-muted-foreground">
                {t.name}
              </span>
            </button>
          )
        })}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() =>
          setTheme({
            font: defaultDocTheme.font,
            headingFont: defaultDocTheme.headingFont,
            accent: defaultDocTheme.accent,
            ...withStyleSet(theme, defaultDocTheme.styleSet),
          })
        }
      >
        <RotateCcw /> {t("Ripristina il tema predefinito")}
      </DropdownMenuItem>
    </>
  )
}

/* ----------------------------- set di stili ----------------------------- */

/** Anteprima di un set: titolo, titolo 1 e qualche riga, in miniatura */
function StyleSetCard({
  theme,
  setId,
  active,
  onPick,
  name,
}: {
  theme: DocTheme
  setId: string
  active: boolean
  onPick: () => void
  name: string
}) {
  const t = useT()
  const preview: DocTheme = { ...theme, ...withStyleSet(theme, setId) }
  const scale = 0.34
  const look = (id: string) => {
    const p = resolveStyle(preview, id).props
    const color =
      p.color === "accent"
        ? docAccent(theme.accent).solid
        : p.color === "muted"
          ? "var(--muted-foreground)"
          : p.color || undefined
    return {
      fontFamily: styleFontStack(preview, p.font),
      fontSize: Math.max(5, p.size * PT * scale),
      fontWeight: p.bold ? 700 : 400,
      fontStyle: p.italic ? "italic" : undefined,
      textTransform: p.caps === "all" ? "uppercase" : undefined,
      fontVariantCaps: p.caps === "small" ? "small-caps" : undefined,
      textAlign: p.align,
      color,
      lineHeight: 1.15,
      borderBottom:
        p.border === "bottom" ? "1px solid currentColor" : undefined,
      borderLeft:
        p.border === "left"
          ? `2px solid ${docAccent(theme.accent).solid}`
          : undefined,
      paddingLeft: p.border === "left" ? 3 : undefined,
      background:
        p.background === "accent-soft"
          ? docAccent(theme.accent).fill
          : undefined,
    } as React.CSSProperties
  }
  return (
    <button
      type="button"
      title={t("Set di stili: {name}", { name })}
      aria-pressed={active}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onPick}
      className={cn(
        "flex h-[58px] w-[62px] shrink-0 flex-col gap-[3px] overflow-hidden rounded-md border bg-background px-1.5 py-1 text-left transition",
        active
          ? "border-primary/70 ring-1 ring-primary/40"
          : "border-border hover:border-foreground/30"
      )}
    >
      <span className="block truncate" style={look("title")}>
        {t("Titolo")}
      </span>
      <span className="block truncate" style={look("heading1")}>
        {t("Titolo 1")}
      </span>
      <span aria-hidden className="block space-y-[2px]">
        {[100, 92, 70].map((w) => (
          <span
            key={w}
            className="block h-[2px] rounded-full bg-foreground/15"
            style={{ width: `${w}%` }}
          />
        ))}
      </span>
    </button>
  )
}

function StyleSetGallery({
  theme,
  setTheme,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  const t = useT()
  const pick = (id: string) => setTheme(withStyleSet(theme, id))
  // a vista i primi quattro e quello in uso
  const first = STYLE_SETS.slice(0, 4)
  const current = STYLE_SETS.find((s) => s.id === theme.styleSet)
  const row =
    current && !first.includes(current)
      ? [...first.slice(0, 3), current]
      : first
  return (
    <div className="flex items-center gap-1 pl-1">
      <div className="hidden items-center gap-1 sm:flex">
        {row.map((set) => (
          <StyleSetCard
            key={set.id}
            theme={theme}
            setId={set.id}
            name={set.name}
            active={theme.styleSet === set.id}
            onPick={() => pick(set.id)}
          />
        ))}
      </div>
      <RibbonMenu
        className="w-[300px]"
        trigger={
          <button
            type="button"
            aria-label={t("Tutti i set di stili")}
            title={t("Set di stili")}
            onMouseDown={(e) => e.preventDefault()}
            className="flex h-[58px] w-5 shrink-0 items-center justify-center rounded-md border border-border text-muted-foreground hover:bg-muted sm:w-4"
          >
            <ChevronDown className="size-3" />
          </button>
        }
      >
        <StyleSetGrid theme={theme} onPick={pick} />
      </RibbonMenu>
    </div>
  )
}

function StyleSetGrid({
  theme,
  onPick,
}: {
  theme: DocTheme
  onPick: (id: string) => void
}) {
  const t = useT()
  const close = useCloseRibbonMenu()
  return (
    <>
      <DropdownMenuLabel>{t("Set di stili")}</DropdownMenuLabel>
      <div className="grid grid-cols-4 gap-1.5 p-1.5">
        {STYLE_SETS.map((set) => (
          <div key={set.id} className="flex flex-col items-center gap-0.5">
            <StyleSetCard
              theme={theme}
              setId={set.id}
              name={set.name}
              active={theme.styleSet === set.id}
              onPick={() => {
                onPick(set.id)
                close?.()
              }}
            />
            <span className="w-full truncate text-center text-[10px] text-muted-foreground">
              {set.name}
            </span>
          </div>
        ))}
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={() => onPick("default")}>
        <RotateCcw /> {t("Ripristina il set di stili predefinito")}
      </DropdownMenuItem>
    </>
  )
}

/* -------------------------------- colori -------------------------------- */

function ColorsMenu({
  theme,
  setTheme,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  const t = useT()
  const custom = /^#/.test(theme.accent)
  return (
    <>
      <DropdownMenuLabel>{t("Colori del tema")}</DropdownMenuLabel>
      {SWATCHES.filter((s) => s.key !== "white").map((s) => (
        <DropdownMenuItem
          key={s.key}
          onClick={() => setTheme({ accent: s.key })}
          className={cn(theme.accent === s.key && "bg-accent")}
        >
          <span className="flex overflow-hidden rounded-[4px] ring-1 ring-foreground/10">
            {[s.solid, s.border, s.fill, s.soft, s.text].map((c, i) => (
              <span key={i} className="h-4 w-3.5" style={{ background: c }} />
            ))}
          </span>
          <span className="flex-1">{s.label}</span>
        </DropdownMenuItem>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuLabel className="flex items-center gap-1.5">
        <Droplet className="size-3" /> {t("Colore personalizzato")}
      </DropdownMenuLabel>
      <div className="px-2 pb-2">
        <CustomColor
          value={custom ? theme.accent : docAccent(theme.accent).solid}
          onChange={(accent) => {
            // solo esadecimali lunghi: la versione tenue si calcola da quelli
            const hex =
              accent.length === 4
                ? `#${accent
                    .slice(1)
                    .split("")
                    .map((c) => c + c)
                    .join("")}`
                : accent
            setTheme({ accent: hex.toLowerCase() })
          }}
        />
      </div>
    </>
  )
}

/* ------------------------------ spaziatura ------------------------------ */

function SpacingMenu({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { theme, setTheme } = ctx
  const active = activeSpacing(theme)
  const normal = resolveStyle(theme, "normal").props
  return (
    <>
      <DropdownMenuLabel>{t("Spaziatura paragrafo")}</DropdownMenuLabel>
      {SPACING_PRESETS.map((preset) => {
        const line = preset.props.lineHeight ?? normal.lineHeight
        const gap = preset.props.spaceAfter ?? normal.spaceAfter
        return (
          <DropdownMenuItem
            key={preset.id}
            onClick={() => setTheme(withSpacing(theme, preset.props))}
            className={cn(active === preset.id && "bg-accent")}
          >
            <span
              aria-hidden
              className="flex w-5 shrink-0 flex-col"
              style={{ gap: Math.min(4, gap / 3) }}
            >
              {[0, 1].map((p) => (
                <span
                  key={p}
                  className="flex flex-col"
                  style={{ gap: Math.max(1, (line - 1) * 3) }}
                >
                  <span className="h-px w-full bg-current opacity-70" />
                  <span className="h-px w-3/4 bg-current opacity-70" />
                </span>
              ))}
            </span>
            <span className="flex min-w-0 flex-col">
              <span>{preset.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {preset.id === "default"
                  ? t("Dopo {after} pt · Interlinea {lineHeight}", {
                      after: String(Math.round(normal.spaceAfter)).replace(
                        ".",
                        ","
                      ),
                      lineHeight: String(normal.lineHeight).replace(".", ","),
                    })
                  : preset.hint}
              </span>
            </span>
          </DropdownMenuItem>
        )
      })}
      <DropdownMenuSeparator />
      <DropdownMenuItem
        onClick={() => ctx.openStyleDialog({ mode: "modify", id: "normal" })}
      >
        <Pilcrow /> {t("Spaziatura paragrafo personalizzata…")}
      </DropdownMenuItem>
    </>
  )
}

/* ------------------------------- filigrana ------------------------------ */

function WatermarkMenu({
  theme,
  setTheme,
  onCustom,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  onCustom: () => void
}) {
  const t = useT()
  const close = useCloseRibbonMenu()
  const groups = [...new Set(WATERMARK_PRESETS.map((p) => p.group))]
  return (
    <div className="max-h-[70dvh] overflow-y-auto">
      {groups.map((group) => (
        <div key={group}>
          <DropdownMenuLabel>{group}</DropdownMenuLabel>
          <div className="grid grid-cols-3 gap-1.5 px-1.5 pb-1.5">
            {WATERMARK_PRESETS.filter((p) => p.group === group).flatMap((p) =>
              (["diagonal", "horizontal"] as const)
                .slice(0, group === t("Stato") ? 1 : 2)
                .map((layout) => {
                  const mark = newWatermark({
                    ...(theme.watermark && !theme.watermark.image
                      ? {
                          color: theme.watermark.color,
                          opacity: theme.watermark.opacity,
                          font: theme.watermark.font,
                        }
                      : {}),
                    text: p.text,
                    layout,
                  })
                  const active =
                    theme.watermark?.text === p.text &&
                    theme.watermark.layout === layout
                  return (
                    <button
                      key={`${p.text}-${layout}`}
                      type="button"
                      title={`${p.text} ${layout === "diagonal" ? t("(diagonale)") : t("(orizzontale)")}`}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        setTheme({ watermark: mark })
                        close?.()
                      }}
                      className={cn(
                        "rounded-md p-1 transition hover:bg-muted",
                        active && "bg-accent"
                      )}
                    >
                      <WatermarkPreview
                        theme={theme}
                        watermark={mark}
                        className="max-w-none"
                      />
                    </button>
                  )
                })
            )}
          </div>
        </div>
      ))}
      <DropdownMenuSeparator />
      <DropdownMenuItem onClick={onCustom}>
        <Stamp /> {t("Filigrana personalizzata…")}
      </DropdownMenuItem>
      <DropdownMenuItem
        disabled={!theme.watermark}
        onClick={() => setTheme({ watermark: null })}
      >
        <RotateCcw /> {t("Rimuovi filigrana")}
      </DropdownMenuItem>
    </div>
  )
}

/* ---------------------------- colore pagina ----------------------------- */

function PageColorMenu({
  theme,
  setTheme,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  const t = useT()
  const paper = theme.paper === AUTO_BG ? "" : theme.paper
  return (
    <>
      <DropdownMenuLabel>{t("Colore pagina")}</DropdownMenuLabel>
      <SwatchGrid
        columns={6}
        colors={PAPERS}
        value={paper}
        onPick={(v) => setTheme({ paper: v || AUTO_BG })}
      />
      <div className="px-1.5 pb-1.5">
        <CustomColor
          value={paper || "#ffffff"}
          onChange={(v) => setTheme({ paper: v })}
        />
      </div>
      <DropdownMenuSeparator />
      <DropdownMenuLabel>{t("Sfondo intorno al foglio")}</DropdownMenuLabel>
      <SwatchGrid
        columns={6}
        colors={[
          { label: t("Automatico (segue il tema)"), value: "" },
          ...BACKGROUNDS.map((b) => ({ label: b.label, value: b.value })),
        ]}
        value={theme.background === AUTO_BG ? "" : theme.background}
        onPick={(v) => setTheme({ background: v || AUTO_BG })}
      />
    </>
  )
}

/* ------------------------- tipi di carattere ---------------------------- */

function FontsDialog({
  open,
  onClose,
  theme,
  setTheme,
}: {
  open: boolean
  onClose: () => void
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent className="sm:max-w-[460px]">
        {open ? (
          <FontsForm theme={theme} setTheme={setTheme} onClose={onClose} />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function FontsForm({
  theme,
  setTheme,
  onClose,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  onClose: () => void
}) {
  const t = useT()
  const [heading, setHeading] = React.useState(theme.headingFont ?? theme.font)
  const [body, setBody] = React.useState(theme.font)
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        setTheme({ font: body, headingFont: heading === body ? null : heading })
        onClose()
      }}
    >
      <DialogHeader>
        <DialogTitle>{t("Personalizza tipi di carattere")}</DialogTitle>
        <DialogDescription>
          {t("Gli stili che usano «Titoli» e «Corpo» cambiano insieme.")}
        </DialogDescription>
      </DialogHeader>
      <DialogBody className="grid gap-4 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Carattere titoli")}
          </span>
          <FontPicker value={heading} onChange={setHeading} />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Carattere corpo del testo")}
          </span>
          <FontPicker value={body} onChange={setBody} />
        </label>
        <div className="rounded-lg border border-border bg-background p-3 sm:col-span-2">
          <p
            className="text-xl leading-tight font-bold"
            style={{ fontFamily: fontStack(heading) }}
          >
            {t("Titolo")}
          </p>
          <p
            className="mt-1 text-sm text-muted-foreground"
            style={{ fontFamily: fontStack(body) }}
          >
            {t(
              "Il corpo del testo usa questo carattere: paragrafi, elenchi e tabelle."
            )}
          </p>
        </div>
      </DialogBody>
      <DialogFooter>
        <Button type="button" variant="ghost" onClick={onClose}>
          {t("Annulla")}
        </Button>
        <Button type="submit">{t("Salva")}</Button>
      </DialogFooter>
    </form>
  )
}
