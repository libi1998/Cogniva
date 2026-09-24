"use client"

import { useT, currentRegion } from "@/lib/i18n/client"
import * as React from "react"
import { useEditorState, type Editor } from "@tiptap/react"
import { watermarkFontSize } from "@/lib/doc-design"
import { fontStack } from "@/lib/fonts"
import { getPagination } from "@/lib/pagination"
import { useAuthor } from "@/lib/author"
import {
  BAND_FIELDS,
  bandForPage,
  bandParts,
  joinBand,
} from "@/lib/header-footer"
import { cn } from "@/lib/utils"
import type { DocMargins, DocTheme, DocWatermark } from "@/lib/types"
import { useNotes } from "./footnote-node"

/** Numero di pagine e note di ogni pagina, dal motore di impaginazione */
export function usePagination(editor: Editor | null) {
  return (
    useEditorState({
      editor,
      selector: ({ editor: e }) => (e ? getPagination(e.state) : null),
    }) ?? { pages: 1, notes: [[]], noteHeights: [0] }
  )
}

/**
 * I fogli di un documento impaginato: la carta di ogni pagina, dietro al
 * testo, e sopra intestazione, piè di pagina, numero, bordo e note a piè di
 * pagina. Le altezze usano lo stesso stacco degli spaziatori, così in stampa
 * (stacco zero) i fogli si toccano esattamente come la carta.
 */
export function PageLayer({
  editor,
  theme,
  title,
  pageHeight,
  pages,
  paper,
  shadow,
  band = null,
  onBandChange,
  onBandClose,
}: {
  editor: Editor | null
  theme: DocTheme
  title: string
  pageHeight: number
  pages: number
  paper: string
  shadow: string
  /** intestazione o piè di pagina che si sta scrivendo, e su che pagina */
  band?: BandEditing | null
  onBandChange?: (where: "header" | "footer", text: string) => void
  onBandClose?: () => void
}) {
  const info = usePagination(editor)
  const notes = useNotes(editor)
  const byPos = new Map(notes.map((n) => [n.pos, n]))
  const border = pageBorderCss(theme)
  const { margins } = theme

  return (
    <>
      {Array.from({ length: pages }).map((_, i) => {
        const top = `calc(${i} * (${pageHeight}px + var(--page-gap)))`
        const pageNotes = (info.notes[i] ?? [])
          .map((pos) => byPos.get(pos))
          .filter((n): n is NonNullable<typeof n> => Boolean(n))
        const notesHeight = info.noteHeights[i] ?? 0
        return (
          <React.Fragment key={i}>
            <div
              aria-hidden
              className="absolute inset-x-0"
              style={{
                top,
                height: pageHeight,
                zIndex: -2,
                background: paper,
                borderRadius: theme.cornerRadius,
                boxShadow: shadow,
              }}
            />
            {theme.watermark ? (
              <Watermark
                watermark={theme.watermark}
                theme={theme}
                top={top}
                height={pageHeight}
              />
            ) : null}
            {/* sopra alle fasce degli spaziatori, che coprono i margini */}
            <div
              className="pointer-events-none absolute inset-x-0"
              style={{ top, height: pageHeight, zIndex: 4 }}
            >
              <PageBand
                index={i}
                pages={pages}
                top={0}
                span={pageHeight}
                theme={theme}
                title={title}
                border={border}
                margins={margins}
                hide={band && band.page === i ? band.where : null}
              />
              {band && band.page === i && onBandChange && onBandClose ? (
                <EditableBand
                  band={band}
                  theme={theme}
                  pageHeight={pageHeight}
                  onChange={onBandChange}
                  onClose={onBandClose}
                />
              ) : null}
              {pageNotes.length && editor ? (
                <div
                  className="doc-page-notes pointer-events-auto absolute overflow-hidden"
                  style={{
                    left: margins.left,
                    right: margins.right,
                    top: pageHeight - margins.bottom - notesHeight,
                    height: notesHeight,
                  }}
                >
                  <span aria-hidden className="doc-page-notes-rule" />
                  {pageNotes.map((note) => (
                    <p
                      key={note.pos}
                      className="doc-page-note"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() =>
                        editor
                          .chain()
                          .focus()
                          .setNodeSelection(note.pos)
                          .scrollIntoView()
                          .run()
                      }
                    >
                      <span className="doc-page-note-n">{note.label}</span>
                      {note.text || " "}
                    </p>
                  ))}
                </div>
              ) : null}
            </div>
          </React.Fragment>
        )
      })}
    </>
  )
}

/** Il bordo della pagina in CSS: tratto e colore */
export function pageBorderCss(theme: DocTheme) {
  const width =
    theme.pageBorder === "thin"
      ? "1px solid"
      : theme.pageBorder === "thick"
        ? "3px solid"
        : theme.pageBorder === "double"
          ? "4px double"
          : theme.pageBorder === "dashed"
            ? "1.5px dashed"
            : theme.pageBorder === "dotted"
              ? "2px dotted"
              : ""
  if (!width) return ""
  return `${width} ${theme.pageBorderColor || "var(--doc-muted)"}`
}

/**
 * Intestazione, piè di pagina, numero, bordo e filigrana di ogni pagina.
 *
 * Sono posizionati alle stesse altezze dove il browser spezza la stampa, così
 * finiscono al posto giusto sia a video sia sulla carta sia nelle esportazioni.
 */
export function PageDecor({
  theme,
  title,
  pageHeight,
  sheetHeight,
}: {
  theme: DocTheme
  title: string
  pageHeight: number
  sheetHeight: number
}) {
  const { header, footer, pageNumbers, pageBorder, margins, watermark } = theme
  if (
    !header &&
    !footer &&
    pageNumbers === "none" &&
    pageBorder === "none" &&
    !watermark
  ) {
    return null
  }
  // senza formato di carta la filigrana si ripete a ogni «schermata» di testo
  const span = pageHeight > 0 ? pageHeight : sheetHeight
  const pages = pageHeight > 0 ? Math.max(1, Math.ceil(sheetHeight / span)) : 1
  const border = pageBorderCss(theme)
  const marks =
    watermark && pageHeight <= 0
      ? Math.max(1, Math.round(sheetHeight / 1000))
      : pages

  return (
    <>
      {watermark
        ? Array.from({ length: marks }).map((_, i) => (
            <Watermark
              key={`w${i}`}
              watermark={watermark}
              theme={theme}
              top={`${(i * sheetHeight) / marks}px`}
              height={
                pageHeight > 0 ? pageHeight : Math.max(1, sheetHeight / marks)
              }
            />
          ))
        : null}
      <div className="pointer-events-none absolute inset-0 z-0">
        {Array.from({ length: pages }).map((_, i) => (
          <PageBand
            key={i}
            index={i}
            pages={pages}
            top={i * span}
            span={span}
            theme={theme}
            title={title}
            border={border}
            margins={margins}
          />
        ))}
      </div>
    </>
  )
}

/**
 * La filigrana di una pagina: sotto al testo (z-index negativo dentro al
 * foglio isolato) e sopra alla carta. Il testo si adatta alla pagina.
 */
function Watermark({
  watermark,
  theme,
  top,
  height,
}: {
  watermark: DocWatermark
  theme: DocTheme
  top: string
  height: number
}) {
  const diagonal = watermark.layout === "diagonal"
  const text = watermark.text.trim()
  return (
    <div
      aria-hidden
      data-watermark=""
      className="pointer-events-none absolute inset-x-0 flex items-center justify-center overflow-hidden select-none"
      style={{ top, height, zIndex: -1, containerType: "size" }}
    >
      {watermark.image ? (
        // eslint-disable-next-line @next/next/no-img-element -- immagine scelta da chi scrive, un data URI
        <img
          src={watermark.image}
          alt=""
          draggable={false}
          style={{
            width: `${Math.round(watermark.scale * 100)}cqw`,
            maxHeight: "90cqh",
            objectFit: "contain",
            opacity: watermark.opacity,
          }}
        />
      ) : text ? (
        <span
          style={{
            fontFamily: fontStack(
              watermark.font ?? theme.headingFont ?? theme.font
            ),
            fontWeight: 700,
            color: watermark.color,
            opacity: watermark.opacity,
            whiteSpace: "nowrap",
            lineHeight: 1,
            letterSpacing: "0.04em",
            // la diagonale di una pagina A4 è circa 1,22 volte l'altezza: il
            // testo occupa i tre quarti della linea su cui sta
            fontSize: watermarkFontSize(text, watermark.layout),
            transform: diagonal ? "rotate(-45deg)" : undefined,
          }}
        >
          {text}
        </span>
      ) : null}
    </div>
  )
}

function PageBand({
  index,
  pages,
  top,
  span,
  theme,
  title,
  border,
  margins,
  hide = null,
}: {
  index: number
  pages: number
  top: number
  span: number
  theme: DocTheme
  title: string
  border: string
  margins: DocMargins
  /** la riga che si sta scrivendo: al suo posto c'è quella modificabile */
  hide?: "header" | "footer" | null
}) {
  const author = useAuthor()
  const start = theme.pageNumberStart ?? 1
  const vars = {
    page: start + index,
    pages: start + pages - 1,
    title,
    author,
    date: new Date().toLocaleDateString(currentRegion(), {
      day: "numeric",
      month: "long",
      year: "numeric",
    }),
  }
  const header = bandForPage("header", theme, vars)
  const footer = bandForPage("footer", theme, vars)
  const { headTop, footTop } = bandTops(top, span, margins)

  return (
    <>
      {border ? (
        <div
          className="absolute rounded-[2px]"
          style={{
            top: top + 22,
            height: span - 44,
            left: 22,
            right: 22,
            border,
          }}
        />
      ) : null}
      {header && hide !== "header" ? (
        <BandRow parts={header} top={headTop} margins={margins} />
      ) : null}
      {footer && hide !== "footer" ? (
        <BandRow parts={footer} top={footTop} margins={margins} />
      ) : null}
    </>
  )
}

/** Dove stanno le righe di intestazione e piè di pagina in una pagina */
function bandTops(top: number, span: number, margins: DocMargins) {
  return {
    headTop: top + Math.max(10, margins.top / 2 - 6),
    footTop: top + span - Math.max(16, margins.bottom / 2),
  }
}

export type BandEditing = {
  where: "header" | "footer"
  /** la pagina (da 0) su cui si scrive */
  page: number
  /** la parte dove mettere il cursore: sinistra, centro, destra */
  part: 0 | 1 | 2
}

/**
 * Da dove si fa doppio clic sul foglio a cosa si modifica: il margine alto è
 * l'intestazione, quello basso il piè di pagina, come in Word. `x` e `y` sono
 * in pixel del foglio, senza zoom.
 */
export function bandAt(
  x: number,
  y: number,
  width: number,
  pageHeight: number,
  gap: number,
  margins: DocMargins
): BandEditing | null {
  if (pageHeight <= 0) return null
  const page = Math.max(0, Math.floor(y / (pageHeight + gap)))
  const inPage = y - page * (pageHeight + gap)
  if (inPage < 0 || inPage > pageHeight) return null
  const where =
    inPage < margins.top
      ? "header"
      : inPage > pageHeight - margins.bottom
        ? "footer"
        : null
  if (!where) return null
  const content = width - margins.left - margins.right
  const rel = (x - margins.left) / (content || 1)
  const part = rel < 1 / 3 ? 0 : rel < 2 / 3 ? 1 : 2
  return { where, page, part }
}

/**
 * La riga che si scrive: tre caselle (sinistra, centro, destra) al posto di
 * quella disegnata, una linea tratteggiata con il nome come in Word e i
 * campi da inserire nel punto del cursore. Vale per tutte le pagine.
 */
function EditableBand({
  band,
  theme,
  pageHeight,
  onChange,
  onClose,
}: {
  band: BandEditing
  theme: DocTheme
  pageHeight: number
  onChange: (where: "header" | "footer", text: string) => void
  onClose: () => void
}) {
  const t = useT()
  const { margins } = theme
  const text = band.where === "header" ? theme.header : theme.footer
  const parts = bandParts(text)
  const refs = [
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
    React.useRef<HTMLInputElement>(null),
  ]
  const { headTop, footTop } = bandTops(0, pageHeight, margins)
  const top = band.where === "header" ? headTop : footTop

  // il cursore va nella parte dove si è fatto doppio clic. Aperta da un
  // menu della barra, il menu che si chiude rimette il fuoco nel testo un
  // attimo dopo: per mezzo secondo il fuoco torna qui
  React.useEffect(() => {
    const input = refs[band.part].current
    if (!input) return
    input.focus({ preventScroll: true })
    const end = input.value.length
    input.setSelectionRange(end, end)
    const until = Date.now() + 500
    const onFocus = (e: FocusEvent) => {
      const target = e.target as HTMLElement | null
      if (Date.now() > until || !target?.closest(".ProseMirror")) return
      input.focus({ preventScroll: true })
    }
    document.addEventListener("focusin", onFocus)
    const stop = window.setTimeout(
      () => document.removeEventListener("focusin", onFocus),
      600
    )
    return () => {
      window.clearTimeout(stop)
      document.removeEventListener("focusin", onFocus)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- solo all'apertura
  }, [band.where, band.page, band.part])

  const write = (index: number, value: string) => {
    const next = [...parts] as [string, string, string]
    next[index] = value
    onChange(band.where, joinBand(next))
  }

  /** un campo nel punto del cursore della casella attiva */
  const insert = (token: string) => {
    const active = refs.findIndex((r) => r.current === document.activeElement)
    const index = active >= 0 ? active : band.part
    const input = refs[index].current
    if (!input) return
    const start = input.selectionStart ?? input.value.length
    const end = input.selectionEnd ?? start
    const value = input.value.slice(0, start) + token + input.value.slice(end)
    write(index, value)
    requestAnimationFrame(() => {
      input.focus({ preventScroll: true })
      input.setSelectionRange(start + token.length, start + token.length)
    })
  }

  const label = band.where === "header" ? t("Intestazione") : t("Piè di pagina")
  const lineTop =
    band.where === "header" ? margins.top - 4 : pageHeight - margins.bottom + 4

  return (
    <div
      className="pointer-events-auto"
      data-band-editor=""
      onKeyDown={(e) => {
        if (e.key === "Escape" || e.key === "Enter") {
          e.preventDefault()
          onClose()
        }
      }}
    >
      <div
        aria-hidden
        className="doc-band-line"
        style={{ top: lineTop, left: 0, right: 0 }}
      >
        <span
          className={cn(
            "doc-band-tag",
            band.where === "header" ? "top-full" : "bottom-full"
          )}
        >
          {label}
        </span>
      </div>
      <div
        role="group"
        aria-label={label}
        className="absolute grid grid-cols-3 items-center gap-2 text-[0.72em] leading-none tabular-nums"
        style={{
          top: top - 6,
          left: margins.left,
          right: margins.right,
        }}
      >
        {([0, 1, 2] as const).map((i) => (
          <input
            key={i}
            ref={refs[i]}
            value={parts[i]}
            aria-label={
              i === 0
                ? t("{band}, a sinistra", { band: label })
                : i === 1
                  ? t("{band}, al centro", { band: label })
                  : t("{band}, a destra", { band: label })
            }
            placeholder={i === band.part && !parts[i] ? t("Scrivi qui") : ""}
            onChange={(e) => write(i, e.target.value)}
            className={cn(
              "doc-band-input h-6 min-w-0 rounded-[3px] bg-transparent px-1 outline-none",
              i === 1 && "text-center",
              i === 2 && "text-right"
            )}
          />
        ))}
      </div>
      <div
        className={cn(
          "doc-band-tools absolute flex items-center gap-0.5",
          band.where === "header" ? "" : "-translate-y-full"
        )}
        style={{
          top:
            band.where === "header"
              ? margins.top + 16
              : pageHeight - margins.bottom - 16,
          right: margins.right,
        }}
        // i pulsanti non tolgono il fuoco alla casella: il campo va lì
        onMouseDown={(e) => e.preventDefault()}
      >
        {BAND_FIELDS.map((field) => (
          <button
            key={field.token}
            type="button"
            title={field.label}
            onClick={() => insert(field.token)}
            className="rounded px-1.5 py-0.5 text-[11px] hover:bg-muted"
          >
            {field.label}
          </button>
        ))}
        <button
          type="button"
          onClick={onClose}
          className="ml-1 rounded bg-primary px-2 py-0.5 text-[11px] font-medium text-primary-foreground hover:bg-primary/90"
        >
          {band.where === "header"
            ? t("Chiudi intestazione")
            : t("Chiudi piè di pagina")}
        </button>
      </div>
    </div>
  )
}

/** Una riga di intestazione o piè di pagina, in tre colonne */
function BandRow({
  parts,
  top,
  margins,
}: {
  parts: [string, string, string]
  top: number
  margins: DocMargins
}) {
  return (
    <div
      data-band=""
      className="absolute grid grid-cols-[1fr_auto_1fr] items-center gap-4 text-[0.72em] leading-none tabular-nums"
      style={{
        top,
        left: margins.left,
        right: margins.right,
        color: "var(--doc-muted)",
      }}
    >
      <span className="min-w-0 truncate">{parts[0]}</span>
      <span className="min-w-0 truncate text-center">{parts[1]}</span>
      <span className="min-w-0 truncate text-right">{parts[2]}</span>
    </div>
  )
}

/** Griglia di riferimento, mezzo centimetro, mai stampata né esportata */
export function GridOverlay() {
  return (
    <div
      data-guide
      className="pointer-events-none absolute inset-0 z-0"
      style={{
        backgroundImage:
          "linear-gradient(to right, var(--doc-border) 1px, transparent 1px), linear-gradient(to bottom, var(--doc-border) 1px, transparent 1px)",
        backgroundSize: "18.9px 18.9px",
        opacity: 0.6,
      }}
    />
  )
}

/** Linee tratteggiate che mostrano dove cadono i salti pagina */
export function PageGuides({ pageHeight }: { pageHeight: number }) {
  const t = useT()
  const ref = React.useRef<HTMLDivElement>(null)
  const [count, setCount] = React.useState(0)

  React.useEffect(() => {
    const el = ref.current?.parentElement
    if (!el) return
    const update = () =>
      setCount(Math.max(0, Math.ceil(el.scrollHeight / pageHeight) - 1))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [pageHeight])

  return (
    <div
      ref={ref}
      data-guide
      className="pointer-events-none absolute inset-0 z-0"
    >
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className="absolute right-0 left-0 border-t border-dashed"
          style={{
            top: (i + 1) * pageHeight,
            borderColor: "var(--doc-border)",
          }}
        >
          <span
            className="absolute top-1 right-1 text-[9px]"
            style={{ color: "var(--doc-muted)" }}
          >
            {t("pagina {page}", { page: i + 2 })}
          </span>
        </div>
      ))}
    </div>
  )
}
