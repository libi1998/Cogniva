"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { ArrowDownAZ, Plus, Search, Trash2, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { useAuthor } from "@/lib/author"
import {
  addressText,
  emptyMerge,
  ENVELOPES,
  LABEL_PRODUCTS,
  mergedRows,
  parseDelimited,
  RULE_OPS,
  type LabelProduct,
} from "@/lib/doc-merge"
import type { MergeData, MergeRule } from "@/lib/types"
import { cn } from "@/lib/utils"

import { useT, useLocale, currentLocale } from "@/lib/i18n/client"
import type { Locale } from "@/lib/i18n/config"
import { fieldName, findField, type MergeFieldKey } from "@/lib/doc-merge"
const selectClass =
  "h-8 w-full min-w-0 rounded-md border border-input bg-transparent px-2 text-sm text-foreground"

function Shell({
  open,
  onClose,
  title,
  description,
  width = 480,
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
      <DialogContent
        className="gap-0 p-0"
        style={{ maxWidth: `min(${width}px, calc(100% - 2rem))` }}
      >
        <DialogHeader className="border-b border-border px-5 py-4">
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
    <DialogFooter className="border-t border-border px-5 py-3">
      <Button type="button" variant="ghost" onClick={onClose}>
        {t("Annulla")}
      </Button>
      {children}
    </DialogFooter>
  )
}

/* ------------------------- elenco dei destinatari ------------------------ */

export function RecipientsDialog({
  open,
  onClose,
  merge,
  setMerge,
}: {
  open: boolean
  onClose: () => void
  merge: MergeData | undefined
  setMerge: (merge: MergeData) => void
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Destinatari della stampa unione")}
      description={t(
        "Scrivi l'elenco o importa un file CSV (anche esportato da Excel o da Google Fogli)."
      )}
      width={900}
    >
      <RecipientsForm merge={merge} setMerge={setMerge} onClose={onClose} />
    </Shell>
  )
}

function RecipientsForm({
  merge,
  setMerge,
  onClose,
}: {
  merge: MergeData | undefined
  setMerge: (merge: MergeData) => void
  onClose: () => void
}) {
  const t = useT()
  const [draft, setDraft] = React.useState<MergeData>(() => {
    const base = merge ?? emptyMerge()
    return base.rows.length ? base : { ...base, rows: [{}, {}, {}] }
  })
  const [query, setQuery] = React.useState("")
  const [newField, setNewField] = React.useState("")
  const fileRef = React.useRef<HTMLInputElement>(null)
  const excluded = new Set(draft.excluded)
  const q = query.trim().toLocaleLowerCase("it")
  const visible = draft.rows
    .map((row, index) => ({ row, index }))
    .filter(({ row }) =>
      q
        ? Object.values(row).some((v) => v.toLocaleLowerCase("it").includes(q))
        : true
    )

  const update = (index: number, field: string, value: string) =>
    setDraft((d) => ({
      ...d,
      rows: d.rows.map((r, i) => (i === index ? { ...r, [field]: value } : r)),
    }))

  const sortBy = (field: string) =>
    setDraft((d) => {
      // l'ordine cambia: le righe escluse seguono le loro righe
      const items = d.rows.map((row, i) => ({
        row,
        out: d.excluded.includes(i),
      }))
      items.sort((a, b) =>
        (a.row[field] ?? "").localeCompare(
          b.row[field] ?? "",
          currentLocale(),
          {
            numeric: true,
          }
        )
      )
      return {
        ...d,
        rows: items.map((x) => x.row),
        excluded: items.flatMap((x, i) => (x.out ? [i] : [])),
        preview: -1,
      }
    })

  return (
    <div>
      <div className="space-y-3 px-5 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex h-8 min-w-48 flex-1 items-center gap-2 rounded-md border border-input px-2">
            <Search className="size-3.5 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("Trova destinatario")}
              className="h-full flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileRef.current?.click()}
          >
            <Upload /> {t("Usa elenco esistente…")}
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,.tsv,.txt,text/csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0]
              e.target.value = ""
              if (!file) return
              const parsed = parseDelimited(await file.text())
              if (!parsed.fields.length) {
                toast.error(t("Il file non ha intestazioni di colonna"))
                return
              }
              setDraft((d) => ({ ...d, ...parsed, excluded: [], preview: -1 }))
              toast.success(
                t("{count} destinatari importati", {
                  count: parsed.rows.length,
                })
              )
            }}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setDraft((d) => ({ ...d, rows: [...d.rows, {}] }))}
          >
            <Plus /> {t("Nuova voce")}
          </Button>
        </div>

        <div className="max-h-[50dvh] overflow-auto rounded-md border border-border">
          <table className="w-max min-w-full border-collapse text-sm">
            <thead className="sticky top-0 z-10 bg-muted">
              <tr>
                <th className="w-9 border-b border-border px-2 py-1.5 text-left">
                  <input
                    type="checkbox"
                    aria-label={t("Includi tutti")}
                    checked={draft.excluded.length === 0}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        excluded: e.target.checked
                          ? []
                          : d.rows.map((_, i) => i),
                      }))
                    }
                  />
                </th>
                {draft.fields.map((field) => (
                  <th
                    key={field}
                    className="border-b border-l border-border px-2 py-1.5 text-left font-medium whitespace-nowrap"
                  >
                    <span className="flex items-center gap-1">
                      {field}
                      <button
                        type="button"
                        title={t("Ordina per {field}", { field })}
                        onClick={() => sortBy(field)}
                        className="rounded p-0.5 text-muted-foreground hover:bg-background"
                      >
                        <ArrowDownAZ className="size-3.5" />
                      </button>
                      <button
                        type="button"
                        title={t("Elimina la colonna {field}", { field })}
                        onClick={() =>
                          setDraft((d) => ({
                            ...d,
                            fields: d.fields.filter((f) => f !== field),
                          }))
                        }
                        className="rounded p-0.5 text-muted-foreground hover:bg-background"
                      >
                        <Trash2 className="size-3" />
                      </button>
                    </span>
                  </th>
                ))}
                <th className="w-9 border-b border-l border-border" />
              </tr>
            </thead>
            <tbody>
              {visible.map(({ row, index }) => (
                <tr
                  key={index}
                  className={cn(excluded.has(index) && "opacity-45")}
                >
                  <td className="border-b border-border px-2">
                    <input
                      type="checkbox"
                      aria-label={t("Includi il destinatario {number}", {
                        number: index + 1,
                      })}
                      checked={!excluded.has(index)}
                      onChange={(e) =>
                        setDraft((d) => ({
                          ...d,
                          excluded: e.target.checked
                            ? d.excluded.filter((i) => i !== index)
                            : [...d.excluded, index],
                        }))
                      }
                    />
                  </td>
                  {draft.fields.map((field) => (
                    <td
                      key={field}
                      className="border-b border-l border-border p-0"
                    >
                      <input
                        value={row[field] ?? ""}
                        onChange={(e) => update(index, field, e.target.value)}
                        className="h-8 w-40 bg-transparent px-2 outline-none focus:bg-accent/40"
                      />
                    </td>
                  ))}
                  <td className="border-b border-l border-border px-1">
                    <button
                      type="button"
                      title={t("Elimina la voce")}
                      onClick={() =>
                        setDraft((d) => ({
                          ...d,
                          rows: d.rows.filter((_, i) => i !== index),
                          excluded: d.excluded
                            .filter((i) => i !== index)
                            .map((i) => (i > index ? i - 1 : i)),
                          preview: -1,
                        }))
                      }
                      className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <form
          className="flex items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault()
            const name = newField.trim()
            if (!name || draft.fields.includes(name)) return
            setDraft((d) => ({ ...d, fields: [...d.fields, name] }))
            setNewField("")
          }}
        >
          <Input
            value={newField}
            onChange={(e) => setNewField(e.target.value)}
            placeholder={t("Nuova colonna (es. Importo)")}
            className="h-8 max-w-56 text-sm"
          />
          <Button
            type="submit"
            size="sm"
            variant="outline"
            disabled={!newField.trim()}
          >
            {t("Aggiungi colonna")}
          </Button>
          <span className="ml-auto text-xs text-muted-foreground">
            {t("{included} di {total} inclusi", {
              included: draft.rows.length - draft.excluded.length,
              total: draft.rows.length,
            })}
          </span>
        </form>
      </div>
      <Footer onClose={onClose}>
        <Button
          type="button"
          onClick={() => {
            // le righe completamente vuote non sono destinatari
            const keep = draft.rows
              .map((row, i) => ({ row, i }))
              .filter(({ row }) => Object.values(row).some((v) => v.trim()))
            const map = new Map(keep.map(({ i }, n) => [i, n]))
            setMerge({
              ...draft,
              rows: keep.map(({ row }) => row),
              excluded: draft.excluded.flatMap((i) =>
                map.has(i) ? [map.get(i)!] : []
              ),
              preview: -1,
            })
            onClose()
          }}
        >
          OK
        </Button>
      </Footer>
    </div>
  )
}

/* ------------------------- blocco indirizzo e saluto --------------------- */

export function AddressBlockDialog({
  open,
  onClose,
  editor,
  merge,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
  merge: MergeData | undefined
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Inserisci blocco indirizzo")}
    >
      <AddressBlockForm editor={editor} merge={merge} onClose={onClose} />
    </Shell>
  )
}

function AddressBlockForm({
  editor,
  merge,
  onClose,
}: {
  editor: Editor
  merge: MergeData | undefined
  onClose: () => void
}) {
  const t = useT()
  const fields = merge?.fields ?? []
  const field = (key: MergeFieldKey) => findField(fields, key)
  const regionField = field("region")
  const [company, setCompany] = React.useState(Boolean(field("company")))
  const [title, setTitle] = React.useState(Boolean(field("title")))
  const sample = merge?.rows[0] ?? {}
  const lines: string[][] = (
    [
      [...(title ? (["title"] as const) : []), "first", "last"],
      ...(company ? [["company"] as const] : []),
      ["address"],
      ["zip", "city", "region"],
    ] as MergeFieldKey[][]
  ).map((line) =>
    line.map((key) => field(key)).filter((f): f is string => Boolean(f))
  )

  return (
    <div>
      <div className="space-y-3 px-5 py-4 text-sm">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={title}
            onChange={(e) => setTitle(e.target.checked)}
          />
          {t("Includi il titolo (Sig., Dott.ssa…)")}
        </label>
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={company}
            onChange={(e) => setCompany(e.target.checked)}
          />
          {t("Inserisci il nome della società")}
        </label>
        <div className="rounded-md border border-border bg-muted/40 px-3 py-2 leading-relaxed">
          {lines
            .filter((l) => l.length)
            .map((line, i) => (
              <p key={i}>
                {line
                  .map((f) =>
                    f === regionField
                      ? `(${sample[f] ?? f})`
                      : (sample[f] ?? `«${f}»`)
                  )
                  .join(" ")}
              </p>
            ))}
        </div>
        {!fields.length ? (
          <p className="text-xs text-destructive">
            {t("Prima scegli i destinatari: i campi vengono dall'elenco.")}
          </p>
        ) : null}
      </div>
      <Footer onClose={onClose}>
        <Button
          type="button"
          disabled={!fields.length}
          onClick={() => {
            const content = lines
              .filter((l) => l.length)
              .map((line) => ({
                type: "paragraph",
                attrs: { spaceAfter: "0px" },
                content: line.flatMap((f, i) => [
                  ...(i
                    ? [{ type: "text", text: f === regionField ? " (" : " " }]
                    : []),
                  { type: "mergeField", attrs: { name: f } },
                  ...(f === regionField ? [{ type: "text", text: ")" }] : []),
                ]),
              }))
            editor
              .chain()
              .focus()
              .insertContent([...content, { type: "paragraph" }])
              .run()
            onClose()
          }}
        >
          {t("Inserisci")}
        </Button>
      </Footer>
    </div>
  )
}

/** I saluti d'apertura di una lettera, lingua per lingua */
const SALUTATIONS: Record<Locale, string[]> = {
  it: [
    "Gentile",
    "Egregio",
    "Gentilissima",
    "Caro",
    "Cara",
    "Spettabile",
    "Ciao",
  ],
  en: ["Dear", "Hello", "Hi", "To"],
  es: ["Estimado", "Estimada", "Querido", "Querida", "Hola"],
  fr: ["Madame, Monsieur", "Cher", "Chère", "Bonjour"],
  de: ["Sehr geehrte", "Sehr geehrter", "Liebe", "Lieber", "Hallo"],
  pt: ["Prezado", "Prezada", "Caro", "Cara", "Olá"],
}

const NAME_FORMATS: MergeFieldKey[][] = [
  ["first", "last"],
  ["title", "last"],
  ["title", "first", "last"],
  ["first"],
  ["company"],
]

export function GreetingDialog({
  open,
  onClose,
  editor,
  merge,
}: {
  open: boolean
  onClose: () => void
  editor: Editor
  merge: MergeData | undefined
}) {
  const t = useT()
  return (
    <Shell open={open} onClose={onClose} title={t("Inserisci riga saluto")}>
      <GreetingForm editor={editor} merge={merge} onClose={onClose} />
    </Shell>
  )
}

function GreetingForm({
  editor,
  merge,
  onClose,
}: {
  editor: Editor
  merge: MergeData | undefined
  onClose: () => void
}) {
  const t = useT()
  const locale = useLocale()
  const fields = merge?.fields ?? []
  const salutations = SALUTATIONS[locale]
  const [salutation, setSalutation] = React.useState(salutations[0]!)
  const [format, setFormat] = React.useState(0)
  const [punctuation, setPunctuation] = React.useState(",")
  const [fallback, setFallback] = React.useState(() => t("Gentile cliente,"))
  const sample = merge?.rows[0] ?? {}
  const parts = NAME_FORMATS[format]!.map((key) =>
    findField(fields, key)
  ).filter((f): f is string => Boolean(f))
  return (
    <div>
      <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{t("Saluto")}</span>
          <select
            value={salutation}
            onChange={(e) => setSalutation(e.target.value)}
            className={selectClass}
          >
            {salutations.map((s) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{t("Nome")}</span>
          <select
            value={format}
            onChange={(e) => setFormat(Number(e.target.value))}
            className={selectClass}
          >
            {NAME_FORMATS.map((keys, i) => (
              <option key={keys.join("-")} value={i}>
                {keys.map(fieldName).join(" ")}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Punteggiatura")}
          </span>
          <select
            value={punctuation}
            onChange={(e) => setPunctuation(e.target.value)}
            className={selectClass}
          >
            {[",", ":", "!", ""].map((p) => (
              <option key={p} value={p}>
                {p || t("(nessuna)")}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1 sm:col-span-3">
          <span className="text-xs text-muted-foreground">
            {t("Per i destinatari senza nome")}
          </span>
          <Input
            value={fallback}
            onChange={(e) => setFallback(e.target.value)}
            className="h-8 text-sm"
          />
        </label>
        <p className="rounded-md border border-border bg-muted/40 px-3 py-2 sm:col-span-3">
          {salutation} {parts.map((f) => sample[f] ?? `«${f}»`).join(" ")}
          {punctuation}
        </p>
      </div>
      <Footer onClose={onClose}>
        <Button
          type="button"
          disabled={!parts.length}
          onClick={() => {
            // senza il primo campo del nome si usa la frase alternativa
            const first = parts[0]
            editor
              .chain()
              .focus()
              .insertContent([
                {
                  type: "mergeIf",
                  attrs: {
                    field: first,
                    op: "empty",
                    value: "",
                    then: fallback,
                    otherwise: `${salutation} `,
                  },
                },
                ...parts.flatMap((f, i) => [
                  ...(i ? [{ type: "text", text: " " }] : []),
                  { type: "mergeField", attrs: { name: f } },
                ]),
                ...(punctuation ? [{ type: "text", text: punctuation }] : []),
              ])
              .run()
            onClose()
          }}
        >
          {t("Inserisci")}
        </Button>
      </Footer>
    </div>
  )
}

/* -------------------------------- regole --------------------------------- */

export type RuleKind = "if" | "skip"

export function RuleDialog({
  open,
  onClose,
  kind,
  editor,
  merge,
  setMerge,
}: {
  open: boolean
  onClose: () => void
  kind: RuleKind
  editor: Editor
  merge: MergeData | undefined
  setMerge: (merge: MergeData) => void
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={
        kind === "skip" ? t("Salta record se…") : t("Se… Allora… Altrimenti…")
      }
      description={
        kind === "skip"
          ? t("I destinatari che rispettano la condizione non vengono uniti.")
          : t(
              "Il testo cambia secondo il valore di un campo di ogni destinatario."
            )
      }
    >
      <RuleForm
        kind={kind}
        editor={editor}
        merge={merge}
        setMerge={setMerge}
        onClose={onClose}
      />
    </Shell>
  )
}

function RuleForm({
  kind,
  editor,
  merge,
  setMerge,
  onClose,
}: {
  kind: RuleKind
  editor: Editor
  merge: MergeData | undefined
  setMerge: (merge: MergeData) => void
  onClose: () => void
}) {
  const t = useT()
  const fields = merge?.fields ?? []
  const [rule, setRule] = React.useState<MergeRule>({
    field: fields[0] ?? "",
    op: "eq",
    value: "",
  })
  const [then, setThen] = React.useState("")
  const [otherwise, setOtherwise] = React.useState("")
  const needsValue = rule.op !== "empty" && rule.op !== "filled"
  return (
    <div>
      <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-3">
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Nome campo")}
          </span>
          <select
            value={rule.field}
            onChange={(e) => setRule({ ...rule, field: e.target.value })}
            className={selectClass}
          >
            {fields.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Confronto")}
          </span>
          <select
            value={rule.op}
            onChange={(e) =>
              setRule({ ...rule, op: e.target.value as MergeRule["op"] })
            }
            className={selectClass}
          >
            {RULE_OPS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Confronta con")}
          </span>
          <Input
            value={rule.value}
            disabled={!needsValue}
            onChange={(e) => setRule({ ...rule, value: e.target.value })}
            className="h-8 text-sm"
          />
        </label>
        {kind === "if" ? (
          <>
            <label className="block space-y-1 sm:col-span-3">
              <span className="text-xs text-muted-foreground">
                {t("Inserisci questo testo")}
              </span>
              <Textarea
                value={then}
                onChange={(e) => setThen(e.target.value)}
                rows={2}
              />
            </label>
            <label className="block space-y-1 sm:col-span-3">
              <span className="text-xs text-muted-foreground">
                {t("Altrimenti questo testo")}
              </span>
              <Textarea
                value={otherwise}
                onChange={(e) => setOtherwise(e.target.value)}
                rows={2}
              />
            </label>
          </>
        ) : merge?.skip?.length ? (
          <div className="space-y-1 sm:col-span-3">
            <span className="text-xs text-muted-foreground">
              {t("Regole attive")}
            </span>
            {merge.skip.map((r, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border border-border px-2 py-1"
              >
                <span className="flex-1">
                  {t("Salta se «{field}» {condition} {value}", {
                    field: r.field,
                    condition:
                      RULE_OPS.find(
                        (o) => o.value === r.op
                      )?.label.toLocaleLowerCase() ?? "",
                    value: r.value,
                  })}
                </span>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  className="h-7 text-xs"
                  onClick={() =>
                    setMerge({
                      ...merge,
                      skip: merge.skip!.filter((_, j) => j !== i),
                    })
                  }
                >
                  {t("Togli")}
                </Button>
              </div>
            ))}
          </div>
        ) : null}
        {!fields.length ? (
          <p className="text-xs text-destructive sm:col-span-3">
            {t("Prima scegli i destinatari.")}
          </p>
        ) : null}
      </div>
      <Footer onClose={onClose}>
        <Button
          type="button"
          disabled={!fields.length || !rule.field}
          onClick={() => {
            if (kind === "skip" && merge) {
              setMerge({
                ...merge,
                skip: [...(merge.skip ?? []), rule],
                preview: -1,
              })
              toast.success(
                t("{count} destinatari dopo la regola", {
                  count: mergedRows({
                    ...merge,
                    skip: [...(merge.skip ?? []), rule],
                  }).length,
                })
              )
            } else {
              editor
                .chain()
                .focus()
                .insertMergeRule({ ...rule, then, otherwise })
                .run()
            }
            onClose()
          }}
        >
          OK
        </Button>
      </Footer>
    </div>
  )
}

/* ---------------------------- buste ed etichette ------------------------- */

export type EnvelopeRequest = {
  format: "dl" | "c5" | "c6"
  recipient: string
  sender: string
}

export function EnvelopeDialog({
  open,
  onClose,
  initialRecipient,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  initialRecipient: string
  onCreate: (request: EnvelopeRequest) => void
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Buste")}
      description={t("Crea un documento con la busta pronta da stampare.")}
    >
      <EnvelopeForm
        initialRecipient={initialRecipient}
        onClose={onClose}
        onCreate={onCreate}
      />
    </Shell>
  )
}

function EnvelopeForm({
  initialRecipient,
  onClose,
  onCreate,
}: {
  initialRecipient: string
  onClose: () => void
  onCreate: (request: EnvelopeRequest) => void
}) {
  const t = useT()
  const author = useAuthor()
  const [request, setRequest] = React.useState<EnvelopeRequest>({
    format: "dl",
    recipient: initialRecipient,
    sender: author,
  })
  return (
    <div>
      <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
        <label className="block space-y-1 sm:col-span-2">
          <span className="text-xs text-muted-foreground">
            {t("Indirizzo destinatario")}
          </span>
          <Textarea
            value={request.recipient}
            onChange={(e) =>
              setRequest({ ...request, recipient: e.target.value })
            }
            rows={4}
            placeholder={t("Mario Rossi\nVia Roma 1\n00100 Roma (RM)")}
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">
            {t("Indirizzo mittente")}
          </span>
          <Textarea
            value={request.sender}
            onChange={(e) => setRequest({ ...request, sender: e.target.value })}
            rows={3}
          />
        </label>
        <div className="space-y-1">
          <span className="text-xs text-muted-foreground">{t("Formato")}</span>
          {ENVELOPES.map((env) => (
            <label key={env.format} className="flex items-start gap-2 py-0.5">
              <input
                type="radio"
                checked={request.format === env.format}
                onChange={() => setRequest({ ...request, format: env.format })}
                className="mt-1"
              />
              <span>
                {env.label}
                <span className="block text-[11px] text-muted-foreground">
                  {env.hint}
                </span>
              </span>
            </label>
          ))}
        </div>
      </div>
      <Footer onClose={onClose}>
        <Button
          type="button"
          disabled={!request.recipient.trim()}
          onClick={() => {
            onCreate(request)
            onClose()
          }}
        >
          {t("Crea busta")}
        </Button>
      </Footer>
    </div>
  )
}

export type LabelsRequest = {
  product: LabelProduct
  text: string
  /** un'etichetta per destinatario invece che la stessa ripetuta */
  fromRecipients: boolean
}

export function LabelsDialog({
  open,
  onClose,
  merge,
  onCreate,
}: {
  open: boolean
  onClose: () => void
  merge: MergeData | undefined
  onCreate: (request: LabelsRequest) => void
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Etichette")}
      description={t(
        "Un foglio A4 di etichette, con la stessa etichetta o una per destinatario."
      )}
    >
      <LabelsForm merge={merge} onClose={onClose} onCreate={onCreate} />
    </Shell>
  )
}

function LabelsForm({
  merge,
  onClose,
  onCreate,
}: {
  merge: MergeData | undefined
  onClose: () => void
  onCreate: (request: LabelsRequest) => void
}) {
  const t = useT()
  const recipients = merge ? mergedRows(merge).length : 0
  const [request, setRequest] = React.useState<LabelsRequest>({
    product: LABEL_PRODUCTS[0],
    text: merge?.rows[0] ? addressText(merge.rows[0]) : "",
    fromRecipients: recipients > 0,
  })
  const p = request.product
  return (
    <div>
      <div className="grid gap-3 px-5 py-4 text-sm sm:grid-cols-2">
        <div className="space-y-2 sm:col-span-2">
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={request.fromRecipients}
              disabled={!recipients}
              onChange={() => setRequest({ ...request, fromRecipients: true })}
            />
            {t("Un'etichetta per ogni destinatario ({count})", {
              count: recipients,
            })}
          </label>
          <label className="flex items-center gap-2">
            <input
              type="radio"
              checked={!request.fromRecipients}
              onChange={() => setRequest({ ...request, fromRecipients: false })}
            />
            {t("Pagina intera della stessa etichetta")}
          </label>
        </div>
        {!request.fromRecipients ? (
          <label className="block space-y-1 sm:col-span-2">
            <span className="text-xs text-muted-foreground">
              {t("Testo dell'etichetta")}
            </span>
            <Textarea
              value={request.text}
              onChange={(e) => setRequest({ ...request, text: e.target.value })}
              rows={4}
            />
          </label>
        ) : null}
        <label className="block space-y-1">
          <span className="text-xs text-muted-foreground">{t("Prodotto")}</span>
          <select
            value={p.id}
            onChange={(e) =>
              setRequest({
                ...request,
                product:
                  LABEL_PRODUCTS.find((x) => x.id === e.target.value) ??
                  LABEL_PRODUCTS[0],
              })
            }
            className={selectClass}
          >
            {LABEL_PRODUCTS.map((x) => (
              <option key={x.id} value={x.id}>
                {x.label}
              </option>
            ))}
          </select>
        </label>
        <div className="flex items-center gap-3">
          <div
            aria-hidden
            className="grid aspect-[210/297] w-14 shrink-0 gap-[2px] rounded-sm border border-border bg-white p-[3px]"
            style={{ gridTemplateColumns: `repeat(${p.cols}, 1fr)` }}
          >
            {Array.from({ length: p.cols * p.rows }).map((_, i) => (
              <span key={i} className="rounded-[1px] bg-zinc-200" />
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {p.cols} × {p.rows} · {String(p.w).replace(".", ",")} ×{" "}
            {String(p.h).replace(".", ",")} mm
          </p>
        </div>
      </div>
      <Footer onClose={onClose}>
        <Button
          type="button"
          disabled={request.fromRecipients ? !recipients : !request.text.trim()}
          onClick={() => {
            onCreate(request)
            onClose()
          }}
        >
          {t("Nuovo documento")}
        </Button>
      </Footer>
    </div>
  )
}

/* ---------------------------------- email -------------------------------- */

export function EmailDialog({
  open,
  onClose,
  merge,
  messageFor,
}: {
  open: boolean
  onClose: () => void
  merge: MergeData | undefined
  /** il testo del documento unito con i dati di un destinatario */
  messageFor: (row: Record<string, string>) => string
}) {
  const t = useT()
  return (
    <Shell
      open={open}
      onClose={onClose}
      title={t("Invia messaggi email")}
      description={t(
        "Ogni messaggio si apre nel tuo programma di posta, già compilato: controllalo e invialo da lì."
      )}
      width={560}
    >
      <EmailForm merge={merge} messageFor={messageFor} onClose={onClose} />
    </Shell>
  )
}

function EmailForm({
  merge,
  messageFor,
  onClose,
}: {
  merge: MergeData | undefined
  messageFor: (row: Record<string, string>) => string
  onClose: () => void
}) {
  const t = useT()
  const fields = merge?.fields ?? []
  const [to, setTo] = React.useState(
    fields.find((f) => /mail/i.test(f)) ?? fields[0] ?? ""
  )
  const [subject, setSubject] = React.useState("")
  const rows = merge ? mergedRows(merge) : []
  return (
    <div>
      <div className="space-y-3 px-5 py-4 text-sm">
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">{t("A")}</span>
            <select
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className={selectClass}
            >
              {fields.map((f) => (
                <option key={f}>{f}</option>
              ))}
            </select>
          </label>
          <label className="block space-y-1">
            <span className="text-xs text-muted-foreground">
              {t("Oggetto")}
            </span>
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-8 text-sm"
            />
          </label>
        </div>
        <div className="max-h-72 overflow-y-auto rounded-md border border-border">
          {rows.length ? (
            rows.map(({ row, index }) => {
              const address = (row[to] ?? "").trim()
              const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address)
              return (
                <div
                  key={index}
                  className="flex items-center gap-2 border-b border-border px-2.5 py-1.5 last:border-b-0"
                >
                  <span className="min-w-0 flex-1 truncate">
                    {[row.Nome, row.Cognome].filter(Boolean).join(" ") ||
                      t("Destinatario {number}", { number: index + 1 })}
                    <span className="ml-2 text-xs text-muted-foreground">
                      {address || t("senza indirizzo")}
                    </span>
                  </span>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    disabled={!valid}
                    onClick={() => {
                      const body = messageFor(row).slice(0, 1800)
                      window.location.href = `mailto:${encodeURIComponent(address)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`
                    }}
                  >
                    {t("Apri messaggio")}
                  </Button>
                </div>
              )
            })
          ) : (
            <p className="px-2.5 py-3 text-xs text-muted-foreground">
              {t("Nessun destinatario incluso.")}
            </p>
          )}
        </div>
      </div>
      <DialogFooter className="border-t border-border px-5 py-3">
        <Button type="button" onClick={onClose}>
          {t("Chiudi")}
        </Button>
      </DialogFooter>
    </div>
  )
}
