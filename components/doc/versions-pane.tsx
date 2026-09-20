"use client"

import * as React from "react"
import { useRouter } from "next/navigation"
import type { Route } from "next"
import { nanoid } from "nanoid"
import type { Editor } from "@tiptap/react"
import type { JSONContent } from "@tiptap/core"
import {
  Check,
  FileDiff,
  History,
  LoaderCircle,
  Pencil,
  RotateCcw,
  Save,
  Trash2,
  X,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { getAuthor } from "@/lib/author"
import { newDocTheme } from "@/lib/doc-design"
import { fileHref } from "@/lib/import-files"
import { compareDocuments } from "@/lib/review-tools"
import { repairDocContent } from "./extensions"
import { getWorkspace } from "@/lib/store"
import type { WFile } from "@/lib/types"
import { cn } from "@/lib/utils"
import {
  countWords,
  deleteVersion,
  getVersion,
  listVersions,
  renameVersion,
  saveVersion,
  versionsAvailable,
  type VersionInfo,
} from "@/lib/versions"

import { useT, timeAgo, useRegion } from "@/lib/i18n/client"

/**
 * «Cronologia versioni» di Word, in locale. Il documento si fotografa da solo
 * ogni tanto mentre si lavora, e si può fotografare a mano dando un nome alla
 * versione. Da qui si ripristina una versione, la si confronta con quella di
 * adesso (in un documento nuovo, con le revisioni) o la si butta.
 */

/** Ogni quanto l'app fotografa il documento da sola */
const AUTO_EVERY = 5 * 60 * 1000

const docOf = (fileId: string): Extract<WFile, { kind: "doc" }> | null => {
  const file = getWorkspace().files.find((f) => f.id === fileId)
  return file && file.kind === "doc" ? file : null
}

function snapshot(fileId: string, kind: "auto" | "manual", label = "") {
  const file = docOf(fileId)
  if (!file) return Promise.resolve(null)
  return saveVersion({
    fileId,
    kind,
    label,
    author: getAuthor(),
    words: countWords(file.data.content),
    content: file.data.content,
  })
}

/** Il documento nuovo con le differenze: torna il suo id */
function addComparison(
  file: Extract<WFile, { kind: "doc" }>,
  content: JSONContent,
  title: string
) {
  const now = Date.now()
  return getWorkspace().addFile({
    id: nanoid(10),
    kind: "doc",
    title,
    icon: "file-text",
    createdAt: now,
    updatedAt: now,
    data: {
      content,
      theme: { ...newDocTheme(), ...file.data.theme, markup: "all" },
    },
  })
}

/**
 * Fotografa il documento ogni tanto, finché è aperto: solo se è cambiato da
 * quando è stata presa l'ultima versione.
 */
export function useAutoVersions(fileId: string) {
  React.useEffect(() => {
    if (!versionsAvailable()) return
    let stop = false
    let last = 0
    const tick = async () => {
      const file = docOf(fileId)
      if (stop || !file || file.updatedAt <= last) return
      // alla prima occasione si guarda cosa c'è già salvato
      if (!last) {
        const existing = await listVersions(fileId)
        if (stop) return
        const newest = existing[0]?.createdAt ?? 0
        if (newest && file.updatedAt <= newest) {
          last = newest
          return
        }
      }
      last = file.updatedAt
      try {
        await snapshot(fileId, "auto")
      } catch {
        // niente spazio o database chiuso: la cronologia può aspettare
      }
    }
    const timer = setInterval(() => void tick(), AUTO_EVERY)
    return () => {
      stop = true
      clearInterval(timer)
    }
  }, [fileId])
}

export function VersionsPane({
  fileId,
  editor,
  onClose,
}: {
  fileId: string
  editor: Editor
  onClose: () => void
}) {
  const t = useT()
  const region = useRegion()
  const router = useRouter()
  const [list, setList] = React.useState<VersionInfo[] | null>(null)
  const [busy, setBusy] = React.useState(false)
  const [renaming, setRenaming] = React.useState<string | null>(null)
  const [draft, setDraft] = React.useState("")
  const [confirm, setConfirm] = React.useState<string | null>(null)

  const refresh = React.useCallback(() => {
    listVersions(fileId)
      .then(setList)
      .catch(() => setList([]))
  }, [fileId])

  React.useEffect(refresh, [refresh])

  const saveNow = async () => {
    setBusy(true)
    try {
      await snapshot(fileId, "manual", t("Versione salvata a mano"))
      refresh()
      toast.success(t("Versione salvata"))
    } catch {
      toast.error(t("Non riesco a salvare la versione"))
    } finally {
      setBusy(false)
    }
  }

  /** Ripristina: prima si mette al sicuro quello che c'è adesso */
  const restore = async (id: string) => {
    setBusy(true)
    try {
      const version = await getVersion(id)
      if (!version) throw new Error("missing")
      await snapshot(fileId, "auto")
      // una versione può venire da una versione precedente dell'app: si ripara
      // come si fa all'apertura di un file, altrimenti un nodo sconosciuto
      // svuoterebbe il documento
      editor.commands.setContent(
        repairDocContent(version.content) as JSONContent,
        { emitUpdate: true }
      )
      getWorkspace().setDocContent(fileId, editor.getJSON())
      refresh()
      setConfirm(null)
      toast.success(t("Versione ripristinata"), {
        description: t("Quella di prima è finita nella cronologia."),
      })
    } catch {
      toast.error(t("Non riesco a ripristinare la versione"))
    } finally {
      setBusy(false)
    }
  }

  /** Confronta: un documento nuovo con le differenze come revisioni */
  const compare = async (versionId: string) => {
    setBusy(true)
    try {
      const version = await getVersion(versionId)
      const file = docOf(fileId)
      if (!version || !file) throw new Error("missing")
      const content = compareDocuments(
        version.content as JSONContent,
        editor.getJSON(),
        getAuthor()
      )
      const id = addComparison(
        file,
        content,
        t("{title} — versione del {date}", {
          title: file.title,
          date: new Date(version.createdAt).toLocaleString(region, {
            dateStyle: "short",
            timeStyle: "short",
          }),
        })
      )
      onClose()
      router.push(fileHref({ kind: "doc", id }) as Route)
    } catch {
      toast.error(t("Non riesco a confrontare le versioni"))
    } finally {
      setBusy(false)
    }
  }

  const rename = async (id: string) => {
    await renameVersion(id, draft.trim())
    setRenaming(null)
    refresh()
  }

  const remove = async (id: string) => {
    await deleteVersion(id)
    refresh()
  }

  return (
    <div
      className="flex h-full w-full flex-col"
      aria-label={t("Cronologia versioni")}
    >
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border pr-1 pl-4">
        <span className="flex items-center gap-1.5 text-[11px] font-semibold text-muted-foreground">
          <History className="size-3.5" /> {t("Cronologia versioni")}
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={t("Chiudi la cronologia")}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="shrink-0 border-b border-border p-2">
        <Button
          size="sm"
          variant="secondary"
          className="w-full"
          disabled={busy}
          onClick={() => void saveNow()}
        >
          <Save className="size-4" /> {t("Salva una versione")}
        </Button>
        <p className="mt-1.5 px-1 text-[11px] text-muted-foreground">
          {t(
            "Una versione si salva da sola ogni cinque minuti, se hai scritto qualcosa."
          )}
        </p>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {list === null ? (
          <LoaderCircle className="mx-auto mt-8 size-5 animate-spin text-muted-foreground" />
        ) : list.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-muted-foreground">
            {t("Ancora nessuna versione di questo documento.")}
          </p>
        ) : (
          <ul>
            {list.map((v) => (
              <li
                key={v.id}
                className="border-b border-border px-3 py-2 text-xs last:border-b-0"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">
                    {v.label || t("Salvataggio automatico")}
                  </span>
                  <span
                    className={cn(
                      "shrink-0 rounded px-1 text-[10px]",
                      v.kind === "manual"
                        ? "bg-primary/10 text-primary"
                        : "text-muted-foreground"
                    )}
                  >
                    {v.kind === "manual"
                      ? t("A mano||versione salvata da chi scrive")
                      : t("Automatica")}
                  </span>
                </div>
                <p className="mt-0.5 text-muted-foreground">
                  {timeAgo(v.createdAt)} ·{" "}
                  {new Date(v.createdAt).toLocaleTimeString(region, {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}{" "}
                  · {t("{count} parole", { count: v.words })}
                </p>
                <p className="text-muted-foreground">{v.author}</p>

                {renaming === v.id ? (
                  <form
                    className="mt-1.5 flex items-center gap-1"
                    onSubmit={(e) => {
                      e.preventDefault()
                      void rename(v.id)
                    }}
                  >
                    <Input
                      autoFocus
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      className="h-7 text-xs"
                      aria-label={t("Nome della versione")}
                    />
                    <Button type="submit" size="sm" className="h-7 px-2">
                      <Check className="size-3.5" />
                    </Button>
                  </form>
                ) : confirm === v.id ? (
                  <div className="mt-1.5 flex items-center gap-1.5">
                    <span className="text-muted-foreground">
                      {t("Sostituire il documento?")}
                    </span>
                    <Button
                      size="sm"
                      className="h-7 px-2"
                      disabled={busy}
                      onClick={() => void restore(v.id)}
                    >
                      {t("Ripristina||riporta il documento a una versione")}
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2"
                      onClick={() => setConfirm(null)}
                    >
                      {t("Annulla")}
                    </Button>
                  </div>
                ) : (
                  <div className="mt-1 flex items-center gap-0.5">
                    <Action
                      label={t("Ripristina questa versione")}
                      icon={<RotateCcw className="size-3.5" />}
                      onClick={() => setConfirm(v.id)}
                    />
                    <Action
                      label={t("Confronta con il documento di adesso")}
                      icon={<FileDiff className="size-3.5" />}
                      onClick={() => void compare(v.id)}
                    />
                    <Action
                      label={t("Dai un nome alla versione")}
                      icon={<Pencil className="size-3.5" />}
                      onClick={() => {
                        setDraft(v.label)
                        setRenaming(v.id)
                      }}
                    />
                    <Action
                      label={t("Elimina questa versione")}
                      icon={<Trash2 className="size-3.5" />}
                      onClick={() => void remove(v.id)}
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}

function Action({
  label,
  icon,
  onClick,
}: {
  label: string
  icon: React.ReactNode
  onClick: () => void
}) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      onClick={onClick}
      className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      {icon}
    </button>
  )
}
