"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { FileQuestion, Plus } from "lucide-react"
import { TopBarFrame } from "@/components/shared/top-bar"
import { Button, buttonVariants } from "@/components/ui/button"
import { getWorkspace } from "@/lib/store"
import { useDocumentTitle } from "@/lib/use-document-title"
import type { FileKind } from "@/lib/types"
import { cn } from "@/lib/utils"

/*
 * Gli stati di un file prima che sia pronto. Lo spazio di lavoro vive nel
 * browser: il server (e il prerender) disegnano questi scheletri, che hanno
 * le stesse misure delle schermate vere così al caricamento niente salta.
 */

export function TopBarSkeleton() {
  return (
    <TopBarFrame>
      <span className="ml-1 hidden size-5 skeleton rounded-md sm:block" />
      <span className="ml-1 h-4 w-40 max-w-[40vw] skeleton" />
      <span className="ml-auto flex shrink-0 items-center gap-1.5 pr-1">
        <span className="size-6 skeleton rounded-md" />
        <span className="size-6 skeleton rounded-md" />
        <span className="hidden h-6 w-16 skeleton rounded-md sm:block" />
      </span>
    </TopBarFrame>
  )
}

export function PanelSkeleton({ width }: { width: number }) {
  return (
    <aside
      aria-hidden
      className="hidden shrink-0 flex-col gap-3 border-l border-border bg-card p-4 min-[1180px]:flex"
      style={{ width }}
    >
      <span className="h-3 w-16 skeleton" />
      <span className="h-8 w-full skeleton rounded-lg" />
      <span className="h-3 w-24 skeleton" />
      <span className="h-2 w-full skeleton" />
      <span className="mt-2 grid grid-cols-6 gap-1.5">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} className="aspect-square skeleton rounded-md" />
        ))}
      </span>
    </aside>
  )
}

export function BoardSkeleton() {
  return (
    <div
      className="flex h-dvh flex-col bg-muted"
      aria-busy="true"
      aria-label="Carico la board"
    >
      <TopBarSkeleton />
      <div className="relative flex min-h-0 flex-1">
        <div
          className="relative min-w-0 flex-1"
          style={{
            backgroundColor: "var(--canvas-auto)",
            backgroundImage:
              "radial-gradient(circle at 1px 1px, color-mix(in oklch, var(--muted-foreground) 30%, transparent) 1px, transparent 0)",
            backgroundSize: "24px 24px",
          }}
        >
          <div className="absolute top-4 bottom-16 left-3 flex items-center sm:left-4">
            <div className="flex h-full max-h-[440px] w-12 flex-col items-center gap-2 rounded-2xl border border-black/5 bg-card/95 p-2 shadow-sm dark:border-white/10">
              {Array.from({ length: 7 }, (_, i) => (
                <span key={i} className="size-7 shrink-0 skeleton rounded-lg" />
              ))}
            </div>
          </div>
          <div className="absolute bottom-3 left-3 safe-bottom sm:bottom-4 sm:left-4">
            <div className="h-9 w-36 rounded-xl border border-black/5 bg-card/95 shadow-sm dark:border-white/10" />
          </div>
        </div>
        <PanelSkeleton width={272} />
      </div>
    </div>
  )
}

/** Un file che non c'è: link vecchio, file eliminato o di un altro browser */
export function FileMissing({ kind }: { kind: FileKind }) {
  const router = useRouter()
  useDocumentTitle("File non trovato · Cogniva")
  const create = () => {
    const id = getWorkspace().createFile(kind)
    router.replace(kind === "board" ? `/board/${id}` : `/doc/${id}`)
  }
  return (
    <main className="flex h-dvh flex-col items-center justify-center gap-4 bg-muted px-6 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-accent text-primary">
        <FileQuestion className="size-6" />
      </div>
      <div className="max-w-sm space-y-1.5">
        <h1 className="text-base font-semibold text-foreground">
          {kind === "board"
            ? "Questa board non c'è"
            : "Questo documento non c'è"}
        </h1>
        <p className="text-sm text-muted-foreground">
          Potrebbe essere stato eliminato per sempre, oppure è salvato in un
          altro browser: lo spazio di lavoro vive solo su questo dispositivo.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/" className={cn(buttonVariants({ size: "default" }))}>
          Torna ai file
        </Link>
        <Button variant="outline" onClick={create}>
          <Plus className="size-4" />
          {kind === "board" ? "Nuova board" : "Nuovo documento"}
        </Button>
      </div>
    </main>
  )
}
