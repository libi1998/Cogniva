"use client"

import * as React from "react"
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  Italic,
  RotateCcw,
  Underline,
} from "lucide-react"
import type { Editor } from "@tiptap/react"
import { FontPicker } from "@/components/shared/font-picker"
import { CustomColor } from "@/components/shared/custom-color"
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
import { Input } from "@/components/ui/input"
import {
  BUILTIN_STYLES,
  listStyles,
  newStyleId,
  resolveStyle,
  styleFontLabel,
  styleFontStack,
  type DocStyleDef,
  type StyleAlign,
  type StyleBorder,
  type StyleCaps,
  type StyleKind,
  type StyleProps,
} from "@/lib/doc-styles"
import { docAccent } from "@/lib/palette"
import type { DocTheme } from "@/lib/types"
import { cn } from "@/lib/utils"
import { SizeCombo } from "./ribbon/font-controls"
import { Stepper } from "./ribbon/ribbon-ui"
import { TEXT_COLORS } from "./ribbon/shared"
import {
  createStyleFromSelection,
  propsFromSelection,
  withStyle,
} from "./style-actions"

import { useT, tr } from "@/lib/i18n/client"
export type StyleDialogRequest =
  { mode: "modify"; id: string } | { mode: "new"; baseId: string }

const KIND_OPTIONS: { value: string; label: string }[] = [
  {
    value: "paragraph",
    get label() {
      return tr("Paragrafo")
    },
  },
  {
    value: "title",
    get label() {
      return tr("Titolo del documento")
    },
  },
  {
    value: "heading-1",
    get label() {
      return tr("Titolo, livello 1")
    },
  },
  {
    value: "heading-2",
    get label() {
      return tr("Titolo, livello 2")
    },
  },
  {
    value: "heading-3",
    get label() {
      return tr("Titolo, livello 3")
    },
  },
  {
    value: "quote",
    get label() {
      return tr("Citazione")
    },
  },
  {
    value: "code",
    get label() {
      return tr("Codice")
    },
  },
]

const LINE_OPTIONS = [1, 1.15, 1.3, 1.5, 1.62, 2, 2.5, 3]

const BORDER_OPTIONS: { value: StyleBorder; label: string }[] = [
  {
    value: "none",
    get label() {
      return tr("Nessuno")
    },
  },
  {
    value: "bottom",
    get label() {
      return tr("Sotto")
    },
  },
  {
    value: "top",
    get label() {
      return tr("Sopra")
    },
  },
  {
    value: "left",
    get label() {
      return tr("Barra a sinistra")
    },
  },
  {
    value: "topBottom",
    get label() {
      return tr("Sopra e sotto")
    },
  },
  {
    value: "box",
    get label() {
      return tr("Riquadro")
    },
  },
]

const CAPS_OPTIONS: { value: StyleCaps; label: string }[] = [
  {
    value: "none",
    get label() {
      return tr("Normali")
    },
  },
  {
    value: "small",
    get label() {
      return tr("Maiuscoletto")
    },
  },
  {
    value: "all",
    get label() {
      return tr("Tutte maiuscole")
    },
  },
]

const CM_PER_PT = 2.54 / 72
const fmt = (n: number, d = 1) =>
  String(Math.round(n * 10 ** d) / 10 ** d).replace(".", ",")

/** Il colore come lo vede chi guarda: i gettoni del tema diventano colori */
function previewColor(theme: DocTheme, value: string) {
  if (value === "accent") return docAccent(theme.accent).solid
  if (value === "muted") return "#71717a"
  if (value === "accent-soft") return docAccent(theme.accent).fill
  return value
}

function kindValue(kind: StyleKind, level?: number) {
  return kind === "heading" ? `heading-${level ?? 1}` : kind
}

/** Descrizione a parole, come quella sotto l'anteprima di Word */
function describe(theme: DocTheme, p: StyleProps, basedOn: string | null) {
  const parts = [
    tr("Carattere: {theme}, {count} pt", {
      theme: styleFontLabel(theme, p.font),
      count: fmt(p.size),
    }),
    p.bold ? tr("Grassetto") : null,
    p.italic ? tr("Corsivo") : null,
    p.underline ? tr("Sottolineato") : null,
    p.caps === "small"
      ? tr("Maiuscoletto")
      : p.caps === "all"
        ? tr("Maiuscole")
        : null,
    p.color
      ? tr("Colore: {color}", {
          color:
            p.color === "accent"
              ? tr("accento")
              : p.color === "muted"
                ? tr("attenuato")
                : p.color,
        })
      : null,
    tr("Interlinea: {value}", { value: fmt(p.lineHeight, 2) }),
    tr("Spazio prima: {value} pt", { value: fmt(p.spaceBefore) }),
    tr("Dopo: {value} pt", { value: fmt(p.spaceAfter) }),
    p.indentLeft
      ? tr("Rientro: {value} cm", { value: fmt(p.indentLeft * CM_PER_PT, 2) })
      : null,
    basedOn
      ? tr("Basato su: {name}", { name: resolveStyle(theme, basedOn).name })
      : null,
  ]
  return parts.filter(Boolean).join(" · ")
}

/**
 * «Modifica stile» e «Crea stile»: le proprietà si cambiano su una bozza con
 * anteprima dal vivo; il documento cambia solo con OK.
 */
export function StyleDialog({
  request,
  onClose,
  editor,
  theme,
  setTheme,
  onCreated,
}: {
  request: StyleDialogRequest | null
  onClose: () => void
  editor: Editor | null
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  /** uno stile appena creato si applica subito al paragrafo */
  onCreated: (id: string, theme: DocTheme) => void
}) {
  return (
    <Dialog open={request !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[640px]">
        {request ? (
          <StyleForm
            key={
              request.mode === "modify" ? request.id : `new-${request.baseId}`
            }
            request={request}
            editor={editor}
            theme={theme}
            setTheme={setTheme}
            onClose={onClose}
            onCreated={onCreated}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  )
}

function StyleForm({
  request,
  editor,
  theme,
  setTheme,
  onClose,
  onCreated,
}: {
  request: StyleDialogRequest
  editor: Editor | null
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  onClose: () => void
  onCreated: (id: string, theme: DocTheme) => void
}) {
  const t = useT()
  // la bozza: id e definizione (solo i valori cambiati rispetto alla base)
  const [draft, setDraft] = React.useState<{ id: string; def: DocStyleDef }>(
    () => {
      if (request.mode === "modify") {
        return {
          id: request.id,
          def: { ...(theme.styles?.[request.id] ?? {}) },
        }
      }
      const name = t("Stile {number}", {
        number:
          Object.keys(theme.styles ?? {}).filter((k) => k.startsWith("user-"))
            .length + 1,
      })
      if (editor)
        return createStyleFromSelection(editor, theme, name, request.baseId)
      return {
        id: `user-stile-${Date.now().toString(36)}`,
        def: { name, kind: "paragraph", basedOn: request.baseId },
      }
    }
  )
  const builtin = BUILTIN_STYLES[draft.id]
  const preview: DocTheme = {
    ...theme,
    styles: { ...(theme.styles ?? {}), [draft.id]: draft.def },
  }
  const style = resolveStyle(preview, draft.id)
  const p = style.props
  const all = listStyles(preview)
  // non si può basare uno stile su sé stesso né su chi discende da lui
  const descendants = new Set<string>([draft.id])
  let grew = true
  while (grew) {
    grew = false
    for (const s of all) {
      if (s.basedOn && descendants.has(s.basedOn) && !descendants.has(s.id)) {
        descendants.add(s.id)
        grew = true
      }
    }
  }

  const set = (patch: Partial<DocStyleDef>) =>
    setDraft((d) => ({ ...d, def: { ...d.def, ...patch } }))

  const specials = [
    {
      key: "+body",
      label: styleFontLabel(theme, "+body"),
      stack: styleFontStack(theme, "+body"),
    },
    {
      key: "+heading",
      label: styleFontLabel(theme, "+heading"),
      stack: styleFontStack(theme, "+heading"),
    },
  ]

  const save = () => {
    const def = { ...draft.def }
    if (!def.name?.trim()) def.name = style.name
    // uno stile nuovo prende l'id dal nome definitivo, non da «Stile 1»
    const id =
      request.mode === "new" ? newStyleId(def.name ?? "", theme) : draft.id
    if (def.next === draft.id) def.next = id
    const patch = withStyle(theme, id, def)
    setTheme(patch)
    if (request.mode === "new") onCreated(id, { ...theme, ...patch })
    onClose()
  }

  const canReset =
    request.mode === "modify" &&
    Boolean(theme.styles?.[draft.id]) &&
    Boolean(builtin)

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
      className="contents"
    >
      <DialogHeader>
        <DialogTitle>
          {request.mode === "new" ? t("Crea stile") : t("Modifica stile")}
        </DialogTitle>
        <DialogDescription>
          {t("Le modifiche valgono per tutti i paragrafi con questo stile.")}
        </DialogDescription>
      </DialogHeader>

      <DialogBody className="space-y-5">
        <section className="space-y-2.5">
          <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Proprietà")}
          </h4>
          <div className="grid gap-2.5 sm:grid-cols-2">
            <Field label={t("Nome")}>
              <Input
                value={draft.def.name ?? style.name}
                onChange={(e) => set({ name: e.target.value })}
                className="h-8 text-sm"
                disabled={Boolean(builtin) && draft.id === "normal"}
              />
            </Field>
            <Field label={t("Tipo di stile")}>
              <NativeSelect
                value={kindValue(style.kind, style.level)}
                disabled={Boolean(builtin)}
                onChange={(v) => {
                  if (v.startsWith("heading-")) {
                    set({
                      kind: "heading",
                      level: Number(v.slice(8)) as 1 | 2 | 3,
                    })
                  } else set({ kind: v as StyleKind, level: undefined })
                }}
                options={KIND_OPTIONS}
              />
            </Field>
            <Field label={t("Basato su")}>
              <NativeSelect
                value={style.basedOn ?? ""}
                disabled={draft.id === "normal"}
                onChange={(v) => set({ basedOn: v || null })}
                options={[
                  { value: "", label: t("(nessuno)") },
                  ...all
                    .filter((s) => !descendants.has(s.id))
                    .map((s) => ({ value: s.id, label: s.name })),
                ]}
              />
            </Field>
            <Field label={t("Stile del paragrafo successivo")}>
              <NativeSelect
                value={style.next ?? draft.id}
                onChange={(v) => set({ next: v })}
                options={all
                  .filter((s) => s.kind !== "code" && s.kind !== "quote")
                  .map((s) => ({
                    value: s.id,
                    label:
                      s.id === draft.id
                        ? t("{name} (lo stesso)", { name: s.name })
                        : s.name,
                  }))}
              />
            </Field>
          </div>
        </section>

        <section className="space-y-2.5">
          <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Carattere")}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="w-[210px]">
              <FontPicker
                value={p.font}
                specials={specials}
                onChange={(font) => set({ font })}
              />
            </div>
            <SizeCombo pt={p.size} onPick={(size) => set({ size })} />
            <Toggle
              label={t("Grassetto")}
              active={p.bold}
              onClick={() => set({ bold: !p.bold })}
            >
              <Bold className="size-4" />
            </Toggle>
            <Toggle
              label={t("Corsivo")}
              active={p.italic}
              onClick={() => set({ italic: !p.italic })}
            >
              <Italic className="size-4" />
            </Toggle>
            <Toggle
              label={t("Sottolineato")}
              active={p.underline}
              onClick={() => set({ underline: !p.underline })}
            >
              <Underline className="size-4" />
            </Toggle>
            <NativeSelect
              value={p.caps}
              onChange={(v) => set({ caps: v as StyleCaps })}
              options={CAPS_OPTIONS}
              className="w-[132px]"
            />
          </div>
          <div className="space-y-1.5">
            <span className="text-xs text-muted-foreground">{t("Colore")}</span>
            <div className="flex flex-wrap items-center gap-1.5">
              {[
                { label: t("Automatico"), value: "" },
                { label: t("Accento del tema"), value: "accent" },
                { label: t("Attenuato"), value: "muted" },
                ...TEXT_COLORS.slice(1),
              ].map((c) => (
                <button
                  key={c.label}
                  type="button"
                  title={c.label}
                  onClick={() => set({ color: c.value })}
                  className={cn(
                    "size-6 rounded-md ring-1 ring-black/15 transition hover:scale-110",
                    p.color === c.value &&
                      "ring-2 ring-ring ring-offset-1 ring-offset-background"
                  )}
                  style={{
                    background: c.value
                      ? previewColor(theme, c.value)
                      : "linear-gradient(135deg, #18181b 50%, #ffffff 50%)",
                  }}
                />
              ))}
              <div className="w-[120px]">
                <CustomColor
                  value={
                    p.color && p.color.startsWith("#") ? p.color : "#27272a"
                  }
                  onChange={(color) => set({ color })}
                />
              </div>
            </div>
          </div>
        </section>

        <section className="space-y-2.5">
          <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Paragrafo")}
          </h4>
          <div className="flex flex-wrap items-center gap-1.5">
            {(
              [
                ["left", t("A sinistra"), AlignLeft],
                ["center", "Al centro", AlignCenter],
                ["right", t("A destra"), AlignRight],
                ["justify", t("Giustificato"), AlignJustify],
              ] as [StyleAlign, string, typeof AlignLeft][]
            ).map(([value, label, Icon]) => (
              <Toggle
                key={value}
                label={label}
                active={p.align === value}
                onClick={() => set({ align: value })}
              >
                <Icon className="size-4" />
              </Toggle>
            ))}
            <span className="ml-3 text-xs text-muted-foreground">
              {t("Interlinea")}
            </span>
            <NativeSelect
              value={String(p.lineHeight)}
              onChange={(v) => set({ lineHeight: Number(v) })}
              options={[...new Set([...LINE_OPTIONS, p.lineHeight])]
                .sort((a, b) => a - b)
                .map((n) => ({ value: String(n), label: fmt(n, 2) }))}
              className="w-[84px]"
            />
          </div>
          <div className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <Stepper
              label={t("Spazio prima")}
              value={p.spaceBefore}
              unit="pt"
              step={2}
              min={0}
              max={200}
              decimals={0}
              width={84}
              labelWidth={92}
              onChange={(spaceBefore) => set({ spaceBefore })}
            />
            <Stepper
              label={t("Spazio dopo")}
              value={p.spaceAfter}
              unit="pt"
              step={2}
              min={0}
              max={200}
              decimals={0}
              width={84}
              labelWidth={92}
              onChange={(spaceAfter) => set({ spaceAfter })}
            />
            <Stepper
              label={t("Rientro")}
              value={p.indentLeft * CM_PER_PT}
              unit="cm"
              step={0.25}
              min={0}
              max={10}
              decimals={2}
              width={84}
              labelWidth={92}
              onChange={(cm) => set({ indentLeft: Math.round(cm / CM_PER_PT) })}
            />
            <Stepper
              label={t("Prima riga")}
              value={p.firstLine * CM_PER_PT}
              unit="cm"
              step={0.25}
              min={-5}
              max={5}
              decimals={2}
              width={84}
              labelWidth={92}
              onChange={(cm) => set({ firstLine: Math.round(cm / CM_PER_PT) })}
            />
            <Stepper
              label={t("Spaziatura")}
              value={p.letterSpacing}
              unit="pt"
              step={0.2}
              min={-3}
              max={10}
              decimals={1}
              width={84}
              labelWidth={92}
              onChange={(letterSpacing) => set({ letterSpacing })}
            />
            <label className="flex h-7 items-center gap-1.5 text-xs text-muted-foreground">
              <span className="w-[62px] shrink-0">{t("Bordo")}</span>
              <NativeSelect
                value={p.border}
                onChange={(v) => set({ border: v as StyleBorder })}
                options={BORDER_OPTIONS}
                className="w-[138px]"
              />
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="w-[62px] shrink-0 text-xs text-muted-foreground">
              {t("Sfondo")}
            </span>
            {[
              { label: t("Nessuno"), value: "" },
              { label: t("Accento tenue"), value: "accent-soft" },
              { label: t("Grigio"), value: "#f4f4f5" },
              { label: t("Giallo"), value: "#fef9c3" },
              { label: t("Verde"), value: "#dcfce7" },
              { label: t("Azzurro"), value: "#dbeafe" },
              { label: t("Rosa"), value: "#fce7f3" },
            ].map((c) => (
              <button
                key={c.label}
                type="button"
                title={c.label}
                onClick={() => set({ background: c.value })}
                className={cn(
                  "size-6 rounded-md ring-1 ring-black/15 transition hover:scale-110",
                  p.background === c.value &&
                    "ring-2 ring-ring ring-offset-1 ring-offset-background"
                )}
                style={{
                  background: c.value
                    ? previewColor(theme, c.value)
                    : "linear-gradient(135deg, transparent 45%, #e03177 45% 55%, transparent 55%)",
                }}
              />
            ))}
          </div>
        </section>

        <section className="space-y-2">
          <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            {t("Anteprima")}
          </h4>
          <StylePreview theme={theme} props={p} />
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            {describe(preview, p, style.basedOn)}
          </p>
        </section>
      </DialogBody>

      <DialogFooter className="flex-row flex-wrap items-center gap-2 sm:justify-between">
        <div className="flex flex-wrap gap-2">
          {canReset ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setDraft((d) => ({ ...d, def: {} }))}
            >
              <RotateCcw className="size-3.5" /> {t("Valori predefiniti")}
            </Button>
          ) : null}
          {editor && request.mode === "modify" ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              title={t("Prende l'aspetto del testo dove si trova il cursore")}
              onClick={() =>
                set(
                  propsFromSelection(editor, preview, style.basedOn ?? "normal")
                )
              }
            >
              {t("Come la selezione")}
            </Button>
          ) : null}
        </div>
        <div className="ml-auto flex gap-2">
          <Button type="button" variant="outline" onClick={onClose}>
            {t("Annulla")}
          </Button>
          <Button type="submit">OK</Button>
        </div>
      </DialogFooter>
    </form>
  )
}

/** Il foglio in miniatura: paragrafo prima, testo nello stile, paragrafo dopo */
export function StylePreview({
  theme,
  props: p,
}: {
  theme: DocTheme
  props: StyleProps
}) {
  const t = useT()
  const line = "h-1.5 rounded-full bg-zinc-300/70 dark:bg-zinc-600/70"
  return (
    <div className="space-y-1.5 overflow-hidden rounded-lg border border-border bg-white p-4 text-zinc-800 dark:bg-zinc-900 dark:text-zinc-100">
      <div className={cn(line, "w-[92%]")} />
      <div className={cn(line, "w-[70%]")} />
      <div
        style={{
          fontFamily: styleFontStack(theme, p.font),
          fontSize: Math.min(40, p.size * (96 / 72)),
          fontWeight: p.bold ? 700 : 400,
          fontStyle: p.italic ? "italic" : "normal",
          textDecoration: p.underline ? "underline" : "none",
          textTransform: p.caps === "all" ? "uppercase" : "none",
          fontVariantCaps: p.caps === "small" ? "small-caps" : "normal",
          color: p.color ? previewColor(theme, p.color) : undefined,
          background: p.background
            ? previewColor(theme, p.background)
            : undefined,
          textAlign: p.align,
          lineHeight: p.lineHeight,
          letterSpacing: p.letterSpacing ? `${p.letterSpacing}pt` : undefined,
          marginTop: Math.min(24, p.spaceBefore),
          marginBottom: Math.min(24, p.spaceAfter),
          marginLeft: p.indentLeft * (96 / 72),
          textIndent: p.firstLine * (96 / 72),
          borderLeft:
            p.border === "left"
              ? `3px solid ${previewColor(theme, "accent")}`
              : undefined,
          borderBottom:
            p.border === "bottom" ||
            p.border === "box" ||
            p.border === "topBottom"
              ? "1px solid currentColor"
              : undefined,
          borderTop:
            p.border === "top" || p.border === "box" || p.border === "topBottom"
              ? "1px solid currentColor"
              : undefined,
          padding: p.border !== "none" || p.background ? "4px 10px" : undefined,
        }}
      >
        {t("La volpe veloce salta sopra il cane pigro.")}
      </div>
      <div className={cn(line, "w-[96%]")} />
      <div className={cn(line, "w-[84%]")} />
      <div className={cn(line, "w-[40%]")} />
    </div>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <label className="block space-y-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </label>
  )
}

function NativeSelect({
  value,
  onChange,
  options,
  disabled,
  className,
}: {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  disabled?: boolean
  className?: string
}) {
  return (
    <select
      value={value}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:border-ring disabled:opacity-60",
        className
      )}
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

function Toggle({
  label,
  active,
  onClick,
  children,
}: {
  label: string
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        "flex size-8 items-center justify-center rounded-md border border-border transition hover:bg-muted",
        active && "border-primary/50 bg-accent text-accent-foreground"
      )}
    >
      {children}
    </button>
  )
}
