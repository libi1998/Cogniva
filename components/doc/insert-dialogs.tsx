"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { Search } from "lucide-react"
import { toast } from "sonner"
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
import { FontPicker } from "@/components/shared/font-picker"
import { CustomColor } from "@/components/shared/custom-color"
import { Glyph } from "@/components/board/glyph"
import { useAuthor } from "@/lib/author"
import {
  BOOKMARK_NAME,
  captionLabels,
  DATE_FORMATS,
  FIELD_LABELS,
  goToBookmark,
  hiddenBookmarkName,
  listBookmarks,
  REF_FORMATS,
  textWithFields,
  type FieldKind,
} from "@/lib/doc-fields"
import {
  signatureContent,
  smartArtBoard,
  SMARTART_TEMPLATES,
} from "@/lib/doc-inserts"
import { fontStack } from "@/lib/fonts"
import {
  BAND_FIELDS,
  bandParts,
  FOOTER_PRESETS,
  HEADER_PRESETS,
  joinBand,
  PAGE_NUMBER_FORMATS,
} from "@/lib/header-footer"
import { ICON_CATEGORIES, ICON_NAMES } from "@/lib/icon-library"
import { docAccent, getSwatch } from "@/lib/palette"
import type { DocTheme } from "@/lib/types"
import { cn } from "@/lib/utils"

import { useT, tr, currentLocale } from "@/lib/i18n/client"
/** Finestra con intestazione, contenuto e pulsanti: lo schema di tutte */
function Shell({
  open,
  onClose,
  title,
  description,
  width = 460,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  width?: number
  children: React.ReactNode
}) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && onClose()}>
      <DialogContent style={{ maxWidth: `min(${width}px, calc(100% - 2rem))` }}>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? (
            <DialogDescription>{description}</DialogDescription>
          ) : null}
        </DialogHeader>
        {open ? children : null}
      </DialogContent>
    </Dialog>
  )
}

function Footer({
  onClose,
  children,
}: {
  onClose: () => void
  children: React.ReactNode
}) {
  const t = useT()
  return (
    <DialogFooter>
      <Button type="button" variant="ghost" onClick={onClose}>
        {t("Annulla")}
      </Button>
      {children}
    </DialogFooter>
  )
}

const selectClass =
  "h-8 min-w-0 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"

/* ------------------------------ segnalibro ------------------------------- */

export function BookmarkDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Segnalibro")}
      description={t(
        "Un nome per questo punto del documento: ci si torna da qui e lo si usa nei riferimenti incrociati."
      )}
    >
      <BookmarkForm editor={editor} onClose={onClose} />
    </Shell>
  )
}

function BookmarkForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const [list, setList] = React.useState(() => listBookmarks(editor.state))
  const [name, setName] = React.useState(() => {
    const words = editor.state.doc
      .textBetween(editor.state.selection.from, editor.state.selection.to, " ")
      .trim()
      .normalize("NFD")
      .replace(/\p{Diacritic}/gu, "")
      .replace(/[^A-Za-z0-9]+/g, "_")
      .replace(/^[^A-Za-z]+|_+$/g, "")
      .slice(0, 40)
    return words
  })
  const [sort, setSort] = React.useState<"name" | "position">("position")
  const valid = BOOKMARK_NAME.test(name)
  const shown =
    sort === "name"
      ? [...list].sort((a, b) => a.name.localeCompare(b.name, currentLocale()))
      : list

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        if (!valid) return
        if (!editor.chain().focus().setBookmark(name).run()) {
          toast.info(
            t("Posiziona il cursore su una parola o seleziona del testo")
          )
          return
        }
        toast.success(t("Segnalibro «{name}» aggiunto", { name }))
        onClose()
      }}
    >
      <DialogBody className="space-y-3">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Nome segnalibro")}
          </span>
          <Input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("Es. Conclusioni")}
            className="h-8 text-sm"
          />
          {name && !valid ? (
            <span className="block text-[11px] text-destructive">
              {t(
                "Inizia con una lettera; solo lettere, numeri e trattino basso, senza spazi."
              )}
            </span>
          ) : null}
        </label>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            {t("Segnalibri del documento ({count})", { count: list.length })}
          </span>
          <span className="flex gap-3">
            {(["name", "position"] as const).map((value) => (
              <label key={value} className="flex items-center gap-1">
                <input
                  type="radio"
                  checked={sort === value}
                  onChange={() => setSort(value)}
                />
                {value === "name" ? t("Nome") : t("Posizione")}
              </label>
            ))}
          </span>
        </div>
        <div className="max-h-48 overflow-y-auto rounded-md border border-border">
          {shown.length ? (
            shown.map((b) => (
              <div
                key={b.name}
                className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 text-sm last:border-b-0"
              >
                <button
                  type="button"
                  onClick={() => setName(b.name)}
                  className="min-w-0 flex-1 text-left"
                >
                  <span className="block truncate font-medium">{b.name}</span>
                  <span className="block truncate text-[11px] text-muted-foreground">
                    {b.text}
                  </span>
                </button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() => {
                    goToBookmark(editor, b.name)
                    onClose()
                  }}
                >
                  {t("Vai a")}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs text-destructive"
                  onClick={() => {
                    editor.chain().removeBookmark(b.name).run()
                    setList(listBookmarks(editor.state))
                  }}
                >
                  {t("Elimina")}
                </Button>
              </div>
            ))
          ) : (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">
              {t("Ancora nessun segnalibro.")}
            </p>
          )}
        </div>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit" disabled={!valid}>
          {t("Aggiungi")}
        </Button>
      </Footer>
    </form>
  )
}

/* ------------------------- riferimento incrociato ------------------------ */

/**
 * Titoli, segnalibri o le didascalie di un'etichetta («seq:Figura»). Le
 * etichette sono quelle scritte nel documento, nella lingua in cui si sono
 * create, più quelle personalizzate: prima si cercavano sempre «Figura»,
 * «Tabella» ed «Equazione», e con l'app in un'altra lingua non si trovava
 * nessuna didascalia
 */
type RefKind = "heading" | "bookmark" | `seq:${string}`

const seqLabel = (kind: RefKind) =>
  kind.startsWith("seq:") ? kind.slice(4) : null

/** Le etichette delle didascalie: quelle standard e quelle del documento */
function refLabels(editor: Editor) {
  const labels = new Set(captionLabels())
  editor.state.doc.descendants((node) => {
    if (node.type.name === "field" && node.attrs.kind === "seq")
      labels.add(String(node.attrs.label ?? ""))
    return true
  })
  labels.delete("")
  return [...labels]
}

type RefItem = {
  key: string
  label: string
  /** titoli: la posizione, per aggiungere il segnalibro nascosto */
  heading?: { from: number; to: number; existing: string | null }
  target?: string
}

function refItems(editor: Editor, kind: RefKind): RefItem[] {
  const { state } = editor
  if (kind === "bookmark") {
    return listBookmarks(state).map((b) => ({
      key: b.name,
      label: `${b.name} — ${b.text}`,
      target: `bm:${b.name}`,
    }))
  }
  const items: RefItem[] = []
  const label = seqLabel(kind)
  let count = 0
  state.doc.descendants((node, pos) => {
    if (kind === "heading" && node.type.name === "heading") {
      const hidden = node.firstChild?.marks.find(
        (m) =>
          m.type.name === "bookmark" &&
          String(m.attrs.name ?? "").startsWith("_Ref")
      )
      items.push({
        key: String(pos),
        label: `${"  ".repeat(Number(node.attrs.level) - 1)}${node.textContent}`,
        heading: {
          from: pos + 1,
          to: pos + node.nodeSize - 1,
          existing: hidden ? String(hidden.attrs.name) : null,
        },
      })
      return false
    }
    if (
      label !== null &&
      node.type.name === "field" &&
      node.attrs.kind === "seq" &&
      node.attrs.label === label
    ) {
      count += 1
      const $pos = state.doc.resolve(pos)
      items.push({
        key: String(pos),
        // con il numero della didascalia: il solo testo dava «Figura : …»
        label:
          textWithFields(state, $pos.parent, $pos.before()) ||
          `${label} ${count}`,
        target: `seq:${node.attrs.target}`,
      })
    }
    return true
  })
  return items
}

export function CrossRefDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Riferimento incrociato")}
      description={t(
        "Un rimando che si aggiorna da solo quando il testo o le pagine cambiano."
      )}
      width={520}
    >
      <CrossRefForm editor={editor} onClose={onClose} />
    </Shell>
  )
}

function CrossRefForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const [kind, setKind] = React.useState<RefKind>("heading")
  const [format, setFormat] = React.useState("text")
  const [picked, setPicked] = React.useState<string | null>(null)
  const items = refItems(editor, kind)
  const [labels] = React.useState(() => refLabels(editor))
  const caption = seqLabel(kind)
  const formats = REF_FORMATS.filter(
    (f) => f.for === "any" || (f.for === "seq" && caption !== null)
  )
  const current = items.find((i) => i.key === picked) ?? null

  const insert = (item: RefItem | null) => {
    if (!item) return
    let target = item.target ?? ""
    const chain = editor.chain().focus()
    if (item.heading) {
      const name = item.heading.existing ?? hiddenBookmarkName()
      target = `bm:${name}`
      if (!item.heading.existing && item.heading.to > item.heading.from) {
        const { from, to } = item.heading
        chain.command(({ tr, state }) => {
          tr.addMark(from, to, state.schema.marks.bookmark.create({ name }))
          return true
        })
      }
    }
    chain.insertField({ kind: "ref", target, format }).run()
    onClose()
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        insert(current)
      }}
    >
      <DialogBody className="grid gap-3 sm:grid-cols-2">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Tipo di riferimento")}
          </span>
          <select
            value={kind}
            onChange={(e) => {
              const next = e.target.value as RefKind
              setKind(next)
              setPicked(null)
              setFormat(
                next === "heading" || next === "bookmark" ? "text" : "label"
              )
            }}
            className={cn(selectClass, "w-full")}
          >
            <option value="heading">{t("Titolo")}</option>
            <option value="bookmark">{t("Segnalibro")}</option>
            {labels.map((label) => (
              <option key={label} value={`seq:${label}`}>
                {label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Inserisci riferimento a")}
          </span>
          <select
            value={format}
            onChange={(e) => setFormat(e.target.value)}
            className={cn(selectClass, "w-full")}
          >
            {formats.map((f) => (
              <option key={f.id} value={f.id}>
                {f.id === "text" && caption !== null
                  ? t("Didascalia intera")
                  : f.label}
              </option>
            ))}
          </select>
        </label>
        <div className="sm:col-span-2">
          <span className="text-xs text-muted-foreground">
            {kind === "heading"
              ? t("Per quale titolo")
              : kind === "bookmark"
                ? t("Per quale segnalibro")
                : t("Per quale didascalia")}
          </span>
          <div className="mt-1 max-h-56 overflow-y-auto rounded-md border border-border">
            {items.length ? (
              items.map((i) => (
                <button
                  key={i.key}
                  type="button"
                  onClick={() => setPicked(i.key)}
                  onDoubleClick={() => insert(i)}
                  className={cn(
                    "block w-full truncate px-2.5 py-1.5 text-left text-sm whitespace-pre hover:bg-muted",
                    picked === i.key && "bg-accent text-accent-foreground"
                  )}
                >
                  {i.label}
                </button>
              ))
            ) : (
              <p className="px-2.5 py-3 text-xs text-muted-foreground">
                {kind === "heading"
                  ? t("Il documento non ha titoli (stili Titolo 1–3).")
                  : kind === "bookmark"
                    ? t(
                        "Nessun segnalibro: aggiungine uno da Inserisci › Segnalibro."
                      )
                    : t(
                        "Nessuna didascalia «{kind}»: aggiungila da Riferimenti › Inserisci didascalia.",
                        { kind: caption ?? "" }
                      )}
              </p>
            )}
          </div>
        </div>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit" disabled={!current}>
          {t("Inserisci")}
        </Button>
      </Footer>
    </form>
  )
}

/* ------------------------------ data e ora ------------------------------- */

export function DateTimeDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  const t = useT()
  return (
    <Shell open={open} onClose={onClose} title={t("Data e ora")}>
      <DateTimeForm editor={editor} onClose={onClose} />
    </Shell>
  )
}

function DateTimeForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const [now] = React.useState(() => new Date())
  const [picked, setPicked] = React.useState(DATE_FORMATS[0].id)
  const [auto, setAuto] = React.useState(false)
  const insert = () => {
    const format = DATE_FORMATS.find((f) => f.id === picked) ?? DATE_FORMATS[0]
    const chain = editor.chain().focus()
    if (auto) chain.insertField({ kind: format.kind, format: format.id })
    else chain.insertContent(format.render(now))
    chain.run()
    onClose()
  }
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        insert()
      }}
    >
      <DialogBody className="space-y-3">
        <div className="max-h-64 overflow-y-auto rounded-md border border-border">
          {DATE_FORMATS.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setPicked(f.id)}
              onDoubleClick={insert}
              className={cn(
                "block w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                picked === f.id && "bg-accent text-accent-foreground"
              )}
            >
              {f.render(now)}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={auto}
            onChange={(e) => setAuto(e.target.checked)}
          />
          {t("Aggiorna automaticamente")}
        </label>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit">{t("Inserisci")}</Button>
      </Footer>
    </form>
  )
}

/* --------------------------------- campo --------------------------------- */

const SIMPLE_FIELDS: FieldKind[] = [
  "date",
  "time",
  "page",
  "pages",
  "title",
  "author",
  "words",
]

export function FieldDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Campo")}
      description={t("Un valore che il documento calcola e tiene aggiornato.")}
    >
      <FieldForm editor={editor} onClose={onClose} />
    </Shell>
  )
}

function FieldForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const [kind, setKind] = React.useState<FieldKind>("page")
  const [format, setFormat] = React.useState("")
  const dates = DATE_FORMATS.filter((f) => f.kind === kind)
  const insert = () => {
    editor
      .chain()
      .focus()
      .insertField({ kind, format: format || dates[0]?.id || "" })
      .run()
    onClose()
  }
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        insert()
      }}
    >
      <DialogBody className="grid gap-3 sm:grid-cols-[180px_1fr]">
        <div className="rounded-md border border-border">
          {SIMPLE_FIELDS.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => {
                setKind(k)
                setFormat("")
              }}
              className={cn(
                "block w-full px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                kind === k && "bg-accent text-accent-foreground"
              )}
            >
              {FIELD_LABELS[k]}
            </button>
          ))}
        </div>
        <div className="space-y-2 text-sm">
          {dates.length ? (
            <label className="block space-y-1">
              <span className="text-xs text-muted-foreground">
                {t("Formato")}
              </span>
              <select
                value={format || dates[0].id}
                onChange={(e) => setFormat(e.target.value)}
                className={cn(selectClass, "w-full")}
              >
                {dates.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.render(new Date())}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <p className="text-xs leading-relaxed text-muted-foreground">
            {kind === "page"
              ? t(
                  "Il numero della pagina su cui si trova il campo, con il formato scelto in Inserisci › Numero di pagina."
                )
              : kind === "pages"
                ? t("Il numero totale di pagine del documento.")
                : kind === "title"
                  ? t("Il titolo del documento: cambia quando cambi il titolo.")
                  : kind === "author"
                    ? t("Il nome dell'autore impostato nell'app.")
                    : kind === "words"
                      ? t("Le parole del documento, aggiornate mentre scrivi.")
                      : t(
                          "Si aggiorna ogni volta che il documento viene aperto o stampato."
                        )}
          </p>
        </div>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit">{t("Inserisci")}</Button>
      </Footer>
    </form>
  )
}

/* --------------------------- riga della firma ---------------------------- */

export function SignatureDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  const t = useT()
  return (
    <Shell open={open} onClose={onClose} title={t("Riga della firma")}>
      <SignatureForm editor={editor} onClose={onClose} />
    </Shell>
  )
}

function SignatureForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const author = useAuthor()
  const [info, setInfo] = React.useState({
    name: author,
    role: "",
    email: "",
    date: true,
  })
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        editor.chain().focus().insertContent(signatureContent(info)).run()
        onClose()
      }}
    >
      <DialogBody className="space-y-2.5">
        {(
          [
            ["name", t("Firmatario suggerito"), t("Nome e cognome")],
            [
              "role",
              t("Titolo del firmatario"),
              t("Es. Amministratore delegato"),
            ],
            [
              "email",
              t("Indirizzo di posta elettronica"),
              t("nome@azienda.it"),
            ],
          ] as const
        ).map(([key, label, placeholder]) => (
          <label key={key} className="block space-y-1">
            <span className="text-xs text-muted-foreground">{label}</span>
            <Input
              value={info[key]}
              placeholder={placeholder}
              onChange={(e) => setInfo({ ...info, [key]: e.target.value })}
              className="h-8 text-sm"
            />
          </label>
        ))}
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={info.date}
            onChange={(e) => setInfo({ ...info, date: e.target.checked })}
          />
          {t("Aggiungi la riga per luogo e data")}
        </label>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit">{t("Inserisci")}</Button>
      </Footer>
    </form>
  )
}

/* ------------------------------- simboli -------------------------------- */

const SYMBOL_GROUPS: { label: string; chars: string }[] = [
  {
    get label() {
      return tr("Punteggiatura")
    },
    chars: "« » „ “ ” ‘ ’ ‚ … – — • · ¡ ¿ § ¶ † ‡ ※ ‖ © ® ™ ℗ № ℮ ° ′ ″",
  },
  {
    get label() {
      return tr("Valute")
    },
    chars: "€ £ $ ¥ ₹ ₽ ₩ ₿ ¢ ₺ ₴ ₦ ฿ ₫ ₪ ₱ ₲ ₡ ₵",
  },
  {
    get label() {
      return tr("Matematica")
    },
    chars:
      "± × ÷ = ≠ ≈ ≡ ≤ ≥ < > ∞ √ ∛ ∑ ∏ ∫ ∮ ∂ ∆ ∇ ∈ ∉ ⊂ ⊃ ⊆ ⊇ ∪ ∩ ∧ ∨ ¬ ∀ ∃ ∅ ‰ ∝ ∠ ⊥ ∥ ∴ ∵ ⌈ ⌉ ⌊ ⌋",
  },
  {
    get label() {
      return tr("Frazioni e apici")
    },
    chars:
      "½ ⅓ ⅔ ¼ ¾ ⅕ ⅖ ⅗ ⅘ ⅙ ⅚ ⅛ ⅜ ⅝ ⅞ ⁰ ¹ ² ³ ⁴ ⁵ ⁶ ⁷ ⁸ ⁹ ⁿ ₀ ₁ ₂ ₃ ₄ ₅ ₆ ₇ ₈ ₉",
  },
  {
    get label() {
      return tr("Greco")
    },
    chars:
      "α β γ δ ε ζ η θ ι κ λ μ ν ξ ο π ρ σ τ υ φ χ ψ ω Γ Δ Θ Λ Ξ Π Σ Φ Ψ Ω",
  },
  {
    get label() {
      return tr("Frecce")
    },
    chars: "← → ↑ ↓ ↔ ↕ ⇐ ⇒ ⇑ ⇓ ⇔ ↖ ↗ ↘ ↙ ↩ ↪ ↺ ↻ ⟵ ⟶ ⟷ ➔ ➜ ➤ ➢",
  },
  {
    get label() {
      return tr("Forme")
    },
    chars: "■ □ ▪ ▫ ▲ △ ▼ ▽ ◀ ▶ ◆ ◇ ● ○ ◉ ◎ ◐ ◑ ★ ☆ ♠ ♣ ♥ ♦ ✦ ✧ ❖",
  },
  {
    get label() {
      return tr("Spunte e segni")
    },
    chars: "✓ ✔ ✗ ✘ ☐ ☑ ☒ ⊕ ⊗ ⚠ ⓘ ☎ ✉ ✂ ✎ ⌘ ⌥ ⇧ ⌫ ⏎ ♫ ☀ ☁ ☂ ☕ ⚑",
  },
  {
    get label() {
      return tr("Lettere")
    },
    chars:
      "À Á Â Ä Ã Å Æ Ç È É Ê Ë Ì Í Î Ï Ñ Ò Ó Ô Ö Õ Ø Œ Ù Ú Û Ü ß à á â ä ã å æ ç è é ê ë ì í î ï ñ ò ó ô ö õ ø œ ù ú û ü ÿ",
  },
]

const RECENT_KEY = "cogniva.symbols.recent"

function readRecentSymbols(): string[] {
  try {
    const raw = JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]")
    return Array.isArray(raw)
      ? raw.filter((c) => typeof c === "string").slice(0, 16)
      : []
  } catch {
    return []
  }
}

function saveRecentSymbols(list: string[]) {
  try {
    localStorage.setItem(RECENT_KEY, JSON.stringify(list))
  } catch {
    // senza localStorage i recenti valgono finché la finestra è aperta
  }
}

export function SymbolDialog({
  open,
  onClose,
  editor,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
}) {
  const t = useT()
  return (
    <Shell open={open} onClose={onClose} title={t("Simboli")} width={560}>
      <SymbolForm editor={editor} onClose={onClose} />
    </Shell>
  )
}

function SymbolForm({
  editor,
  onClose,
}: {
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const [group, setGroup] = React.useState(SYMBOL_GROUPS[0].label)
  const [picked, setPicked] = React.useState<string | null>(null)
  const [code, setCode] = React.useState("")
  const [recent, setRecent] = React.useState<string[]>(readRecentSymbols)

  const chars = (SYMBOL_GROUPS.find((g) => g.label === group)?.chars ?? "")
    .split(" ")
    .filter(Boolean)
  const fromCode = /^(u\+)?[0-9a-f]{4,5}$/i.test(code.trim())
    ? String.fromCodePoint(parseInt(code.trim().replace(/^u\+/i, ""), 16))
    : null
  const current = fromCode ?? picked

  const insert = (char: string | null) => {
    if (!char) return
    editor.chain().focus().insertContent(char).run()
    const next = [char, ...recent.filter((c) => c !== char)].slice(0, 16)
    setRecent(next)
    saveRecentSymbols(next)
  }

  const cell = (char: string) => (
    <button
      key={char}
      type="button"
      title={`U+${char.codePointAt(0)?.toString(16).toUpperCase().padStart(4, "0")}`}
      onClick={() => {
        setPicked(char)
        setCode("")
      }}
      onDoubleClick={() => insert(char)}
      className={cn(
        "flex aspect-square items-center justify-center rounded-md border text-lg transition hover:bg-muted",
        current === char ? "border-primary bg-accent" : "border-border"
      )}
    >
      {char}
    </button>
  )

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        insert(current)
      }}
    >
      <DialogBody className="space-y-3">
        <div className="flex flex-wrap gap-1">
          {SYMBOL_GROUPS.map((g) => (
            <button
              key={g.label}
              type="button"
              onClick={() => setGroup(g.label)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-xs transition",
                group === g.label
                  ? "border-primary bg-accent text-accent-foreground"
                  : "border-border text-muted-foreground hover:text-foreground"
              )}
            >
              {g.label}
            </button>
          ))}
        </div>
        <div className="grid max-h-60 grid-cols-8 gap-1 overflow-y-auto sm:grid-cols-12">
          {chars.map(cell)}
        </div>
        {recent.length ? (
          <div>
            <span className="text-xs text-muted-foreground">
              {t("Simboli usati di recente")}
            </span>
            <div className="mt-1 grid grid-cols-8 gap-1 sm:grid-cols-16">
              {recent.map(cell)}
            </div>
          </div>
        ) : null}
        <div className="flex items-center gap-3">
          <span
            className="flex size-12 shrink-0 items-center justify-center rounded-lg border border-border text-2xl"
            aria-live="polite"
          >
            {current ?? ""}
          </span>
          <label className="flex flex-1 items-center gap-2 text-xs text-muted-foreground">
            {t("Codice carattere")}
            <Input
              value={
                code ||
                (current
                  ? current
                      .codePointAt(0)!
                      .toString(16)
                      .toUpperCase()
                      .padStart(4, "0")
                  : "")
              }
              onChange={(e) => setCode(e.target.value)}
              placeholder="00A9"
              className="h-8 w-24 font-mono text-sm uppercase"
            />
          </label>
        </div>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit" disabled={!current}>
          {t("Inserisci")}
        </Button>
      </Footer>
    </form>
  )
}

/* -------------------------------- icone --------------------------------- */

export function IconsDialog({
  open,
  onClose,
  theme,
  onInsert,
}: {
  open: boolean
  onClose: () => void
  theme: DocTheme
  onInsert: (names: string[], color: string) => void
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Inserisci icone")}
      description={t(
        "Si inseriscono come immagini: si spostano, ruotano e ridimensionano come le foto."
      )}
      width={620}
    >
      <IconsForm theme={theme} onClose={onClose} onInsert={onInsert} />
    </Shell>
  )
}

function IconsForm({
  theme,
  onClose,
  onInsert,
}: {
  theme: DocTheme
  onClose: () => void
  onInsert: (names: string[], color: string) => void
}) {
  const t = useT()
  const [query, setQuery] = React.useState("")
  const [category, setCategory] = React.useState<string | null>(null)
  const [picked, setPicked] = React.useState<string[]>([])
  const [color, setColor] = React.useState(docAccent(theme.accent).solid)
  const q = query.trim().toLowerCase()
  const names = q
    ? ICON_NAMES.filter((n) => n.includes(q))
    : category
      ? (ICON_CATEGORIES.find((c) => c.label === category)?.icons ?? [])
      : ICON_NAMES
  const colors = [
    ...new Set([
      docAccent(theme.accent).solid,
      "#18181b",
      "#71717a",
      ...["blue", "purple", "pink", "teal", "green", "orange"].map(
        (k) => getSwatch(k).solid
      ),
    ]),
  ]
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        if (!picked.length) return
        onInsert(picked, color)
        onClose()
      }}
    >
      <DialogBody className="space-y-3">
        <div className="flex items-center gap-2 rounded-md border border-input px-2.5">
          <Search className="size-3.5 text-muted-foreground" />
          <input
            autoFocus
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t(
              "Cerca fra {count} icone (in inglese: arrow, user, chart…)",
              { count: ICON_NAMES.length }
            )}
            className="h-8 flex-1 bg-transparent text-sm outline-none"
          />
        </div>
        {!q ? (
          <div className="flex gap-1 overflow-x-auto pb-1">
            {[null, ...ICON_CATEGORIES.map((c) => c.label)].map((label) => (
              <button
                key={label ?? "all"}
                type="button"
                onClick={() => setCategory(label)}
                className={cn(
                  "shrink-0 rounded-full border px-2.5 py-1 text-xs transition",
                  category === label
                    ? "border-primary bg-accent text-accent-foreground"
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                {label ? t(label) : t("Tutte")}
              </button>
            ))}
          </div>
        ) : null}
        <div className="grid max-h-72 grid-cols-6 gap-1.5 overflow-y-auto sm:grid-cols-10">
          {names.map((name) => {
            const on = picked.includes(name)
            return (
              <button
                key={name}
                type="button"
                title={name}
                aria-pressed={on}
                onClick={() =>
                  setPicked(
                    on ? picked.filter((n) => n !== name) : [...picked, name]
                  )
                }
                className={cn(
                  "flex aspect-square items-center justify-center rounded-md border transition hover:bg-muted",
                  on ? "border-primary bg-accent" : "border-border"
                )}
              >
                <Glyph name={name} size={22} color={color} />
              </button>
            )
          })}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted-foreground">
            {t("Colore")}
          </span>
          {colors.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setColor(c)}
              className={cn(
                "size-6 rounded-md ring-1 ring-black/10",
                color === c &&
                  "ring-2 ring-ring ring-offset-1 ring-offset-background"
              )}
              style={{ background: c }}
              aria-label={c}
            />
          ))}
          <div className="w-28">
            <CustomColor value={color} onChange={setColor} />
          </div>
        </div>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit" disabled={!picked.length}>
          {t("Inserisci")}
          {picked.length ? ` (${picked.length})` : ""}
        </Button>
      </Footer>
    </form>
  )
}

/* ------------------------------- SmartArt ------------------------------- */

function SmartArtPreview({ id }: { id: string }) {
  const { drafts, edges } = smartArtBoard(id)
  const nodes = drafts.map((d) => ({ ...d.node, key: d.key }))
  const xs = nodes.flatMap((n) => [n.x, n.x + (n.w ?? 180)])
  const ys = nodes.flatMap((n) => [n.y, n.y + (n.h ?? 84)])
  const minX = Math.min(...xs) - 20
  const minY = Math.min(...ys) - 20
  const w = Math.max(...xs) - minX + 20
  const h = Math.max(...ys) - minY + 20
  const byKey = new Map(nodes.map((n) => [n.key, n]))
  return (
    <svg
      viewBox={`${minX} ${minY} ${w} ${h}`}
      className="h-20 w-full"
      aria-hidden
    >
      {edges.map((e, i) => {
        const a = byKey.get(e.from)
        const b = byKey.get(e.to)
        if (!a || !b) return null
        return (
          <line
            key={i}
            x1={a.x + (a.w ?? 180) / 2}
            y1={a.y + (a.h ?? 84) / 2}
            x2={b.x + (b.w ?? 180) / 2}
            y2={b.y + (b.h ?? 84) / 2}
            stroke="currentColor"
            strokeOpacity={0.4}
            strokeWidth={6}
          />
        )
      })}
      {nodes.map((n) => (
        <rect
          key={n.key}
          x={n.x}
          y={n.y}
          width={n.w ?? 180}
          height={n.h ?? 84}
          rx={
            n.shape === "ellipse"
              ? (n.w ?? 180) / 2
              : n.shape === "pill"
                ? (n.h ?? 84) / 2
                : n.shape === "rect"
                  ? 4
                  : 16
          }
          fill={getSwatch(n.color ?? "blue").fill}
          stroke={getSwatch(n.color ?? "blue").solid}
          strokeWidth={5}
        />
      ))}
    </svg>
  )
}

export function SmartArtDialog({
  open,
  onClose,
  onPick,
}: {
  open: boolean
  onClose: () => void
  onPick: (id: string) => void
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Scegli elemento grafico SmartArt")}
      description={t(
        "Diventa una board incorporata: si modifica con tutti gli strumenti delle board."
      )}
      width={640}
    >
      <SmartArtForm onClose={onClose} onPick={onPick} />
    </Shell>
  )
}

function SmartArtForm({
  onClose,
  onPick,
}: {
  onClose: () => void
  onPick: (id: string) => void
}) {
  const t = useT()
  const groups = [...new Set(SMARTART_TEMPLATES.map((t) => t.group))]
  const [group, setGroup] = React.useState<string | null>(null)
  const [picked, setPicked] = React.useState(SMARTART_TEMPLATES[0].id)
  const shown = SMARTART_TEMPLATES.filter((t) => !group || t.group === group)
  const current = SMARTART_TEMPLATES.find((t) => t.id === picked)
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        onPick(picked)
        onClose()
      }}
    >
      <DialogBody className="grid gap-3 sm:grid-cols-[130px_1fr]">
        <div className="flex gap-1 overflow-x-auto sm:flex-col">
          {[null, ...groups].map((g) => (
            <button
              key={g ?? "all"}
              type="button"
              onClick={() => setGroup(g)}
              className={cn(
                "shrink-0 rounded-md px-2.5 py-1.5 text-left text-sm hover:bg-muted",
                group === g && "bg-accent text-accent-foreground"
              )}
            >
              {g ?? t("Tutti")}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {shown.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setPicked(t.id)}
                onDoubleClick={() => {
                  onPick(t.id)
                  onClose()
                }}
                className={cn(
                  "rounded-lg border p-2 text-left transition hover:border-foreground/30",
                  picked === t.id
                    ? "border-primary ring-1 ring-primary/40"
                    : "border-border"
                )}
              >
                <SmartArtPreview id={t.id} />
                <span className="mt-1 block truncate text-xs font-medium">
                  {t.label}
                </span>
              </button>
            ))}
          </div>
          {current ? (
            <p className="text-xs text-muted-foreground">
              <b className="text-foreground">{current.label}</b> —{" "}
              {current.hint}.
            </p>
          ) : null}
        </div>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit">OK</Button>
      </Footer>
    </form>
  )
}

/* ------------------------------ capolettera ------------------------------ */

export function DropCapDialog({
  open,
  onClose,
  editor,
  theme,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
  theme: DocTheme
}) {
  const t = useT()
  return (
    <Shell open={open} onClose={onClose} title={t("Capolettera")}>
      <DropCapForm editor={editor} theme={theme} onClose={onClose} />
    </Shell>
  )
}

function DropCapForm({
  editor,
  theme,
  onClose,
}: {
  editor: Editor
  theme: DocTheme
  onClose: () => void
}) {
  const t = useT()
  const attrs = editor.getAttributes("paragraph")
  const [mode, setMode] = React.useState<"drop" | "margin" | null>(
    (attrs.dropCap as "drop" | "margin" | null) ?? "drop"
  )
  const [lines, setLines] = React.useState(Number(attrs.dropLines) || 3)
  const [font, setFont] = React.useState<string>(
    theme.headingFont ?? theme.font
  )
  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        editor
          .chain()
          .focus()
          .setDropCap(mode, lines, mode ? fontStack(font) : null)
          .run()
        onClose()
      }}
    >
      <DialogBody className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {(
            [
              [null, t("Nessuno")],
              ["drop", t("Interno")],
              ["margin", t("Nel margine")],
            ] as const
          ).map(([value, label]) => (
            <button
              key={label}
              type="button"
              onClick={() => setMode(value)}
              className={cn(
                "flex flex-col items-center gap-1 rounded-lg border p-2 text-xs transition",
                mode === value
                  ? "border-primary ring-1 ring-primary/40"
                  : "border-border"
              )}
            >
              <span
                aria-hidden
                className="relative flex h-12 w-16 flex-col justify-center gap-1"
              >
                {value ? (
                  <span
                    className="absolute top-0.5 text-2xl leading-none font-bold text-primary"
                    style={{ left: value === "margin" ? -8 : 0 }}
                  >
                    {t("A")}
                  </span>
                ) : null}
                {[0, 1, 2, 3].map((i) => (
                  <span
                    key={i}
                    className="h-[3px] rounded-full bg-foreground/20"
                    style={{ marginLeft: value === "drop" && i < 3 ? 18 : 0 }}
                  />
                ))}
              </span>
              {label}
            </button>
          ))}
        </div>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Tipo di carattere")}
          </span>
          <FontPicker value={font} onChange={setFont} />
        </label>
        <label className="flex items-center justify-between gap-3 text-sm">
          <span className="text-muted-foreground">{t("Altezza in righe")}</span>
          <input
            type="number"
            min={2}
            max={6}
            value={lines}
            onChange={(e) =>
              setLines(Math.max(2, Math.min(6, Number(e.target.value) || 3)))
            }
            className="h-8 w-20 rounded-md border border-input bg-transparent px-2 text-right tabular-nums"
          />
        </label>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button type="submit">OK</Button>
      </Footer>
    </form>
  )
}

/* ----------------------- intestazione e piè di pagina -------------------- */

export function HeaderFooterDialog({
  open,
  onClose,
  theme,
  setTheme,
  initial,
}: {
  open: boolean
  onClose: () => void
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  initial: "header" | "footer"
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Intestazione e piè di pagina")}
      description={t(
        "Tre parti per riga: a sinistra, al centro, a destra. I campi si riempiono pagina per pagina."
      )}
      width={600}
    >
      <HeaderFooterForm
        theme={theme}
        setTheme={setTheme}
        onClose={onClose}
        initial={initial}
      />
    </Shell>
  )
}

function HeaderFooterForm({
  theme,
  setTheme,
  onClose,
  initial,
}: {
  theme: DocTheme
  setTheme: (patch: Partial<DocTheme>) => void
  onClose: () => void
  initial: "header" | "footer"
}) {
  const t = useT()
  const [tab, setTab] = React.useState(initial)
  const [header, setHeader] = React.useState(bandParts(theme.header))
  const [footer, setFooter] = React.useState(bandParts(theme.footer))
  const [first, setFirst] = React.useState(theme.differentFirstPage)
  const [format, setFormat] = React.useState(theme.pageNumberFormat)
  const [start, setStart] = React.useState(theme.pageNumberStart)
  const focused = React.useRef<{
    index: number
    input: HTMLInputElement | null
  }>({
    index: 0,
    input: null,
  })
  const parts = tab === "header" ? header : footer
  const setParts = tab === "header" ? setHeader : setFooter
  const presets = tab === "header" ? HEADER_PRESETS : FOOTER_PRESETS

  const addToken = (token: string) => {
    const { index, input } = focused.current
    const value = parts[index]
    const at = input?.selectionStart ?? value.length
    const next = [...parts] as [string, string, string]
    next[index] = `${value.slice(0, at)}${token}${value.slice(at)}`
    setParts(next)
  }

  return (
    <form
      className="contents"
      onSubmit={(e) => {
        e.preventDefault()
        setTheme({
          header: joinBand(header),
          footer: joinBand(footer),
          differentFirstPage: first,
          pageNumberFormat: format,
          pageNumberStart: Math.max(0, Math.round(start)),
        })
        onClose()
      }}
    >
      <DialogBody className="space-y-3">
        <div className="flex gap-1 rounded-lg bg-muted p-0.5">
          {(["header", "footer"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setTab(value)}
              className={cn(
                "h-7 flex-1 rounded-md text-xs transition",
                tab === value
                  ? "bg-background font-medium shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              {value === "header" ? t("Intestazione") : t("Piè di pagina")}
            </button>
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-3">
          {([t("A sinistra"), t("Al centro"), t("A destra")] as const).map(
            (label, i) => (
              <label key={label} className="block space-y-1">
                <span className="text-xs text-muted-foreground">{label}</span>
                <Input
                  value={parts[i]}
                  onFocus={(e) => {
                    focused.current = { index: i, input: e.target }
                  }}
                  onChange={(e) => {
                    const next = [...parts] as [string, string, string]
                    next[i] = e.target.value.replace(/\|/g, "")
                    setParts(next)
                  }}
                  className={cn(
                    "h-8 text-sm",
                    i === 1 && "text-center",
                    i === 2 && "text-right"
                  )}
                />
              </label>
            )
          )}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          <span className="mr-1 text-xs text-muted-foreground">
            {t("Inserisci campo")}
          </span>
          {BAND_FIELDS.map((f) => (
            <Button
              key={f.token}
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => addToken(f.token)}
            >
              {f.label}
            </Button>
          ))}
        </div>
        <div>
          <span className="text-xs text-muted-foreground">{t("Modelli")}</span>
          <div className="mt-1 grid grid-cols-2 gap-1.5 sm:grid-cols-3">
            {presets.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => setParts(bandParts(p.value))}
                className="rounded-md border border-border px-2 py-1.5 text-left transition hover:bg-muted"
              >
                <span className="block text-xs font-medium">{p.label}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {p.hint}
                </span>
              </button>
            ))}
          </div>
        </div>
        <div className="grid gap-2 border-t border-border pt-3 sm:grid-cols-3">
          <label className="flex items-center gap-2 text-sm sm:col-span-3">
            <input
              type="checkbox"
              checked={first}
              onChange={(e) => setFirst(e.target.checked)}
            />
            {t(
              "Diversa per la prima pagina (niente intestazione e piè di pagina)"
            )}
          </label>
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">
              {t("Formato numeri di pagina")}
            </span>
            <select
              value={format}
              onChange={(e) =>
                setFormat(e.target.value as DocTheme["pageNumberFormat"])
              }
              className={cn(selectClass, "w-full")}
            >
              {PAGE_NUMBER_FORMATS.map((f) => (
                <option key={f.value} value={f.value}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {t("Inizia da")}
            </span>
            <input
              type="number"
              min={0}
              max={9999}
              value={start}
              onChange={(e) => setStart(Number(e.target.value) || 0)}
              className="h-8 w-full rounded-md border border-input bg-transparent px-2 text-right text-sm tabular-nums"
            />
          </label>
        </div>
      </DialogBody>
      <Footer onClose={onClose}>
        <Button
          type="button"
          variant="outline"
          onClick={() => setParts(["", "", ""])}
        >
          {tab === "header"
            ? t("Rimuovi intestazione")
            : t("Rimuovi piè di pagina")}
        </Button>
        <Button type="submit">{t("Salva")}</Button>
      </Footer>
    </form>
  )
}
