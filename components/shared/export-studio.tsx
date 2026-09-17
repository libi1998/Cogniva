"use client"

import * as React from "react"
import {
  Download,
  FileCode2,
  FileImage,
  FileText,
  FileType2,
  Loader2,
  PenTool,
  Printer,
  X,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog"
import { Switch } from "@/components/ui/switch"
import { download, safeName } from "@/lib/export"
import {
  exportPdf,
  exportPng,
  parsePageRange,
  renderPreview,
} from "@/lib/export-studio/export"
import { QUALITY, type ExportQuality } from "@/lib/export-studio/raster"
import {
  createBoardSession,
  createDocSession,
  type DocSnapshot,
  type ExportSession,
  type PaperChoice,
  type SessionLayout,
} from "@/lib/export-studio/session"
import { tr, useT } from "@/lib/i18n/client"
import { formatLabel } from "@/lib/page"
import type { BoardData, PageFormat } from "@/lib/types"
import { cn } from "@/lib/utils"

/**
 * La sezione Esporta: a sinistra l'anteprima delle pagine come usciranno, a
 * destra le impostazioni. PDF e PNG si costruiscono qui, pagina per pagina,
 * senza passare dalla stampa del browser; Word, Markdown e SVG usano i loro
 * convertitori.
 */

export type StudioFormat = "pdf" | "png" | "svg" | "docx" | "md"

export type ExportStudioSource =
  | {
      kind: "doc"
      title: string
      language: string
      /** la pagina che si stava guardando, da 0 */
      currentPage: number
      /** il documento ha già un formato di carta (scheda Layout) */
      paperFormat: PageFormat | null
      orientation: "portrait" | "landscape"
      hasComments: boolean
      snapshot: () => Promise<DocSnapshot>
      markdown: () => Promise<string>
      exportDocx: (filename: string, comments: boolean) => Promise<void>
      exportSvg: (filename: string) => Promise<void>
      print: () => void
    }
  | {
      kind: "board"
      title: string
      data: BoardData
      background: string
    }

type BoardSession = Awaited<ReturnType<typeof createBoardSession>>

const PAPERS: PageFormat[] = ["a4", "a5", "a3", "letter", "legal", "tabloid"]

export function ExportStudio({
  source,
  initialFormat,
  onClose,
}: {
  source: ExportStudioSource
  initialFormat: StudioFormat
  onClose: () => void
}) {
  const t = useT()
  // la sorgente resta quella dell'apertura: l'editor intanto è fermo
  const [origin] = React.useState(source)
  const isDoc = origin.kind === "doc"
  const [format, setFormat] = React.useState<StudioFormat>(() =>
    !isDoc && (initialFormat === "docx" || initialFormat === "md")
      ? "pdf"
      : initialFormat
  )
  const [markdown, setMarkdown] = React.useState<string | null>(null)
  const [session, setSession] = React.useState<ExportSession | null>(null)
  const [failure, setFailure] = React.useState<string | null>(null)
  const [paper, setPaper] = React.useState<PaperChoice>(() => ({
    format:
      origin.kind === "doc" && origin.paperFormat
        ? origin.paperFormat
        : defaultPaper(origin.kind === "doc" ? origin.language : ""),
    orientation: origin.kind === "doc" ? origin.orientation : "portrait",
  }))
  const paperKey =
    origin.kind === "doc" && !origin.paperFormat
      ? `${paper.format}:${paper.orientation}`
      : "fixed"
  const [laid, setLaid] = React.useState<{
    key: string
    layout: SessionLayout
  } | null>(null)
  const layout = laid?.key === paperKey ? laid.layout : null
  const [preview, setPreview] = React.useState<{
    key: string
    urls: Record<number, string>
  }>({ key: "", urls: {} })
  const previewUrls = preview.key === paperKey ? preview.urls : {}

  const [pagesMode, setPagesMode] = React.useState<"all" | "current" | "range">(
    "all"
  )
  const [rangeText, setRangeText] = React.useState("")
  const [quality, setQuality] = React.useState<ExportQuality>("standard")
  const [gray, setGray] = React.useState(false)
  const [selectable, setSelectable] = React.useState(true)
  const [combine, setCombine] = React.useState(false)
  const [comments, setComments] = React.useState(true)
  const [name, setName] = React.useState(() =>
    safeName(origin.title || tr("Senza titolo"))
  )
  const [progress, setProgress] = React.useState<{
    done: number
    total: number
  } | null>(null)
  const exportAbort = React.useRef<AbortController | null>(null)

  // la sessione nasce all'apertura e muore alla chiusura
  React.useEffect(() => {
    let alive = true
    let created: ExportSession | null = null
    void openSession(origin, () => alive).then(
      (s) => {
        if (!alive) return s.dispose()
        created = s
        setSession(s)
      },
      (err: unknown) => {
        if (!alive) return
        console.error(err)
        setFailure(err instanceof Error ? err.message : String(err))
      }
    )
    return () => {
      alive = false
      created?.dispose()
    }
  }, [origin])

  // impaginazione e anteprima: di nuovo quando cambia la carta
  React.useEffect(() => {
    if (!session) return
    const controller = new AbortController()
    const urls: string[] = []
    const key = paperKey
    void session
      .layout(paper)
      .then((next) => {
        if (controller.signal.aborted) return
        setLaid({ key, layout: next })
        setPreview({ key, urls: {} })
        return renderPreview(session, next, {
          width: previewWidth(),
          signal: controller.signal,
          onPage: (index, url) => {
            urls.push(url)
            setPreview((p) =>
              p.key === key ? { key, urls: { ...p.urls, [index]: url } } : p
            )
          },
        })
      })
      .catch((err: unknown) => {
        if (controller.signal.aborted) return
        console.error(err)
        setFailure(err instanceof Error ? err.message : String(err))
      })
    return () => {
      controller.abort()
      // le immagini restano visibili finché la nuova anteprima non arriva
      setTimeout(() => urls.forEach((u) => URL.revokeObjectURL(u)), 4000)
    }
  }, [session, paper, paperKey])

  // chiudendo, un'esportazione in corso si ferma
  React.useEffect(() => () => exportAbort.current?.abort(), [])

  const total = layout?.pages ?? 0
  const current = origin.kind === "doc" ? origin.currentPage : 0
  const raster = format === "pdf" || format === "png"
  const pageChoice = isDoc && raster
  const indices: number[] | null = !layout
    ? null
    : !pageChoice || pagesMode === "all"
      ? Array.from({ length: total }, (_, i) => i)
      : pagesMode === "current"
        ? [Math.min(current, total - 1)]
        : parsePageRange(rangeText, total)
  const selected = new Set(indices ?? [])
  const busy = progress !== null
  const canExport =
    !busy &&
    name.trim().length > 0 &&
    (format === "md"
      ? markdown !== null
      : format === "docx" || (format === "svg" && isDoc)
        ? true
        : !failure && Boolean(session && layout && indices?.length))

  const chooseFormat = (next: StudioFormat) => setFormat(next)

  // il Markdown si prepara la prima volta che serve
  const wantsMarkdown = format === "md"
  React.useEffect(() => {
    if (!wantsMarkdown || origin.kind !== "doc") return
    let alive = true
    void origin.markdown().then((text) => {
      if (alive) setMarkdown(text)
    })
    return () => {
      alive = false
    }
  }, [wantsMarkdown, origin])

  const start = () => {
    if (!canExport) return
    const controller = new AbortController()
    exportAbort.current = controller
    void runStudioExport({
      origin,
      session,
      layout,
      format,
      indices: indices ?? [],
      quality,
      gray,
      selectable,
      combine,
      comments,
      markdown,
      name: name.trim(),
      signal: controller.signal,
      onProgress: (done, count) => setProgress({ done, total: count }),
      onFinish: (ok) => {
        setProgress(null)
        exportAbort.current = null
        if (ok) onClose()
      },
      onHandOff: onClose,
    })
  }

  const extension =
    format === "png" && indices && indices.length > 1 && !combine
      ? "zip"
      : format
  const formats: {
    value: StudioFormat
    label: string
    hint: string
    icon: React.ReactNode
  }[] = [
    {
      value: "pdf",
      label: "PDF",
      hint: isDoc
        ? t("Pagine pronte da condividere")
        : t("Pronta da condividere"),
      icon: <FileText className="size-4" />,
    },
    {
      value: "png",
      label: "PNG",
      hint: isDoc ? t("Un'immagine per pagina") : t("Immagine"),
      icon: <FileImage className="size-4" />,
    },
    {
      value: "svg",
      label: "SVG",
      hint: isDoc ? t("Vettoriale, tutto il documento") : t("Vettoriale"),
      icon: <PenTool className="size-4" />,
    },
    ...(isDoc
      ? [
          {
            value: "docx" as const,
            label: ".docx",
            hint: t("Modificabile, con note e commenti"),
            icon: <FileType2 className="size-4" />,
          },
          {
            value: "md" as const,
            label: "Markdown",
            hint: t("Solo testo e struttura"),
            icon: <FileCode2 className="size-4" />,
          },
        ]
      : []),
  ]
  const formatName =
    format === "docx"
      ? ".docx"
      : format === "md"
        ? "Markdown"
        : format.toUpperCase()

  const summary = !layout
    ? t("Preparo l'anteprima…")
    : format === "md"
      ? t("Solo testo e struttura")
      : format === "docx"
        ? t("Si impagina nel programma che lo apre")
        : format === "svg"
          ? t("Vettoriale, tutto il documento")
          : isDoc
            ? t("{pages} · {paper} · {dpi} dpi", {
                pages:
                  (indices?.length ?? 0) === 1
                    ? t("1 pagina")
                    : t("{count} pagine", { count: indices?.length ?? 0 }),
                paper: formatLabel(paper.format, paper.orientation),
                dpi: QUALITY[quality].dpi,
              })
            : t("{width}×{height} px · {dpi} dpi", {
                width: Math.round(layout.width),
                height: Math.round(layout.height),
                dpi: QUALITY[quality].dpi,
              })

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent
        showCloseButton={false}
        className="top-0 left-0 flex h-dvh max-h-dvh w-screen max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none p-0 ring-0 sm:max-w-none"
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
          <div className="flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground">
            <Download className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-sm font-semibold">
              {t("Esporta")}
            </DialogTitle>
            <p className="truncate text-xs text-muted-foreground">
              {origin.title || t("Senza titolo")}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            aria-label={t("Chiudi")}
            onClick={onClose}
          >
            <X className="size-4" />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,42fr)_minmax(0,58fr)] md:grid-cols-[minmax(0,1fr)_340px] md:grid-rows-1">
          {/* anteprima */}
          <div
            className="relative min-h-0 overflow-y-auto bg-muted"
            aria-label={t("Anteprima")}
          >
            {format === "md" ? (
              <pre className="mx-auto my-6 max-w-3xl rounded-xl bg-background p-6 font-mono text-xs leading-relaxed whitespace-pre-wrap text-foreground shadow-sm ring-1 ring-border sm:my-10">
                {markdown}
              </pre>
            ) : failure ? (
              <div className="flex h-full flex-col items-center justify-center gap-1 p-8 text-center">
                <p className="text-sm font-medium">
                  {t("Anteprima non disponibile")}
                </p>
                <p className="max-w-sm text-xs text-muted-foreground">
                  {failure}
                </p>
              </div>
            ) : !layout ? (
              <div className="flex h-full items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" />
                {t("Preparo l'anteprima…")}
              </div>
            ) : (
              <div className="mx-auto flex max-w-[760px] flex-col items-center gap-6 px-4 py-6 sm:px-8 sm:py-10">
                {format === "docx" || format === "svg" ? (
                  <p className="w-full rounded-lg bg-background/70 px-3 py-2 text-center text-xs text-muted-foreground ring-1 ring-border">
                    {format === "docx"
                      ? t(
                          "Anteprima indicativa: il file .docx resta modificabile e si impagina nel programma che lo apre."
                        )
                      : t(
                          "L'SVG contiene tutto il documento in un'unica immagine vettoriale."
                        )}
                  </p>
                ) : null}
                {Array.from({ length: total }, (_, i) => {
                  const url = previewUrls[i]
                  const excluded = pageChoice && !selected.has(i)
                  return (
                    <figure key={i} className="w-full">
                      <div
                        className={cn(
                          "relative w-full overflow-hidden rounded-[3px] bg-white shadow-[0_1px_2px_rgba(0,0,0,0.06),0_12px_32px_-12px_rgba(0,0,0,0.18)] ring-1 ring-black/5 transition-opacity",
                          excluded && "opacity-35"
                        )}
                        style={{
                          aspectRatio: `${layout.width} / ${layout.height}`,
                        }}
                      >
                        {url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={url}
                            alt={t("Pagina {page}", { page: i + 1 })}
                            className={cn(
                              "absolute inset-0 size-full",
                              gray && raster && "grayscale"
                            )}
                            draggable={false}
                          />
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Loader2 className="size-5 animate-spin text-muted-foreground/60" />
                          </div>
                        )}
                      </div>
                      {total > 1 ? (
                        <figcaption className="mt-2 text-center text-xs text-muted-foreground tabular-nums">
                          {excluded
                            ? t("{page} · esclusa", { page: i + 1 })
                            : i + 1}
                        </figcaption>
                      ) : null}
                    </figure>
                  )
                })}
              </div>
            )}
          </div>

          {/* impostazioni */}
          <aside className="flex min-h-0 flex-col border-t border-border bg-background md:border-t-0 md:border-l">
            <div className="min-h-0 flex-1 space-y-6 overflow-y-auto p-4">
              <Section title={t("Formato")}>
                <div className="grid grid-cols-2 gap-2">
                  {formats.map((f) => (
                    <button
                      key={f.value}
                      type="button"
                      aria-pressed={format === f.value}
                      onClick={() => chooseFormat(f.value)}
                      className={cn(
                        "flex items-start gap-2 rounded-lg border px-2.5 py-2 text-left transition",
                        format === f.value
                          ? "border-primary bg-accent text-accent-foreground"
                          : "border-border hover:bg-muted"
                      )}
                    >
                      <span className="mt-0.5 shrink-0">{f.icon}</span>
                      <span className="min-w-0">
                        <span className="block text-sm font-medium">
                          {f.label}
                        </span>
                        <span className="block text-[11px] leading-snug text-muted-foreground">
                          {f.hint}
                        </span>
                      </span>
                    </button>
                  ))}
                </div>
              </Section>

              {pageChoice ? (
                <Section title={t("Pagine")}>
                  <Segmented
                    value={pagesMode}
                    onChange={setPagesMode}
                    options={[
                      { value: "all", label: t("Tutte") },
                      {
                        value: "current",
                        label: t("Corrente ({page})", {
                          page: Math.min(current, Math.max(0, total - 1)) + 1,
                        }),
                      },
                      { value: "range", label: t("Intervallo") },
                    ]}
                  />
                  {pagesMode === "range" ? (
                    <div className="space-y-1">
                      <input
                        value={rangeText}
                        onChange={(e) => setRangeText(e.target.value)}
                        placeholder={t("Es. 1-3, 5")}
                        aria-label={t("Pagine da esportare")}
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      />
                      <p
                        className={cn(
                          "text-[11px]",
                          rangeText.trim() && !indices
                            ? "text-destructive"
                            : "text-muted-foreground"
                        )}
                      >
                        {rangeText.trim() && !indices
                          ? t(
                              "Intervallo non valido: il documento ha {count} pagine.",
                              {
                                count: total,
                              }
                            )
                          : t("Numeri o intervalli separati da virgole.")}
                      </p>
                    </div>
                  ) : null}
                </Section>
              ) : null}

              {isDoc && raster && origin.kind === "doc" ? (
                <Section title={t("Carta")}>
                  {origin.paperFormat ? (
                    <p className="text-xs text-muted-foreground">
                      {formatLabel(origin.paperFormat, origin.orientation)}
                      <br />
                      {t("Si cambia in Layout › Dimensioni.")}
                    </p>
                  ) : (
                    <>
                      <select
                        value={paper.format}
                        aria-label={t("Formato della carta")}
                        onChange={(e) =>
                          setPaper((p) => ({
                            ...p,
                            format: e.target.value as PageFormat,
                          }))
                        }
                        className="h-8 w-full rounded-md border border-input bg-background px-2 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                      >
                        {PAPERS.map((p) => (
                          <option key={p} value={p}>
                            {formatLabel(p, "portrait")}
                          </option>
                        ))}
                      </select>
                      <Segmented
                        value={paper.orientation}
                        onChange={(orientation) =>
                          setPaper((p) => ({ ...p, orientation }))
                        }
                        options={[
                          { value: "portrait", label: t("Verticale") },
                          { value: "landscape", label: t("Orizzontale") },
                        ]}
                      />
                    </>
                  )}
                </Section>
              ) : null}

              {raster ? (
                <>
                  <Section title={t("Qualità")}>
                    <Segmented
                      value={quality}
                      onChange={setQuality}
                      options={[
                        {
                          value: "draft",
                          label: t("Bozza"),
                          hint: `${QUALITY.draft.dpi} dpi`,
                        },
                        {
                          value: "standard",
                          label: t("Standard"),
                          hint: `${QUALITY.standard.dpi} dpi`,
                        },
                        {
                          value: "high",
                          label: t("Alta"),
                          hint: `${QUALITY.high.dpi} dpi`,
                        },
                      ]}
                    />
                  </Section>
                  <Section title={t("Colori")}>
                    <Segmented
                      value={gray ? "gray" : "color"}
                      onChange={(v) => setGray(v === "gray")}
                      options={[
                        { value: "color", label: t("A colori") },
                        { value: "gray", label: t("Bianco e nero") },
                      ]}
                    />
                  </Section>
                </>
              ) : null}

              {(format === "pdf" && isDoc) ||
              (format === "png" && isDoc && (indices?.length ?? 0) > 1) ||
              (format === "docx" &&
                origin.kind === "doc" &&
                origin.hasComments) ? (
                <Section title={t("Opzioni")}>
                  {format === "pdf" ? (
                    <Toggle
                      checked={selectable}
                      onChange={setSelectable}
                      label={t("Testo selezionabile")}
                      hint={t("Si può cercare e copiare nel PDF")}
                    />
                  ) : null}
                  {format === "png" ? (
                    <Toggle
                      checked={combine}
                      onChange={setCombine}
                      label={t("Un'unica immagine")}
                      hint={t("Le pagine una sotto l'altra, invece di un .zip")}
                    />
                  ) : null}
                  {format === "docx" ? (
                    <Toggle
                      checked={comments}
                      onChange={setComments}
                      label={t("Includi i commenti")}
                    />
                  ) : null}
                </Section>
              ) : null}

              <Section title={t("Nome del file")}>
                <div className="flex h-8 items-center rounded-md border border-input bg-background focus-within:ring-2 focus-within:ring-ring/50">
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    aria-label={t("Nome del file")}
                    className="h-full min-w-0 flex-1 bg-transparent px-2 text-sm outline-none"
                  />
                  <span className="pr-2 text-xs text-muted-foreground">
                    .{extension}
                  </span>
                </div>
              </Section>
            </div>

            <div className="shrink-0 space-y-3 border-t border-border p-4">
              {progress ? (
                <div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                    <div
                      className="h-full rounded-full bg-primary transition-[width]"
                      style={{
                        width: `${Math.round(
                          (progress.done / Math.max(1, progress.total)) * 100
                        )}%`,
                      }}
                    />
                  </div>
                  <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {t("Pagina {page} di {total}", {
                        page: Math.min(progress.done + 1, progress.total),
                        total: progress.total,
                      })}
                    </span>
                    <button
                      type="button"
                      className="font-medium text-foreground hover:underline"
                      onClick={() => exportAbort.current?.abort()}
                    >
                      {t("Annulla")}
                    </button>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">{summary}</p>
              )}
              <div className="flex gap-2">
                {origin.kind === "doc" ? (
                  <Button
                    variant="outline"
                    disabled={busy}
                    onClick={() => {
                      onClose()
                      origin.print()
                    }}
                  >
                    <Printer className="size-4" />
                    {t("Stampa…")}
                  </Button>
                ) : null}
                <Button
                  className="flex-1"
                  disabled={!canExport}
                  onClick={start}
                >
                  {busy ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <Download className="size-4" />
                  )}
                  {t("Esporta {format}", { format: formatName })}
                </Button>
              </div>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="space-y-2">
      <h3 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </h3>
      {children}
    </section>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; hint?: string }[]
  onChange: (value: T) => void
}) {
  return (
    <div
      className="grid gap-1 rounded-lg bg-muted p-1"
      style={{
        gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))`,
      }}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          aria-pressed={value === o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "min-w-0 rounded-md px-1.5 py-1.5 text-xs transition",
            value === o.value
              ? "bg-background font-medium text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <span className="block truncate">{o.label}</span>
          {o.hint ? (
            <span className="block truncate text-[10px] text-muted-foreground">
              {o.hint}
            </span>
          ) : null}
        </button>
      ))}
    </div>
  )
}

function Toggle({
  checked,
  onChange,
  label,
  hint,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  hint?: string
}) {
  return (
    <label className="flex cursor-pointer items-start justify-between gap-3">
      <span className="min-w-0">
        <span className="block text-sm">{label}</span>
        {hint ? (
          <span className="block text-[11px] text-muted-foreground">
            {hint}
          </span>
        ) : null}
      </span>
      <Switch
        checked={checked}
        onCheckedChange={(next) => onChange(next)}
        className="mt-0.5"
      />
    </label>
  )
}

/* ------------------------- fuori dal componente ------------------------ */

function defaultPaper(language: string): PageFormat {
  // Stati Uniti e Canada usano il formato Letter
  return /^en-(US|CA)$|^es-(US|MX)$/i.test(language) ? "letter" : "a4"
}

function previewWidth() {
  const dpr = typeof window === "undefined" ? 1 : window.devicePixelRatio || 1
  return Math.min(1400, 720 * Math.min(2, dpr))
}

async function openSession(origin: ExportStudioSource, alive: () => boolean) {
  // fuori dall'effetto che la chiama: la fotografia usa flushSync, che dentro
  // un effetto di React non disegna nulla. Se intanto l'effetto è già stato
  // smontato non si fotografa niente
  await new Promise((r) => setTimeout(r, 0))
  if (!alive()) throw new DOMException("closed", "AbortError")
  if (origin.kind === "doc") {
    const snapshot = await origin.snapshot()
    return createDocSession(snapshot)
  }
  return createBoardSession({
    data: origin.data,
    background: origin.background,
  })
}

async function runStudioExport(job: {
  origin: ExportStudioSource
  session: ExportSession | null
  layout: SessionLayout | null
  format: StudioFormat
  indices: number[]
  quality: ExportQuality
  gray: boolean
  selectable: boolean
  combine: boolean
  comments: boolean
  markdown: string | null
  name: string
  signal: AbortSignal
  onProgress: (done: number, total: number) => void
  onFinish: (ok: boolean) => void
  onHandOff: () => void
}) {
  const { origin, session, layout, format, name } = job
  const label =
    format === "docx"
      ? ".docx"
      : format === "md"
        ? "Markdown"
        : format.toUpperCase()
  try {
    if (format === "docx" && origin.kind === "doc") {
      job.onHandOff()
      await origin.exportDocx(name, job.comments)
      return
    }
    if (format === "md") {
      download(
        new Blob([job.markdown ?? ""], { type: "text/markdown;charset=utf-8" }),
        `${name}.md`
      )
    } else if (format === "svg") {
      if (origin.kind === "doc") {
        job.onHandOff()
        await origin.exportSvg(name)
        return
      }
      download((session as BoardSession).svg(), `${name}.svg`)
    } else if (session && layout) {
      if (format === "pdf") {
        const blob = await exportPdf(session, layout, {
          indices: job.indices,
          quality: job.quality,
          gray: job.gray,
          selectable: job.selectable && origin.kind === "doc",
          title: origin.title || tr("Senza titolo"),
          language: origin.kind === "doc" ? origin.language : undefined,
          signal: job.signal,
          onProgress: job.onProgress,
        })
        download(blob, `${name}.pdf`)
      } else {
        const out = await exportPng(session, layout, {
          indices: job.indices,
          quality: job.quality,
          gray: job.gray,
          combine: job.combine,
          name,
          signal: job.signal,
          onProgress: job.onProgress,
        })
        download(out.blob, out.filename)
      }
    }
    toast.success(tr("Esportato in {label}", { label }))
    job.onFinish(true)
  } catch (err) {
    if (job.signal.aborted) {
      job.onFinish(false)
      return
    }
    console.error(err)
    toast.error(tr("Esportazione non riuscita"), {
      description: err instanceof Error ? err.message : undefined,
    })
    job.onFinish(false)
  }
}
