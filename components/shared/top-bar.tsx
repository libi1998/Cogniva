"use client"

import type { Route } from "next"
import * as React from "react"
import Link from "next/link"
import { ArrowLeft, Search } from "lucide-react"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import { Glyph } from "@/components/board/glyph"
import { openCommandPalette } from "@/components/shared/command-palette"
import { Kbd } from "@/components/ui/kbd"
import { IconPanel } from "@/components/board/panels"
import { useDocumentTitle } from "@/lib/use-document-title"
import { useStore } from "@/lib/store"
import { cn } from "@/lib/utils"

import { useT, hrefFor } from "@/lib/i18n/client"
/**
 * La cornice della barra in alto, senza dati: la usano sia la barra vera sia
 * lo scheletro che si vede prima che lo spazio di lavoro sia caricato, così
 * al passaggio niente si sposta.
 */
export function TopBarFrame({
  children,
  className,
}: {
  children: React.ReactNode
  className?: string
}) {
  const t = useT()
  return (
    <header
      className={cn(
        "flex h-[calc(3.25rem+env(safe-area-inset-top))] shrink-0 items-center gap-1 border-b border-border bg-card pt-[env(safe-area-inset-top)] safe-x sm:gap-1.5",
        className
      )}
    >
      <Link
        href={hrefFor("/") as Route}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground"
        title={t("Tutti i file")}
        aria-label={t("Tutti i file")}
      >
        <ArrowLeft className="size-[18px]" />
      </Link>
      {children}
    </header>
  )
}

/** Il pulsante della palette: testo sugli schermi larghi, lente sugli altri */
export function CommandsButton() {
  const t = useT()
  return (
    <>
      <button
        type="button"
        onClick={openCommandPalette}
        title={t("Cerca comandi e file")}
        className="hidden h-8 items-center gap-2 rounded-lg border border-border px-2.5 text-xs text-muted-foreground transition hover:bg-muted hover:text-foreground lg:flex"
      >
        <Search className="size-3.5" />
        {t("Comandi")}
        <Kbd>⌘K</Kbd>
      </button>
      <button
        type="button"
        onClick={openCommandPalette}
        title={t("Cerca comandi e file")}
        aria-label={t("Cerca comandi e file")}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition hover:bg-muted hover:text-foreground lg:hidden"
      >
        <Search className="size-4" />
      </button>
    </>
  )
}

export function TopBar({
  fileId,
  right,
}: {
  fileId: string
  right?: React.ReactNode
}) {
  const t = useT()
  const file = useStore((s) => s.files.find((f) => f.id === fileId))
  const rename = useStore((s) => s.renameFile)
  const setIcon = useStore((s) => s.setIcon)
  const [open, setOpen] = React.useState(false)
  useDocumentTitle(`${file?.title.trim() || t("Senza titolo")} · Cogniva`)
  if (!file) return null

  return (
    <TopBarFrame>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger
          render={
            <button
              type="button"
              title={t("Cambia icona")}
              aria-label={t("Cambia icona")}
              className="hidden size-8 shrink-0 items-center justify-center rounded-lg text-foreground/80 transition hover:bg-muted hover:text-foreground sm:flex"
            />
          }
        >
          <Glyph name={file.icon} size={18} strokeWidth={1.9} />
        </PopoverTrigger>
        <PopoverContent align="start" className="w-auto p-0">
          <IconPanel
            onPick={(name) => {
              setIcon(fileId, name)
              setOpen(false)
            }}
          />
        </PopoverContent>
      </Popover>

      <input
        aria-label={t("Nome del file")}
        value={file.title}
        onChange={(e) => rename(fileId, e.target.value)}
        spellCheck={false}
        enterKeyHint="done"
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === "Escape") e.currentTarget.blur()
        }}
        className="w-0 max-w-[420px] min-w-16 flex-1 truncate rounded-lg px-2 py-1 text-sm font-semibold text-foreground transition outline-none hover:bg-muted focus:bg-muted"
      />

      <div className="ml-auto flex shrink-0 items-center gap-0.5 sm:gap-1">
        <CommandsButton />
        {right}
      </div>
    </TopBarFrame>
  )
}
