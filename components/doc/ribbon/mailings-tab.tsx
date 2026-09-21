"use client"

import * as React from "react"
import type { Route } from "next"
import { useRouter } from "next/navigation"
import { nanoid } from "nanoid"
import type { JSONContent } from "@tiptap/core"
import {
  AlertCircle,
  AtSign,
  BookUser,
  ChevronFirst,
  ChevronLast,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileStack,
  Highlighter,
  ListChecks,
  Mail,
  MailPlus,
  MessageSquareText,
  Printer,
  Search,
  Split,
  Tags,
  UserRoundPen,
  Users,
  FileInput,
  MailCheck,
} from "lucide-react"
import { toast } from "sonner"
import {
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import { Input } from "@/components/ui/input"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { newDocTheme } from "@/lib/doc-design"
import {
  addressText,
  emptyMerge,
  fillContent,
  LABEL_PRODUCTS,
  labelsContent,
  labelsMargins,
  mergedDocument,
  mergedRows,
  usedFields,
} from "@/lib/doc-merge"
import { fileHref } from "@/lib/import-files"
import { getWorkspace } from "@/lib/store"
import type { DocTheme, MergeData, WFile } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  AddressBlockDialog,
  EmailDialog,
  EnvelopeDialog,
  GreetingDialog,
  LabelsDialog,
  RecipientsDialog,
  RuleDialog,
  type EnvelopeRequest,
  type LabelsRequest,
  type RuleKind,
} from "../mailings-dialogs"
import { RibbonButton, RibbonGroup, RibbonMenu, RibbonRows } from "./ribbon-ui"
import type { RibbonCtx } from "./shared"

import { useT, tr } from "@/lib/i18n/client"
type MailDialog =
  | "recipients"
  | "address"
  | "greeting"
  | "rule-if"
  | "rule-skip"
  | "envelope"
  | "labels"
  | "email"
  | null

const MM = 96 / 25.4

const MERGE_TYPES: { value: MergeData["type"]; label: string; hint: string }[] =
  [
    {
      value: "letters",
      get label() {
        return tr("Lettere")
      },
      get hint() {
        return tr("Una lettera per destinatario")
      },
    },
    {
      value: "envelopes",
      get label() {
        return tr("Buste")
      },
      get hint() {
        return tr("Una busta per destinatario")
      },
    },
    {
      value: "labels",
      get label() {
        return tr("Etichette")
      },
      get hint() {
        return tr("Fogli di etichette con gli indirizzi")
      },
    },
    {
      value: "normal",
      get label() {
        return tr("Documento normale di Word")
      },
      get hint() {
        return tr("Togli la stampa unione")
      },
    },
  ]

/** Il testo semplice di un contenuto, per i messaggi email */
function plainText(node: JSONContent): string {
  if (node.type === "text") return node.text ?? ""
  if (node.type === "hardBreak") return "\n"
  const inner = (node.content ?? []).map(plainText).join("")
  const block = ["paragraph", "heading", "docTitle", "listItem", "taskItem"]
  return block.includes(node.type ?? "") ? `${inner}\n` : inner
}

/** Un documento nuovo con contenuto e tema, già salvato nell'area di lavoro */
function createDoc(
  title: string,
  content: JSONContent,
  theme: Partial<DocTheme>
) {
  const now = Date.now()
  const file: WFile = {
    id: nanoid(10),
    kind: "doc",
    title,
    icon: "file-text",
    createdAt: now,
    updatedAt: now,
    data: { content, theme: { ...newDocTheme(), ...theme } },
  }
  return getWorkspace().addFile(file)
}

/**
 * «Corrispondenza», come in Word: buste, etichette e stampa unione con
 * anteprima dei risultati e documento finale.
 */
export function MailingsTab({ ctx }: { ctx: RibbonCtx }) {
  const t = useT()
  const { editor, theme, merge } = ctx
  const router = useRouter()
  const [dialog, setDialog] = React.useState<MailDialog>(null)
  const [search, setSearch] = React.useState("")
  const close = () => setDialog(null)
  const included = merge ? mergedRows(merge) : []
  const hasRecipients = included.length > 0
  const previewing = Boolean(merge && merge.preview >= 0)
  const position = merge
    ? included.findIndex((r) => r.index === merge.preview)
    : -1

  const setMerge = (next: MergeData) => ctx.setMerge(next)
  const ensureMerge = () => merge ?? emptyMerge()
  const open = (id: string) =>
    router.push(fileHref({ kind: "doc", id }) as Route)

  const goTo = (i: number) => {
    if (!merge || !included.length) return
    const clamped = Math.max(0, Math.min(included.length - 1, i))
    setMerge({ ...merge, preview: included[clamped].index })
  }

  const finalize = (action: "edit" | "print") => {
    if (!merge || !hasRecipients) {
      toast.info(t("Scegli prima i destinatari"))
      return
    }
    const title = t("{title} — unione", { title: ctx.title || "Documento" })
    let id: string
    if (merge.type === "labels") {
      id = createDoc(
        title,
        {
          type: "doc",
          content: [
            labelsContent(
              included.map(({ row }) => addressText(row)),
              LABEL_PRODUCTS[0]
            ),
            { type: "paragraph" },
          ],
        },
        { format: "a4", margins: labelsMargins(LABEL_PRODUCTS[0]) }
      )
    } else {
      id = createDoc(title, mergedDocument(editor.getJSON(), merge), {
        ...theme,
        styles: theme.styles,
      })
    }
    toast.success(
      action === "print"
        ? t("Documento unito con {count} destinatari: premi ⌘P per stamparlo", {
            count: included.length,
          })
        : t("Documento unito con {count} destinatari", {
            count: included.length,
          })
    )
    open(id)
  }

  const createEnvelope = (request: EnvelopeRequest) => {
    const recipients =
      merge?.type === "envelopes" && hasRecipients
        ? included.map(({ row }) => addressText(row))
        : [request.recipient]
    const content: JSONContent[] = []
    recipients.forEach((address, i) => {
      if (i) content.push({ type: "pageBreak" })
      content.push(
        ...request.sender
          .split("\n")
          .filter((l) => l.trim())
          .map((line) => ({
            type: "paragraph",
            attrs: { spaceAfter: "0px" },
            content: [
              {
                type: "text",
                text: line,
                marks: [{ type: "textStyle", attrs: { fontSize: "9pt" } }],
              },
            ],
          })),
        {
          type: "paragraph",
          attrs: { spaceBefore: `${Math.round(22 * MM)}px` },
        },
        ...address
          .split("\n")
          .filter((l) => l.trim())
          .map((line) => ({
            type: "paragraph",
            attrs: { spaceAfter: "0px", indent: Math.round(95 * MM) },
            content: [{ type: "text", text: line }],
          }))
      )
    })
    const id = createDoc(
      recipients.length > 1
        ? t("Buste — {title}", { title: ctx.title })
        : t("Busta"),
      { type: "doc", content },
      {
        format: request.format,
        orientation: "landscape",
        margins: {
          top: 12 * MM,
          bottom: 10 * MM,
          left: 14 * MM,
          right: 14 * MM,
        },
      }
    )
    toast.success(t("Busta creata"))
    open(id)
  }

  const createLabels = (request: LabelsRequest) => {
    const texts = request.fromRecipients
      ? included.map(({ row }) => addressText(row))
      : Array.from(
          { length: request.product.cols * request.product.rows },
          () => request.text
        )
    const id = createDoc(
      t("Etichette"),
      {
        type: "doc",
        content: [labelsContent(texts, request.product), { type: "paragraph" }],
      },
      {
        format: "a4",
        orientation: "portrait",
        margins: labelsMargins(request.product),
      }
    )
    toast.success(t("Foglio di etichette creato"))
    open(id)
  }

  const checkErrors = () => {
    if (!merge) {
      toast.info(t("Nessuna stampa unione in corso"))
      return
    }
    const used = usedFields(editor.getJSON())
    const missing = used.filter((f) => !merge.fields.includes(f))
    const empty = used
      .filter((f) => merge.fields.includes(f))
      .map(
        (f) =>
          [
            f,
            included.filter(({ row }) => !(row[f] ?? "").trim()).length,
          ] as const
      )
      .filter(([, n]) => n > 0)
    if (!used.length) toast.info(t("Il documento non contiene campi unione"))
    else if (!missing.length && !empty.length)
      toast.success(
        t("Nessun errore: {count} documenti pronti", { count: included.length })
      )
    else
      toast.warning(
        [
          missing.length
            ? t("Campi non presenti nell'elenco: {fields}", {
                fields: missing.join(", "),
              })
            : "",
          ...empty.map(([f, n]) =>
            t("«{field}» vuoto per {count} destinatari", { field: f, count: n })
          ),
        ]
          .filter(Boolean)
          .join(" · "),
        { duration: 8000 }
      )
  }

  return (
    <>
      <RibbonGroup label={t("Crea")} icon={<Mail className="size-5" />}>
        <RibbonButton
          large
          label={t("Buste")}
          icon={<Mail className="size-5" />}
          onClick={() => setDialog("envelope")}
        />
        <RibbonButton
          large
          label={t("Etichette")}
          icon={<Tags className="size-5" />}
          onClick={() => setDialog("labels")}
        />
      </RibbonGroup>

      <RibbonGroup
        label={t("Inizia stampa unione")}
        icon={<MailPlus className="size-5" />}
        safe
      >
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Inizia stampa unione")}
              active={Boolean(merge && merge.type !== "normal")}
              icon={<MailPlus className="size-5" />}
            />
          }
        >
          {MERGE_TYPES.map((t) => (
            <DropdownMenuItem
              key={t.value}
              onClick={() =>
                t.value === "normal"
                  ? ctx.setMerge(undefined)
                  : setMerge({ ...ensureMerge(), type: t.value })
              }
              className={cn(merge?.type === t.value && "bg-accent")}
            >
              <div className="flex flex-col">
                <span>{t.label}</span>
                <span className="text-[11px] text-muted-foreground">
                  {t.hint}
                </span>
              </div>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setDialog("email")}>
            <AtSign /> {t("Messaggi email")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Seleziona destinatari")}
              icon={<Users className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={() => setDialog("recipients")}>
            {t("Digita nuovo elenco…")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("recipients")}>
            {t("Usa elenco esistente (CSV)…")}
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonButton
          large
          label={t("Modifica elenco destinatari")}
          disabled={!merge?.rows.length}
          icon={<UserRoundPen className="size-5" />}
          onClick={() => setDialog("recipients")}
        />
      </RibbonGroup>

      <RibbonGroup
        label={t("Composizione e inserimento campi")}
        icon={<FileInput className="size-5" />}
      >
        <RibbonButton
          large
          data-safe=""
          label={t("Evidenzia campi unione")}
          disabled={!merge}
          active={Boolean(merge?.highlight)}
          icon={<Highlighter className="size-5" />}
          onClick={() =>
            merge && setMerge({ ...merge, highlight: !merge.highlight })
          }
        />
        <RibbonButton
          large
          label={t("Blocco indirizzo")}
          disabled={!merge}
          icon={<BookUser className="size-5" />}
          onClick={() => setDialog("address")}
        />
        <RibbonButton
          large
          label={t("Riga saluto")}
          disabled={!merge}
          icon={<MessageSquareText className="size-5" />}
          onClick={() => setDialog("greeting")}
        />
        <RibbonRows>
          <RibbonMenu
            className="max-h-[60dvh] w-52 overflow-y-auto"
            trigger={
              <RibbonButton
                compact
                chevron
                label={t("Inserisci campo unione")}
                disabled={!merge}
                icon={<ListChecks className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>{t("Campi")}</DropdownMenuLabel>
            {(merge?.fields ?? []).map((field) => (
              <DropdownMenuItem
                key={field}
                onClick={() =>
                  editor.chain().focus().insertMergeField(field).run()
                }
              >
                «{field}»
              </DropdownMenuItem>
            ))}
          </RibbonMenu>
          <RibbonMenu
            className="w-56"
            trigger={
              <RibbonButton
                compact
                chevron
                label={t("Regole")}
                disabled={!merge}
                icon={<Split className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem onClick={() => setDialog("rule-if")}>
              {t("Se… Allora… Altrimenti…")}
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("rule-skip")}>
              {t("Salta record se…")}
            </DropdownMenuItem>
          </RibbonMenu>
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup
        label={t("Anteprima risultati")}
        icon={<Eye className="size-5" />}
        safe
      >
        <RibbonButton
          large
          label={t("Anteprima risultati")}
          disabled={!hasRecipients}
          active={previewing}
          icon={<Eye className="size-5" />}
          onClick={() =>
            merge &&
            setMerge({ ...merge, preview: previewing ? -1 : included[0].index })
          }
        />
        <RibbonRows>
          <div className="flex items-center gap-0.5">
            <RibbonButton
              title={t("Primo record")}
              disabled={!previewing || position <= 0}
              icon={<ChevronFirst className="size-4" />}
              onClick={() => goTo(0)}
            />
            <RibbonButton
              title={t("Record precedente")}
              disabled={!previewing || position <= 0}
              icon={<ChevronLeft className="size-4" />}
              onClick={() => goTo(position - 1)}
            />
            <span className="w-14 text-center text-xs tabular-nums">
              {previewing ? `${position + 1} / ${included.length}` : "—"}
            </span>
            <RibbonButton
              title={t("Record successivo")}
              disabled={!previewing || position >= included.length - 1}
              icon={<ChevronRight className="size-4" />}
              onClick={() => goTo(position + 1)}
            />
            <RibbonButton
              title={t("Ultimo record")}
              disabled={!previewing || position >= included.length - 1}
              icon={<ChevronLast className="size-4" />}
              onClick={() => goTo(included.length - 1)}
            />
          </div>
          <Popover>
            <PopoverTrigger
              render={
                <RibbonButton
                  compact
                  label={t("Trova destinatario")}
                  disabled={!hasRecipients}
                  icon={<Search className="size-4" />}
                  className="justify-start"
                />
              }
            />
            <PopoverContent
              align="start"
              className="w-64 space-y-2 p-3"
              finalFocus={false}
            >
              <Input
                autoFocus
                value={search}
                placeholder={t("Nome, città, email…")}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key !== "Enter" || !merge) return
                  const q = search.trim().toLocaleLowerCase("it")
                  const start = Math.max(0, position + 1)
                  const order = [
                    ...included.slice(start),
                    ...included.slice(0, start),
                  ]
                  const hit = order.find(({ row }) =>
                    Object.values(row).some((v) =>
                      v.toLocaleLowerCase("it").includes(q)
                    )
                  )
                  if (hit) setMerge({ ...merge, preview: hit.index })
                  else toast.info(t("Nessun destinatario trovato"))
                }}
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {t("Invio per il prossimo risultato")}
              </p>
            </PopoverContent>
          </Popover>
          <RibbonButton
            compact
            label={t("Controlla errori")}
            disabled={!merge}
            icon={<AlertCircle className="size-4" />}
            className="justify-start"
            onClick={checkErrors}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup
        label={t("Completa")}
        icon={<MailCheck className="size-5" />}
      >
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label={t("Finalizza e unisci")}
              disabled={!hasRecipients}
              icon={<FileStack className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={() => finalize("edit")}>
            <FileStack /> {t("Modifica singoli documenti…")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => finalize("print")}>
            <Printer /> {t("Stampa documenti…")}
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("email")}>
            <AtSign /> {t("Invia messaggi email…")}
          </DropdownMenuItem>
        </RibbonMenu>
      </RibbonGroup>

      <RecipientsDialog
        open={dialog === "recipients"}
        onClose={close}
        merge={merge}
        setMerge={(next) =>
          setMerge(next.type === "normal" ? { ...next, type: "letters" } : next)
        }
      />
      <AddressBlockDialog
        open={dialog === "address"}
        onClose={close}
        editor={editor}
        merge={merge}
      />
      <GreetingDialog
        open={dialog === "greeting"}
        onClose={close}
        editor={editor}
        merge={merge}
      />
      <RuleDialog
        open={dialog === "rule-if" || dialog === "rule-skip"}
        onClose={close}
        kind={(dialog === "rule-skip" ? "skip" : "if") as RuleKind}
        editor={editor}
        merge={merge}
        setMerge={setMerge}
      />
      <EnvelopeDialog
        open={dialog === "envelope"}
        onClose={close}
        initialRecipient={
          merge?.rows[0]
            ? addressText(
                merge.rows[merge.preview >= 0 ? merge.preview : 0] ??
                  merge.rows[0]
              )
            : ""
        }
        onCreate={createEnvelope}
      />
      <LabelsDialog
        open={dialog === "labels"}
        onClose={close}
        merge={merge}
        onCreate={createLabels}
      />
      <EmailDialog
        open={dialog === "email"}
        onClose={close}
        merge={merge}
        messageFor={(row) =>
          plainText({
            type: "doc",
            content: (editor.getJSON().content ?? []).flatMap((n) =>
              fillContent(n, row)
            ),
          }).trim()
        }
      />
    </>
  )
}
