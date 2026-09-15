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
      label: "Lettere",
      hint: "Una lettera per destinatario",
    },
    { value: "envelopes", label: "Buste", hint: "Una busta per destinatario" },
    {
      value: "labels",
      label: "Etichette",
      hint: "Fogli di etichette con gli indirizzi",
    },
    {
      value: "normal",
      label: "Documento normale di Word",
      hint: "Togli la stampa unione",
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
      toast.info("Scegli prima i destinatari")
      return
    }
    const title = `${ctx.title || "Documento"} — unione`
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
        ? `Documento unito con ${included.length} destinatari: premi ⌘P per stamparlo`
        : `Documento unito con ${included.length} destinatari`
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
      recipients.length > 1 ? `Buste — ${ctx.title}` : "Busta",
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
    toast.success("Busta creata")
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
      "Etichette",
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
    toast.success("Foglio di etichette creato")
    open(id)
  }

  const checkErrors = () => {
    if (!merge) {
      toast.info("Nessuna stampa unione in corso")
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
    if (!used.length) toast.info("Il documento non contiene campi unione")
    else if (!missing.length && !empty.length)
      toast.success(`Nessun errore: ${included.length} documenti pronti`)
    else
      toast.warning(
        [
          missing.length
            ? `Campi non presenti nell'elenco: ${missing.join(", ")}`
            : "",
          ...empty.map(([f, n]) => `«${f}» vuoto per ${n} destinatari`),
        ]
          .filter(Boolean)
          .join(" · "),
        { duration: 8000 }
      )
  }

  return (
    <>
      <RibbonGroup label="Crea">
        <RibbonButton
          large
          label="Buste"
          icon={<Mail className="size-5" />}
          onClick={() => setDialog("envelope")}
        />
        <RibbonButton
          large
          label="Etichette"
          icon={<Tags className="size-5" />}
          onClick={() => setDialog("labels")}
        />
      </RibbonGroup>

      <RibbonGroup label="Inizia stampa unione" safe>
        <RibbonMenu
          className="w-64"
          trigger={
            <RibbonButton
              large
              chevron
              label="Inizia stampa unione"
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
            <AtSign /> Messaggi email
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Seleziona destinatari"
              icon={<Users className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={() => setDialog("recipients")}>
            Digita nuovo elenco…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("recipients")}>
            Usa elenco esistente (CSV)…
          </DropdownMenuItem>
        </RibbonMenu>
        <RibbonButton
          large
          label="Modifica elenco destinatari"
          disabled={!merge?.rows.length}
          icon={<UserRoundPen className="size-5" />}
          onClick={() => setDialog("recipients")}
        />
      </RibbonGroup>

      <RibbonGroup label="Composizione e inserimento campi">
        <RibbonButton
          large
          data-safe=""
          label="Evidenzia campi unione"
          disabled={!merge}
          active={Boolean(merge?.highlight)}
          icon={<Highlighter className="size-5" />}
          onClick={() =>
            merge && setMerge({ ...merge, highlight: !merge.highlight })
          }
        />
        <RibbonButton
          large
          label="Blocco indirizzo"
          disabled={!merge}
          icon={<BookUser className="size-5" />}
          onClick={() => setDialog("address")}
        />
        <RibbonButton
          large
          label="Riga saluto"
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
                label="Inserisci campo unione"
                disabled={!merge}
                icon={<ListChecks className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuLabel>Campi</DropdownMenuLabel>
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
                label="Regole"
                disabled={!merge}
                icon={<Split className="size-4" />}
                className="justify-start"
              />
            }
          >
            <DropdownMenuItem onClick={() => setDialog("rule-if")}>
              Se… Allora… Altrimenti…
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setDialog("rule-skip")}>
              Salta record se…
            </DropdownMenuItem>
          </RibbonMenu>
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Anteprima risultati" safe>
        <RibbonButton
          large
          label="Anteprima risultati"
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
              title="Primo record"
              disabled={!previewing || position <= 0}
              icon={<ChevronFirst className="size-4" />}
              onClick={() => goTo(0)}
            />
            <RibbonButton
              title="Record precedente"
              disabled={!previewing || position <= 0}
              icon={<ChevronLeft className="size-4" />}
              onClick={() => goTo(position - 1)}
            />
            <span className="w-14 text-center text-xs tabular-nums">
              {previewing ? `${position + 1} / ${included.length}` : "—"}
            </span>
            <RibbonButton
              title="Record successivo"
              disabled={!previewing || position >= included.length - 1}
              icon={<ChevronRight className="size-4" />}
              onClick={() => goTo(position + 1)}
            />
            <RibbonButton
              title="Ultimo record"
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
                  label="Trova destinatario"
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
                placeholder="Nome, città, email…"
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
                  else toast.info("Nessun destinatario trovato")
                }}
                className="h-8 text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                Invio per il prossimo risultato
              </p>
            </PopoverContent>
          </Popover>
          <RibbonButton
            compact
            label="Controlla errori"
            disabled={!merge}
            icon={<AlertCircle className="size-4" />}
            className="justify-start"
            onClick={checkErrors}
          />
        </RibbonRows>
      </RibbonGroup>

      <RibbonGroup label="Completa">
        <RibbonMenu
          className="w-60"
          trigger={
            <RibbonButton
              large
              chevron
              label="Finalizza e unisci"
              disabled={!hasRecipients}
              icon={<FileStack className="size-5" />}
            />
          }
        >
          <DropdownMenuItem onClick={() => finalize("edit")}>
            <FileStack /> Modifica singoli documenti…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => finalize("print")}>
            <Printer /> Stampa documenti…
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setDialog("email")}>
            <AtSign /> Invia messaggi email…
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
