"use client"

import * as React from "react"
import type { Editor } from "@tiptap/react"
import { useEditorState } from "@tiptap/react"
import {
  CaseSensitive,
  ChevronDown,
  ChevronUp,
  Replace,
  ReplaceAll,
  WholeWord,
  X,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"
import { getFindState } from "@/lib/find-replace"

import { useT } from "@/lib/i18n/client"
function Toggle({
  on,
  onClick,
  title,
  children,
}: {
  on: boolean
  onClick: () => void
  title: string
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      title={title}
      aria-pressed={on}
      onClick={onClick}
      className={cn(
        "flex size-7 items-center justify-center rounded-md transition-colors",
        on
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-muted hover:text-foreground"
      )}
    >
      {children}
    </button>
  )
}

/** Trova e sostituisci, come il riquadro di Word */
export function FindBar({
  editor,
  onClose,
  mode = "find",
}: {
  editor: Editor | null
  onClose: () => void
  /** «Sostituisci» apre il riquadro col cursore nel secondo campo */
  mode?: "find" | "replace"
}) {
  const t = useT()
  const [term, setTerm] = React.useState("")
  const [replacement, setReplacement] = React.useState("")
  const inputRef = React.useRef<HTMLInputElement>(null)
  const replaceRef = React.useRef<HTMLInputElement>(null)

  const find = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { total: 0, active: 0, caseSensitive: false, whole: false }
      const s = getFindState(e.state)
      return {
        total: s.matches.length,
        active: s.matches.length ? s.active + 1 : 0,
        caseSensitive: s.caseSensitive,
        whole: s.whole,
      }
    },
  }) ?? { total: 0, active: 0, caseSensitive: false, whole: false }

  // solo quando cambia il modo: mentre si scrive il fuoco resta dov'è. Il
  // testo cercato si legge con un Effect Event, senza farne una dipendenza
  const focusField = React.useEffectEvent(() => {
    const target =
      mode === "replace" && term ? replaceRef.current : inputRef.current
    target?.focus()
    target?.select()
  })
  React.useEffect(() => {
    focusField()
  }, [mode])

  // la ricerca parte da sola mentre si scrive, con una pausa per non
  // ricalcolare le corrispondenze a ogni tasto su documenti lunghi
  React.useEffect(() => {
    if (!editor) return
    const id = setTimeout(() => {
      if (!editor.isDestroyed) editor.commands.setSearch({ term })
    }, 150)
    return () => clearTimeout(id)
  }, [editor, term])

  React.useEffect(() => {
    return () => {
      if (editor && !editor.isDestroyed) editor.commands.clearSearch()
    }
  }, [editor])

  if (!editor) return null

  const close = () => {
    editor.commands.clearSearch()
    onClose()
  }

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault()
      close()
    }
    if (e.key === "Enter") {
      e.preventDefault()
      if (e.shiftKey) editor.commands.findPrevious()
      else editor.commands.findNext()
    }
  }

  return (
    <div
      onKeyDown={onKeyDown}
      className="flex flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1.5"
    >
      <div className="flex items-center gap-1">
        <Input
          ref={inputRef}
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={t("Trova")}
          className="h-8 w-44 text-xs"
        />
        <span className="w-16 shrink-0 text-center text-[11px] text-muted-foreground tabular-nums">
          {term
            ? t("{active} di {total}", {
                active: find.active,
                total: find.total,
              })
            : ""}
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title={t("Precedente ⇧↵")}
          disabled={!find.total}
          onClick={() => editor.commands.findPrevious()}
        >
          <ChevronUp className="size-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="size-7"
          title={t("Successiva ↵")}
          disabled={!find.total}
          onClick={() => editor.commands.findNext()}
        >
          <ChevronDown className="size-4" />
        </Button>
        <Toggle
          on={find.caseSensitive}
          title={t("Maiuscole/minuscole")}
          onClick={() =>
            editor.commands.setSearch({ caseSensitive: !find.caseSensitive })
          }
        >
          <CaseSensitive className="size-4" />
        </Toggle>
        <Toggle
          on={find.whole}
          title={t("Solo parole intere")}
          onClick={() => editor.commands.setSearch({ whole: !find.whole })}
        >
          <WholeWord className="size-4" />
        </Toggle>
      </div>

      <div className="flex items-center gap-1">
        <Input
          ref={replaceRef}
          value={replacement}
          onChange={(e) => setReplacement(e.target.value)}
          placeholder={t("Sostituisci con")}
          className="h-8 w-44 text-xs"
        />
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={!find.total}
          onClick={() => {
            editor.commands.replaceCurrent(replacement)
            editor.commands.setSearch({})
          }}
        >
          <Replace className="size-3.5" /> {t("Sostituisci")}
        </Button>
        <Button
          variant="outline"
          size="sm"
          className="h-7 gap-1 px-2 text-[11px]"
          disabled={!find.total}
          onClick={() => editor.commands.replaceAll(replacement)}
        >
          <ReplaceAll className="size-3.5" /> {t("Tutto")}
        </Button>
      </div>

      <Button
        variant="ghost"
        size="icon"
        className="ml-auto size-7"
        title={t("Chiudi ⎋")}
        onClick={close}
      >
        <X className="size-4" />
      </Button>
    </div>
  )
}
