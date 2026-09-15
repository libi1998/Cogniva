"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { LoaderCircle, X } from "lucide-react"
import { addinInfo, type AddinId } from "@/lib/addins"
import { docAccent } from "@/lib/palette"
import type { DocTheme } from "@/lib/types"
import { cn } from "@/lib/utils"
import { ADDIN_ICONS, ADDIN_TINTS } from "./addins/addin-icons"
import { createAddinApi, type AddinApi } from "./addins/api"
import type { TaskPane } from "./ribbon/shared"
import { ThesaurusPane } from "./thesaurus-pane"

// ogni componente aggiuntivo si scarica solo quando si apre
const PANES: Record<
  AddinId,
  React.LazyExoticComponent<(props: { api: AddinApi }) => React.ReactNode>
> = {
  qr: React.lazy(() =>
    import("./addins/qr-addin").then((m) => ({ default: m.QrAddin }))
  ),
  readability: React.lazy(() =>
    import("./addins/readability-addin").then((m) => ({
      default: m.ReadabilityAddin,
    }))
  ),
  placeholder: React.lazy(() =>
    import("./addins/placeholder-addin").then((m) => ({
      default: m.PlaceholderAddin,
    }))
  ),
  signature: React.lazy(() =>
    import("./addins/signature-addin").then((m) => ({
      default: m.SignatureAddin,
    }))
  ),
  wikipedia: React.lazy(() =>
    import("./addins/wikipedia-addin").then((m) => ({
      default: m.WikipediaAddin,
    }))
  ),
  openverse: React.lazy(() =>
    import("./addins/openverse-addin").then((m) => ({
      default: m.OpenverseAddin,
    }))
  ),
}

/** Il contenuto del riquadro attività: Thesaurus o un componente aggiuntivo */
export function TaskPaneHost({
  pane,
  editor,
  theme,
  onClose,
}: {
  pane: TaskPane
  editor: Editor
  theme: DocTheme | null | undefined
  onClose: () => void
}) {
  const language = theme?.language || "it-IT"
  if (pane.kind === "thesaurus") {
    return (
      <ThesaurusPane
        editor={editor}
        language={language}
        initialWord={pane.word}
        onClose={onClose}
      />
    )
  }
  const info = addinInfo(pane.id)
  if (!info) return null
  const Pane = PANES[info.id]
  const api = createAddinApi(
    editor,
    language,
    docAccent(theme?.accent ?? "blue").solid
  )
  return (
    <div className="flex h-full w-full flex-col" aria-label={info.name}>
      <div className="flex h-9 shrink-0 items-center justify-between border-b border-border pr-1 pl-3">
        <span className="flex min-w-0 items-center gap-2 text-[11px] font-semibold text-muted-foreground">
          <span
            className={cn(
              "flex size-5 items-center justify-center rounded",
              ADDIN_TINTS[info.id]
            )}
          >
            {ADDIN_ICONS[info.id]("size-3")}
          </span>
          <span className="truncate">{info.name}</span>
        </span>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Chiudi ${info.name}`}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <X className="size-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        <React.Suspense
          fallback={
            <LoaderCircle className="mx-auto mt-8 size-5 animate-spin text-muted-foreground" />
          }
        >
          <Pane api={api} />
        </React.Suspense>
      </div>
    </div>
  )
}
